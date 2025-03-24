const axios = require('axios');
const log = require('electron-log');
const cheerio = require('cheerio');

/**
 * 歌詞搜索服務
 * 支持從多個來源獲取歌詞
 */
class LyricsService {
  constructor(options = {}) {
    this.options = {
      // 超時設置
      timeout: options.timeout || 15000,
      // API金鑰
      apiKeys: {
        genius: options.apiKeys?.genius || '',
        musixmatch: options.apiKeys?.musixmatch || ''
      },
      // 代理設置
      proxy: options.proxy || null,
      // 默認語言
      defaultLanguage: options.defaultLanguage || 'zh-TW',
      // 緩存設置
      cacheEnabled: options.cacheEnabled !== undefined ? options.cacheEnabled : true,
      // 歌詞來源優先級
      sourcesPriority: options.sourcesPriority || ['netease', 'kkbox', 'genius', 'musixmatch', 'mojim']
    };
    
    // 創建帶有適當配置的HTTP客戶端
    this.httpClient = axios.create({
      timeout: this.options.timeout
    });
    
    // 設置代理
    if (this.options.proxy) {
      this.httpClient.defaults.proxy = this.options.proxy;
    }
    
    // 內存緩存
    this.cache = {
      searches: new Map(), // 緩存搜索結果
      lyrics: new Map() // 緩存歌詞內容
    };
  }
  
  /**
   * 更新配置選項
   * @param {Object} options - 新的配置選項
   */
  updateOptions(options) {
    // 深度合併選項
    this.options = {
      ...this.options,
      ...options,
      apiKeys: {
        ...this.options.apiKeys,
        ...options.apiKeys
      }
    };
    
    // 更新HTTP客戶端設置
    if (options.timeout) {
      this.httpClient.defaults.timeout = options.timeout;
    }
    
    if (options.proxy !== undefined) {
      this.httpClient.defaults.proxy = options.proxy;
    }
  }
  
  /**
   * 搜索歌詞
   * @param {Object} query - 搜索查詢
   * @param {string} query.title - 歌曲標題
   * @param {string} [query.artist] - 藝人名稱
   * @param {string} [query.album] - 專輯名稱
   * @param {string} [query.language] - 歌詞語言偏好
   * @param {Array<string>} [query.sources] - 指定搜索來源
   * @returns {Promise<Array>} 搜索結果列表
   */
  async searchLyrics(query) {
    // 生成緩存鍵
    const cacheKey = this._generateCacheKey(query);
    
    // 檢查緩存
    if (this.options.cacheEnabled && this.cache.searches.has(cacheKey)) {
      return this.cache.searches.get(cacheKey);
    }
    
    // 處理搜索來源
    const sources = query.sources || this.options.sourcesPriority;
    
    // 存儲所有來源的結果
    let allResults = [];
    
    // 並行搜索所有來源
    const searchPromises = sources.map(source => {
      switch (source) {
        case 'netease':
          return this._searchNetease(query).catch(err => {
            log.error(`網易雲音樂搜索錯誤: ${err.message}`);
            return [];
          });
        case 'kkbox':
          return this._searchKKBOX(query).catch(err => {
            log.error(`KKBOX搜索錯誤: ${err.message}`);
            return [];
          });
        case 'genius':
          return this._searchGenius(query).catch(err => {
            log.error(`Genius搜索錯誤: ${err.message}`);
            return [];
          });
        case 'musixmatch':
          return this._searchMusixmatch(query).catch(err => {
            log.error(`Musixmatch搜索錯誤: ${err.message}`);
            return [];
          });
        case 'mojim':
          return this._searchMojim(query).catch(err => {
            log.error(`魔鏡歌詞網搜索錯誤: ${err.message}`);
            return [];
          });
        default:
          return Promise.resolve([]);
      }
    });
    
    // 等待所有搜索完成
    const results = await Promise.all(searchPromises);
    
    // 合併結果
    results.forEach(sourceResults => {
      allResults = allResults.concat(sourceResults);
    });
    
    // 去重並排序
    allResults = this._deduplicateResults(allResults);
    
    // 依照相關性排序
    allResults = this._rankResults(allResults, query);
    
    // 緩存結果
    if (this.options.cacheEnabled) {
      this.cache.searches.set(cacheKey, allResults);
    }
    
    return allResults;
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
    // 如果已處理過，直接返回
    if (lyrics.processed) {
      return lyrics;
    }
    
    // 將文本分割為段落
    if (lyrics.text && typeof lyrics.text === 'string') {
      const paragraphs = this._splitIntoParagraphs(lyrics.text);
      
      return {
        ...lyrics,
        processed: true,
        paragraphs
      };
    }
    
    return {
      ...lyrics,
      processed: true
    };
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
   * 清除緩存
   */
  clearCache() {
    this.cache.searches.clear();
    this.cache.lyrics.clear();
  }
}

module.exports = LyricsService; 