// 定義全局通知方法
window.showNotification = (message, type = 'info') => {
  // 創建通知元素
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // 添加到頁面
  document.body.appendChild(notification);
  
  // 3秒後自動移除
  setTimeout(() => {
    notification.remove();
  }, 3000);
};

/**
 * 設置模塊
 * 負責應用程序設置的管理和界面交互
 */
class SettingsModule {
  constructor() {
    this.settings = {
      theme: 'light',
      outputPath: '',
      autoUpdate: true,
      locale: 'zh-TW',
      apiKeys: {
        openai: '',
        stabilityai: '',
        genius: '',
        musixmatch: '',
        google: ''
      },
      searchEngineId: '',
      promptTemplates: {},
      slidesSettings: {},
      apiConfigs: {
        lyricsSearch: 'google',
        imageGeneration: 'openai',
        slideCreation: 'openai'
      },
      imageProvider: 'openai',
      imageModel: 'dall-e-3',
      imageStyle: 'natural',
      imageQuality: 'standard'
    };
    
    // 在 constructor 中不進行 DOM 相關操作，而是在 init 方法中執行
    console.log('設置模塊已創建');
  }
  
  /**
   * 初始化模塊
   * @param {Object} dependencies - 依賴模塊
   */
  init(dependencies) {
    this.dialogModule = dependencies.dialogModule;
    
    // 綁定DOM元素
    this.bindElements();
    
    // 綁定事件監聽器
    this.bindEvents();
    
    // 加載設置
    this.loadSettings();
    
    console.log('設置模塊已初始化');
  }
  
  /**
   * 綁定DOM元素
   */
  bindElements() {
    // 獲取所有需要的DOM元素，使用可選鏈避免null引用錯誤
    
    // 基本設置
    this.outputPathInput = document.getElementById('output-path');
    this.browseOutputPathBtn = document.getElementById('browse-output-path-btn');
    this.themeSelect = document.getElementById('theme-select');
    this.languageSelect = document.getElementById('language-select');
    this.autoUpdateCheckbox = document.getElementById('auto-update-checkbox');
    
    // API金鑰設置
    this.openaiApiKeyInput = document.getElementById('openai-api-key');
    this.stabilityaiApiKeyInput = document.getElementById('stabilityai-api-key');
    this.geniusApiKeyInput = document.getElementById('genius-api-key');
    this.musixmatchApiKeyInput = document.getElementById('musixmatch-api-key');
    this.googleApiKeyInput = document.getElementById('google-api-key');
    this.searchEngineIdInput = document.getElementById('search-engine-id');
    
    // API分類設置
    this.lyricsSearchSelect = document.getElementById('lyrics-search-select');
    this.imageGenerationSelect = document.getElementById('image-generation-select');
    this.slideCreationSelect = document.getElementById('slide-creation-select');
    
    // 顯示/隱藏密碼按鈕
    this.showOpenaiKeyBtn = document.getElementById('show-openai-key-btn');
    this.showStabilityaiKeyBtn = document.getElementById('show-stabilityai-key-btn');
    this.showGeniusKeyBtn = document.getElementById('show-genius-key-btn');
    this.showMusixmatchKeyBtn = document.getElementById('show-musixmatch-key-btn');
    this.showGoogleKeyBtn = document.getElementById('show-google-key-btn');
    
    // 檢查API金鑰按鈕
    this.checkOpenaiKeyBtn = document.getElementById('check-openai-key-btn');
    this.checkStabilityaiKeyBtn = document.getElementById('check-stabilityai-key-btn');
    this.checkGeniusKeyBtn = document.getElementById('check-genius-key-btn');
    this.checkMusixmatchKeyBtn = document.getElementById('check-musixmatch-key-btn');
    this.checkGoogleKeyBtn = document.getElementById('check-google-key-btn');
    
    // 圖片生成設置
    this.imageProviderSelect = document.getElementById('image-provider-select');
    this.imageModelSelect = document.getElementById('image-model-select');
    this.imageQualitySelect = document.getElementById('image-quality-select');
    this.imageStyleSelect = document.getElementById('image-style-select');
    this.stabilityModelSelect = document.getElementById('stability-model-select');
    
    // 提示詞模板設置
    this.promptTemplateSelect = document.getElementById('prompt-template-select');
    this.promptTemplateText = document.getElementById('prompt-template-text');
    this.saveTemplateBtn = document.getElementById('save-template-btn');
    this.resetTemplateBtn = document.getElementById('reset-template-btn');
    
    // 投影片設置
    this.fontFamilySelect = document.getElementById('font-family-select');
    this.fontSizeInput = document.getElementById('font-size-input');
    this.fontColorInput = document.getElementById('font-color-input');
    this.textShadowCheckbox = document.getElementById('text-shadow-checkbox');
    this.lineHeightInput = document.getElementById('line-height-input');
    this.maxLinesInput = document.getElementById('max-lines-input');
    this.textPositionSelect = document.getElementById('text-position-select');
    
    // 緩存管理
    this.clearLyricsCacheBtn = document.getElementById('clear-lyrics-cache-btn');
    this.clearImagesCacheBtn = document.getElementById('clear-images-cache-btn');
    this.clearAllCacheBtn = document.getElementById('clear-all-cache-btn');
    
    // 保存設置按鈕
    this.saveSettingsBtn = document.getElementById('save-settings-btn');
  }
  
