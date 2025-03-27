const axios = require('axios');
const log = require('electron-log');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

/**
 * 歌詞搜索服務
 * 支持從多個來源獲取歌詞
 */
class LyricsService {
  constructor(options = {}) {
    this.options = {
      // API金鑰設定
      apiKeys: options.apiKeys || {
        openai: '',
        genius: '',
        musixmatch: '',
        google: '' // 新增Google API金鑰
      },
      searchEngineId: options.searchEngineId || '', // 新增Google搜尋引擎ID
      // 默認語言
      defaultLanguage: options.defaultLanguage || 'zh-TW',
      // 是否啟用緩存
      cacheEnabled: options.cacheEnabled !== undefined ? options.cacheEnabled : true,
      // 緩存路徑
      cachePath: options.cachePath || path.join(app.getPath('userData'), 'cache', 'lyrics'),
      // 歌詞來源優先順序
      sourcesPriority: options.sourcesPriority || ['google', 'netease', 'kkbox', 'genius', 'musixmatch', 'mojim'],
      // 是否使用AI
      useLLM: false, // 禁用AI搜尋
      // 超時設置
      timeout: options.timeout || 10000,
      // 重試設置
      retryCount: options.retryCount || 3,
      retryDelay: options.retryDelay || 1000,
      // 代理設置
      proxy: options.proxy || null,
      // AI語言模型設置 (將被忽略)
      llmSettings: {
        model: options.llmSettings?.model || 'gpt-4o-mini',
        temperature: options.llmSettings?.temperature || 0.7,
        maxTokens: options.llmSettings?.maxTokens || 2048
      },
      // API端點
      endpoints: {
        genius: 'https://api.genius.com',
        musixmatch: 'https://api.musixmatch.com/ws/1.1',
        google: 'https://www.googleapis.com/customsearch/v1' // https://customsearch.googleapis.com
      }
    };
    
    // 確保緩存目錄存在
    if (this.options.cacheEnabled) {
      try {
        if (!fs.existsSync(this.options.cachePath)) {
          fs.mkdirSync(this.options.cachePath, { recursive: true });
        }
        console.log('歌詞緩存目錄:', this.options.cachePath);
      } catch (error) {
        console.error('創建緩存目錄失敗:', error);
        this.options.cacheEnabled = false;
      }
    }
    
    // 初始化緩存
    this.cache = {
      search: new Map(),
      lyrics: new Map()
    };
    
    // 創建帶有適當配置的HTTP客戶端
    this.httpClient = axios.create({
      timeout: this.options.timeout
    });
    
    // 設置代理
    if (this.options.proxy) {
      this.httpClient.defaults.proxy = this.options.proxy;
    }
    
    // 使用請求計數
    this.apiUsage = {
      openai: {
        requests: 0,
        lastUsed: null,
        usageHistory: []
      },
      google: {
        requests: 0,
        lastUsed: null,
        usageHistory: []
      },
      genius: {
        requests: 0,
        lastUsed: null,
        usageHistory: []
      },
      musixmatch: {
        requests: 0,
        lastUsed: null,
        usageHistory: []
      }
    };
    
    // 加載緩存
    this._loadCache();
    
    console.log('歌詞服務已初始化', {
      cacheEnabled: this.options.cacheEnabled,
      defaultLanguage: this.options.defaultLanguage,
      sourcesPriority: this.options.sourcesPriority,
      useLLM: this.options.useLLM
    });
  }
  
  /**
   * 加載緩存文件
   * @private
   */
  _loadCache() {
    if (!this.options.cacheEnabled) return;
    
    try {
      const cachePath = this.options.cachePath;
      
      // 確保緩存目錄存在
      if (!fs.existsSync(cachePath)) {
        fs.mkdirSync(cachePath, { recursive: true });
        log.info(`創建歌詞緩存目錄: ${cachePath}`);
        return; // 新目錄，無需加載任何內容
      }
      
      // 嘗試讀取搜索結果緩存
      const searchCachePath = path.join(cachePath, 'search_cache.json');
      if (fs.existsSync(searchCachePath)) {
        try {
          const searchCacheData = fs.readFileSync(searchCachePath, 'utf8');
          const searchCache = JSON.parse(searchCacheData);
          
          // 轉換回Map格式
          Object.keys(searchCache).forEach(key => {
            this.cache.search.set(key, searchCache[key]);
          });
          
          log.info(`已加載 ${this.cache.search.size} 條搜索緩存`);
        } catch (error) {
          log.warn('加載搜索緩存失敗:', error.message);
        }
      }
      
      // 嘗試讀取歌詞內容緩存
      const lyricsCachePath = path.join(cachePath, 'lyrics_cache.json');
      if (fs.existsSync(lyricsCachePath)) {
        try {
          const lyricsCacheData = fs.readFileSync(lyricsCachePath, 'utf8');
          const lyricsCache = JSON.parse(lyricsCacheData);
          
          // 轉換回Map格式
          Object.keys(lyricsCache).forEach(key => {
            this.cache.lyrics.set(key, lyricsCache[key]);
          });
          
          log.info(`已加載 ${this.cache.lyrics.size} 條歌詞緩存`);
        } catch (error) {
          log.warn('加載歌詞緩存失敗:', error.message);
        }
      }
    } catch (error) {
      log.error('加載緩存時出錯:', error);
    }
  }
  
