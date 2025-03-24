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
   * @param {boolean} forceSaveAs - 是否強制另存為
   * @param {Function} callback - 保存後的回調函數
   */
  saveProject(forceSaveAs = false, callback = null) {
    // 如果沒有保存路徑或需要另存為，則請求保存路徑
    if (!this.savedPath || forceSaveAs) {
      window.electronAPI.send('save-project-as', this.prepareProjectDataForSave());
    } else {
      window.electronAPI.send('save-project', this.prepareProjectDataForSave());
    }
    
    // 保存回調
    if (callback) {
      const handleSaved = (success) => {
        if (success) {
          callback();
          window.electronAPI.removeListener('project-saved', handleSaved);
        }
      };
      
      window.electronAPI.receive('project-saved', handleSaved);
    }
  }
  
  /**
   * 準備項目數據用於保存
   * @returns {Object} 項目數據
   */
  prepareProjectDataForSave() {
    // 更新修改時間
    this.projectData.modified = new Date();
    
    // 獲取最新的歌詞數據
    if (window.lyricsModule) {
      this.projectData.lyrics = window.lyricsModule.getLyricsData();
    }
    
    // 獲取最新的投影片數據
    if (window.slideModule) {
      this.projectData.slides = window.slideModule.getSlidesData();
    }
    
    // 添加路徑（如果有）
    if (this.savedPath) {
      this.projectData.path = this.savedPath;
    }
    
    return this.projectData;
  }
  
  /**
   * 更新項目信息
   * @param {Object} info - 項目信息
   */
  updateProjectInfo(info) {
    if (!info) return;
    
    // 更新項目數據
    if (info.title) {
      this.projectData.title = info.title;
      this.projectData.name = info.title; // 同時更新項目名稱
    }
    
    if (info.artist) {
      this.projectData.artist = info.artist;
    }
    
    if (info.source) {
      this.projectData.source = info.source;
    }
    
    if (info.sourceUrl) {
      this.projectData.sourceUrl = info.sourceUrl;
    }
    
    if (info.language) {
      this.projectData.language = info.language;
    }
    
    // 標記項目已修改
    this.isModified = true;
    
    // 更新UI
    if (info.title) {
      document.getElementById('project-name').textContent = info.title;
    }
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
   * 標記項目已修改
   */
  markAsModified() {
    this.isModified = true;
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