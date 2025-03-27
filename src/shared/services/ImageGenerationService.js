const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = require('electron-log');
const { app } = require('electron');

/**
 * 圖像生成服務
 * 支持多種AI圖像生成API的接入
 */
class ImageGenerationService {
  constructor(options = {}) {
    this.options = {
      // API金鑰
      apiKeys: options.apiKeys || {
        openai: '',
        stabilityai: ''
      },
      // 是否啟用緩存
      cacheEnabled: options.cacheEnabled !== undefined ? options.cacheEnabled : true,
      // 緩存目錄路徑
      cachePath: options.cachePath || path.join(app.getPath('userData'), 'cache', 'images'),
      // 緩存清理間隔（毫秒），默認30天
      cacheTTL: options.cacheTTL || 30 * 24 * 60 * 60 * 1000,
      // 圖像生成默認參數
      defaultParams: {
        width: options.defaultParams?.width || 1920,
        height: options.defaultParams?.height || 1080,
        provider: options.defaultParams?.provider || 'openai',
        model: options.defaultParams?.model || 'dall-e-3',
        style: options.defaultParams?.style || 'natural',
        quality: options.defaultParams?.quality || 'standard',
        orientation: options.defaultParams?.orientation || 'landscape'
      },
      // 超時設置
      timeout: options.timeout || 60000,
      // 代理設置
      proxy: options.proxy || null,
      // 歌詞投影片背景預設提示詞模板
      promptTemplates: options.promptTemplates || {
        default: "為以下歌詞創建背景圖片：\n「{{lyrics}}」\n風格：簡約現代，適合教會或歌唱聚會使用的投影片背景，不要包含任何文字或人物，只需要創作美麗和諧的抽象背景。",
        abstract: "創建一個抽象藝術背景，代表以下歌詞的情感：\n「{{lyrics}}」\n風格：柔和色彩、流動形狀，沒有文字，適合作為投影片背景。",
        nature: "基於以下歌詞創建一個自然風景背景：\n「{{lyrics}}」\n風格：平靜的自然景觀，沒有文字，適合作為投影片背景。",
        worship: "為這段敬拜歌詞創建一個虔誠的背景：\n「{{lyrics}}」\n風格：神聖、平和、簡約，沒有文字，適合教會使用的投影片背景。",
        modern: "為以下歌詞創建一個現代風格背景：\n「{{lyrics}}」\n風格：現代設計、簡約、平滑漸變，沒有文字，適合作為投影片背景。"
      },
      // 最大批次處理數量
      maxBatchSize: options.maxBatchSize || 5,
      // 重試設置
      retryCount: options.retryCount || 3,
      retryDelay: options.retryDelay || 2000
    };
    
    // 確保緩存目錄存在
    if (this.options.cacheEnabled) {
      try {
        if (!fs.existsSync(this.options.cachePath)) {
          fs.mkdirSync(this.options.cachePath, { recursive: true });
        }
        console.log('圖片緩存目錄:', this.options.cachePath);
      } catch (error) {
        console.error('創建緩存目錄失敗:', error);
        this.options.cacheEnabled = false;
      }
    }
    
    // 創建帶有適當配置的HTTP客戶端
    this.httpClient = axios.create({
      timeout: this.options.timeout
    });
    
    // 設置代理
    if (this.options.proxy) {
      this.httpClient.defaults.proxy = this.options.proxy;
    }
    
    // 記錄API使用情況
    this.apiUsage = {
      openai: {
        requests: 0,
        lastUsed: null,
        usageHistory: []
      },
      stabilityai: {
        requests: 0,
        lastUsed: null,
        usageHistory: []
      }
    };
    
    // 控制同時進行的請求
    this.abortControllers = new Map();
    
    // 初始化緩存系統
    this._initCache();
    
    console.log('圖片生成服務已初始化', {
      cacheEnabled: this.options.cacheEnabled,
      provider: this.options.defaultParams.provider,
      model: this.options.defaultParams.model
    });
  }
  
  /**
   * 初始化緩存系統
   * @private
   */
  _initCache() {
    if (!this.options.cacheEnabled) return;
    
    try {
      // 清理過期的緩存文件
      this._cleanExpiredCache();
      
      // 讀取緩存目錄中的文件，建立內存索引
      this.cacheIndex = new Map();
      const files = fs.readdirSync(this.options.cachePath);
      
      for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
          const filePath = path.join(this.options.cachePath, file);
          const stats = fs.statSync(filePath);
          
          // 從文件名中提取信息
          const info = this._extractInfoFromFilename(file);
          
          this.cacheIndex.set(file, {
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            accessed: stats.atime,
            ...info
          });
        }
      }
      
