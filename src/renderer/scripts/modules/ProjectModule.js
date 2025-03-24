/**
 * 項目模塊
 * 負責項目的創建、保存、載入和管理
 */
class ProjectModule {
  constructor() {
    this.projectData = {
      id: this.generateId(),
      name: '未命名項目',
      created: new Date(),
      modified: new Date(),
      title: '',
      artist: '',
      source: '',
      sourceUrl: '',
      language: 'auto',
      lyrics: [],
      slides: [],
      settings: {
        template: 'default',
        resolution: '16:9',
        width: 1920,
        height: 1080
      }
    };
    
    this.savedPath = '';
    this.isModified = false;
    
    console.log('項目模塊已初始化');
  }
  
  /**
   * 初始化模塊
   * @param {Object} dependencies - 依賴模塊
   */
  init(dependencies) {
    this.dialogModule = dependencies.dialogModule;
    this.lyricsModule = dependencies.lyricsModule;
    this.slideModule = dependencies.slideModule;
    this.previewModule = dependencies.previewModule;
    this.exportModule = dependencies.exportModule;
    this.settingsModule = dependencies.settingsModule;
    
    // 檢查electronAPI是否可用
    if (window.electronAPI) {
      // 設置IPC事件監聽器
      window.electronAPI.on('project-open-result', this.handleProjectOpenResult.bind(this));
      window.electronAPI.on('project-save-result', this.handleProjectSaveResult.bind(this));
      console.log('項目模塊IPC事件已設置');
    } else {
      // electronAPI不可用時，顯示警告並以模擬模式繼續
      console.warn('electronAPI不可用，項目模塊將以有限功能運行');
      // 添加此方法以在electronAPI不可用時提供兼容性
      window.electronAPI = window.electronAPI || {
        on: (channel, listener) => {
          console.log(`模擬監聽${channel}事件`);
          // 返回一個空函數，用於移除監聽器時調用
          return () => {};
        },
        send: (channel, ...args) => {
          console.log(`模擬發送${channel}事件:`, args);
        },
        showOpenDialog: () => Promise.resolve({ canceled: true }),
        showSaveDialog: () => Promise.resolve({ canceled: true }),
        getAppPath: () => ''
      };
    }
    
    // 設置模塊間事件監聽
    window.addEventListener('lyrics-updated', this.handleLyricsUpdated.bind(this));
    window.addEventListener('slides-updated', this.handleSlidesUpdated.bind(this));
    
    // 綁定其他UI事件
    this.bindUIEvents();
    
    console.log('項目模塊依賴已初始化');
  }
  