  /**
   * 綁定事件監聽器
   */
  bindEvents() {
    // 只有在元素存在的情況下才綁定事件
    
    // 基本設置
    if (this.browseOutputPathBtn) {
      this.browseOutputPathBtn.addEventListener('click', () => this.selectOutputPath());
    }
    if (this.themeSelect) {
      this.themeSelect.addEventListener('change', () => this.applyTheme(this.themeSelect.value));
    }
    
    // API金鑰顯示/隱藏
    if (this.showOpenaiKeyBtn && this.openaiApiKeyInput) {
      this.showOpenaiKeyBtn.addEventListener('click', () => this.togglePasswordVisibility(this.openaiApiKeyInput, this.showOpenaiKeyBtn));
    }
    if (this.showStabilityaiKeyBtn && this.stabilityaiApiKeyInput) {
      this.showStabilityaiKeyBtn.addEventListener('click', () => this.togglePasswordVisibility(this.stabilityaiApiKeyInput, this.showStabilityaiKeyBtn));
    }
    if (this.showGeniusKeyBtn && this.geniusApiKeyInput) {
      this.showGeniusKeyBtn.addEventListener('click', () => this.togglePasswordVisibility(this.geniusApiKeyInput, this.showGeniusKeyBtn));
    }
    if (this.showMusixmatchKeyBtn && this.musixmatchApiKeyInput) {
      this.showMusixmatchKeyBtn.addEventListener('click', () => this.togglePasswordVisibility(this.musixmatchApiKeyInput, this.showMusixmatchKeyBtn));
    }
    if (this.showGoogleKeyBtn && this.googleApiKeyInput) {
      this.showGoogleKeyBtn.addEventListener('click', () => this.togglePasswordVisibility(this.googleApiKeyInput, this.showGoogleKeyBtn));
    }
    
    // 檢查API金鑰
    if (this.checkOpenaiKeyBtn && this.openaiApiKeyInput) {
      this.checkOpenaiKeyBtn.addEventListener('click', () => this.checkApiKey('openai', this.openaiApiKeyInput.value));
    }
    if (this.checkStabilityaiKeyBtn && this.stabilityaiApiKeyInput) {
      this.checkStabilityaiKeyBtn.addEventListener('click', () => this.checkApiKey('stabilityai', this.stabilityaiApiKeyInput.value));
    }
    if (this.checkGeniusKeyBtn && this.geniusApiKeyInput) {
      this.checkGeniusKeyBtn.addEventListener('click', () => this.checkApiKey('genius', this.geniusApiKeyInput.value));
    }
    if (this.checkMusixmatchKeyBtn && this.musixmatchApiKeyInput) {
      this.checkMusixmatchKeyBtn.addEventListener('click', () => this.checkApiKey('musixmatch', this.musixmatchApiKeyInput.value));
    }
    if (this.checkGoogleKeyBtn && this.googleApiKeyInput) {
      this.checkGoogleKeyBtn.addEventListener('click', () => this.checkApiKey('google', this.googleApiKeyInput.value));
    }
    
    // API分類選擇
    if (this.lyricsSearchSelect) {
      this.lyricsSearchSelect.addEventListener('change', () => this.updateApiConfigs());
    }
    if (this.imageGenerationSelect) {
      this.imageGenerationSelect.addEventListener('change', () => this.updateApiConfigs());
    }
    if (this.slideCreationSelect) {
      this.slideCreationSelect.addEventListener('change', () => this.updateApiConfigs());
    }
    
    // 圖片生成服務切換
    if (this.imageProviderSelect) {
      this.imageProviderSelect.addEventListener('change', () => this.toggleImageProviderOptions());
    }
    
    // 提示詞模板切換
    if (this.promptTemplateSelect) {
      this.promptTemplateSelect.addEventListener('change', () => this.loadSelectedTemplate());
    }
    if (this.saveTemplateBtn) {
      this.saveTemplateBtn.addEventListener('click', () => this.saveCurrentTemplate());
    }
    if (this.resetTemplateBtn) {
      this.resetTemplateBtn.addEventListener('click', () => this.resetCurrentTemplate());
    }
    
    // 緩存管理
    if (this.clearLyricsCacheBtn) {
      this.clearLyricsCacheBtn.addEventListener('click', () => this.clearCache('lyrics'));
    }
    if (this.clearImagesCacheBtn) {
      this.clearImagesCacheBtn.addEventListener('click', () => this.clearCache('images'));
    }
    if (this.clearAllCacheBtn) {
      this.clearAllCacheBtn.addEventListener('click', () => this.clearCache('all'));
    }
    
    // 保存設置
    if (this.saveSettingsBtn) {
      this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    }
  }
  
