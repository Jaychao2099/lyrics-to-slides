/**
 * 預載入腳本
 * 為渲染進程提供安全的 API，用於與主進程通信
 */

const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

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
      'update-settings'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
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
      'update-downloaded'
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
    osVersion: os.release(),
    cpuCores: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    hostname: os.hostname()
  }),
  
  // 檔案對話框
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  
  // 外部連結
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
  
  // 應用程序路徑
  getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
  
  // 配置存儲
  getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', key, value),
  
  // 項目相關功能
  loadProject: (filePath) => ipcRenderer.invoke('load-project', filePath),
  exportSlideshow: (options) => ipcRenderer.invoke('export-slideshow', options),
  
  // 歌詞相關
  searchLyrics: (query) => ipcRenderer.invoke('search-lyrics', query),
  
  // 圖像生成相關
  generateImage: (params) => ipcRenderer.invoke('generate-image', params),
  
  // 應用程序更新相關
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
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
      'project-loaded'
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
  },
  
  // 發送一次性事件
  send: (channel, data) => {
    // 允許的事件通道
    const validChannels = [
      'onboarding-complete'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  }
});

// 應用程序可用後通知主進程
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.send('renderer-ready');
}); 