  /**
   * 綁定UI事件
   */
  bindUIEvents() {
    // 在這裡綁定與項目相關的UI事件
    const newProjectBtn = document.getElementById('new-project-btn');
    const openProjectBtn = document.getElementById('open-project-btn');
    const saveProjectBtn = document.getElementById('save-project-btn');
    const saveAsProjectBtn = document.getElementById('save-as-project-btn');
    
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => this.createNewProject());
    }
    
    if (openProjectBtn) {
      openProjectBtn.addEventListener('click', () => this.openProject());
    }
    
    if (saveProjectBtn) {
      saveProjectBtn.addEventListener('click', () => this.saveProject(false));
    }
    
    if (saveAsProjectBtn) {
      saveAsProjectBtn.addEventListener('click', () => this.saveProject(true));
    }
  }
  
  /**
   * 處理項目開啟結果
   * @param {Object} event - 事件對象
   * @param {Object} result - 開啟結果
   */
  handleProjectOpenResult(event, result) {
    if (result.success && result.data) {
      this.loadProjectData(result.data);
    } else {
      window.showNotification('項目開啟失敗: ' + (result.error || '未知錯誤'), 'error');
    }
  }
  
  /**
   * 處理項目保存結果
   * @param {Object} event - 事件對象
   * @param {Object} result - 保存結果
   */
  handleProjectSaveResult(event, result) {
    if (result.success) {
      this.savedPath = result.path;
      this.isModified = false;
      window.showNotification('項目已保存', 'success');
    } else {
      window.showNotification('項目保存失敗: ' + (result.error || '未知錯誤'), 'error');
    }
  }
  
  /**
   * 處理歌詞更新事件
   * @param {Event} event - 事件對象
   */
  handleLyricsUpdated(event) {
    // 更新項目數據中的歌詞
    if (event.detail && event.detail.lyrics) {
      this.projectData.lyrics = event.detail.lyrics;
      this.markAsModified();
    }
  }
  
  /**
   * 處理投影片更新事件
   * @param {Event} event - 事件對象
   */
  handleSlidesUpdated(event) {
    // 更新項目數據中的投影片
    if (event.detail && event.detail.slides) {
      this.projectData.slides = event.detail.slides;
      this.markAsModified();
    }
  }
  
  /**
   * 標記項目為已修改
   */
  markAsModified() {
    if (!this.isModified) {
      this.isModified = true;
      this.projectData.modified = new Date();
      
      // 更新UI以顯示未保存狀態
      const projectNameElement = document.getElementById('project-name');
      if (projectNameElement && !projectNameElement.textContent.endsWith('*')) {
        projectNameElement.textContent += ' *';
      }
    }
  }
  
  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  /**
   * 創建新項目
   */
  createNewProject() {
    // 如果當前項目有未保存的更改，詢問是否儲存
    if (this.isModified) {
      this.confirmSaveBeforeNew();
      return;
    }
    
    // 直接創建新項目
    this.resetProject();
  }
  
  /**
   * 在創建新項目前確認是否儲存當前項目
   */
  confirmSaveBeforeNew() {
    const dialogContent = `
      <div class="dialog-header">
        <h3>未保存的更改</h3>
        <button class="dialog-close" id="close-confirm-dialog">✕</button>
      </div>
      <div class="dialog-body">
        <p>當前項目有未保存的更改，是否在創建新項目前儲存？</p>
      </div>
      <div class="dialog-footer">
        <button id="dont-save-btn" class="action-button">不儲存</button>
        <button id="cancel-new-btn" class="action-button">取消</button>
        <button id="save-before-new-btn" class="action-button primary">儲存</button>
      </div>
    `;
    
    window.dialogModule.showDialog(dialogContent, 'confirm-save-dialog');
    
    // 設置對話框按鈕事件
    const closeBtn = document.getElementById('close-confirm-dialog');
    const dontSaveBtn = document.getElementById('dont-save-btn');
    const cancelBtn = document.getElementById('cancel-new-btn');
    const saveBtn = document.getElementById('save-before-new-btn');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
      });
    }
    
    if (dontSaveBtn) {
      dontSaveBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
        setTimeout(() => {
          this.resetProject();
        }, 300);
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
      });
    }
    
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
        this.saveProject(true, () => {
          this.resetProject();
        });
      });
    }
  }
  
  /**
   * 重設項目到初始狀態
   */
  resetProject() {
    this.projectData = {
      id: this.generateId(),
      name: '未命名項目',
      created: new Date(),
      modified: new Date(),
      title: '',
      artist: '',
      source: '',
      sourceUrl: '',
      language: 'auto',
      lyrics: [],
      slides: [],
      settings: {
        template: 'default',
        resolution: '16:9',
        width: 1920,
        height: 1080
      }
    };
    
    this.savedPath = '';
    this.isModified = false;
    
    // 更新UI
    document.getElementById('project-name').textContent = this.projectData.name;
    document.getElementById('song-title').textContent = '尚未設置歌曲';
    document.getElementById('artist-name').textContent = '未知藝人';
    
    // 清除歌詞和投影片
    if (window.lyricsModule) {
      window.lyricsModule.renderEmptyState();
    }
    
    if (window.slideModule) {
      window.slideModule.clearSlides();
    }
    
    // 通知用戶
    window.showNotification('已創建新項目', 'info');
  }
  
  /**
   * 打開項目
   */
  openProject() {
    // 如果當前項目有未保存的更改，詢問是否儲存
    if (this.isModified) {
      this.confirmSaveBeforeOpen();
      return;
    }
    
    // 直接打開項目
    this.sendOpenProjectRequest();
  }
  
  /**
   * 在打開項目前確認是否儲存當前項目
   */
  confirmSaveBeforeOpen() {
    const dialogContent = `
      <div class="dialog-header">
        <h3>未保存的更改</h3>
        <button class="dialog-close" id="close-confirm-open-dialog">✕</button>
      </div>
      <div class="dialog-body">
        <p>當前項目有未保存的更改，是否在打開新項目前儲存？</p>
      </div>
      <div class="dialog-footer">
        <button id="dont-save-open-btn" class="action-button">不儲存</button>
        <button id="cancel-open-btn" class="action-button">取消</button>
        <button id="save-before-open-btn" class="action-button primary">儲存</button>
      </div>
    `;
    
    window.dialogModule.showDialog(dialogContent, 'confirm-save-open-dialog');
    
    // 設置對話框按鈕事件
    const closeBtn = document.getElementById('close-confirm-open-dialog');
    const dontSaveBtn = document.getElementById('dont-save-open-btn');
    const cancelBtn = document.getElementById('cancel-open-btn');
    const saveBtn = document.getElementById('save-before-open-btn');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
      });
    }
    
    if (dontSaveBtn) {
      dontSaveBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
        setTimeout(() => {
          this.sendOpenProjectRequest();
        }, 300);
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
      });
    }
    
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
        this.saveProject(true, () => {
          this.sendOpenProjectRequest();
        });
      });
    }
  }
  
  /**
   * 發送打開項目請求到主進程
   */
  sendOpenProjectRequest() {
    window.electronAPI.send('open-project');
  }
  
  /**
   * 載入項目數據
   * @param {Object} data - 項目數據
   */
  loadProjectData(data) {
    if (!data) return;
    
    this.projectData = data;
    this.savedPath = data.path || '';
    this.isModified = false;
    
    // 更新UI
    document.getElementById('project-name').textContent = this.projectData.name;
    document.getElementById('song-title').textContent = this.projectData.title || '尚未設置歌曲';
    document.getElementById('artist-name').textContent = this.projectData.artist || '未知藝人';
    
    // 載入歌詞
    if (window.lyricsModule && Array.isArray(this.projectData.lyrics)) {
      window.lyricsModule.lyrics = this.projectData.lyrics;
      window.lyricsModule.renderLyrics();
    }
    
    // 載入投影片
    if (window.slideModule && Array.isArray(this.projectData.slides)) {
      window.slideModule.loadSlides(this.projectData.slides);
    }
    
    // 應用項目設定
    if (this.projectData.settings) {
      this.applyProjectSettings(this.projectData.settings);
    }
  }
  
  /**
   * 應用項目設定
   * @param {Object} settings - 項目設定
   */
  applyProjectSettings(settings) {
    // 應用到投影片模塊
    if (window.slideModule) {
      window.slideModule.applyTemplate(settings.template);
      window.slideModule.setResolution(settings.width, settings.height);
    }
    
    // 應用其他設定
    // TODO: 添加更多設定的應用
  }
  
  /**
   * 保存項目
   * @param {boolean} saveAs - 是否另存為
   * @param {Function} callback - 保存完成後的回調函數
   */
  saveProject(saveAs = false, callback) {
    try {
      // 如果需要另存為或尚未設置保存路徑
      if (saveAs || !this.savedPath) {
        this.showSaveDialog((filePath) => {
          if (filePath) {
            this.saveProjectToPath(filePath, callback);
          }
        });
      } else {
        // 直接保存到已有路徑
        this.saveProjectToPath(this.savedPath, callback);
      }
    } catch (error) {
      console.error('項目保存錯誤:', error);
      if (window.modules && window.modules.dialogModule) {
        window.modules.dialogModule.showAlertDialog(
          `保存項目時發生錯誤: ${error.message}`, 
          '保存失敗', 
          'error'
        );
      }
    }
  }
  
  /**
   * 顯示保存對話框
   * @param {Function} callback - 選擇文件後的回調函數
   */
  showSaveDialog(callback) {
    if (!window.electronAPI) {
      console.error('無法訪問 electronAPI');
      return;
    }
    
    // 設置對話框選項
    const options = {
      title: '保存項目',
      defaultPath: this.savedPath || window.electronAPI.getAppPath('documents'),
      filters: [
        { name: '歌曲投影片項目', extensions: ['lsp'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    };
    
    // 顯示保存對話框
    window.electronAPI.showSaveDialog(options)
      .then(result => {
        if (!result.canceled && result.filePath) {
          callback(result.filePath);
        }
      })
      .catch(error => {
        console.error('顯示保存對話框時出錯:', error);
        if (window.modules && window.modules.dialogModule) {
          window.modules.dialogModule.showAlertDialog(
            `顯示保存對話框時發生錯誤: ${error.message}`, 
            '錯誤', 
            'error'
          );
        }
      });
  }
  
  /**
   * 將項目保存到指定路徑
   * @param {string} filePath - 保存路徑
   * @param {Function} callback - 保存完成後的回調函數
   */
  saveProjectToPath(filePath, callback) {
    try {
      // 準備保存數據
      const dataToSave = this.prepareProjectDataForSave();
      
      // 檢查文件擴展名
      let pathToSave = filePath;
      if (!pathToSave.toLowerCase().endsWith('.lsp')) {
        pathToSave += '.lsp';
      }
      
      console.log('保存項目到:', pathToSave);
      
      // 更新項目信息
      this.projectData.modified = new Date();
      
      // 如果是首次保存，可能需要設置項目名稱
      if (!this.savedPath) {
        // 從文件路徑提取項目名稱
        const pathParts = pathToSave.split(/[/\\]/);
        const fileName = pathParts[pathParts.length - 1];
        const projectName = fileName.replace(/\.lsp$/i, '');
        
        // 更新項目名稱
        this.projectData.name = projectName;
      }
      
      // 保存路徑
      this.savedPath = pathToSave;
      
      // 將數據轉換為JSON字符串
      const jsonData = JSON.stringify(dataToSave, null, 2);
      
      // 發送保存請求到主進程
      window.electronAPI.send('save-project', {
        path: pathToSave,
        data: jsonData
      });
      
      // 標記為未修改
      this.isModified = false;
      
      // 更新UI
      document.getElementById('project-name').textContent = this.projectData.name;
      
      // 顯示通知
      if (window.showNotification) {
        window.showNotification('項目已成功保存', 'success');
      }
      
      // 執行回調
      if (typeof callback === 'function') {
        callback(true);
      }
    } catch (error) {
      console.error('保存項目時出錯:', error);
      
      if (window.modules && window.modules.dialogModule) {
        window.modules.dialogModule.showAlertDialog(
          `保存項目時發生錯誤: ${error.message}`, 
          '保存失敗', 
          'error'
        );
      }
      
      // 執行回調並標記失敗
      if (typeof callback === 'function') {
        callback(false);
      }
    }
  }
  
  /**
   * 準備項目數據用於保存
   * @returns {Object} 準備好的項目數據
   */
  prepareProjectDataForSave() {
    // 創建數據副本，避免修改原始數據
    const saveData = JSON.parse(JSON.stringify(this.projectData));
    
    // 添加保存路徑信息
    saveData.path = this.savedPath;
    
    // 添加項目版本信息
    saveData.appVersion = {
      version: '1.0.0', // 應該從主進程獲取
      saveFormat: '1'
    };
    
    // 添加時間戳
    saveData.saveTime = new Date().toISOString();
    
    return saveData;
  }
  
  /**
   * 添加資源到項目
   * @param {Object} resource - 資源對象
   * @returns {string} 資源ID
   */
  addResource(resource) {
    // 確保資源有一個ID
    if (!resource.id) {
      resource.id = this.generateId();
    }
    
    // 確保項目有資源數組
    if (!this.projectData.resources) {
      this.projectData.resources = [];
    }
    
    // 添加資源
    this.projectData.resources.push(resource);
    
    // 標記項目為已修改
    this.markAsModified();
    
    // 返回資源ID
    return resource.id;
  }
  
  /**
   * 獲取資源
   * @param {string} resourceId - 資源ID
   * @returns {Object|null} 資源對象或null
   */
  getResource(resourceId) {
    // 確保項目有資源數組
    if (!this.projectData.resources) {
      return null;
    }
    
    // 查找並返回資源
    return this.projectData.resources.find(r => r.id === resourceId) || null;
  }
  
  /**
   * 更新項目信息
   * @param {Object} info - 項目信息
   */
  updateProjectInfo(info) {
    // 更新項目信息
    if (info.title !== undefined) {
      this.projectData.title = info.title;
      
      // 更新UI
      const titleElement = document.getElementById('song-title');
      if (titleElement) {
        titleElement.textContent = info.title || '尚未設置歌曲';
      }
    }
    
    if (info.artist !== undefined) {
      this.projectData.artist = info.artist;
      
      // 更新UI
      const artistElement = document.getElementById('artist-name');
      if (artistElement) {
        artistElement.textContent = info.artist || '未知藝人';
      }
    }
    
    if (info.source !== undefined) {
      this.projectData.source = info.source;
    }
    
    if (info.sourceUrl !== undefined) {
      this.projectData.sourceUrl = info.sourceUrl;
    }
    
    if (info.language !== undefined) {
      this.projectData.language = info.language;
    }
    
    if (info.lyrics !== undefined) {
      this.projectData.lyrics = info.lyrics;
    }
    
    // 標記項目為已修改
    this.markAsModified();
  }
  
  /**
   * 獲取項目數據
   * @returns {Object} 項目數據
   */
  getProjectData() {
    return this.projectData;
  }
  
  /**
   * 獲取當前保存路徑
   * @returns {string} 保存路徑
   */
  getSavedPath() {
    return this.savedPath;
  }
  
  /**
   * 設置保存路徑
   * @param {string} path - 保存路徑
   */
  setSavedPath(path) {
    this.savedPath = path;
  }
  
  /**
   * 檢查項目是否已修改
   * @returns {boolean} 是否已修改
   */
  checkIfModified() {
    return this.isModified;
  }
}

// 全局導出
window.ProjectModule = ProjectModule; 