  /**
   * 加載設置
   */
  async loadSettings() {
    try {
      // 從主進程獲取設置
      const settings = await window.electronAPI.getStoreValue('settings') || {};
      
      console.log('從主進程獲取的設置:', settings);
      
      // 確保有默認的apiConfigs
      if (!settings.apiConfigs) {
        settings.apiConfigs = {
          lyricsSearch: 'google',
          imageGeneration: 'openai',
          slideCreation: 'openai'
        };
      }
      
      // 確保apiKeys存在
      if (!settings.apiKeys) {
        settings.apiKeys = {};
      }
      
      // 更新本地設置
      this.settings = settings;
      
      // 獨立載入輸出路徑
      if (!this.settings.outputPath) {
        try {
          this.settings.outputPath = await window.electronAPI.getStoreValue('outputPath') || '';
          console.log('已載入輸出路徑:', this.settings.outputPath);
        } catch (pathError) {
          console.error('獲取輸出路徑時出錯:', pathError);
        }
      }
      
      // 獨立載入搜尋引擎ID
      if (!this.settings.searchEngineId) {
        try {
          this.settings.searchEngineId = await window.electronAPI.getStoreValue('searchEngineId') || '';
          console.log('已載入搜尋引擎ID:', this.settings.searchEngineId);
        } catch (idError) {
          console.error('獲取搜尋引擎ID時出錯:', idError);
        }
      }
      
      // 獨立載入Google API金鑰
      try {
        const googleApiKey = await window.electronAPI.getStoreValue('apiKeys.google') || '';
        if (googleApiKey) {
          if (!this.settings.apiKeys) {
            this.settings.apiKeys = {};
          }
          this.settings.apiKeys.google = googleApiKey;
          console.log('已載入Google API金鑰:', googleApiKey ? '已設置' : '未設置');
        }
      } catch (googleKeyError) {
        console.error('獲取Google API金鑰時出錯:', googleKeyError);
      }
      
      // 更新UI
      this.updateSettingsUI();
      
      // 更新API UI狀態
      this.updateApiUIState();
      
      // 更新搜尋配置狀態
      this.updateSearchConfigUI();
      
      // 應用主題
      this.applyTheme(settings.theme || 'light');
      
      console.log('設置已加載');
    } catch (error) {
      console.error('加載設置失敗:', error);
      window.showNotification('加載設置失敗', 'error');
    }
  }
  