  /**
   * 保存緩存到文件
   * @private
   */
  _saveCache() {
    if (!this.options.cacheEnabled) return;
    
    try {
      const cachePath = this.options.cachePath;
      
      // 確保緩存目錄存在
      if (!fs.existsSync(cachePath)) {
        fs.mkdirSync(cachePath, { recursive: true });
      }
      
      // 將搜索緩存保存為JSON文件
      const searchCachePath = path.join(cachePath, 'search_cache.json');
      const searchCacheObj = {};
      this.cache.search.forEach((value, key) => {
        searchCacheObj[key] = value;
      });
      fs.writeFileSync(searchCachePath, JSON.stringify(searchCacheObj, null, 2));
      
      // 將歌詞緩存保存為JSON文件
      const lyricsCachePath = path.join(cachePath, 'lyrics_cache.json');
      const lyricsCacheObj = {};
      this.cache.lyrics.forEach((value, key) => {
        lyricsCacheObj[key] = value;
      });
      fs.writeFileSync(lyricsCachePath, JSON.stringify(lyricsCacheObj, null, 2));
      
      log.info('歌詞緩存已保存到文件');
    } catch (error) {
      log.error('保存緩存到文件失敗:', error);
    }
  }
  
  /**
   * 更新配置選項
   * @param {Object} options - 新的配置選項
   */
  updateOptions(options) {
    // 更新API金鑰
    if (options.apiKeys) {
      this.options.apiKeys = { ...this.options.apiKeys, ...options.apiKeys };
    }
    
    // 更新搜尋引擎ID
    if (options.searchEngineId) {
      this.options.searchEngineId = options.searchEngineId;
    }
    
    // 更新其他選項
    if (options.defaultLanguage) {
      this.options.defaultLanguage = options.defaultLanguage;
    }
    
    if (options.sourcesPriority) {
      this.options.sourcesPriority = options.sourcesPriority;
    }
    
    // 鎖定useLLM為false
    this.options.useLLM = false;
    
    if (options.timeout) {
      this.options.timeout = options.timeout;
      this.httpClient.defaults.timeout = this.options.timeout;
    }
    
    if (options.proxy) {
      this.options.proxy = options.proxy;
      this.httpClient.defaults.proxy = this.options.proxy;
    }
    
    console.log('歌詞服務選項已更新', {
      apiKeys: Object.keys(this.options.apiKeys),
      defaultLanguage: this.options.defaultLanguage,
      sourcesPriority: this.options.sourcesPriority,
      useLLM: this.options.useLLM
    });
  }
  
  /**
   * 搜索歌詞
   * @param {Object} query - 搜索查詢
   * @param {Function} progressCallback - 進度回調函數
   * @returns {Promise<Array>} 搜索結果
   */
  async searchLyrics(query, progressCallback) {
    // 驗證搜索參數
    if (!query || (!query.title && !query.artist)) {
      throw new Error('缺少搜索參數');
    }
    
    // 為了簡化，我們將所有搜索參數轉換為字符串
    const normalizedQuery = {
      title: String(query.title || ''),
      artist: String(query.artist || ''),
      language: query.language || this._detectLanguage(query.title, query.artist)
    };
    
    // 生成緩存鍵
    const cacheKey = `${normalizedQuery.title}|${normalizedQuery.artist}`;
    
    // 檢查緩存
    if (this.options.cacheEnabled && this.cache.search.has(cacheKey)) {
      return this.cache.search.get(cacheKey);
    }
    
    try {
      // 報告進度
      if (typeof progressCallback === 'function') {
        progressCallback({ status: 'started', message: '開始搜索歌詞...' });
      }
      
      let results = [];
      
      // 按優先順序嘗試不同的搜索源
      for (const source of this.options.sourcesPriority) {
        if (typeof progressCallback === 'function') {
          progressCallback({ 
            status: 'searching', 
            source, 
            message: `正在使用 ${this._getSourceName(source)} 搜索...` 
          });
        }
        
        let sourceResults = [];
        
        switch (source) {
          case 'google':
            sourceResults = await this._searchGoogle(normalizedQuery);
            break;
          case 'netease':
            sourceResults = await this._searchNetease(normalizedQuery);
            break;
          case 'kkbox':
            sourceResults = await this._searchKKBOX(normalizedQuery);
            break;
          case 'genius':
            sourceResults = await this._searchGenius(normalizedQuery);
            break;
          case 'musixmatch':
            sourceResults = await this._searchMusixmatch(normalizedQuery);
            break;
          case 'mojim':
            sourceResults = await this._searchMojim(normalizedQuery);
            break;
          default:
            console.log(`跳過未知的歌詞来源: ${source}`);
            continue;
        }
        
        // 將結果添加到總結果中
        if (sourceResults.length > 0) {
          results = [...results, ...sourceResults];
          
          // 如果已經找到足夠的結果，可以停止進一步搜索
          if (results.length >= 10) {
            break;
          }
        }
      }
      
      // 報告進度
      if (typeof progressCallback === 'function') {
        progressCallback({ 
          status: 'completed', 
          resultsCount: results.length,
          message: `找到 ${results.length} 個搜索結果` 
        });
      }
      
      // 根據相關性對結果排序
      results = this._rankSearchResults(results, normalizedQuery);
      
      // 緩存結果
      if (this.options.cacheEnabled) {
        this.cache.search.set(cacheKey, results);
        // 保存緩存到文件
        this._saveCache();
      }
      
      return results;
    } catch (error) {
      // 報告錯誤
      if (typeof progressCallback === 'function') {
        progressCallback({ 
          status: 'error', 
          error: error.message,
          message: `搜索錯誤: ${error.message}` 
        });
      }
      
      log.error('搜索歌詞時出錯:', error);
      throw error;
    }
  }
  
