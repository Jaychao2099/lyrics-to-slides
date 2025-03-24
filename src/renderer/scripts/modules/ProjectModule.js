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
    this._isSaving = false;
    
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
        getAppPath: (path) => Promise.resolve(path || 'documents')
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
   * 更新項目信息
   * @param {Object} info - 項目信息對象
   */
  updateProjectInfo(info) {
    // 檢查參數
    if (!info) {
      console.warn('updateProjectInfo: 沒有提供有效的信息');
      return;
    }
    
    // 更新項目數據
    if (info.title !== undefined) this.projectData.title = info.title;
    if (info.artist !== undefined) this.projectData.artist = info.artist;
    if (info.source !== undefined) this.projectData.source = info.source;
    if (info.sourceUrl !== undefined) this.projectData.sourceUrl = info.sourceUrl;
    if (info.language !== undefined) this.projectData.language = info.language;
    
    // 如果提供了歌詞數據，更新歌詞
    if (info.lyrics) {
      this.projectData.lyrics = info.lyrics;
      
      // 通知其他模塊歌詞已更新
      window.dispatchEvent(new CustomEvent('project-lyrics-updated', {
        detail: { lyrics: info.lyrics }
      }));
    }
    
    // 如果提供了投影片數據，更新投影片
    if (info.slides) {
      this.projectData.slides = info.slides;
      
      // 通知其他模塊投影片已更新
      window.dispatchEvent(new CustomEvent('project-slides-updated', {
        detail: { slides: info.slides }
      }));
    }
    
    // 更新UI
    this.updateUIWithProjectInfo();
    
    // 標記項目為已修改
    this.markAsModified();
    
    console.log('項目信息已更新:', info);
  }
  
  /**
   * 更新UI以顯示項目信息
   */
  updateUIWithProjectInfo() {
    // 更新項目名稱
    const projectNameElement = document.getElementById('project-name');
    if (projectNameElement) {
      projectNameElement.textContent = this.projectData.name + (this.isModified ? ' *' : '');
    }
    
    // 更新歌曲標題
    const songTitleElement = document.getElementById('song-title');
    if (songTitleElement) {
      songTitleElement.textContent = this.projectData.title || '尚未設置歌曲';
    }
    
    // 更新藝人名稱
    const artistElement = document.getElementById('artist-name');
    if (artistElement) {
      artistElement.textContent = this.projectData.artist || '未知藝人';
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
    console.log(`開始保存項目，另存為: ${saveAs}, 現有路徑: ${this.savedPath}`);
    
    // 阻止遞迴調用
    if (this._isSaving) {
      console.warn('項目正在保存中，請稍候...');
      return;
    }
    
    this._isSaving = true;
    
    try {
      // 如果需要另存為或尚未設置保存路徑
      if (saveAs || !this.savedPath) {
        console.log('顯示保存對話框');
        
        // 使用對話框選擇保存位置
        this.showSaveDialog((filePath) => {
          if (filePath) {
            console.log(`用戶選擇的保存路徑: ${filePath}`);
            this.saveProjectToPath(filePath, (success) => {
              this._isSaving = false;
              if (typeof callback === 'function') {
                callback(success);
              }
            });
          } else {
            console.log('用戶取消了保存操作');
            this._isSaving = false;
            if (typeof callback === 'function') {
              callback(false);
            }
          }
        });
      } else {
        // 直接保存到已有路徑
        console.log(`直接保存到現有路徑: ${this.savedPath}`);
        this.saveProjectToPath(this.savedPath, (success) => {
          this._isSaving = false;
          if (typeof callback === 'function') {
            callback(success);
          }
        });
      }
    } catch (error) {
      console.error('項目保存錯誤:', error);
      this._isSaving = false;
      
      if (window.modules && window.modules.dialogModule) {
        window.modules.dialogModule.showAlertDialog(
          `保存項目時發生錯誤: ${error.message}`, 
          '保存失敗', 
          'error'
        );
      } else {
        alert(`保存項目時發生錯誤: ${error.message}`);
      }
      
      if (typeof callback === 'function') {
        callback(false);
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
    
    try {
      // 設置對話框選項
      const options = {
        title: '保存項目',
        filters: [
          { name: '歌曲投影片項目', extensions: ['lsp'] },
          { name: '所有文件', extensions: ['*'] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      };
      
      // 添加預設路徑 (直接使用字符串而非函數返回值)
      if (this.savedPath) {
        options.defaultPath = this.savedPath;
      } else {
        // 使用固定路徑或通過非同步方式獲取文檔路徑
        window.electronAPI.getAppPath('documents')
          .then(docPath => {
            options.defaultPath = docPath;
            this.showSaveDialogWithOptions(options, callback);
          })
          .catch(err => {
            console.warn('無法獲取文檔路徑:', err);
            // 在錯誤情況下仍然顯示對話框，但沒有預設路徑
            this.showSaveDialogWithOptions(options, callback);
          });
        return;
      }
      
      // 如果已有savedPath，直接顯示對話框
      this.showSaveDialogWithOptions(options, callback);
    } catch (error) {
      console.error('準備保存對話框時出錯:', error);
      if (window.modules && window.modules.dialogModule) {
        window.modules.dialogModule.showAlertDialog(
          `準備保存對話框時發生錯誤: ${error.message}`, 
          '錯誤', 
          'error'
        );
      }
    }
  }
  
  /**
   * 使用指定選項顯示保存對話框
   * @param {Object} options - 對話框選項
   * @param {Function} callback - 選擇文件後的回調函數
   */
  showSaveDialogWithOptions(options, callback) {
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
      // 檢查路徑有效性
      if (!filePath) {
        throw new Error('保存路徑無效');
      }
      
      console.log('準備保存項目到:', filePath);
      
      // 準備保存數據
      const dataToSave = this.prepareProjectDataForSave();
      
      // 檢查文件擴展名
      let pathToSave = filePath;
      if (!pathToSave.toLowerCase().endsWith('.lsp')) {
        pathToSave += '.lsp';
      }
      
      console.log('最終保存路徑:', pathToSave);
      
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
        console.log('更新項目名稱為:', projectName);
      }
      
      // 保存路徑
      this.savedPath = pathToSave;
      
      // 將數據轉換為JSON字符串
      let jsonData;
      try {
        jsonData = JSON.stringify(dataToSave);
        console.log('數據已序列化，大小約為:', Math.round(jsonData.length / 1024), 'KB');
      } catch (jsonError) {
        throw new Error(`無法序列化項目數據: ${jsonError.message}`);
      }
      
      // 發送保存請求到主進程
      if (window.electronAPI && typeof window.electronAPI.send === 'function') {
        window.electronAPI.send('save-project', {
          path: pathToSave,
          data: jsonData
        });
        
        console.log('已發送保存請求到主進程');
        
        // 標記為未修改
        this.isModified = false;
        
        // 更新UI
        const projectNameElement = document.getElementById('project-name');
        if (projectNameElement) {
          projectNameElement.textContent = this.projectData.name;
        }
        
        // 顯示通知
        if (window.showNotification) {
          window.showNotification('項目已成功保存', 'success');
        } else {
          console.log('項目已成功保存');
        }
        
        // 執行回調
        if (typeof callback === 'function') {
          callback(true);
        }
      } else {
        throw new Error('無法發送保存請求到主進程');
      }
    } catch (error) {
      console.error('保存項目時出錯:', error);
      
      // 顯示錯誤消息
      if (window.modules && window.modules.dialogModule) {
        window.modules.dialogModule.showAlertDialog(
          `保存項目時發生錯誤: ${error.message}`, 
          '保存失敗', 
          'error'
        );
      } else {
        alert(`保存項目時發生錯誤: ${error.message}`);
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
    try {
      // 創建淺拷貝，避免修改原始數據
      const tempData = { ...this.projectData };
      
      // 過濾不需要保存的屬性
      const keysToRemove = ['_tempData', 'unsavedChanges', 'previewCache'];
      keysToRemove.forEach(key => {
        if (tempData[key]) delete tempData[key];
      });
      
      // 確保沒有循環引用和不可序列化的對象
      const processObject = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        
        // 處理數組
        if (Array.isArray(obj)) {
          return obj.map(item => processObject(item));
        }
        
        // 處理普通對象
        const newObj = {};
        for (const [key, value] of Object.entries(obj)) {
          // 跳過函數和DOM元素等不可序列化的對象
          if (typeof value === 'function') continue;
          if (value instanceof Element) continue;
          if (value instanceof HTMLCollection) continue;
          if (value instanceof NodeList) continue;
          
          // 遞歸處理嵌套對象
          newObj[key] = processObject(value);
        }
        return newObj;
      };
      
      // 處理整個數據對象
      const cleanData = processObject(tempData);
      
      // 添加保存路徑信息
      cleanData.path = this.savedPath;
      
      // 添加項目版本信息
      cleanData.appVersion = {
        version: '1.0.0', // 應該從主進程獲取
        saveFormat: '1'
      };
      
      // 添加時間戳
      cleanData.saveTime = new Date().toISOString();
      
      return cleanData;
    } catch (error) {
      console.error('準備保存數據時發生錯誤:', error);
      // 嘗試提供基本可用的數據
      return {
        id: this.projectData.id || this.generateId(),
        name: this.projectData.name || '未命名項目',
        created: this.projectData.created || new Date(),
        modified: new Date(),
        lyrics: [],
        slides: [],
        path: this.savedPath,
        appVersion: { version: '1.0.0', saveFormat: '1' },
        saveTime: new Date().toISOString()
      };
    }
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
  
  /**
   * 更新預覽視窗
   * 當切換到預覽部分時調用
   */
  updatePreview() {
    console.log('更新預覽視窗');
    
    // 如果沒有加載項目，顯示提示
    if (!this.projectData || !this.projectData.slides || this.projectData.slides.length === 0) {
      const previewContainer = document.getElementById('preview-container');
      if (previewContainer) {
        previewContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">👋</div>
            <h3>沒有可預覽的內容</h3>
            <p>請先在歌詞編輯部分添加歌詞，或在設計部分創建投影片</p>
          </div>
        `;
      }
      return;
    }
    
    // 獲取預覽模塊
    const previewModule = this.previewModule || window.previewModule || window.modules?.previewModule;
    if (previewModule && typeof previewModule.renderPreview === 'function') {
      previewModule.renderPreview(this.projectData);
    } else {
      console.warn('預覽模塊不可用或缺少renderPreview方法');
      
      // 基本預覽實現
      this.renderBasicPreview();
    }
  }
  
  /**
   * 基本預覽實現（當預覽模塊不可用時）
   */
  renderBasicPreview() {
    const previewContainer = document.getElementById('preview-container');
    if (!previewContainer) return;
    
    let previewHtml = '<div class="preview-slides">';
    
    // 生成簡單的投影片預覽
    (this.projectData.slides || []).forEach((slide, index) => {
      const slideContent = slide.content || '';
      previewHtml += `
        <div class="preview-slide">
          <div class="preview-slide-content">
            <div class="preview-slide-number">${index + 1}</div>
            <div class="preview-slide-text">${slideContent}</div>
          </div>
        </div>
      `;
    });
    
    previewHtml += '</div>';
    previewContainer.innerHTML = previewHtml;
  }
  
  /**
   * 更新設計視窗
   * 當切換到設計部分時調用
   */
  updateDesignView() {
    console.log('更新設計視窗');
    
    // 如果沒有加載項目，顯示提示
    if (!this.projectData || !this.projectData.slides || this.projectData.slides.length === 0) {
      const designContainer = document.getElementById('design-container');
      if (designContainer) {
        designContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">✏️</div>
            <h3>沒有可設計的投影片</h3>
            <p>請先在歌詞編輯部分添加歌詞</p>
          </div>
        `;
      }
      return;
    }
    
    // 獲取設計模塊
    const designModule = this.designModule || window.designModule || window.modules?.designModule;
    if (designModule && typeof designModule.renderDesignView === 'function') {
      designModule.renderDesignView(this.projectData);
    } else {
      console.warn('設計模塊不可用或缺少renderDesignView方法');
      
      // 基本設計視窗實現
      this.renderBasicDesignView();
    }
  }
  
  /**
   * 基本設計視窗實現（當設計模塊不可用時）
   */
  renderBasicDesignView() {
    const designContainer = document.getElementById('design-container');
    if (!designContainer) return;
    
    let designHtml = `
      <div class="design-controls">
        <div class="control-group">
          <label>模板</label>
          <select id="template-selector">
            <option value="default">默認模板</option>
            <option value="dark">深色模板</option>
            <option value="light">淺色模板</option>
          </select>
        </div>
        <div class="control-group">
          <label>字體</label>
          <select id="font-selector">
            <option value="default">默認字體</option>
            <option value="serif">襯線字體</option>
            <option value="sans-serif">無襯線字體</option>
          </select>
        </div>
        <button id="apply-design" class="action-button primary">應用設計</button>
      </div>
      <div class="design-slides-container">
        <div class="design-slides">
    `;
    
    // 生成設計視窗的投影片
    (this.projectData.slides || []).forEach((slide, index) => {
      const slideContent = slide.content || '';
      designHtml += `
        <div class="design-slide" data-slide-index="${index}">
          <div class="design-slide-content">
            <div class="design-slide-number">${index + 1}</div>
            <div class="design-slide-text" contenteditable="true">${slideContent}</div>
          </div>
        </div>
      `;
    });
    
    designHtml += `
        </div>
      </div>
    `;
    
    designContainer.innerHTML = designHtml;
    
    // 添加事件監聽器
    const applyButton = document.getElementById('apply-design');
    if (applyButton) {
      applyButton.addEventListener('click', () => {
        this.applyDesign();
      });
    }
    
    // 添加編輯投影片文本的事件
    const slideTextElements = document.querySelectorAll('.design-slide-text');
    slideTextElements.forEach(element => {
      element.addEventListener('blur', () => {
        const slideIndex = parseInt(element.closest('.design-slide').dataset.slideIndex);
        const newText = element.textContent || '';
        this.updateSlideContent(slideIndex, newText);
      });
    });
  }
  
  /**
   * 更新投影片內容
   * @param {number} slideIndex - 投影片索引
   * @param {string} content - 新內容
   */
  updateSlideContent(slideIndex, content) {
    if (!this.projectData || !this.projectData.slides) return;
    
    // 檢查索引是否有效
    if (slideIndex < 0 || slideIndex >= this.projectData.slides.length) {
      console.error(`無效的投影片索引: ${slideIndex}`);
      return;
    }
    
    // 更新投影片內容
    this.projectData.slides[slideIndex].content = content;
    
    // 標記項目為已修改
    this.projectModified = true;
    
    console.log(`已更新投影片 #${slideIndex + 1} 的內容`);
  }
  
  /**
   * 應用設計更改
   */
  applyDesign() {
    const templateSelector = document.getElementById('template-selector');
    const fontSelector = document.getElementById('font-selector');
    
    if (!templateSelector || !fontSelector) {
      console.error('找不到設計選擇器元素');
      return;
    }
    
    const template = templateSelector.value;
    const font = fontSelector.value;
    
    // 更新項目設計設置
    if (!this.projectData.design) {
      this.projectData.design = {};
    }
    
    this.projectData.design.template = template;
    this.projectData.design.font = font;
    
    // 標記項目為已修改
    this.projectModified = true;
    
    console.log(`已應用設計更改: 模板=${template}, 字體=${font}`);
    
    // 顯示確認訊息
    alert('已應用設計更改！');
  }
}

// 全局導出
window.ProjectModule = ProjectModule; 