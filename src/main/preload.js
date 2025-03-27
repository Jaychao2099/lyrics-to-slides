/**
 * 預載入腳本
 * 為渲染進程提供安全的 API，用於與主進程通信
 */

const { contextBridge, ipcRenderer } = require('electron');

// 定義暴露給渲染進程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 發送消息到主進程
   * @param {string} channel - 頻道名稱
   * @param {...any} args - 發送的參數
   */
  send: (channel, ...args) => {
    // 白名單頻道
    const validChannels = [
      'minimize-window',
      'maximize-window',
      'close-window',
      'new-project',
      'open-project',
      'save-project',
      'save-project-as',
      'search-lyrics',
      'get-lyrics',
      'generate-image',
      'export-slideshow',
      'select-output-path',
      'get-settings',
      'update-settings',
      'open-dev-tools',
      'renderer-ready',
      'onboarding-complete',
      'import-lyrics-text',
      'menu-new-project',
      'menu-open-project',
      'menu-save-project',
      'menu-save-project-as',
      'menu-search-lyrics',
      'menu-export',
      'menu-theme-changed',
      'menu-preferences',
      'menu-api-keys',
      'menu-check-updates',
      'cancel-export',
      'cancel-image-generation',
      'app-ready',
      'check-for-updates'
    ];
    
    if (validChannels.includes(channel)) {
      console.log(`preload: 發送 ${channel} 訊息`);
      ipcRenderer.send(channel, ...args);
    } else {
      console.error(`preload: 嘗試發送未授權頻道 ${channel} 的訊息`);
    }
  },
  
  /**
   * 接收主進程的消息
   * @param {string} channel - 頻道名稱
   * @param {Function} callback - 回調函數
   */
  receive: (channel, callback) => {
    // 白名單頻道
    const validChannels = [
      'project-created',
      'project-loaded',
      'project-saved',
      'lyrics-search-result',
      'lyrics-content',
      'image-generation-started',
      'image-generation-progress',
      'image-generated',
      'export-started',
      'export-progress',
      'export-complete',
      'output-path-selected',
      'settings-data',
      'settings-updated',
      'update-available',
      'update-downloaded',
      'setup-completed',
      'menu-new-project',
      'menu-open-project',
      'menu-save-project',
      'menu-save-project-as',
      'menu-search-lyrics',
      'menu-export',
      'menu-theme-changed',
      'menu-preferences',
      'menu-api-keys',
      'menu-check-updates',
      'show-lyrics-search-dialog',
      'show-lyrics-import-dialog'
    ];
    
    if (validChannels.includes(channel)) {
      // 通過闔上函數確保 callback 只有在接收到消息時才能被調用
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      
      // 返回取消訂閱函數
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
  },
  
  /**
   * 移除特定頻道的監聽器
   * @param {string} channel - 頻道名稱
   * @param {Function} listener - 之前註冊的監聽器
   */
  removeListener: (channel, listener) => {
    if (listener) {
      ipcRenderer.removeListener(channel, listener);
    }
  },
  
  /**
   * 移除特定頻道的所有監聽器
   * @param {string} channel - 頻道名稱
   */
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  /**
   * 獲取應用版本信息
   * @returns {Promise<Object>} 版本信息
   */
  getVersionInfo: () => ipcRenderer.invoke('get-version-info'),
  
  /**
   * 獲取系統信息
   * @returns {Object} 系統信息
   */
  getSystemInfo: () => ({
    platform: process.platform,
    arch: process.arch,
    version: process.versions.electron,
    osVersion: process.getSystemVersion ? process.getSystemVersion() : 'unknown',
    cpuCores: navigator.hardwareConcurrency || 1,
    totalMemory: 'N/A',
    freeMemory: 'N/A',
    hostname: 'user-device'
  }),
  
  // 打開開發者工具
  openDevTools: () => ipcRenderer.send('open-dev-tools'),
  
  // 檔案對話框
  showOpenDialog: (options) => {
    console.log('preload: 呼叫showOpenDialog, 選項:', options);
    try {
      // 處理選項，確保它們是安全的
      const safeOptions = {
        ...options,
        properties: Array.isArray(options.properties) ? options.properties : ['openDirectory'],
        title: options.title || '選擇目錄',
        buttonLabel: options.buttonLabel || '選擇'
      };
      
      console.log('preload: 處理後的對話框選項:', safeOptions);
      
      return ipcRenderer.invoke('show-open-dialog', safeOptions)
        .then(result => {
          console.log('preload: showOpenDialog成功結果:', result);
          return result;
        })
        .catch(err => {
          console.error('preload: showOpenDialog錯誤:', err);
          // 創建更友好的錯誤對象返回給渲染進程
          return {
            canceled: true,
            error: {
              message: err.message || '選擇檔案時發生錯誤',
              code: err.code || 'UNKNOWN_ERROR'
            }
          };
        });
    } catch (error) {
      console.error('preload: 調用showOpenDialog時發生異常:', error);
      // 返回一個取消狀態而不是拋出錯誤，讓UI可以處理
      return Promise.resolve({
        canceled: true,
        error: {
          message: error.message || '處理檔案對話框請求時發生錯誤',
          code: 'PROCESS_ERROR'
        }
      });
    }
  },
  showSaveDialog: (options) => {
    console.log('preload: 呼叫showSaveDialog');
    return ipcRenderer.invoke('show-save-dialog', options);
  },
  showMessageBox: (options) => {
    console.log('preload: 呼叫showMessageBox');
    return ipcRenderer.invoke('show-message-box', options);
  },
  
  // 外部連結
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
  
  // 應用程序路徑
  getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
  
  // 配置存儲
  getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', key, value),
  
  // 更新設置
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  
  // 項目相關功能
  loadProject: (filePath) => ipcRenderer.invoke('load-project', filePath),
  exportSlideshow: (options) => ipcRenderer.invoke('export-slideshow', options),
  
  // 歌詞相關
  searchLyrics: (query) => ipcRenderer.invoke('search-lyrics', query),
  getLyrics: (resultId) => ipcRenderer.invoke('get-lyrics', resultId),
  
  // 圖像生成相關
  generateImage: (params) => ipcRenderer.invoke('generate-image', params),
  
  // 應用程序更新相關
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  // 引導設置相關
  onboardingComplete: (data) => {
    console.log('preload: 調用 onboardingComplete 方法，數據:', data);
    try {
      ipcRenderer.send('onboarding-complete', data);
      console.log('preload: 成功發送 onboarding-complete 事件');
      return true;
    } catch (error) {
      console.error('preload: 發送 onboarding-complete 事件時出錯:', error);
      return false;
    }
  },
  
  // 事件監聽器
  on: (channel, callback) => {
    // 允許的事件通道
    const validChannels = [
      'update-available',
      'download-progress',
      'update-downloaded',
      'lyrics-search-result',
      'image-generation-progress',
      'image-generation-complete',
      'export-progress',
      'export-complete',
      'project-saved',
      'project-loaded',
      'menu-new-project',
      'menu-open-project',
      'menu-save-project',
      'menu-save-project-as',
      'menu-search-lyrics',
      'menu-export',
      'menu-theme-changed',
      'menu-preferences',
      'menu-api-keys',
      'menu-check-updates'
    ];
    
    if (validChannels.includes(channel)) {
      // 移除舊的監聽器以避免重複註冊
      ipcRenderer.removeAllListeners(channel);
      
      // 設置新的監聽器
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      
      // 返回一個清理函數，用於移除監聽器
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
  }
});

// 應用程序可用後通知主進程
window.addEventListener('DOMContentLoaded', () => {
  // 在DOMContentLoaded事件後通知主進程渲染器已準備好
  console.log('preload: DOM已載入，通知主進程渲染器已準備好');
  ipcRenderer.send('renderer-ready');
}); 