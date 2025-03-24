/**
 * 數據庫模組
 * 
 * 提供對本地SQLite數據庫的操作接口
 * 用於存儲用戶數據、歌詞緩存、設置等
 */

// 暫時使用內存存儲替代SQLite數據庫
// 後續會使用better-sqlite3重新實現
const memoryStorage = {
  lyrics: new Map(),
  projects: new Map(),
  settings: new Map(),
};

/**
 * 數據庫模組
 */
const Database = {
  /**
   * 初始化數據庫
   * @returns {Promise<void>}
   */
  init: async () => {
    console.log('初始化臨時數據庫');
    return Promise.resolve();
  },

  /**
   * 存儲歌詞
   * @param {string} songId - 歌曲ID
   * @param {Object} lyricsData - 歌詞數據
   * @returns {Promise<void>}
   */
  storeLyrics: async (songId, lyricsData) => {
    memoryStorage.lyrics.set(songId, {
      ...lyricsData,
      timestamp: Date.now()
    });
    return Promise.resolve();
  },

  /**
   * 獲取歌詞
   * @param {string} songId - 歌曲ID
   * @returns {Promise<Object>} 歌詞數據
   */
  getLyrics: async (songId) => {
    return Promise.resolve(memoryStorage.lyrics.get(songId) || null);
  },

  /**
   * 獲取所有歌詞
   * @returns {Promise<Array>} 歌詞數據數組
   */
  getAllLyrics: async () => {
    return Promise.resolve(
      Array.from(memoryStorage.lyrics.entries()).map(([id, data]) => ({
        id,
        ...data,
      }))
    );
  },

  /**
   * 存儲項目
   * @param {string} projectId - 項目ID
   * @param {Object} projectData - 項目數據
   * @returns {Promise<void>}
   */
  storeProject: async (projectId, projectData) => {
    memoryStorage.projects.set(projectId, {
      ...projectData,
      lastModified: Date.now()
    });
    return Promise.resolve();
  },

  /**
   * 獲取項目
   * @param {string} projectId - 項目ID
   * @returns {Promise<Object>} 項目數據
   */
  getProject: async (projectId) => {
    return Promise.resolve(memoryStorage.projects.get(projectId) || null);
  },

  /**
   * 獲取所有項目
   * @returns {Promise<Array>} 項目數據數組
   */
  getAllProjects: async () => {
    return Promise.resolve(
      Array.from(memoryStorage.projects.entries()).map(([id, data]) => ({
        id,
        ...data,
      }))
    );
  },

  /**
   * 刪除項目
   * @param {string} projectId - 項目ID
   * @returns {Promise<boolean>} 是否成功
   */
  deleteProject: async (projectId) => {
    const result = memoryStorage.projects.delete(projectId);
    return Promise.resolve(result);
  },

  /**
   * 存儲設置
   * @param {string} key - 設置鍵
   * @param {any} value - 設置值
   * @returns {Promise<void>}
   */
  storeSetting: async (key, value) => {
    memoryStorage.settings.set(key, value);
    return Promise.resolve();
  },

  /**
   * 獲取設置
   * @param {string} key - 設置鍵
   * @returns {Promise<any>} 設置值
   */
  getSetting: async (key) => {
    return Promise.resolve(memoryStorage.settings.get(key) || null);
  },

  /**
   * 獲取所有設置
   * @returns {Promise<Object>} 設置對象
   */
  getAllSettings: async () => {
    const settings = {};
    memoryStorage.settings.forEach((value, key) => {
      settings[key] = value;
    });
    return Promise.resolve(settings);
  },

  /**
   * 清除所有數據
   * @returns {Promise<void>}
   */
  clear: async () => {
    memoryStorage.lyrics.clear();
    memoryStorage.projects.clear();
    memoryStorage.settings.clear();
    return Promise.resolve();
  }
};

module.exports = Database; 