  /**
   * 獲取歌詞內容
   * @param {Object} lyricInfo - 歌詞信息
   * @returns {Promise<Object>} 歌詞內容
   */
  async getLyrics(lyricInfo) {
    // 檢查緩存
    if (this.options.cacheEnabled && this.cache.lyrics.has(lyricInfo.id)) {
      return this.cache.lyrics.get(lyricInfo.id);
    }
    
    let lyrics = null;
    
    try {
      switch (lyricInfo.source) {
        case 'google':
          lyrics = await this._getLyricsFromGoogle(lyricInfo);
          break;
        case 'netease':
          lyrics = await this._getLyricsFromNetease(lyricInfo);
          break;
        case 'kkbox':
          lyrics = await this._getLyricsFromKKBOX(lyricInfo);
          break;
        case 'genius':
          lyrics = await this._getLyricsFromGenius(lyricInfo);
          break;
        case 'musixmatch':
          lyrics = await this._getLyricsFromMusixmatch(lyricInfo);
          break;
        case 'mojim':
          lyrics = await this._getLyricsFromMojim(lyricInfo);
          break;
        default:
          throw new Error(`不支持的歌詞來源: ${lyricInfo.source}`);
      }
      
      // 處理歌詞格式
      if (lyrics) {
        lyrics = this._processLyrics(lyrics, lyricInfo);
        
        // 緩存結果
        if (this.options.cacheEnabled) {
          this.cache.lyrics.set(lyricInfo.id, lyrics);
          // 保存緩存到文件
          this._saveCache();
        }
      }
      
      return lyrics;
    } catch (error) {
      log.error(`獲取歌詞錯誤: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        source: lyricInfo.source,
        id: lyricInfo.id
      };
    }
  }
  
  /**
   * 生成緩存鍵
   * @param {Object} query - 搜索查詢
   * @returns {string} 緩存鍵
   * @private
   */
  _generateCacheKey(query) {
    const key = {
      title: query.title || '',
      artist: query.artist || '',
      album: query.album || '',
      language: query.language || this.options.defaultLanguage
    };
    
    return JSON.stringify(key);
  }
  
  /**
   * 去除重複結果
   * @param {Array} results - 所有搜索結果
   * @returns {Array} 去重後的結果
   * @private
   */
  _deduplicateResults(results) {
    const seen = new Set();
    return results.filter(item => {
      // 創建唯一鍵
      const key = `${item.title}-${item.artist}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  /**
   * 對結果進行排序
   * @param {Array} results - 搜索結果
   * @param {Object} query - 原始搜索查詢
   * @returns {Array} 排序後的結果
   * @private
   */
  _rankResults(results, query) {
    return results.sort((a, b) => {
      // 計算相關性得分
      const scoreA = this._calculateRelevanceScore(a, query);
      const scoreB = this._calculateRelevanceScore(b, query);
      
      return scoreB - scoreA;
    });
  }
  
  /**
   * 計算相關性得分
   * @param {Object} result - 單個結果
   * @param {Object} query - 搜索查詢
   * @returns {number} 相關性得分
   * @private
   */
  _calculateRelevanceScore(result, query) {
    let score = 0;
    
    // 標題匹配度
    if (result.title && query.title) {
      if (result.title.toLowerCase() === query.title.toLowerCase()) {
        score += 10;
      } else if (result.title.toLowerCase().includes(query.title.toLowerCase())) {
        score += 5;
      }
    }
    
    // 藝人匹配度
    if (result.artist && query.artist) {
      if (result.artist.toLowerCase() === query.artist.toLowerCase()) {
        score += 8;
      } else if (result.artist.toLowerCase().includes(query.artist.toLowerCase())) {
        score += 4;
      }
    }
    
    // 專輯匹配度
    if (result.album && query.album) {
      if (result.album.toLowerCase() === query.album.toLowerCase()) {
        score += 3;
      } else if (result.album.toLowerCase().includes(query.album.toLowerCase())) {
        score += 1;
      }
    }
    
    // 語言匹配度
    if (result.language && query.language) {
      if (result.language === query.language) {
        score += 2;
      }
    }
    
    // 根據來源調整分數
    const sourceIndex = this.options.sourcesPriority.indexOf(result.source);
    if (sourceIndex >= 0) {
      // 根據來源優先級加分
      score += (this.options.sourcesPriority.length - sourceIndex) / 2;
    }
    
    return score;
  }
  
  /**
   * 處理歌詞格式
   * @param {Object} lyrics - 原始歌詞數據
   * @param {Object} lyricInfo - 歌詞信息
   * @returns {Object} 處理後的歌詞
   * @private
   */
  _processLyrics(lyrics, lyricInfo) {
    if (!lyrics || !lyrics.text) {
      return lyrics;
    }
    
    // 清理歌詞文本
    let text = lyrics.text;
    
    // 移除時間標記 [00:00.00]
    text = text.replace(/\[\d+:\d+\.\d+\]/g, '');
    
    // 移除多餘的標點符號和特殊字符
    text = text.replace(/\[.*?\]/g, ''); // 移除方括號內容
    text = text.replace(/『|』|「|」|《|》|〈|〉|【|】|（|）|\(|\)|\{|\}/g, ''); // 移除各種括號
    
    // 清理多餘空行
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // 分段
    const paragraphs = this._splitIntoParagraphs(text);
    
    // 生成段落類型
    const paragraphsWithTypes = paragraphs.map(paragraph => {
      return {
        text: paragraph,
        type: this._detectParagraphType(paragraph)
      };
    });
    
    // 更新歌詞對象
    lyrics.processedText = text;
    lyrics.paragraphs = paragraphsWithTypes;
    
    return lyrics;
  }
  
  /**
   * 將歌詞文本分割為段落
   * @param {string} text - 歌詞文本
   * @returns {Array} 段落數組
   * @private
   */
  _splitIntoParagraphs(text) {
    // 移除頭尾空白
    text = text.trim();
    
    // 使用正則表達式分割段落
    // 根據連續兩個以上的換行符分割
    const rawParagraphs = text.split(/\n\s*\n+/);
    
    // 處理每個段落，移除時間標記等
    return rawParagraphs.map((paragraph, index) => {
      // 移除時間標記 [00:00.00]
      const cleanText = paragraph.replace(/\[\d+:\d+\.\d+\]/g, '').trim();
      
      // 如果段落為空，跳過
      if (!cleanText) {
        return null;
      }
      
      return {
        id: `p${index}`,
        text: cleanText,
        type: this._detectParagraphType(cleanText)
      };
    }).filter(Boolean); // 過濾空段落
  }
  
  /**
   * 檢測段落類型
   * @param {string} text - 段落文本
   * @returns {string} 段落類型
   * @private
   */
  _detectParagraphType(text) {
    // 分析段落特徵
    if (text.includes(':') && (text.toLowerCase().includes('composer') || text.toLowerCase().includes('作曲'))) {
      return 'metadata';
    }
    
    if (text.toLowerCase().includes('chorus') || text.toLowerCase().includes('verse') || 
        text.includes('副歌') || text.includes('主歌')) {
      return 'section';
    }
    
    if (text.toLowerCase().includes('repeat') || text.includes('重複')) {
      return 'instruction';
    }
    
    // 默認為普通歌詞段落
    return 'lyrics';
  }
  
  /**
   * 檢測語言
   * @param {string} title - 歌曲標題
   * @param {string} artist - 藝人名稱
   * @returns {string} 語言代碼
   * @private
   */
  _detectLanguage(title, artist) {
    // 簡易語言檢測邏輯
    // 檢查是否含有中文字符
    const hasChinese = /[\u4e00-\u9fa5]/.test(title) || /[\u4e00-\u9fa5]/.test(artist);
    
    if (hasChinese) {
      return 'zh-TW'; // 默認繁體中文
    }
    
    // 檢查是否含有日文字符
    const hasJapanese = /[\u3040-\u30ff]/.test(title) || /[\u3040-\u30ff]/.test(artist);
    
    if (hasJapanese) {
      return 'ja';
    }
    
    // 檢查是否含有韓文字符
    const hasKorean = /[\uac00-\ud7a3]/.test(title) || /[\uac00-\ud7a3]/.test(artist);
    
    if (hasKorean) {
      return 'ko';
    }
    
    // 默認英文
    return 'en';
  }
  
  // 以下實現各個歌詞來源的搜索和獲取方法
  
  /**
   * 從網易雲音樂搜索歌詞
   * @param {Object} query - 搜索查詢
   * @returns {Promise<Array>} 搜索結果
   * @private
   */
  async _searchNetease(query) {
    try {
      // 構建搜索關鍵詞
      let keywords = query.title;
      if (query.artist) {
        keywords += ` ${query.artist}`;
      }
      
      // 使用非官方API
      const response = await this.httpClient.get(`https://netease-cloud-music-api-psi-sandy.vercel.app/search?keywords=${encodeURIComponent(keywords)}&limit=10`);
      
      if (response.data && response.data.result && response.data.result.songs) {
        return response.data.result.songs.map(song => ({
          id: song.id.toString(),
          title: song.name,
          artist: song.artists.map(artist => artist.name).join(', '),
          album: song.album.name,
          source: 'netease',
          language: this._detectLanguage(song.name, song.artists[0].name),
          sourceUrl: `https://music.163.com/#/song?id=${song.id}`,
          albumArt: song.album.picUrl
        }));
      }
      
      return [];
    } catch (error) {
      log.error('網易雲音樂搜索錯誤:', error);
      return [];
    }
  }
  
  /**
   * 從網易雲音樂獲取歌詞
   * @param {Object} lyricInfo - 歌詞信息
   * @returns {Promise<Object>} 歌詞內容
   * @private
   */
  async _getLyricsFromNetease(lyricInfo) {
    try {
      const response = await this.httpClient.get(`https://netease-cloud-music-api-psi-sandy.vercel.app/lyric?id=${lyricInfo.id}`);
      
      if (response.data && response.data.lrc) {
        return {
          success: true,
          source: 'netease',
          id: lyricInfo.id,
          title: lyricInfo.title,
          artist: lyricInfo.artist,
          album: lyricInfo.album,
          text: response.data.lrc.lyric,
          tlyric: response.data.tlyric ? response.data.tlyric.lyric : null, // 翻譯歌詞
          sourceUrl: lyricInfo.sourceUrl
        };
      } else {
        throw new Error('無法獲取歌詞數據');
      }
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 從KKBOX搜索歌詞
   * @param {Object} query - 搜索查詢
   * @returns {Promise<Array>} 搜索結果
   * @private
   */
  async _searchKKBOX(query) {
    try {
      // 構建搜索關鍵詞
      let keywords = query.title;
      if (query.artist) {
        keywords += ` ${query.artist}`;
      }
      
      // 使用KKBOX搜索頁面進行爬蟲
      const response = await this.httpClient.get(`https://www.kkbox.com/tw/tc/search.php?word=${encodeURIComponent(keywords)}`);
      
      const $ = cheerio.load(response.data);
      const results = [];
      
      // 解析搜索結果
      $('.search-song-list .song-list-row').each((index, element) => {
        const $element = $(element);
        const $title = $element.find('.song-title');
        const $artist = $element.find('.song-artist');
        const $album = $element.find('.song-album');
        
        // 提取ID
        const songHref = $title.find('a').attr('href');
        const idMatch = songHref ? songHref.match(/\/song\/([^\/]+)/) : null;
        const id = idMatch ? idMatch[1] : null;
        
        if (id) {
          results.push({
            id,
            title: $title.text().trim(),
            artist: $artist.text().trim(),
            album: $album.text().trim(),
            source: 'kkbox',
            language: this._detectLanguage($title.text().trim(), $artist.text().trim()),
            sourceUrl: `https://www.kkbox.com${songHref}`,
            albumArt: $element.find('.song-cover img').attr('src')
          });
        }
      });
      
      return results;
    } catch (error) {
      log.error('KKBOX搜索錯誤:', error);
      return [];
    }
  }
  
  /**
   * 從KKBOX獲取歌詞
   * @param {Object} lyricInfo - 歌詞信息
   * @returns {Promise<Object>} 歌詞內容
   * @private
   */
  async _getLyricsFromKKBOX(lyricInfo) {
    try {
      // 訪問歌曲頁面
      const response = await this.httpClient.get(lyricInfo.sourceUrl);
      
      const $ = cheerio.load(response.data);
      let lyrics = '';
      
      // 提取歌詞
      $('.lyrics p').each((index, element) => {
        lyrics += $(element).text() + '\n\n';
      });
      
      if (lyrics) {
        return {
          success: true,
          source: 'kkbox',
          id: lyricInfo.id,
          title: lyricInfo.title,
          artist: lyricInfo.artist,
          album: lyricInfo.album,
          text: lyrics.trim(),
          sourceUrl: lyricInfo.sourceUrl
        };
      } else {
        throw new Error('無法獲取歌詞數據');
      }
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 從Genius搜索歌詞
   * @param {Object} query - 搜索查詢
   * @returns {Promise<Array>} 搜索結果
   * @private
   */
  async _searchGenius(query) {
    try {
      // 檢查API金鑰
      if (!this.options.apiKeys.genius) {
        log.warn('缺少Genius API金鑰，跳過搜索');
        return [];
      }
      
      // 構建搜索關鍵詞
      let q = query.title;
      if (query.artist) {
        q += ` ${query.artist}`;
      }
      
      // 使用Genius API
      const response = await this.httpClient.get('https://api.genius.com/search', {
        params: { q },
        headers: {
          'Authorization': `Bearer ${this.options.apiKeys.genius}`
        }
      });
      
      if (response.data && response.data.response && response.data.response.hits) {
        return response.data.response.hits
          .filter(hit => hit.type === 'song')
          .map(hit => {
            const song = hit.result;
            return {
              id: song.id.toString(),
              title: song.title,
              artist: song.primary_artist.name,
              album: song.album ? song.album.name : '',
              source: 'genius',
              language: this._detectLanguage(song.title, song.primary_artist.name),
              sourceUrl: song.url,
              albumArt: song.song_art_image_thumbnail_url
            };
          });
      }
      
      return [];
    } catch (error) {
      log.error('Genius搜索錯誤:', error);
      return [];
    }
  }
  
  /**
   * 從Genius獲取歌詞
   * @param {Object} lyricInfo - 歌詞信息
   * @returns {Promise<Object>} 歌詞內容
   * @private
   */
  async _getLyricsFromGenius(lyricInfo) {
    try {
      // 訪問歌詞頁面
      const response = await this.httpClient.get(lyricInfo.sourceUrl);
      
      const $ = cheerio.load(response.data);
      let lyrics = '';
      
      // 提取歌詞
      // Genius歌詞在div[data-lyrics-container="true"]中
      $('div[data-lyrics-container="true"]').each((index, element) => {
        const html = $(element).html();
        // 處理<br>標籤
        const text = html.replace(/<br\s*\/?>/g, '\n');
        // 移除其他HTML標籤
        const plainText = $('<div>').html(text).text();
        lyrics += plainText + '\n\n';
      });
      
      if (lyrics) {
        return {
          success: true,
          source: 'genius',
          id: lyricInfo.id,
          title: lyricInfo.title,
          artist: lyricInfo.artist,
          album: lyricInfo.album,
          text: lyrics.trim(),
          sourceUrl: lyricInfo.sourceUrl
        };
      } else {
        throw new Error('無法獲取歌詞數據');
      }
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 從Musixmatch搜索歌詞
   * @param {Object} query - 搜索查詢
   * @returns {Promise<Array>} 搜索結果
   * @private
   */
  async _searchMusixmatch(query) {
    try {
      // 檢查API金鑰
      if (!this.options.apiKeys.musixmatch) {
        log.warn('缺少Musixmatch API金鑰，跳過搜索');
        return [];
      }
      
      // 構建搜索關鍵詞
      const q_track = query.title;
      const q_artist = query.artist || '';
      
      // 使用Musixmatch API
      const response = await this.httpClient.get('https://api.musixmatch.com/ws/1.1/track.search', {
        params: {
          q_track,
          q_artist,
          page_size: 10,
          page: 1,
          s_track_rating: 'desc',
          apikey: this.options.apiKeys.musixmatch
        }
      });
      
      if (response.data && 
          response.data.message && 
          response.data.message.body && 
          response.data.message.body.track_list) {
        
        return response.data.message.body.track_list.map(item => {
          const track = item.track;
          return {
            id: track.track_id.toString(),
            title: track.track_name,
            artist: track.artist_name,
            album: track.album_name,
            source: 'musixmatch',
            language: track.primary_genres.music_genre_list.length > 0 ? 
                      this._mapMusixmatchGenreToLanguage(track.primary_genres.music_genre_list[0].music_genre.music_genre_name) : 
                      this._detectLanguage(track.track_name, track.artist_name),
            sourceUrl: `https://www.musixmatch.com/lyrics/${encodeURIComponent(track.artist_name.replace(/ /g, '-'))}/${encodeURIComponent(track.track_name.replace(/ /g, '-'))}`,
            hasLyrics: track.has_lyrics === 1
          };
        });
      }
      
      return [];
    } catch (error) {
      log.error('Musixmatch搜索錯誤:', error);
      return [];
    }
  }
  
  /**
   * 將Musixmatch流派映射到語言
   * @param {string} genre - 流派名稱
   * @returns {string} 語言代碼
   * @private
   */
  _mapMusixmatchGenreToLanguage(genre) {
    if (!genre) return 'en';
    
    const genreLower = genre.toLowerCase();
    
    if (genreLower.includes('chinese') || genreLower.includes('mandarin') || genreLower.includes('cantopop')) {
      return 'zh-TW';
    }
    
    if (genreLower.includes('j-pop') || genreLower.includes('japanese')) {
      return 'ja';
    }
    
    if (genreLower.includes('k-pop') || genreLower.includes('korean')) {
      return 'ko';
    }
    
    return 'en';
  }
  
  /**
   * 從Musixmatch獲取歌詞
   * @param {Object} lyricInfo - 歌詞信息
   * @returns {Promise<Object>} 歌詞內容
   * @private
   */
  async _getLyricsFromMusixmatch(lyricInfo) {
    try {
      // 檢查API金鑰
      if (!this.options.apiKeys.musixmatch) {
        throw new Error('缺少Musixmatch API金鑰');
      }
      
      // 獲取歌詞
      const response = await this.httpClient.get('https://api.musixmatch.com/ws/1.1/track.lyrics.get', {
        params: {
          track_id: lyricInfo.id,
          apikey: this.options.apiKeys.musixmatch
        }
      });
      
      if (response.data && 
          response.data.message && 
          response.data.message.body && 
          response.data.message.body.lyrics) {
        
        const lyrics = response.data.message.body.lyrics;
        
        // 如果歌詞需要付費訪問
        if (lyrics.restricted === 1) {
          throw new Error('該歌詞需要付費訪問');
        }
        
        return {
          success: true,
          source: 'musixmatch',
          id: lyricInfo.id,
          title: lyricInfo.title,
          artist: lyricInfo.artist,
          album: lyricInfo.album,
          text: lyrics.lyrics_body,
          copyright: lyrics.lyrics_copyright,
          sourceUrl: lyricInfo.sourceUrl
        };
      } else {
        throw new Error('無法獲取歌詞數據');
      }
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 從魔鏡歌詞網搜索歌詞
   * @param {Object} query - 搜索查詢
   * @returns {Promise<Array>} 搜索結果
   * @private
   */
  async _searchMojim(query) {
    try {
      // 構建搜索關鍵詞
      let keywords = query.title;
      if (query.artist) {
        keywords += ` ${query.artist}`;
      }
      
      // 使用魔鏡歌詞網搜索頁面進行爬蟲
      const response = await this.httpClient.get(`https://mojim.com/twznamesearch.htm?k=${encodeURIComponent(keywords)}&c=3`);
      
      const $ = cheerio.load(response.data);
      const results = [];
      
      // 解析搜索結果
      $('.sk2').each((index, element) => {
        const $element = $(element);
        const $link = $element.find('a');
        
        if ($link.length > 0) {
          const href = $link.attr('href');
          const fullTitle = $link.text().trim();
          
          // 嘗試從標題中分離歌曲和藝人
          const titleParts = fullTitle.split('-').map(part => part.trim());
          let title, artist;
          
          if (titleParts.length > 1) {
            // 通常格式為 "藝人 - 歌曲"
            artist = titleParts[0];
            title = titleParts.slice(1).join(' - '); // 歌名可能包含 "-"
          } else {
            title = fullTitle;
            artist = '';
          }
          
          // 從URL中提取ID
          const idMatch = href.match(/\/song\/([^\/]+)\.htm/);
          const id = idMatch ? idMatch[1] : null;
          
          if (id) {
            results.push({
              id,
              title,
              artist,
              album: '',
              source: 'mojim',
              language: 'zh-TW', // 魔鏡主要為中文歌詞
              sourceUrl: `https://mojim.com${href}`
            });
          }
        }
      });
      
      return results;
    } catch (error) {
      log.error('魔鏡歌詞網搜索錯誤:', error);
      return [];
    }
  }
  
  /**
   * 從魔鏡歌詞網獲取歌詞
   * @param {Object} lyricInfo - 歌詞信息
   * @returns {Promise<Object>} 歌詞內容
   * @private
   */
  async _getLyricsFromMojim(lyricInfo) {
    try {
      // 訪問歌詞頁面
      const response = await this.httpClient.get(lyricInfo.sourceUrl);
      
      const $ = cheerio.load(response.data);
      let lyrics = '';
      
      // 提取歌詞
      // 魔鏡歌詞網的歌詞通常在#fsZx1或#fsZx2中
      const lyricsDiv = $('#fsZx1, #fsZx2');
      
      if (lyricsDiv.length > 0) {
        // 獲取歌詞區域的所有文本，處理換行
        lyrics = lyricsDiv.html()
          .replace(/<br\s*\/?>/gi, '\n') // 將<br>替換為換行
          .replace(/<\/div>/gi, '\n') // 將</div>替換為換行
          .replace(/<[^>]*>/g, ''); // 移除其他標籤
        
        // 清理歌詞
        lyrics = lyrics
          .replace(/\[.*?\]/g, '') // 移除如 [00:00.00] 的時間標記
          .replace(/●.*?\n/g, '') // 移除註釋行
          .replace(/※.*?\n/g, '') // 移除註釋行
          .replace(/\n{3,}/g, '\n\n'); // 將三個以上連續換行替換為兩個換行
        
        return {
          success: true,
          source: 'mojim',
          id: lyricInfo.id,
          title: lyricInfo.title,
          artist: lyricInfo.artist,
          album: lyricInfo.album,
          text: lyrics.trim(),
          sourceUrl: lyricInfo.sourceUrl
        };
      } else {
        throw new Error('無法獲取歌詞數據');
      }
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 從Google Custom Search搜索歌詞
   * @param {Object} query - 搜索查詢
   * @returns {Promise<Array>} 搜索結果
   * @private
   */
  async _searchGoogle(query) {
    try {
      // 檢查API金鑰和搜尋引擎ID
      if (!this.options.apiKeys.google || !this.options.searchEngineId) {
        log.warn('缺少Google API金鑰或搜尋引擎ID，跳過搜索');
        return [];
      }
      
      // 構建搜索關鍵詞
      let keywords = query.title;
      if (query.artist) {
        keywords += ` ${query.artist}`;
      }
      keywords += ' lyrics 歌詞';
      
      // 使用Google Custom Search API
      const apiKey = this.options.apiKeys.google;
      const searchEngineId = this.options.searchEngineId;
      const url = `${this.options.endpoints.google}?q=${encodeURIComponent(keywords)}&key=${apiKey}&cx=${searchEngineId}`;
      
      // 記錄API使用
      this.apiUsage.google.requests++;
      this.apiUsage.google.lastUsed = new Date().toISOString();
      this.apiUsage.google.usageHistory.push({
        timestamp: new Date().toISOString(),
        query: keywords
      });
      
      const response = await this.httpClient.get(url);
      
      if (response.data && response.data.items && response.data.items.length > 0) {
        return response.data.items.map((item, index) => {
          // 從標題和片段嘗試提取藝術家和歌曲名稱
          let title = query.title;
          let artist = query.artist;
          
          // 如果標題包含 " - " 嘗試解析歌手和歌曲
          if (item.title && item.title.includes(' - ')) {
            const parts = item.title.split(' - ');
            if (parts.length >= 2) {
              artist = parts[0].trim();
              title = parts[1].trim().replace(/ lyrics| 歌詞/i, '');
            }
          }
          
          return {
            id: `google-${index}-${Date.now()}`,
            title: title,
            artist: artist,
            album: '',
            source: 'google',
            language: this._detectLanguage(title, artist),
            sourceUrl: item.link,
            snippet: item.snippet,
            pagemap: item.pagemap
          };
        });
      }
      
      return [];
    } catch (error) {
      log.error('Google搜索錯誤:', error);
      return [];
    }
  }

  /**
   * 從Google Custom Search獲取歌詞
   * @param {Object} lyricInfo - 歌詞信息
   * @returns {Promise<Object>} 歌詞內容
   * @private
   */
  async _getLyricsFromGoogle(lyricInfo) {
    try {
      // 訪問歌詞頁面
      const response = await this.httpClient.get(lyricInfo.sourceUrl);
      
      // 使用cheerio載入頁面內容
      const $ = cheerio.load(response.data);
      let lyrics = '';
      
      // 嘗試各種常見的歌詞網站結構來抓取歌詞
      // 方法1: 尋找帶有"lyrics"類別的元素
      const lyricsElements = $('.lyrics, .Lyrics__Container, .songLyricsV14, [data-lyrics-container="true"]');
      if (lyricsElements.length > 0) {
        lyricsElements.each((index, element) => {
          const html = $(element).html();
          // 處理<br>標籤
          const text = html.replace(/<br\s*\/?>/g, '\n');
          // 移除其他HTML標籤
          const plainText = $('<div>').html(text).text();
          lyrics += plainText + '\n\n';
        });
      } 
      // 方法2: 尋找常見的歌詞區塊
      else {
        // 嘗試常見的ID
        const lyricsContainers = $('#lyrics-body, #lyric-body, #lyricsBody, #lyrics, #lyric, .lyricbox');
        if (lyricsContainers.length > 0) {
          lyricsContainers.each((index, element) => {
            const html = $(element).html();
            const text = html.replace(/<br\s*\/?>/g, '\n');
            const plainText = $('<div>').html(text).text();
            lyrics += plainText + '\n\n';
          });
        }
        // 方法3: 嘗試尋找包含大量文字的段落(p)元素
        else {
          // 尋找包含"歌詞"或"lyrics"字樣的段落
          $('p:contains("歌詞"), p:contains("Lyrics"), p:contains("lyrics")').each((index, element) => {
            const text = $(element).text();
            if (text.length > 50) { // 只選取較長的文字
              lyrics += text + '\n\n';
            }
          });
        }
      }
      
      // 如果仍然沒找到歌詞，嘗試最後的方法
      if (!lyrics.trim()) {
        // 找出頁面中最長的文字區塊
        let longestText = '';
        $('div, pre, article').each((index, element) => {
          const text = $(element).text().trim();
          if (text.length > longestText.length && text.includes('\n')) {
            longestText = text;
          }
        });
        
        if (longestText.length > 100) { // 只使用較長且有換行的文字
          lyrics = longestText;
        }
      }
      
      if (lyrics.trim()) {
        return {
          success: true,
          source: 'google',
          id: lyricInfo.id,
          title: lyricInfo.title,
          artist: lyricInfo.artist,
          album: lyricInfo.album || '',
          text: this._cleanLyrics(lyrics.trim()),
          sourceUrl: lyricInfo.sourceUrl
        };
      } else {
        throw new Error('無法從頁面中提取歌詞');
      }
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 清理歌詞文本
   * @param {string} lyrics - 原始歌詞文本
   * @returns {string} 清理後的歌詞
   * @private
   */
  _cleanLyrics(lyrics) {
    return lyrics
      .replace(/\[.*?\]/g, '') // 移除時間標記 [00:00.00]
      .replace(/\(\d+:\d+\)/g, '') // 移除時間標記 (00:00)
      .replace(/\d+:\d+/g, '') // 移除單獨的時間標記 00:00
      .replace(/作詞.*?\n/g, '') // 移除作詞行
      .replace(/作曲.*?\n/g, '') // 移除作曲行
      .replace(/編曲.*?\n/g, '') // 移除編曲行
      .replace(/歌手.*?\n/g, '') // 移除歌手行
      .replace(/演唱.*?\n/g, '') // 移除演唱行
      .replace(/填詞.*?\n/g, '') // 移除填詞行
      .replace(/\n{3,}/g, '\n\n'); // 將三個以上連續換行替換為兩個換行
  }
  
  /**
   * 獲取歌詞來源的顯示名稱
   * @param {string} source - 歌詞來源代碼
   * @returns {string} 顯示名稱
   * @private
   */
  _getSourceName(source) {
    const sourceNames = {
      'google': 'Google搜尋',
      'netease': '網易雲音樂',
      'kkbox': 'KKBOX',
      'genius': 'Genius',
      'musixmatch': 'Musixmatch',
      'mojim': '魔鏡歌詞網'
    };
    
    return sourceNames[source] || source;
  }
  
  /**
   * 獲取API使用情況
   * @returns {Object} API使用統計
   */
  getApiUsage() {
    return this.apiUsage;
  }
  
  /**
   * 檢查API金鑰是否有效
   * @param {string} provider - API提供者
   * @param {string} apiKey - API金鑰
   * @returns {Promise<boolean>} 金鑰是否有效
   */
  async checkApiKey(provider, apiKey) {
    try {
      switch (provider) {
        case 'genius': {
          const response = await this.httpClient.get(`${this.options.endpoints.genius}/search?q=test`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            }
          });
          return response.status === 200;
        }
        
        case 'musixmatch': {
          const response = await this.httpClient.get(`${this.options.endpoints.musixmatch}/chart.artists.get?page=1&page_size=1&apikey=${apiKey}`);
          return response.data && response.data.message && response.data.message.header && response.data.message.header.status_code === 200;
        }
        
        case 'openai': {
          const response = await this.httpClient.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: "user",
                  content: "Hello"
                }
              ],
              max_tokens: 5
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              }
            }
          );
          return response.status === 200;
        }
        
        default:
          return false;
      }
    } catch (error) {
      log.error(`檢查${provider}的API金鑰時出錯:`, error);
      return false;
    }
  }
  
  /**
   * 更新API金鑰
   * @param {string} provider - API提供者
   * @param {string} apiKey - API金鑰
   * @returns {boolean} 更新是否成功
   */
  updateApiKey(provider, apiKey) {
    if (this.options.apiKeys.hasOwnProperty(provider)) {
      this.options.apiKeys[provider] = apiKey;
      return true;
    }
    return false;
  }
  
  /**
   * 清除緩存
   */
  clearCache() {
    this.cache.search.clear();
    this.cache.lyrics.clear();
    
    // 刪除持久化的緩存文件
    if (this.options.cacheEnabled) {
      try {
        const searchCachePath = path.join(this.options.cachePath, 'search_cache.json');
        const lyricsCachePath = path.join(this.options.cachePath, 'lyrics_cache.json');
        
        // 刪除搜索緩存文件
        if (fs.existsSync(searchCachePath)) {
          fs.unlinkSync(searchCachePath);
        }
        
        // 刪除歌詞緩存文件
        if (fs.existsSync(lyricsCachePath)) {
          fs.unlinkSync(lyricsCachePath);
        }
        
        log.info('歌詞服務緩存文件已刪除');
      } catch (error) {
        log.error('刪除緩存文件失敗:', error);
      }
    }
    
    log.info('歌詞服務緩存已清除');
  }
}

module.exports = LyricsService; 