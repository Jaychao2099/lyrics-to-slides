/**
 * 匯出模塊
 * 負責將投影片匯出為不同格式
 */
class ExportModule {
  constructor() {
    this.projectModule = null;
    this.slideModule = null;
    this.dialogModule = null;
    this.exportInProgress = false;
    this.exportProgress = 0;
    this.exportOptions = {
      format: 'pptx',
      quality: 'high',
      includeTransitions: true,
      includeNotes: false,
      outputDirectory: '',
      filename: ''
    };
    
    // DOM元素引用
    this.elements = {
      exportContainer: document.getElementById('export-container'),
      formatOptions: document.getElementById('format-options'),
      qualityOptions: document.getElementById('quality-options'),
      outputLocation: document.getElementById('output-location'),
      outputPath: document.getElementById('output-path'),
      browseButton: document.getElementById('browse-output'),
      filenameInput: document.getElementById('export-filename'),
      exportButton: document.getElementById('start-export'),
      cancelButton: document.getElementById('cancel-export'),
      exportProgress: document.getElementById('export-progress'),
      progressBar: document.getElementById('progress-bar'),
      progressStatus: document.getElementById('progress-status')
    };
    
    // 初始化事件監聽器
    this.initEventListeners();
  }
  
  /**
   * 初始化模塊
   * @param {Object} dependencies - 依賴模塊
   */
  init(dependencies) {
    this.projectModule = dependencies.projectModule;
    this.slideModule = dependencies.slideModule;
    this.dialogModule = dependencies.dialogModule;
    
    // 註冊IPC事件監聽器
    window.electronAPI.on('export-progress', this.handleExportProgress.bind(this));
    window.electronAPI.on('export-complete', this.handleExportComplete.bind(this));
    
    // 獲取默認輸出路徑
    this.loadDefaultOutputPath();
    
    console.log('匯出模塊已初始化');
  }
  