  /**
   * 更新設置UI
   */
  updateSettingsUI() {
    // 基本設置
    if (this.outputPathInput) {
      this.outputPathInput.value = this.settings.outputPath || '';
      console.log('設置輸出路徑UI:', this.settings.outputPath);
    } else {
      console.warn('輸出路徑輸入框不存在');
    }
    
    if (this.themeSelect) {
      this.themeSelect.value = this.settings.theme || 'light';
    }
    
    if (this.languageSelect) {
      this.languageSelect.value = this.settings.locale || 'zh-TW';
    }
    
    if (this.autoUpdateCheckbox) {
      this.autoUpdateCheckbox.checked = this.settings.autoUpdate !== false;
    }
    
    // API金鑰設置
    if (this.openaiApiKeyInput) {
      this.openaiApiKeyInput.value = this.settings.apiKeys?.openai || '';
    }
    
    if (this.stabilityaiApiKeyInput) {
      this.stabilityaiApiKeyInput.value = this.settings.apiKeys?.stabilityai || '';
    }
    
    if (this.geniusApiKeyInput) {
      this.geniusApiKeyInput.value = this.settings.apiKeys?.genius || '';
    }
    
    if (this.musixmatchApiKeyInput) {
      this.musixmatchApiKeyInput.value = this.settings.apiKeys?.musixmatch || '';
    }
    
    if (this.googleApiKeyInput) {
      this.googleApiKeyInput.value = this.settings.apiKeys?.google || '';
      console.log('設置Google API金鑰UI:', this.settings.apiKeys?.google ? '已設置' : '未設置');
    }
    
    if (this.searchEngineIdInput) {
      this.searchEngineIdInput.value = this.settings.searchEngineId || '';
      console.log('設置搜索引擎ID UI:', this.settings.searchEngineId);
    }
    
    // 確保apiConfigs存在
    if (!this.settings.apiConfigs) {
      this.settings.apiConfigs = {
        lyricsSearch: 'google',
        imageGeneration: 'openai',
        slideCreation: 'openai'
      };
    }
    
    // API分類設置
    if (this.lyricsSearchSelect) {
      this.lyricsSearchSelect.value = this.settings.apiConfigs.lyricsSearch || 'google';
    }
    
    if (this.imageGenerationSelect) {
      this.imageGenerationSelect.value = this.settings.apiConfigs.imageGeneration || 'openai';
    }
    
    if (this.slideCreationSelect) {
      this.slideCreationSelect.value = this.settings.apiConfigs.slideCreation || 'openai';
    }
    
    // 圖片生成設置
    if (this.imageProviderSelect) {
      this.imageProviderSelect.value = this.settings.imageProvider || 'openai';
    }
    
    if (this.imageModelSelect) {
      this.imageModelSelect.value = this.settings.imageModel || 'dall-e-3';
    }
    
    if (this.imageQualitySelect) {
      this.imageQualitySelect.value = this.settings.imageQuality || 'standard';
    }
    
    if (this.imageStyleSelect) {
      this.imageStyleSelect.value = this.settings.imageStyle || 'natural';
    }
    
    if (this.stabilityModelSelect) {
      this.stabilityModelSelect.value = this.settings.stabilityModel || 'stable-diffusion-xl-1024-v1-0';
    }
    
    // 提示詞模板
    this.promptTemplates = this.settings.promptTemplates || {};
    this.loadTemplateOptions();
    this.loadSelectedTemplate();
    
    // 投影片設置
    const slideSettings = this.settings.slidesSettings || {};
    
    if (this.fontFamilySelect) {
      this.fontFamilySelect.value = slideSettings.fontFamily || 'Microsoft JhengHei, Arial, sans-serif';
    }
    
    if (this.fontSizeInput) {
      this.fontSizeInput.value = slideSettings.fontSize || 60;
    }
    
    if (this.fontColorInput) {
      this.fontColorInput.value = slideSettings.fontColor || '#FFFFFF';
    }
    
    if (this.textShadowCheckbox) {
      this.textShadowCheckbox.checked = slideSettings.textShadow !== false;
    }
    
    if (this.lineHeightInput) {
      this.lineHeightInput.value = slideSettings.lineHeight || 1.5;
    }
    
    if (this.maxLinesInput) {
      this.maxLinesInput.value = slideSettings.maxLinesPerSlide || 4;
    }
    
    if (this.textPositionSelect) {
      this.textPositionSelect.value = slideSettings.textPosition || 'center';
    }
    
    // 更新圖片提供商選項顯示
    this.toggleImageProviderOptions();
  }
  