      console.log(`緩存索引已建立，共 ${this.cacheIndex.size} 個文件`);
    } catch (error) {
      console.error('初始化緩存系統失敗:', error);
    }
  }
  
  /**
   * 從文件名中提取信息
   * @param {string} filename - 文件名
   * @returns {Object} 提取的信息
   * @private
   */
  _extractInfoFromFilename(filename) {
    // 首先嘗試解析新的命名格式: 歌名_藝術家_promptHash.png
    const songMatch = filename.match(/^(.+?)_(.+?)_([a-f0-9]{10})\.(png|jpg|jpeg)$/i);
    if (songMatch) {
      return {
        songTitle: songMatch[1],
        artist: songMatch[2],
        promptHash: songMatch[3],
        format: songMatch[4]
      };
    }
    
    // 舊格式: promptHash_model_size_quality_style.png
    const oldMatch = filename.match(/^([a-f0-9]{10})_(.+?)_(\d+x\d+)(?:_(.+?))?(?:_(.+?))?\.(png|jpg|jpeg)$/i);
    if (oldMatch) {
      return {
        promptHash: oldMatch[1],
        model: oldMatch[2],
        size: oldMatch[3],
        quality: oldMatch[4] || '',
        style: oldMatch[5] || '',
        format: oldMatch[6]
      };
    }
    
    return { unknown: true };
  }
  
  /**
   * 清理過期的緩存文件
   * @private
   */
  _cleanExpiredCache() {
    if (!this.options.cacheEnabled) return;
    
    try {
      const now = Date.now();
      const files = fs.readdirSync(this.options.cachePath);
      
      let removed = 0;
      for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
          const filePath = path.join(this.options.cachePath, file);
          const stats = fs.statSync(filePath);
          
          // 檢查文件是否過期
          if (now - stats.atime.getTime() > this.options.cacheTTL) {
            fs.unlinkSync(filePath);
            removed++;
          }
        }
      }
      
      if (removed > 0) {
        console.log(`已清理 ${removed} 個過期的緩存文件`);
      }
    } catch (error) {
      console.error('清理過期緩存失敗:', error);
    }
  }
  
  /**
   * 使用歌曲信息生成圖像文件名
   * @param {string} songTitle - 歌曲標題
   * @param {string} artist - 藝術家
   * @param {string} promptHash - 提示詞的哈希值
   * @returns {string} 文件名
   * @private
   */
  _generateSongBasedFilename(songTitle, artist, promptHash) {
    // 清理歌曲標題和藝術家名稱中的非法字符
    const cleanTitle = songTitle.replace(/[\\/:*?"<>|]/g, '_').trim();
    const cleanArtist = artist ? artist.replace(/[\\/:*?"<>|]/g, '_').trim() : 'unknown';
    
    return `${cleanTitle}_${cleanArtist}_${promptHash}.png`;
  }
  
  /**
   * 檢查歌曲是否已有緩存圖片
   * @param {string} songTitle - 歌曲標題
   * @param {string} artist - 藝術家
   * @returns {string|null} 緩存文件路徑，如果不存在則返回null
   */
  checkSongImageCache(songTitle, artist) {
    if (!this.options.cacheEnabled || !this.cacheIndex) return null;
    
    try {
      // 清理名稱，用於比對
      const cleanTitle = songTitle.replace(/[\\/:*?"<>|]/g, '_').trim().toLowerCase();
      const cleanArtist = artist ? artist.replace(/[\\/:*?"<>|]/g, '_').trim().toLowerCase() : '';
      
      // 遍歷緩存索引查找匹配的文件
      for (const [filename, info] of this.cacheIndex.entries()) {
        if (info.songTitle && info.songTitle.toLowerCase() === cleanTitle) {
          // 如果提供了藝術家，則也進行比對
          if (!cleanArtist || !info.artist || info.artist.toLowerCase() === cleanArtist) {
            return info.path;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('檢查歌曲圖片緩存失敗:', error);
      return null;
    }
  }
  
  /**
   * 為歌曲生成圖片
   * @param {Object} songInfo - 歌曲信息
   * @param {string} songInfo.title - 歌曲標題
   * @param {string} songInfo.artist - 藝術家
   * @param {string} songInfo.lyrics - 歌詞
   * @param {Object} options - 生成選項
   * @param {Function} progressCallback - 進度回調
   * @returns {Promise<Object>} 生成結果
   */
  async generateSongImage(songInfo, options = {}, progressCallback) {
    if (!songInfo || !songInfo.title) {
      throw new Error('缺少歌曲標題');
    }
    
    try {
      // 首先檢查緩存中是否已有此歌曲的圖片
      const cachedImagePath = this.checkSongImageCache(songInfo.title, songInfo.artist);
      if (cachedImagePath) {
        if (typeof progressCallback === 'function') {
          progressCallback({
            status: 'cache_hit',
            progress: 1,
            message: '從緩存中找到圖片',
            filePath: cachedImagePath
          });
        }
        
        return {
          success: true,
          source: 'cache',
          filePath: cachedImagePath,
          songTitle: songInfo.title,
          artist: songInfo.artist
        };
      }
      
      // 如果沒有緩存，則生成新的圖片
      if (typeof progressCallback === 'function') {
        progressCallback({
          status: 'preparing',
          progress: 0.1,
          message: '準備生成圖片'
        });
      }
      
      // 生成適合的提示詞
      let prompt;
      if (options.prompt) {
        prompt = options.prompt;
      } else {
        // 從歌詞生成提示詞
        const lyrics = songInfo.lyrics || '';
        const templateName = options.promptTemplate || 'default';
        
        prompt = this.generatePromptFromLyrics(lyrics, {
          template: templateName,
          songTitle: songInfo.title,
          artist: songInfo.artist
        });
      }
      
      if (typeof progressCallback === 'function') {
        progressCallback({
          status: 'prompt_ready',
          progress: 0.2,
          message: '提示詞已準備',
          prompt
        });
      }
      
      // 生成圖片
      const result = await this.generateImage({
        ...options,
        prompt,
        songTitle: songInfo.title,
        artist: songInfo.artist
      }, (progress) => {
        if (typeof progressCallback === 'function') {
          progressCallback({
            ...progress,
            progress: 0.2 + progress.progress * 0.8 // 映射進度到20%-100%
          });
        }
      });
      
      // 如果成功，將結果添加到緩存索引
      if (result.success && result.filePath) {
        const promptHash = crypto
          .createHash('md5')
          .update(prompt)
          .digest('hex')
          .substring(0, 10);
        
        const filename = path.basename(result.filePath);
        
        this.cacheIndex.set(filename, {
          path: result.filePath,
          songTitle: songInfo.title,
          artist: songInfo.artist,
          promptHash,
          created: new Date(),
          accessed: new Date()
        });
      }
      
      return {
        ...result,
        songTitle: songInfo.title,
        artist: songInfo.artist
      };
    } catch (error) {
      console.error('生成歌曲圖片失敗:', error);
      
      if (typeof progressCallback === 'function') {
        progressCallback({
          status: 'error',
          progress: 0,
          message: `生成失敗: ${error.message}`
        });
      }
      
      throw error;
    }
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
      },
      defaultParams: {
        ...this.options.defaultParams,
        ...options.defaultParams
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
   * 保存API金鑰
   * @param {string} provider - 提供商名稱
   * @param {string} apiKey - API金鑰
   */
  setApiKey(provider, apiKey) {
    if (provider in this.options.apiKeys) {
      this.options.apiKeys[provider] = apiKey;
      return true;
    }
    return false;
  }
  
  /**
   * 檢查API金鑰是否已設置
   * @param {string} provider - 提供商名稱
   * @returns {boolean} 是否已設置API金鑰
   */
  hasApiKey(provider) {
    return !!(this.options.apiKeys[provider] && this.options.apiKeys[provider].length > 0);
  }
  
  /**
   * 使用OpenAI API生成圖像
   * @param {Object} params - 生成參數
   * @returns {Promise<Object>} 生成結果
   */
  async generateWithOpenAI(params) {
    // 驗證API金鑰
    if (!this.hasApiKey('openai')) {
      throw new Error('未設置OpenAI API金鑰');
    }
    
    // 處理參數
    const model = params.model || this.options.defaultParams.model;
    const quality = params.quality || this.options.defaultParams.quality;
    const style = params.style || this.options.defaultParams.style;
    
    // 決定尺寸
    let size;
    if (model === 'dall-e-3') {
      // DALL-E 3支持的尺寸
      switch (params.orientation || this.options.defaultParams.orientation) {
        case 'square':
          size = '1024x1024';
          break;
        case 'portrait':
          size = '1024x1792';
          break;
        case 'landscape':
        default:
          size = '1792x1024';
          break;
      }
    } else {
      // DALL-E 2支持的尺寸
      size = '1024x1024';
    }
    
    try {
      // 記錄使用情況
      this.apiUsage.openai.requests++;
      this.apiUsage.openai.lastUsed = new Date().toISOString();
      this.apiUsage.openai.usageHistory.push({
        timestamp: new Date().toISOString(),
        model,
        quality
      });
      
      // 調用API
      const response = await this.httpClient.post(
        'https://api.openai.com/v1/images/generations',
        {
          model,
          prompt: params.prompt,
          n: 1,
          size,
          quality,
          style,
          response_format: 'b64_json'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.options.apiKeys.openai}`
          }
        }
      );
      
      // 處理響應
      if (response.data && response.data.data && response.data.data.length > 0) {
        const imageData = response.data.data[0];
        
        // 保存到緩存
        let filePath = null;
        if (this.options.cacheEnabled && imageData.b64_json) {
          const filename = this._generateCacheFilename(params.prompt, model, size, quality, style);
          filePath = path.join(this.options.cachePath, filename);
          
          // 保存Base64圖像數據到文件
          fs.writeFileSync(filePath, Buffer.from(imageData.b64_json, 'base64'));
        }
        
        return {
          success: true,
          provider: 'openai',
          model,
          imageData: imageData.b64_json,
          filePath,
          metadata: {
            model,
            quality,
            style,
            size,
            created: Date.now()
          }
        };
      } else {
        throw new Error('API未返回圖像數據');
      }
    } catch (error) {
      log.error('OpenAI圖像生成錯誤:', error);
      
      return {
        success: false,
        provider: 'openai',
        error: error.message,
        details: error.response?.data || {}
      };
    }
  }
  
  /**
   * 使用StabilityAI API生成圖像
   * @param {Object} params - 生成參數
   * @returns {Promise<Object>} 生成結果
   */
  async generateWithStabilityAI(params) {
    // 驗證API金鑰
    if (!this.hasApiKey('stabilityai')) {
      throw new Error('未設置StabilityAI API金鑰');
    }
    
    // 處理參數
    const engineId = params.model || 'stable-diffusion-xl-1024-v1-0';
    const width = params.width || this.options.defaultParams.width;
    const height = params.height || this.options.defaultParams.height;
    
    // 確保尺寸是512的倍數
    const adjustedWidth = Math.round(width / 512) * 512;
    const adjustedHeight = Math.round(height / 512) * 512;
    
    try {
      // 記錄使用情況
      this.apiUsage.stabilityai.requests++;
      this.apiUsage.stabilityai.lastUsed = new Date().toISOString();
      this.apiUsage.stabilityai.usageHistory.push({
        timestamp: new Date().toISOString(),
        engineId,
        width: adjustedWidth,
        height: adjustedHeight
      });
      
      // 處理提示詞
      const textPrompts = [
        {
          text: params.prompt,
          weight: 1
        }
      ];
      
      if (params.negativePrompt) {
        textPrompts.push({
          text: params.negativePrompt,
          weight: -1
        });
      }
      
      // 調用API
      const response = await this.httpClient.post(
        `https://api.stability.ai/v1/generation/${engineId}/text-to-image`,
        {
          text_prompts: textPrompts,
          cfg_scale: 7,
          height: adjustedHeight,
          width: adjustedWidth,
          samples: 1,
          steps: 30
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.options.apiKeys.stabilityai}`
          }
        }
      );
      
      // 處理響應
      if (response.data && response.data.artifacts && response.data.artifacts.length > 0) {
        const imageData = response.data.artifacts[0];
        
        // 保存到緩存
        let filePath = null;
        if (this.options.cacheEnabled && imageData.base64) {
          const filename = this._generateCacheFilename(params.prompt, engineId, `${adjustedWidth}x${adjustedHeight}`);
          filePath = path.join(this.options.cachePath, filename);
          
          // 保存Base64圖像數據到文件
          fs.writeFileSync(filePath, Buffer.from(imageData.base64, 'base64'));
        }
        
        return {
          success: true,
          provider: 'stabilityai',
          model: engineId,
          imageData: imageData.base64,
          filePath,
          metadata: {
            model: engineId,
            width: adjustedWidth,
            height: adjustedHeight,
            seed: imageData.seed,
            created: Date.now()
          }
        };
      } else {
        throw new Error('API未返回圖像數據');
      }
    } catch (error) {
      log.error('StabilityAI圖像生成錯誤:', error);
      
      return {
        success: false,
        provider: 'stabilityai',
        error: error.message,
        details: error.response?.data || {}
      };
    }
  }
  
  /**
   * 生成圖像
   * @param {Object} params - 生成參數
   * @param {Function} [progressCallback] - 進度回調函數
   * @returns {Promise<Object>} 生成結果
   */
  async generateImage(params, progressCallback) {
    // 生成請求 ID
    const requestId = this._createRequestId();
    
    // 創建取消控制器
    const abortController = new AbortController();
    this.abortControllers.set(requestId, abortController);
    
    try {
      // 報告開始進度
      if (typeof progressCallback === 'function') {
        progressCallback({
          requestId,
          status: 'started',
          progress: 0,
          message: '開始生成圖片...'
        });
      }
      
      // 合併默認參數
      const mergedParams = {
        ...this.options.defaultParams,
        ...params
      };
      
      // 如果沒有提供提示詞但提供了歌詞，則自動生成提示詞
      if (!mergedParams.prompt && mergedParams.lyrics) {
        mergedParams.prompt = this.generatePromptFromLyrics(
          mergedParams.lyrics,
          {
            template: mergedParams.promptTemplate || 'default',
            style: mergedParams.additionalStyle,
            width: mergedParams.width,
            height: mergedParams.height,
            songTitle: mergedParams.songTitle,
            artist: mergedParams.artist
          }
        );
        
        // 報告提示詞生成進度
        if (typeof progressCallback === 'function') {
          progressCallback({
            requestId,
            status: 'prompt_generated',
            progress: 0.1,
            message: '提示詞已生成',
            prompt: mergedParams.prompt
          });
        }
      }
      
      // 檢查緩存
      if (this.options.cacheEnabled) {
        // 生成提示詞的哈希
        const promptHash = crypto
          .createHash('md5')
          .update(mergedParams.prompt)
          .digest('hex')
          .substring(0, 10);
        
        // 先檢查歌曲名稱緩存
        if (mergedParams.songTitle) {
          const cachedImagePath = this.checkSongImageCache(mergedParams.songTitle, mergedParams.artist);
          if (cachedImagePath) {
            // 報告緩存命中
            if (typeof progressCallback === 'function') {
              progressCallback({
                requestId,
                status: 'completed',
                progress: 1,
                message: '從緩存中獲取了圖片',
                filePath: cachedImagePath,
                fromCache: true
              });
            }
            
            // 釋放控制器
            this.abortControllers.delete(requestId);
            
            return {
              success: true,
              provider: 'cache',
              filePath: cachedImagePath,
              fromCache: true
            };
          }
        }
        
        // 檢查提示詞緩存
        let cacheFilename;
        
        // 優先使用歌曲名稱生成的文件名
        if (mergedParams.songTitle) {
          cacheFilename = this._generateSongBasedFilename(
            mergedParams.songTitle,
            mergedParams.artist || '',
            promptHash
          );
        } else {
          // 使用原來的命名方案
          cacheFilename = this._generateCacheFilename(
            mergedParams.prompt,
            mergedParams.model,
            `${mergedParams.width}x${mergedParams.height}`,
            mergedParams.quality,
            mergedParams.style
          );
        }
        
        const cachedFilePath = path.join(this.options.cachePath, cacheFilename);
        
        if (fs.existsSync(cachedFilePath)) {
          // 報告緩存命中
          if (typeof progressCallback === 'function') {
            progressCallback({
              requestId,
              status: 'completed',
              progress: 1,
              message: '從緩存中獲取了圖片',
              filePath: cachedFilePath,
              fromCache: true
            });
          }
          
          // 更新緩存索引
          this.cacheIndex.set(cacheFilename, {
            path: cachedFilePath,
            songTitle: mergedParams.songTitle,
            artist: mergedParams.artist,
            promptHash,
            accessed: new Date()
          });
          
          // 釋放控制器
          this.abortControllers.delete(requestId);
          
          return {
            success: true,
            provider: 'cache',
            filePath: cachedFilePath,
            fromCache: true
          };
        }
      }
      
      // 報告開始API調用
      if (typeof progressCallback === 'function') {
        progressCallback({
          requestId,
          status: 'api_call',
          progress: 0.3,
          message: `正在調用 ${mergedParams.provider.toUpperCase()} API...`
        });
      }
      
      // 根據提供者生成圖像
      let result;
      switch (mergedParams.provider) {
        case 'openai':
          result = await this.generateWithOpenAI(mergedParams);
          break;
        case 'stabilityai':
          result = await this.generateWithStabilityAI(mergedParams);
          break;
        default:
          throw new Error(`不支持的提供者: ${mergedParams.provider}`);
      }
      
      // 如果生成成功
      if (result.success) {
        // 如果已啟用緩存但沒有生成文件路徑，則保存圖像到緩存
        if (this.options.cacheEnabled && result.imageData && !result.filePath) {
          // 生成提示詞的哈希
          const promptHash = crypto
            .createHash('md5')
            .update(mergedParams.prompt)
            .digest('hex')
            .substring(0, 10);
          
          // 確定文件名
          let filename;
          if (mergedParams.songTitle) {
            filename = this._generateSongBasedFilename(
              mergedParams.songTitle,
              mergedParams.artist || '',
              promptHash
            );
          } else {
            filename = this._generateCacheFilename(
              mergedParams.prompt,
              mergedParams.model,
              `${mergedParams.width}x${mergedParams.height}`,
              mergedParams.quality,
              mergedParams.style
            );
          }
          
          const filePath = path.join(this.options.cachePath, filename);
          
          // 保存Base64圖像數據到文件
          fs.writeFileSync(filePath, Buffer.from(result.imageData, 'base64'));
          
          // 更新結果
          result.filePath = filePath;
          
          // 更新緩存索引
          this.cacheIndex.set(filename, {
            path: filePath,
            songTitle: mergedParams.songTitle,
            artist: mergedParams.artist,
            promptHash,
            created: new Date(),
            accessed: new Date(),
            provider: mergedParams.provider,
            model: mergedParams.model
          });
        }
        
        // 報告完成
        if (typeof progressCallback === 'function') {
          progressCallback({
            requestId,
            status: 'completed',
            progress: 1,
            message: '圖片生成完成',
            filePath: result.filePath
          });
        }
      } else {
        // 報告錯誤
        if (typeof progressCallback === 'function') {
          progressCallback({
            requestId,
            status: 'error',
            progress: 0,
            message: `圖片生成失敗: ${result.error}`,
            error: result.error
          });
        }
      }
      
      // 釋放控制器
      this.abortControllers.delete(requestId);
      
      return result;
    } catch (error) {
      // 報告錯誤
      if (typeof progressCallback === 'function') {
        progressCallback({
          requestId,
          status: 'error',
          progress: 0,
          message: `圖片生成遇到錯誤: ${error.message}`,
          error: error.message
        });
      }
      
      log.error('圖片生成錯誤:', error);
      
      // 釋放控制器
      this.abortControllers.delete(requestId);
      
      throw error;
    }
  }
  
  /**
   * 檢查緩存
   * @param {Object} params - 生成參數
   * @returns {string|null} 緩存文件路徑或null
   * @private
   */
  _checkCache(params) {
    if (!this.options.cacheEnabled) return null;
    
    try {
      // 根據不同提供商生成文件名模式
      let patterns = [];
      
      if (params.provider === 'openai') {
        // 為OpenAI生成可能的緩存文件名
        const model = params.model || this.options.defaultParams.model;
        const quality = params.quality || this.options.defaultParams.quality;
        const style = params.style || this.options.defaultParams.style;
        
        // DALL-E 3支持的尺寸
        const sizes = ['1024x1024', '1792x1024', '1024x1792'];
        
        for (const size of sizes) {
          patterns.push(this._generateCacheFilename(params.prompt, model, size, quality, style));
        }
      } else if (params.provider === 'stabilityai') {
        // 為StabilityAI生成可能的緩存文件名
        const engineId = params.model || 'stable-diffusion-xl-1024-v1-0';
        const width = params.width || this.options.defaultParams.width;
        const height = params.height || this.options.defaultParams.height;
        
        // 確保尺寸是512的倍數
        const adjustedWidth = Math.round(width / 512) * 512;
        const adjustedHeight = Math.round(height / 512) * 512;
        
        patterns.push(this._generateCacheFilename(params.prompt, engineId, `${adjustedWidth}x${adjustedHeight}`));
      }
      
      // 檢查是否有匹配的緩存文件
      const files = fs.readdirSync(this.options.cachePath);
      
      for (const pattern of patterns) {
        const matchingFile = files.find(file => file === pattern);
        if (matchingFile) {
          return path.join(this.options.cachePath, matchingFile);
        }
      }
      
      return null;
    } catch (error) {
      log.error('檢查緩存錯誤:', error);
      return null;
    }
  }
  
  /**
   * 生成緩存文件名
   * @param {string} prompt - 提示詞
   * @param {string} model - 模型名稱
   * @param {string} size - 圖像尺寸
   * @param {string} [quality] - 品質設置
   * @param {string} [style] - 風格設置
   * @returns {string} 緩存文件名
   * @private
   */
  _generateCacheFilename(prompt, model, size, quality = '', style = '') {
    // 生成提示詞的哈希
    const promptHash = crypto
      .createHash('md5')
      .update(prompt)
      .digest('hex')
      .substring(0, 10);
    
    // 創建包含所有相關參數的文件名
    let filename = `${promptHash}_${model}_${size}`;
    
    if (quality) {
      filename += `_${quality}`;
    }
    
    if (style) {
      filename += `_${style}`;
    }
    
    return `${filename}.png`;
  }
  
  /**
   * 清除緩存
   * @param {Object} options - 清除選項
   * @returns {number} 已清除的文件數
   */
  clearCache(options = {}) {
    if (!this.options.cacheEnabled) return 0;
    
    try {
      const files = fs.readdirSync(this.options.cachePath);
      let deletedCount = 0;
      
      // 根據選項過濾要刪除的文件
      for (const file of files) {
        let shouldDelete = true;
        
        if (options.provider && !file.includes(options.provider)) {
          shouldDelete = false;
        }
        
        if (options.model && !file.includes(options.model)) {
          shouldDelete = false;
        }
        
        if (options.before) {
          const filePath = path.join(this.options.cachePath, file);
          const stats = fs.statSync(filePath);
          if (stats.mtime.getTime() > options.before) {
            shouldDelete = false;
          }
        }
        
        if (shouldDelete) {
          fs.unlinkSync(path.join(this.options.cachePath, file));
          deletedCount++;
        }
      }
      
      return deletedCount;
    } catch (error) {
      log.error('清除緩存錯誤:', error);
      return 0;
    }
  }
  
  /**
   * 獲取API使用統計
   * @returns {Object} API使用統計
   */
  getApiUsageStats() {
    return this.apiUsage;
  }
  
  /**
   * 從歌詞生成提示詞
   * @param {string} lyrics - 歌詞內容
   * @param {Object} options - 生成選項
   * @returns {string} 生成的提示詞
   */
  generatePromptFromLyrics(lyrics, options = {}) {
    // 獲取提示詞模板
    const templateName = options.template || 'default';
    let template = this.options.promptTemplates[templateName];
    
    if (!template) {
      console.warn(`找不到名為 "${templateName}" 的提示詞模板，使用默認模板`);
      template = this.options.promptTemplates.default;
    }
    
    // 提取歌詞中最具代表性的部分
    let lyricsExcerpt = '';
    
    if (lyrics) {
      // 將歌詞分割為段落
      const paragraphs = lyrics.split(/\n\s*\n/).filter(p => p.trim());
      
      if (paragraphs.length > 0) {
        // 優先選擇副歌部分（通常是最具代表性的）
        // 尋找包含"副歌"、"chorus"或重複出現的段落
        const chorusParagraphs = paragraphs.filter(p => 
          p.includes('副歌') || 
          p.toLowerCase().includes('chorus') ||
          p.toLowerCase().includes('refrain')
        );
        
        if (chorusParagraphs.length > 0) {
          // 使用找到的第一個副歌
          lyricsExcerpt = chorusParagraphs[0];
        } else {
          // 如果找不到副歌，使用歌詞的前兩個段落
          lyricsExcerpt = paragraphs.slice(0, 2).join('\n\n');
        }
      } else {
        // 如果沒有明確的段落分隔，使用歌詞的前幾行
        const lines = lyrics.split('\n').filter(line => line.trim());
        lyricsExcerpt = lines.slice(0, Math.min(6, lines.length)).join('\n');
      }
    }
    
    // 如果提取的歌詞太長，限制長度
    if (lyricsExcerpt.length > 300) {
      lyricsExcerpt = lyricsExcerpt.substring(0, 300) + '...';
    }
    
    // 填充模板
    let prompt = template.replace(/{{lyrics}}/g, lyricsExcerpt);
    
    // 加入歌曲標題和藝術家（如果提供）
    if (options.songTitle) {
      prompt = prompt.replace(/{{songTitle}}/g, options.songTitle);
      
      // 確保提示詞中包含歌曲標題
      if (!prompt.includes(options.songTitle)) {
        prompt = `歌曲：${options.songTitle}\n${prompt}`;
      }
    }
    
    if (options.artist) {
      prompt = prompt.replace(/{{artist}}/g, options.artist);
      
      // 確保提示詞中包含藝術家
      if (options.artist && !prompt.includes(options.artist)) {
        prompt = `藝術家：${options.artist}\n${prompt}`;
      }
    }
    
    // 添加額外風格說明
    if (options.style) {
      prompt += `\n附加風格: ${options.style}`;
    }
    
    // 添加解析度要求
    if (options.width && options.height) {
      prompt += `\n解析度: ${options.width}x${options.height} 像素`;
    }
    
    return prompt;
  }
  
  /**
   * 批量生成多張圖片
   * @param {Array<Object>} paramsList - 參數列表
   * @param {Function} progressCallback - 進度回調
   * @returns {Promise<Array<Object>>} 生成結果列表
   */
  async generateBatch(paramsList, progressCallback) {
    // 檢查是否有參數
    if (!paramsList || !Array.isArray(paramsList) || paramsList.length === 0) {
      return [];
    }
    
    // 限制批量處理的數量
    const batchSize = Math.min(paramsList.length, this.options.maxBatchSize);
    const batch = paramsList.slice(0, batchSize);
    
    // 初始化結果數組
    const results = new Array(batch.length).fill(null);
    const inProgress = new Set();
    let completed = 0;
    
    // 報告進度的函數
    const reportProgress = () => {
      if (typeof progressCallback === 'function') {
        progressCallback({
          total: batch.length,
          completed,
          inProgress: Array.from(inProgress),
          results: results.filter(r => r !== null)
        });
      }
    };
    
    try {
      // 創建生成任務
      const tasks = batch.map((params, index) => {
        return async () => {
          try {
            inProgress.add(index);
            reportProgress();
            
            // 生成圖片
            const result = await this.generateImage(params);
            
            // 更新結果
            results[index] = result;
            inProgress.delete(index);
            completed++;
            reportProgress();
            
            return result;
          } catch (error) {
            log.error(`批量生成任務 ${index} 失敗:`, error);
            
            results[index] = {
              success: false,
              error: error.message,
              index
            };
            
            inProgress.delete(index);
            completed++;
            reportProgress();
            
            return null;
          }
        };
      });
      
      // 並行執行任務（最多3個同時進行）
      const results = await this._runConcurrentTasks(tasks, 3);
      
      return results.filter(result => result !== null);
    } catch (error) {
      log.error('批量生成圖片時出錯:', error);
      throw error;
    }
  }
  
  /**
   * 取消正在進行的圖片生成任務
   * @param {string} [requestId] - 請求ID，如果不指定則取消所有請求
   * @returns {boolean} 取消是否成功
   */
  cancelGeneration(requestId) {
    if (requestId) {
      // 取消特定請求
      const controller = this.abortControllers.get(requestId);
      if (controller) {
        controller.abort();
        this.abortControllers.delete(requestId);
        log.info(`已取消圖片生成請求: ${requestId}`);
        return true;
      }
      return false;
    } else {
      // 取消所有請求
      for (const [id, controller] of this.abortControllers.entries()) {
        controller.abort();
        log.info(`已取消圖片生成請求: ${id}`);
      }
      this.abortControllers.clear();
      log.info('已取消所有圖片生成請求');
      return true;
    }
  }
  
  /**
   * 並行執行多個任務
   * @param {Array<Function>} tasks - 任務函數列表
   * @param {number} concurrency - 同時執行的任務數量
   * @returns {Promise<Array>} 任務執行結果
   * @private
   */
  async _runConcurrentTasks(tasks, concurrency) {
    const results = new Array(tasks.length);
    let currentIndex = 0;
    
    // 創建工作函數
    const worker = async () => {
      while (currentIndex < tasks.length) {
        const index = currentIndex++;
        results[index] = await tasks[index]();
      }
    };
    
    // 創建工作線程
    const workers = Array(Math.min(concurrency, tasks.length))
      .fill()
      .map(() => worker());
    
    // 等待所有工作完成
    await Promise.all(workers);
    
    return results;
  }
  
  /**
   * 為每個請求創建唯一ID
   * @returns {string} 請求ID
   * @private
   */
  _createRequestId() {
    return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  }
  
  /**
   * 檢查API金鑰是否有效
   * @param {string} provider - 提供商名稱
   * @param {string} apiKey - API金鑰
   * @returns {Promise<boolean>} 是否有效
   */
  async checkApiKey(provider, apiKey) {
    try {
      if (provider === 'openai') {
        // 測試OpenAI API金鑰
        const response = await this.httpClient.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Hello' }],
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
      } else if (provider === 'stabilityai') {
        // 測試StabilityAI API金鑰
        const response = await this.httpClient.get(
          'https://api.stability.ai/v1/engines/list',
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            }
          }
        );
        
        return response.status === 200;
      }
      
      return false;
    } catch (error) {
      log.error(`檢查 ${provider} API金鑰時出錯:`, error);
      return false;
    }
  }
  
  /**
   * 添加或更新提示詞模板
   * @param {string} name - 模板名稱
   * @param {string} template - 模板內容
   * @returns {boolean} 更新是否成功
   */
  setPromptTemplate(name, template) {
    if (!name || typeof template !== 'string') {
      return false;
    }
    
    this.options.promptTemplates[name] = template;
    return true;
  }
  
  /**
   * 獲取可用的提示詞模板列表
   * @returns {Object} 模板對象
   */
  getPromptTemplates() {
    return {...this.options.promptTemplates};
  }
}

module.exports = ImageGenerationService; 