  /**
   * 初始化事件監聽器
   */
  initEventListeners() {
    // 格式選項
    const formatRadios = this.elements.formatOptions?.querySelectorAll('input[name="export-format"]');
    if (formatRadios) {
      formatRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.exportOptions.format = e.target.value;
          this.updateFormatDependentOptions();
        });
      });
    }
    
    // 品質選項
    const qualityRadios = this.elements.qualityOptions?.querySelectorAll('input[name="export-quality"]');
    if (qualityRadios) {
      qualityRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.exportOptions.quality = e.target.value;
        });
      });
    }
    
    // 過渡選項
    const transitionCheckbox = document.getElementById('include-transitions');
    if (transitionCheckbox) {
      transitionCheckbox.addEventListener('change', (e) => {
        this.exportOptions.includeTransitions = e.target.checked;
      });
    }
    
    // 註解選項
    const notesCheckbox = document.getElementById('include-notes');
    if (notesCheckbox) {
      notesCheckbox.addEventListener('change', (e) => {
        this.exportOptions.includeNotes = e.target.checked;
      });
    }
    
    // 瀏覽輸出位置按鈕
    if (this.elements.browseButton) {
      this.elements.browseButton.addEventListener('click', () => {
        this.browseOutputLocation();
      });
    }
    
    // 檔案名稱輸入
    if (this.elements.filenameInput) {
      this.elements.filenameInput.addEventListener('input', (e) => {
        this.exportOptions.filename = e.target.value;
      });
    }
    
    // 匯出按鈕
    if (this.elements.exportButton) {
      this.elements.exportButton.addEventListener('click', () => {
        this.startExport();
      });
    }
    
    // 取消按鈕
    if (this.elements.cancelButton) {
      this.elements.cancelButton.addEventListener('click', () => {
        this.cancelExport();
      });
    }
  }
  
  /**
   * 根據所選格式更新相關選項
   */
  updateFormatDependentOptions() {
    // 根據所選格式啟用/禁用某些選項
    const format = this.exportOptions.format;
    
    // 過渡效果選項（僅在 PPTX 和 PDF 中支持）
    const transitionOption = document.getElementById('transitions-option');
    if (transitionOption) {
      if (format === 'pptx' || format === 'pdf') {
        transitionOption.classList.remove('disabled');
        transitionOption.querySelector('input').disabled = false;
      } else {
        transitionOption.classList.add('disabled');
        transitionOption.querySelector('input').disabled = true;
      }
    }
    
    // 註解選項（僅在 PPTX 中支持）
    const notesOption = document.getElementById('notes-option');
    if (notesOption) {
      if (format === 'pptx') {
        notesOption.classList.remove('disabled');
        notesOption.querySelector('input').disabled = false;
      } else {
        notesOption.classList.add('disabled');
        notesOption.querySelector('input').disabled = true;
      }
    }
    
    // 品質選項（僅在圖片和PDF中支持）
    if (this.elements.qualityOptions) {
      if (format === 'images' || format === 'pdf') {
        this.elements.qualityOptions.classList.remove('disabled');
        this.elements.qualityOptions.querySelectorAll('input').forEach(input => {
          input.disabled = false;
        });
      } else {
        this.elements.qualityOptions.classList.add('disabled');
        this.elements.qualityOptions.querySelectorAll('input').forEach(input => {
          input.disabled = true;
        });
      }
    }
    
    // 更新副檔名提示
    this.updateFilenameExtension(format);
  }
  
  /**
   * 更新檔案名稱副檔名提示
   * @param {string} format - 匯出格式
   */
  updateFilenameExtension(format) {
    const extensionLabel = document.getElementById('filename-extension');
    if (!extensionLabel) return;
    
    let extension = '.pptx';
    switch (format) {
      case 'pdf':
        extension = '.pdf';
        break;
      case 'images':
        extension = '/ (圖片集)';
        break;
      case 'video':
        extension = '.mp4';
        break;
      case 'html':
        extension = '.html';
        break;
    }
    
    extensionLabel.textContent = extension;
  }
  
  /**
   * 載入默認輸出路徑
   */
  async loadDefaultOutputPath() {
    try {
      // 從設置中獲取默認輸出路徑
      const outputPath = await window.electronAPI.getStoreValue('outputPath');
      
      if (outputPath) {
        this.exportOptions.outputDirectory = outputPath;
        
        // 更新UI
        if (this.elements.outputPath) {
          this.elements.outputPath.value = outputPath;
        }
      } else {
        // 如果沒有設置，獲取文檔目錄
        const documentsPath = await window.electronAPI.getAppPath('documents');
        this.exportOptions.outputDirectory = documentsPath;
        
        // 更新UI
        if (this.elements.outputPath) {
          this.elements.outputPath.value = documentsPath;
        }
      }
    } catch (error) {
      console.error('載入默認輸出路徑失敗:', error);
    }
  }
  
  /**
   * 瀏覽輸出位置
   */
  async browseOutputLocation() {
    try {
      const result = await window.electronAPI.showOpenDialog({
        title: '選擇匯出位置',
        properties: ['openDirectory']
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        const outputPath = result.filePaths[0];
        this.exportOptions.outputDirectory = outputPath;
        
        // 更新UI
        if (this.elements.outputPath) {
          this.elements.outputPath.value = outputPath;
        }
      }
    } catch (error) {
      console.error('選擇輸出位置失敗:', error);
      this.dialogModule.showAlertDialog(`選擇輸出位置失敗: ${error.message || '未知錯誤'}`);
    }
  }
  
  /**
   * 開始匯出流程
   */
  startExport() {
    // 檢查是否已經有匯出進行中
    if (this.exportInProgress) {
      console.warn('匯出正在進行中，請等待當前匯出完成');
      if (this.dialogModule) {
        this.dialogModule.showAlertDialog('匯出正在進行中，請稍候', '匯出進行中', 'info');
      }
      return;
    }
    
    // 驗證輸出設定
    if (!this.validateExportOptions()) {
      return;
    }
    
    // 獲取專案數據
    const projectData = this.projectModule.getProjectData();
    if (!projectData || !projectData.slides || projectData.slides.length === 0) {
      console.error('沒有投影片可供匯出');
      this.dialogModule.showAlertDialog('沒有可匯出的投影片', '匯出失敗', 'error');
      return;
    }
    
    // 配置匯出選項
    const exportOptions = {
      ...this.exportOptions,
      projectData: this.prepareProjectDataForExport(projectData),
      format: this.exportOptions.format,
      outputPath: this.getOutputFilePath(projectData.name || '未命名簡報')
    };
    
    console.log('開始匯出，選項:', exportOptions);
    
    // 顯示匯出進度
    this.showExportProgress();
    
    // 設置匯出狀態
    this.exportInProgress = true;
    
    // 根據選擇的格式調用不同的匯出方法
    switch (this.exportOptions.format) {
      case 'pptx':
        this.exportToPPTX(exportOptions);
        break;
      case 'pdf':
        this.exportToPDF(exportOptions);
        break;
      case 'images':
        this.exportToImages(exportOptions);
        break;
      case 'video':
        this.exportToVideo(exportOptions);
        break;
      case 'html':
        this.exportToHTML(exportOptions);
        break;
      default:
        this.exportInProgress = false;
        this.hideExportProgress();
        this.dialogModule.showAlertDialog(`不支援的匯出格式: ${this.exportOptions.format}`, '匯出失敗', 'error');
    }
  }
  
  /**
   * 驗證匯出選項
   * @returns {boolean} 是否有效
   */
  validateExportOptions() {
    // 檢查輸出路徑
    if (!this.exportOptions.outputDirectory) {
      this.dialogModule.showAlertDialog('請選擇輸出位置', '無效的輸出位置', 'warning');
      return false;
    }
    
    // 檢查檔案名稱
    if (!this.exportOptions.filename) {
      this.dialogModule.showAlertDialog('請輸入檔案名稱', '無效的檔案名稱', 'warning');
      return false;
    }
    
    // 檢查檔案名稱中的非法字元
    const illegalChars = /[\\/:*?"<>|]/;
    if (illegalChars.test(this.exportOptions.filename)) {
      this.dialogModule.showAlertDialog('檔案名稱包含非法字元 (\\/:*?"<>|)', '無效的檔案名稱', 'warning');
      return false;
    }
    
    return true;
  }
  
  /**
   * 獲取完整的輸出文件路徑
   * @param {string} projectName - 項目名稱
   * @returns {string} 完整的輸出路徑
   */
  getOutputFilePath(projectName) {
    let filename = this.exportOptions.filename || projectName;
    
    // 如果是圖片集，創建一個文件夾
    if (this.exportOptions.format === 'images') {
      return `${this.exportOptions.outputDirectory}/${filename}`;
    }
    
    // 添加適當的副檔名
    let extension = '';
    switch (this.exportOptions.format) {
      case 'pptx':
        extension = '.pptx';
        break;
      case 'pdf':
        extension = '.pdf';
        break;
      case 'video':
        extension = '.mp4';
        break;
      case 'html':
        extension = '.html';
        break;
    }
    
    return `${this.exportOptions.outputDirectory}/${filename}${extension}`;
  }
  
  /**
   * 準備項目數據用於匯出
   * @param {Object} projectData - 原始項目數據
   * @returns {Object} 準備好用於匯出的數據
   */
  prepareProjectDataForExport(projectData) {
    // 創建一個深拷貝，避免修改原始數據
    const exportData = JSON.parse(JSON.stringify(projectData));
    
    // 確保包含必要的元數據
    exportData.metadata = {
      title: projectData.title || '未命名簡報',
      author: projectData.artist || '未知作者',
      createdAt: new Date().toISOString(),
      application: '歌曲投影片生成器',
      version: '1.0.0'
    };
    
    return exportData;
  }
  
  /**
   * 顯示匯出進度界面
   */
  showExportProgress() {
    // 隱藏匯出配置界面
    const exportConfig = document.getElementById('export-config');
    if (exportConfig) {
      exportConfig.style.display = 'none';
    }
    
    // 顯示進度界面
    const exportProgress = document.getElementById('export-progress');
    if (exportProgress) {
      exportProgress.style.display = 'flex';
      
      // 更新進度文本
      const progressStatus = document.getElementById('progress-status');
      if (progressStatus) {
        progressStatus.textContent = '準備匯出...';
      }
      
      // 重置進度條
      const progressBar = document.getElementById('progress-bar');
      if (progressBar) {
        progressBar.style.width = '0%';
      }
    }
  }
  
  /**
   * 隱藏匯出進度界面
   */
  hideExportProgress() {
    // 顯示匯出配置界面
    const exportConfig = document.getElementById('export-config');
    if (exportConfig) {
      exportConfig.style.display = 'block';
    }
    
    // 隱藏進度界面
    const exportProgress = document.getElementById('export-progress');
    if (exportProgress) {
      exportProgress.style.display = 'none';
    }
  }
  
  /**
   * 匯出為PPTX格式
   * @param {Object} options - 匯出選項
   */
  exportToPPTX(options) {
    console.log('開始匯出為PPTX格式', options);
    
    // 更新進度狀態
    this.updateExportProgress(10, '正在創建PPT結構...');
    
    // 使用IPC調用主進程的匯出功能
    window.electronAPI.send('export-slideshow', {
      format: 'pptx',
      outputPath: options.outputPath,
      data: options.projectData,
      options: {
        includeTransitions: this.exportOptions.includeTransitions,
        includeNotes: this.exportOptions.includeNotes
      }
    });
  }
  
  /**
   * 匯出為PDF格式
   * @param {Object} options - 匯出選項
   */
  exportToPDF(options) {
    console.log('開始匯出為PDF格式', options);
    
    // 更新進度狀態
    this.updateExportProgress(10, '正在創建PDF結構...');
    
    // 使用IPC調用主進程的匯出功能
    window.electronAPI.send('export-slideshow', {
      format: 'pdf',
      outputPath: options.outputPath,
      data: options.projectData,
      options: {
        quality: this.exportOptions.quality,
        includeTransitions: this.exportOptions.includeTransitions
      }
    });
  }
  
  /**
   * 匯出為圖片集
   * @param {Object} options - 匯出選項
   */
  exportToImages(options) {
    console.log('開始匯出為圖片集', options);
    
    // 更新進度狀態
    this.updateExportProgress(10, '正在準備圖片...');
    
    // 使用IPC調用主進程的匯出功能
    window.electronAPI.send('export-slideshow', {
      format: 'images',
      outputPath: options.outputPath,
      data: options.projectData,
      options: {
        quality: this.exportOptions.quality,
        imageFormat: 'png' // 或 'jpg'，根據需要
      }
    });
  }
  
  /**
   * 匯出為視頻
   * @param {Object} options - 匯出選項
   */
  exportToVideo(options) {
    console.log('開始匯出為視頻', options);
    
    // 更新進度狀態
    this.updateExportProgress(10, '正在準備視頻編碼器...');
    
    // 使用IPC調用主進程的匯出功能
    window.electronAPI.send('export-slideshow', {
      format: 'video',
      outputPath: options.outputPath,
      data: options.projectData,
      options: {
        quality: this.exportOptions.quality,
        framerate: 30,
        transitionDuration: 1.5 // 秒
      }
    });
  }
  
  /**
   * 匯出為HTML
   * @param {Object} options - 匯出選項
   */
  exportToHTML(options) {
    console.log('開始匯出為HTML', options);
    
    // 更新進度狀態
    this.updateExportProgress(10, '正在創建HTML結構...');
    
    // 使用IPC調用主進程的匯出功能
    window.electronAPI.send('export-slideshow', {
      format: 'html',
      outputPath: options.outputPath,
      data: options.projectData,
      options: {
        includeControls: true,
        autoSlide: false,
        themeColor: '#000000'
      }
    });
  }
  
  /**
   * 更新匯出進度
   * @param {number} percent - 進度百分比 (0-100)
   * @param {string} message - 進度消息
   */
  updateExportProgress(percent, message) {
    // 更新進度條
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
    
    // 更新進度文本
    const progressStatus = document.getElementById('progress-status');
    if (progressStatus) {
      progressStatus.textContent = message;
    }
    
    // 如果進度達到100%，顯示完成信息
    if (percent >= 100) {
      if (progressStatus) {
        progressStatus.textContent = '匯出完成!';
      }
    }
  }
  
  /**
   * 處理匯出進度更新
   * @param {Object} progressData - 進度數據
   */
  handleExportProgress(progressData) {
    if (!this.exportInProgress) return;
    
    // 更新進度界面
    this.updateExportProgress(
      progressData.percent || 0, 
      progressData.message || '處理中...'
    );
  }
  
  /**
   * 處理匯出完成
   * @param {Object} result - 匯出結果
   */
  handleExportComplete(result) {
    // 重置匯出狀態
    this.exportInProgress = false;
    
    // 處理結果
    if (result.error) {
      console.error('匯出失敗:', result.error);
      this.dialogModule.showAlertDialog(`匯出失敗: ${result.error}`, '匯出錯誤', 'error');
      this.hideExportProgress();
      return;
    }
    
    // 更新進度為100%
    this.updateExportProgress(100, '匯出完成!');
    
    // 顯示成功對話框
    this.dialogModule.showConfirmDialog(
      `匯出成功!\n檔案已保存到: ${result.outputPath}`,
      () => {
        // 打開輸出位置
        if (window.electronAPI) {
          window.electronAPI.send('open-output-location', result.outputPath);
        }
        this.hideExportProgress();
      },
      () => {
        this.hideExportProgress();
      },
      {
        title: '匯出完成',
        confirmText: '打開位置',
        cancelText: '關閉'
      }
    );
  }
  
  /**
   * 取消匯出
   */
  cancelExport() {
    if (!this.exportInProgress) return;
    
    // 確認是否取消
    this.dialogModule.showConfirmDialog(
      '確定要取消當前匯出嗎？',
      () => {
        // 發送取消請求
        window.electronAPI.send('cancel-export');
        
        // 重置匯出狀態
        this.exportInProgress = false;
        this.hideExportProgress();
      },
      null,
      {
        title: '取消匯出',
        confirmText: '是',
        cancelText: '否'
      }
    );
  }
}

// 導出模塊
window.ExportModule = ExportModule; 