  /**
   * 保存設置
   */
  async saveSettings() {
    try {
      // 收集設置
      const settings = {
        theme: this.themeSelect.value,
        outputPath: this.outputPathInput.value,
        locale: this.languageSelect.value,
        autoUpdate: this.autoUpdateCheckbox.checked,
        searchEngineId: this.searchEngineIdInput?.value || '',
        apiConfigs: {
          lyricsSearch: this.lyricsSearchSelect?.value || 'google',
          imageGeneration: this.imageGenerationSelect?.value || 'openai',
          slideCreation: this.slideCreationSelect?.value || 'openai'
        }
      };

      // 收集API金鑰
      if (!settings.apiKeys) {
        settings.apiKeys = {};
      }
      settings.apiKeys.openai = this.openaiApiKeyInput?.value || '';
      settings.apiKeys.stabilityai = this.stabilityaiApiKeyInput?.value || '';
      settings.apiKeys.genius = this.geniusApiKeyInput?.value || '';
      settings.apiKeys.musixmatch = this.musixmatchApiKeyInput?.value || '';
      settings.apiKeys.google = this.googleApiKeyInput?.value || '';

      console.log('保存設置:', settings);
      
      // 單獨保存Google API金鑰
      try {
        const googleApiKey = this.googleApiKeyInput?.value || '';
        if (googleApiKey) {
          // 首先獲取現有的apiKeys
          let apiKeys = await window.electronAPI.getStoreValue('apiKeys') || {};
          // 更新Google API金鑰
          apiKeys.google = googleApiKey;
          // 保存回store
          await window.electronAPI.setStoreValue('apiKeys', apiKeys);
          console.log('已單獨保存Google API金鑰:', googleApiKey ? '已設置' : '未設置');
        }
      } catch (googleKeyError) {
        console.error('保存Google API金鑰時出錯:', googleKeyError);
      }

      // 更新設置
      const result = await window.electronAPI.updateSettings(settings);

      if (result.success) {
        window.showNotification('設置已保存');
        this.settings = settings;

        // 應用主題
        this.applyTheme(settings.theme);
      } else {
        window.showNotification('保存設置失敗: ' + (result.error || '未知錯誤'), 'error');
      }
    } catch (error) {
      console.error('保存設置失敗:', error);
      window.showNotification('保存設置失敗: ' + error.message, 'error');
    }
  }
  
  /**
   * 選擇輸出路徑
   */
  async selectOutputPath() {
    try {
      // 向主進程發送選擇輸出路徑請求
      window.electronAPI.send('select-output-path');
      
      // 監聽結果
      window.electronAPI.receive('output-path-selected', (path) => {
        if (path) {
          console.log('接收到選擇的輸出路徑:', path);
          this.outputPathInput.value = path;
          this.settings.outputPath = path;
          
          // 提示用戶保存設置以應用更改
          window.showNotification('請點擊"保存設置"按鈕以儲存輸出路徑', 'info');
        } else {
          console.warn('未選擇輸出路徑或選擇已取消');
        }
      });
    } catch (error) {
      console.error('選擇輸出路徑失敗:', error);
      window.showNotification('選擇輸出路徑失敗', 'error');
    }
  }
  
