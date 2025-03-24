const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = require('electron-log');

/**
 * 圖像生成服務
 * 支持多種AI圖像生成API的接入
 */
class ImageGenerationService {
  constructor(options = {}) {
    this.options = {
      // API金鑰
      apiKeys: {
        openai: options.apiKeys?.openai || '',
        stabilityai: options.apiKeys?.stabilityai || '',
      },
      // 默認參數
      defaultParams: {
        prompt: options.defaultParams?.prompt || '',
        negativePrompt: options.defaultParams?.negativePrompt || '',
        width: options.defaultParams?.width || 1024,
        height: options.defaultParams?.height || 576,
        provider: options.defaultParams?.provider || 'openai',
        model: options.defaultParams?.model || 'dall-e-3',
        style: options.defaultParams?.style || 'natural',
        quality: options.defaultParams?.quality || 'standard',
        orientation: options.defaultParams?.orientation || 'landscape'
      },
      // 緩存設置
      cacheEnabled: options.cacheEnabled !== undefined ? options.cacheEnabled : true,
      cachePath: options.cachePath || path.join(process.env.APPDATA || process.env.HOME, '.lyrics-to-slides', 'cache'),
      // 超時設置
      timeout: options.timeout || 60000,
      // 代理設置
      proxy: options.proxy || null
    };
    
    // 確保緩存目錄存在
    if (this.options.cacheEnabled) {
      try {
        if (!fs.existsSync(this.options.cachePath)) {
          fs.mkdirSync(this.options.cachePath, { recursive: true });
        }
      } catch (error) {
        log.error('創建緩存目錄失敗:', error);
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
   * @returns {Promise<Object>} 生成結果
   */
  async generateImage(params) {
    // 合併默認參數
    const mergedParams = {
      ...this.options.defaultParams,
      ...params
    };
    
    // 檢查緩存
    if (this.options.cacheEnabled) {
      const cachedImage = this._checkCache(mergedParams);
      if (cachedImage) {
        return {
          success: true,
          provider: mergedParams.provider,
          model: mergedParams.model,
          filePath: cachedImage,
          fromCache: true,
          imageData: fs.readFileSync(cachedImage, { encoding: 'base64' }),
          metadata: {
            provider: mergedParams.provider,
            model: mergedParams.model,
            prompt: mergedParams.prompt,
            cached: true
          }
        };
      }
    }
    
    // 根據提供商生成圖像
    switch (mergedParams.provider.toLowerCase()) {
      case 'openai':
        return this.generateWithOpenAI(mergedParams);
      case 'stabilityai':
        return this.generateWithStabilityAI(mergedParams);
      default:
        throw new Error(`不支持的圖像生成提供商: ${mergedParams.provider}`);
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
}

module.exports = ImageGenerationService; 