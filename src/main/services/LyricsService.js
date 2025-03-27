const log = require('electron-log');

class LyricsService {
  /**
   * 更新服務選項
   * @param {Object} options - 新的選項
   */
  updateOptions(options) {
    if (!options) return;
    
    // 更新API金鑰
    if (options.apiKeys) {
      this.options.apiKeys = {
        ...this.options.apiKeys,
        ...options.apiKeys
      };
      
      // 記錄更新的API金鑰
      const updatedKeys = Object.keys(options.apiKeys);
      log.info(`歌詞服務: 已更新API金鑰: ${updatedKeys.join(', ')}`);
      
      // 特別檢查Google API金鑰
      if (options.apiKeys.google !== undefined) {
        log.info(`歌詞服務: Google API金鑰狀態: ${options.apiKeys.google ? '已設置' : '未設置'}`);
      }
    }
    
    // 更新搜尋引擎ID
    if (options.searchEngineId !== undefined) {
      this.options.searchEngineId = options.searchEngineId;
      log.info(`歌詞服務: 搜尋引擎ID: ${options.searchEngineId ? '已設置' : '未設置'}`);
    }
    
    // 當設置好Google API和搜尋引擎ID時，初始化Google客戶端
    if (this.options.apiKeys?.google && this.options.searchEngineId) {
      try {
        log.info('歌詞服務: 嘗試初始化Google搜尋客戶端');
        this._initGoogleClient();
      } catch (error) {
        log.error('歌詞服務: 初始化Google搜尋客戶端失敗:', error);
      }
    }
  }
} 