  /**
   * 切換密碼可見性
   * @param {HTMLInputElement} input - 密碼輸入框
   * @param {HTMLButtonElement} button - 切換按鈕
   */
  togglePasswordVisibility(input, button) {
    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = '隱藏';
    } else {
      input.type = 'password';
      button.textContent = '顯示';
    }
  }
  
  /**
   * 檢查API金鑰
   * @param {string} provider - API提供商
   * @param {string} apiKey - API金鑰
   */
  async checkApiKey(provider, apiKey) {
    if (!apiKey) {
      window.showNotification('請輸入API金鑰', 'warning');
      return;
    }
    
    try {
      // 禁用檢查按鈕
      const button = document.getElementById(`check-${provider}-key-btn`);
      if (button) {
        button.disabled = true;
        button.textContent = '檢查中...';
      }

      // 使用模擬的檢查功能，實際應用中應該連接到主進程
      let isValid = false;
      
      // 簡單檢查 API 金鑰格式
      switch (provider) {
        case 'openai':
          isValid = apiKey.startsWith('sk-');
          break;
        case 'stabilityai':
          isValid = apiKey.startsWith('sk-');
          break;
        case 'genius':
          isValid = apiKey.length > 10;
          break;
        case 'musixmatch':
          isValid = apiKey.length > 10;
          break;
        case 'google':
          isValid = apiKey.length > 10;
          break;
        default:
          isValid = false;
      }
      
      // 恢復按鈕
      if (button) {
        button.disabled = false;
        button.textContent = '檢查';
      }
      
      // 顯示結果
      if (isValid) {
        window.showNotification(`${provider} API金鑰格式有效`, 'success');
      } else {
        window.showNotification(`${provider} API金鑰格式無效`, 'error');
      }
    } catch (error) {
      console.error(`檢查${provider}API金鑰失敗:`, error);
      window.showNotification(`檢查API金鑰失敗: ${error.message}`, 'error');
      
      // 恢復按鈕
      const button = document.getElementById(`check-${provider}-key-btn`);
      if (button) {
        button.disabled = false;
        button.textContent = '檢查';
      }
    }
  }
  
  /**
   * 清除緩存
   * @param {string} type - 緩存類型
   */
  async clearCache(type) {
    try {
      // 模擬緩存清除功能
      let message = '';
      
      switch (type) {
        case 'lyrics':
          message = '歌詞緩存已清除';
          // 如果有 localStorage，則清除相關緩存
          if (window.localStorage) {
            const keys = Object.keys(localStorage);
            let count = 0;
            keys.forEach(key => {
              if (key.startsWith('lyrics_') || key.startsWith('search_')) {
                localStorage.removeItem(key);
                count++;
              }
            });
            console.log(`已清除 ${count} 項本地歌詞緩存`);
          }
          break;
        case 'images':
          message = '圖片緩存已清除';
          // 如果有 localStorage，則清除相關緩存
          if (window.localStorage) {
            const keys = Object.keys(localStorage);
            let count = 0;
            keys.forEach(key => {
              if (key.startsWith('image_') || key.startsWith('bg_')) {
                localStorage.removeItem(key);
                count++;
              }
            });
            console.log(`已清除 ${count} 項本地圖片緩存`);
          }
          break;
        case 'all':
          message = '所有緩存已清除';
          // 清除所有 localStorage（但保留設置）
          if (window.localStorage) {
            const settings = localStorage.getItem('settings');
            localStorage.clear();
            if (settings) {
              localStorage.setItem('settings', settings);
            }
            console.log('已清除所有本地緩存（保留設置）');
          }
          break;
        default:
          throw new Error('未知緩存類型');
      }
      
      // 如果 electronAPI 可用，嘗試通知主進程
      if (window.electronAPI && typeof window.electronAPI.send === 'function') {
        try {
          window.electronAPI.send('clear-cache', { type });
        } catch (err) {
          console.warn('無法通知主進程清除緩存:', err);
        }
      }
      
      window.showNotification(`成功清除${type === 'all' ? '所有' : type}緩存`, 'success');
      return { success: true, message };
    } catch (error) {
      console.error('清除緩存失敗:', error);
      window.showNotification('清除緩存失敗: ' + error.message, 'error');
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 切換圖片生成提供商選項
   */
  toggleImageProviderOptions() {
    const provider = this.imageProviderSelect?.value || 'openai';
    
    // 獲取所有OpenAI選項
    const openaiOptions = document.querySelectorAll('.openai-options');
    const stabilityOptions = document.querySelectorAll('.stability-options');
    
    // 根據所選提供商顯示/隱藏選項
    if (provider === 'openai') {
      openaiOptions.forEach(el => el.style.display = 'block');
      stabilityOptions.forEach(el => el.style.display = 'none');
    } else {
      openaiOptions.forEach(el => el.style.display = 'none');
      stabilityOptions.forEach(el => el.style.display = 'block');
    }
    
    // 更新設置
    this.settings.imageProvider = provider;
  }
  
  /**
   * 加載提示詞模板選項
   */
  loadTemplateOptions() {
    // 先清空除了預設和custom外的選項
    const options = Array.from(this.promptTemplateSelect.options);
    for (let i = options.length - 1; i >= 0; i--) {
      const option = options[i];
      if (option.value !== 'default' && option.value !== 'custom') {
        this.promptTemplateSelect.remove(i);
      }
    }
    
    // 添加已有模板
    const templates = Object.keys(this.promptTemplates).filter(key => key !== 'default' && key !== 'custom');
    for (const template of ['default', 'abstract', 'nature', 'worship', 'modern', ...templates]) {
      if (template === 'default' || template === 'custom') continue;
      
      // 檢查選項是否已存在
      let exists = false;
      for (let i = 0; i < this.promptTemplateSelect.options.length; i++) {
        if (this.promptTemplateSelect.options[i].value === template) {
          exists = true;
          break;
        }
      }
      
      // 如果不存在則添加
      if (!exists && this.promptTemplates[template]) {
        const option = document.createElement('option');
        option.value = template;
        option.textContent = this.formatTemplateName(template);
        
        // 插入到 custom 選項前
        const customIndex = Array.from(this.promptTemplateSelect.options)
          .findIndex(opt => opt.value === 'custom');
        
        if (customIndex !== -1) {
          this.promptTemplateSelect.insertBefore(option, this.promptTemplateSelect.options[customIndex]);
        } else {
          this.promptTemplateSelect.appendChild(option);
        }
      }
    }
  }
  
  /**
   * 格式化模板名稱
   * @param {string} name - 模板名稱
   * @returns {string} 格式化後的名稱
   */
  formatTemplateName(name) {
    // 將駝峰命名轉換為空格分隔，首字母大寫
    return name
      .replace(/([A-Z])/g, ' $1') // 在大寫字母前添加空格
      .replace(/^./, str => str.toUpperCase()) // 首字母大寫
      .replace(/^\w/, c => c.toUpperCase()); // 確保首字母大寫
  }
  
  /**
   * 加載選中的模板
   */
  loadSelectedTemplate() {
    const templateName = this.promptTemplateSelect.value;
    
    if (templateName && this.promptTemplates[templateName]) {
      this.promptTemplateText.value = this.promptTemplates[templateName];
    } else if (templateName === 'custom') {
      this.promptTemplateText.value = this.promptTemplates.custom || '';
    } else {
      this.promptTemplateText.value = '';
    }
    
    // 僅當選擇自定義時啟用編輯
    this.promptTemplateText.readOnly = templateName !== 'custom';
  }
  
  /**
   * 保存當前模板
   */
  saveCurrentTemplate() {
    const templateName = this.promptTemplateSelect.value;
    const templateContent = this.promptTemplateText.value.trim();
    
    if (!templateContent) {
      window.showNotification('模板內容不能為空', 'warning');
      return;
    }
    
    // 更新模板
    this.promptTemplates[templateName] = templateContent;
    
    window.showNotification(`模板 "${this.formatTemplateName(templateName)}" 已保存`, 'success');
  }
  
  /**
   * 重置當前模板
   */
  resetCurrentTemplate() {
    const templateName = this.promptTemplateSelect.value;
    
    // 請求確認
    if (confirm(`確定要重置 "${this.formatTemplateName(templateName)}" 模板嗎？`)) {
      // 獲取默認模板
      const defaultTemplates = {
        default: "為以下歌詞創建背景圖片：\n「{{lyrics}}」\n風格：簡約現代，適合教會或歌唱聚會使用的投影片背景，不要包含任何文字或人物，只需要創作美麗和諧的抽象背景。",
        abstract: "創建一個抽象藝術背景，代表以下歌詞的情感：\n「{{lyrics}}」\n風格：柔和色彩、流動形狀，沒有文字，適合作為投影片背景。",
        nature: "基於以下歌詞創建一個自然風景背景：\n「{{lyrics}}」\n風格：平靜的自然景觀，沒有文字，適合作為投影片背景。",
        worship: "為這段敬拜歌詞創建一個虔誠的背景：\n「{{lyrics}}」\n風格：神聖、平和、簡約，沒有文字，適合教會使用的投影片背景。",
        modern: "為以下歌詞創建一個現代風格背景：\n「{{lyrics}}」\n風格：現代設計、簡約、平滑漸變，沒有文字，適合作為投影片背景。"
      };
      
      // 重置為默認值或清空
      if (defaultTemplates[templateName]) {
        this.promptTemplates[templateName] = defaultTemplates[templateName];
        this.promptTemplateText.value = defaultTemplates[templateName];
      } else {
        // 如果是自定義模板，則清空
        this.promptTemplates[templateName] = '';
        this.promptTemplateText.value = '';
      }
      
      window.showNotification(`模板 "${this.formatTemplateName(templateName)}" 已重置`, 'info');
    }
  }
  
  /**
   * 應用主題
   * @param {string} theme - 主題名稱
   */
  applyTheme(theme) {
    // 移除所有主題類
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-auto');
    
    // 添加選中的主題類
    document.documentElement.classList.add(`theme-${theme}`);
    
    console.log(`已應用主題: ${theme}`);
  }
  
  /**
   * 獲取設置值
   * @param {string} key - 設置鍵（可使用點號分隔的路徑）
   * @param {any} defaultValue - 默認值（如果設置不存在）
   * @returns {any} 設置值或默認值
   */
  getSetting(key, defaultValue = null) {
    try {
      const keys = key.split('.');
      let result = this.settings;
      
      for (const k of keys) {
        if (result === undefined || result === null) {
          return defaultValue;
        }
        result = result[k];
      }
      
      return result !== undefined ? result : defaultValue;
    } catch (error) {
      console.error(`獲取設置 ${key} 失敗:`, error);
      return defaultValue;
    }
  }
  
  /**
   * 更新API配置
   */
  updateApiConfigs() {
    // 僅允許特定的API服務用於各功能
    if (this.lyricsSearchSelect) {
      this.settings.apiConfigs.lyricsSearch = 'google'; // 強制使用Google
      this.lyricsSearchSelect.value = 'google';
    }
    
    if (this.imageGenerationSelect) {
      this.settings.apiConfigs.imageGeneration = 'openai'; // 強制使用OpenAI
      this.imageGenerationSelect.value = 'openai';
    }
    
    if (this.slideCreationSelect) {
      this.settings.apiConfigs.slideCreation = 'openai'; // 強制使用OpenAI
      this.slideCreationSelect.value = 'openai';
    }
    
    // 更新相關UI元素狀態
    this.updateApiUIState();
  }
  
  /**
   * 更新API UI狀態
   */
  updateApiUIState() {
    try {
      // 確保apiConfigs存在
      if (!this.settings.apiConfigs) {
        this.settings.apiConfigs = {
          lyricsSearch: 'google',
          imageGeneration: 'openai',
          slideCreation: 'openai'
        };
      }
      
      // 檢查Google API金鑰和搜尋引擎ID是否已填寫
      const hasGoogleConfig = (this.settings.apiKeys?.google && this.settings.searchEngineId) ? true : false;
      
      // 檢查OpenAI API金鑰是否已填寫
      const hasOpenAIConfig = this.settings.apiKeys?.openai ? true : false;
      
      // 顯示相應的警告或提示
      const lyricsSearchWarning = document.getElementById('lyrics-search-warning');
      if (lyricsSearchWarning) {
        lyricsSearchWarning.style.display = hasGoogleConfig ? 'none' : 'block';
      }
      
      const imageGenWarning = document.getElementById('image-gen-warning');
      if (imageGenWarning) {
        imageGenWarning.style.display = hasOpenAIConfig ? 'none' : 'block';
      }
      
      const slideCreationWarning = document.getElementById('slide-creation-warning');
      if (slideCreationWarning) {
        slideCreationWarning.style.display = hasOpenAIConfig ? 'none' : 'block';
      }
      
      // 更新搜尋功能UI狀態
      this.updateSearchConfigUI();
      
    } catch (error) {
      console.error('更新API UI狀態時出錯:', error);
    }
  }
  
  /**
   * 更新搜尋配置UI狀態
   */
  updateSearchConfigUI() {
    try {
      // 根據Google API設定的狀態啟用或禁用搜尋功能
      const hasGoogleConfig = (this.settings.apiKeys?.google && this.settings.searchEngineId) ? true : false;
      
      // 更新搜尋區塊的視覺狀態
      const searchSection = document.getElementById('lyrics-search-section');
      if (searchSection) {
        searchSection.classList.toggle('disabled-api-section', !hasGoogleConfig);
      }
      
      // 啟用或禁用搜尋設置控件
      const searchControls = document.querySelectorAll('.lyrics-search-control');
      searchControls.forEach(control => {
        control.disabled = !hasGoogleConfig;
      });
      
      // 顯示或隱藏警告
      const searchWarning = document.getElementById('lyrics-search-warning');
      if (searchWarning) {
        searchWarning.style.display = hasGoogleConfig ? 'none' : 'block';
        searchWarning.textContent = hasGoogleConfig ? '' : '請設置Google API金鑰和搜尋引擎ID以啟用歌詞搜尋功能';
      }
      
    } catch (error) {
      console.error('更新搜尋配置UI狀態時出錯:', error);
    }
  }
  
  /**
   * 更新與LLM相關的選項
   */
  updateLLMRelatedOptions() {
    // 檢查是否有OpenAI API金鑰
    const hasOpenAIKey = this.settings.apiKeys.openai && this.settings.apiKeys.openai.trim().length > 0;
    
    // 檢查是否有Google API金鑰和搜尋引擎ID
    const hasGoogleConfig = this.settings.apiKeys.google && this.settings.searchEngineId;
    
    // 更新UI元素
    const apiSections = {
      'lyrics-search': hasGoogleConfig,
      'image-generation': hasOpenAIKey,
      'slide-creation': hasOpenAIKey
    };
    
    // 更新各API功能區塊的狀態
    Object.entries(apiSections).forEach(([sectionId, isEnabled]) => {
      const section = document.getElementById(`${sectionId}-section`);
      if (section) {
        const controls = section.querySelectorAll('select, button:not(.api-key-action)');
        controls.forEach(control => {
          control.disabled = !isEnabled;
        });
        
        // 更新區塊的視覺樣式
        section.classList.toggle('disabled-api-section', !isEnabled);
        
        // 顯示或隱藏提示
        const warning = document.getElementById(`${sectionId}-warning`);
        if (warning) {
          warning.style.display = isEnabled ? 'none' : 'block';
        }
      }
    });
    
    // 特別處理圖片生成相關選項
    this.toggleImageProviderOptions();
  }
}

// 導出模塊
window.SettingsModule = SettingsModule; 