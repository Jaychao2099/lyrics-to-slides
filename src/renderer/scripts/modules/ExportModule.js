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
  async startExport() {
    if (this.exportInProgress) return;
    
    // 驗證輸出選項
    if (!this.validateExportOptions()) {
      return;
    }
    
    // 獲取項目數據
    const projectData = this.projectModule.getProjectData();
    
    // 確保有投影片可匯出
    if (!projectData.slides || projectData.slides.length === 0) {
      this.dialogModule.showAlertDialog('沒有可匯出的投影片。請先創建投影片。');
      return;
    }
    
    // 顯示進度UI
    this.showExportProgress();
    
    // 標記匯出中
    this.exportInProgress = true;
    this.exportProgress = 0;
    this.updateProgressBar(0, '準備匯出...');
    
    try {
      // 準備匯出選項
      const exportOptions = {
        format: this.exportOptions.format,
        quality: this.exportOptions.quality,
        includeTransitions: this.exportOptions.includeTransitions,
        includeNotes: this.exportOptions.includeNotes,
        outputDirectory: this.exportOptions.outputDirectory,
        filename: this.getFilename(),
        project: projectData
      };
      
      // 發送匯出請求到主進程
      window.electronAPI.exportSlideshow(exportOptions);
    } catch (error) {
      console.error('啟動匯出失敗:', error);
      this.hideExportProgress();
      this.exportInProgress = false;
      this.dialogModule.showAlertDialog(`匯出失敗: ${error.message || '未知錯誤'}`);
    }
  }
  
  /**
   * 取消當前匯出
   */
  cancelExport() {
    if (!this.exportInProgress) return;
    
    try {
      // 發送取消請求到主進程
      window.electronAPI.send('cancel-export');
      
      // 更新進度狀態
      this.updateProgressBar(this.exportProgress, '正在取消匯出...');
    } catch (error) {
      console.error('取消匯出失敗:', error);
    }
  }
  
  /**
   * 處理匯出進度更新
   * @param {Object} progressData - 進度數據
   */
  handleExportProgress(progressData) {
    if (!this.exportInProgress) return;
    
    this.exportProgress = progressData.percentage || 0;
    this.updateProgressBar(
      this.exportProgress, 
      progressData.status || `正在匯出... ${this.exportProgress}%`
    );
  }
  
  /**
   * 處理匯出完成
   * @param {Object} result - 匯出結果
   */
  handleExportComplete(result) {
    this.exportInProgress = false;
    this.hideExportProgress();
    
    if (result.error) {
      this.dialogModule.showAlertDialog(`匯出失敗: ${result.error}`);
      return;
    }
    
    // 顯示成功消息，並提供打開文件選項
    this.dialogModule.showConfirmDialog(
      `投影片已成功匯出至:\n${result.outputPath}`,
      () => {
        // 打開文件或文件夾
        window.electronAPI.openExternalLink(`file://${result.outputPath}`);
      },
      null,
      {
        title: '匯出完成',
        confirmText: '打開檔案位置',
        cancelText: '關閉'
      }
    );
  }
  
  /**
   * 顯示匯出進度UI
   */
  showExportProgress() {
    // 隱藏匯出選項
    const optionsContainer = this.elements.exportContainer.querySelector('.export-options');
    if (optionsContainer) {
      optionsContainer.style.display = 'none';
    }
    
    // 顯示進度容器
    if (this.elements.exportProgress) {
      this.elements.exportProgress.style.display = 'flex';
    }
    
    // 停用匯出按鈕
    if (this.elements.exportButton) {
      this.elements.exportButton.disabled = true;
    }
    
    // 啟用取消按鈕
    if (this.elements.cancelButton) {
      this.elements.cancelButton.style.display = 'block';
    }
  }
  
  /**
   * 隱藏匯出進度UI
   */
  hideExportProgress() {
    // 顯示匯出選項
    const optionsContainer = this.elements.exportContainer.querySelector('.export-options');
    if (optionsContainer) {
      optionsContainer.style.display = 'block';
    }
    
    // 隱藏進度容器
    if (this.elements.exportProgress) {
      this.elements.exportProgress.style.display = 'none';
    }
    
    // 啟用匯出按鈕
    if (this.elements.exportButton) {
      this.elements.exportButton.disabled = false;
    }
    
    // 隱藏取消按鈕
    if (this.elements.cancelButton) {
      this.elements.cancelButton.style.display = 'none';
    }
  }
  
  /**
   * 更新進度條
   * @param {number} percentage - 進度百分比
   * @param {string} status - 狀態文字
   */
  updateProgressBar(percentage, status) {
    if (this.elements.progressBar) {
      this.elements.progressBar.value = percentage;
    }
    
    if (this.elements.progressStatus) {
      this.elements.progressStatus.textContent = status;
    }
  }
  
  /**
   * 驗證匯出選項
   * @returns {boolean} 是否驗證通過
   */
  validateExportOptions() {
    // 檢查輸出目錄
    if (!this.exportOptions.outputDirectory) {
      this.dialogModule.showAlertDialog('請選擇輸出位置');
      return false;
    }
    
    // 檢查檔案名稱
    if (!this.exportOptions.filename) {
      // 如果用戶沒有輸入檔名，使用項目名稱或默認名稱
      const projectData = this.projectModule.getProjectData();
      this.exportOptions.filename = projectData.name || '歌曲投影片';
      
      // 更新輸入框
      if (this.elements.filenameInput) {
        this.elements.filenameInput.value = this.exportOptions.filename;
      }
    }
    
    return true;
  }
  
  /**
   * 獲取完整檔案名稱（含適當的副檔名）
   * @returns {string} 檔案名稱
   */
  getFilename() {
    let filename = this.exportOptions.filename;
    
    // 確保檔名不含不合法字符
    filename = this.sanitizeFilename(filename);
    
    // 圖片集不添加副檔名
    if (this.exportOptions.format === 'images') {
      return filename;
    }
    
    // 根據格式添加副檔名
    const extensionMap = {
      'pptx': '.pptx',
      'pdf': '.pdf',
      'video': '.mp4',
      'html': '.html'
    };
    
    const extension = extensionMap[this.exportOptions.format] || '';
    
    // 避免重複副檔名
    if (filename.toLowerCase().endsWith(extension)) {
      return filename;
    }
    
    return filename + extension;
  }
  
  /**
   * 過濾檔案名稱中的不合法字符
   * @param {string} filename - 原始檔案名稱
   * @returns {string} 過濾後的檔案名稱
   */
  sanitizeFilename(filename) {
    return filename.replace(/[\\/:*?"<>|]/g, '_');
  }
  
  /**
   * 加載匯出選項
   * @param {Object} projectData - 項目數據
   */
  loadExportOptions(projectData) {
    // 設置檔案名稱
    this.exportOptions.filename = projectData.name || '歌曲投影片';
    if (this.elements.filenameInput) {
      this.elements.filenameInput.value = this.exportOptions.filename;
    }
    
    // 從項目設置中載入匯出格式和品質
    if (projectData.settings?.export) {
      // 設置格式
      if (projectData.settings.export.format) {
        this.exportOptions.format = projectData.settings.export.format;
        
        // 更新單選框
        const formatRadio = document.querySelector(`input[name="export-format"][value="${this.exportOptions.format}"]`);
        if (formatRadio) {
          formatRadio.checked = true;
        }
      }
      
      // 設置品質
      if (projectData.settings.export.quality) {
        this.exportOptions.quality = projectData.settings.export.quality;
        
        // 更新單選框
        const qualityRadio = document.querySelector(`input[name="export-quality"][value="${this.exportOptions.quality}"]`);
        if (qualityRadio) {
          qualityRadio.checked = true;
        }
      }
    }
    
    // 更新格式相關選項
    this.updateFormatDependentOptions();
  }
  
  /**
   * 保存當前匯出選項到項目設置
   */
  saveExportOptions() {
    if (!this.projectModule) return;
    
    const projectData = this.projectModule.getProjectData();
    
    // 更新項目匯出設置
    if (!projectData.settings.export) {
      projectData.settings.export = {};
    }
    
    projectData.settings.export.format = this.exportOptions.format;
    projectData.settings.export.quality = this.exportOptions.quality;
    
    // 標記項目為已修改
    this.projectModule.markAsModified();
  }
}

// 導出模塊
window.ExportModule = ExportModule; 