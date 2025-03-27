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
        musixmatch: ''
      },
      promptTemplates: {},
      slidesSettings: {},
      useLLM: true,
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
    this.useLLMCheckbox = document.getElementById('use-llm-checkbox');
    
    // 顯示/隱藏密碼按鈕
    this.showOpenaiKeyBtn = document.getElementById('show-openai-key-btn');
    this.showStabilityaiKeyBtn = document.getElementById('show-stabilityai-key-btn');
    this.showGeniusKeyBtn = document.getElementById('show-genius-key-btn');
    this.showMusixmatchKeyBtn = document.getElementById('show-musixmatch-key-btn');
    
    // 檢查API金鑰按鈕
    this.checkOpenaiKeyBtn = document.getElementById('check-openai-key-btn');
    this.checkStabilityaiKeyBtn = document.getElementById('check-stabilityai-key-btn');
    this.checkGeniusKeyBtn = document.getElementById('check-genius-key-btn');
    this.checkMusixmatchKeyBtn = document.getElementById('check-musixmatch-key-btn');
    
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
      
      // 更新本地設置
      this.settings = settings;
      
      // 更新UI
      this.updateSettingsUI();
      
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
    this.outputPathInput.value = this.settings.outputPath || '';
    this.themeSelect.value = this.settings.theme || 'light';
    this.languageSelect.value = this.settings.locale || 'zh-TW';
    this.autoUpdateCheckbox.checked = this.settings.autoUpdate !== false;
    
    // API金鑰設置
    this.openaiApiKeyInput.value = this.settings.apiKeys?.openai || '';
    this.stabilityaiApiKeyInput.value = this.settings.apiKeys?.stabilityai || '';
    this.geniusApiKeyInput.value = this.settings.apiKeys?.genius || '';
    this.musixmatchApiKeyInput.value = this.settings.apiKeys?.musixmatch || '';
    this.useLLMCheckbox.checked = this.settings.useLLM !== false;
    
    // 圖片生成設置
    this.imageProviderSelect.value = this.settings.imageProvider || 'openai';
    this.imageModelSelect.value = this.settings.imageModel || 'dall-e-3';
    this.imageQualitySelect.value = this.settings.imageQuality || 'standard';
    this.imageStyleSelect.value = this.settings.imageStyle || 'natural';
    
    if (this.settings.stabilityModel) {
      this.stabilityModelSelect.value = this.settings.stabilityModel;
    }
    
    // 提示詞模板
    this.promptTemplates = this.settings.promptTemplates || {};
    this.loadTemplateOptions();
    this.loadSelectedTemplate();
    
    // 投影片設置
    const slideSettings = this.settings.slidesSettings || {};
    this.fontFamilySelect.value = slideSettings.fontFamily || 'Microsoft JhengHei, Arial, sans-serif';
    this.fontSizeInput.value = slideSettings.fontSize || 60;
    this.fontColorInput.value = slideSettings.fontColor || '#FFFFFF';
    this.textShadowCheckbox.checked = slideSettings.textShadow !== false;
    this.lineHeightInput.value = slideSettings.lineHeight || 1.5;
    this.maxLinesInput.value = slideSettings.maxLinesPerSlide || 4;
    this.textPositionSelect.value = slideSettings.textPosition || 'center';
    
    // 更新圖片提供商選項顯示
    this.toggleImageProviderOptions();
  }
  
  /**
   * 保存設置
   */
  async saveSettings() {
    try {
      // 收集設置值
      const settings = {
        theme: this.themeSelect ? this.themeSelect.value : 'light',
        outputPath: this.outputPathInput ? this.outputPathInput.value : '',
        autoUpdate: this.autoUpdateCheckbox ? this.autoUpdateCheckbox.checked : true,
        locale: this.languageSelect ? this.languageSelect.value : 'zh-TW',
        apiKeys: {
          openai: this.openaiApiKeyInput ? this.openaiApiKeyInput.value : '',
          stabilityai: this.stabilityaiApiKeyInput ? this.stabilityaiApiKeyInput.value : '',
          genius: this.geniusApiKeyInput ? this.geniusApiKeyInput.value : '',
          musixmatch: this.musixmatchApiKeyInput ? this.musixmatchApiKeyInput.value : ''
        },
        promptTemplates: this.promptTemplates || {},
        slidesSettings: {
          fontFamily: this.fontFamilySelect ? this.fontFamilySelect.value : 'Microsoft JhengHei, Arial, sans-serif',
          fontSize: this.fontSizeInput ? parseInt(this.fontSizeInput.value, 10) : 60,
          fontColor: this.fontColorInput ? this.fontColorInput.value : '#FFFFFF',
          textShadow: this.textShadowCheckbox ? this.textShadowCheckbox.checked : true,
          lineHeight: this.lineHeightInput ? parseFloat(this.lineHeightInput.value) : 1.5,
          maxLinesPerSlide: this.maxLinesInput ? parseInt(this.maxLinesInput.value, 10) : 4,
          textPosition: this.textPositionSelect ? this.textPositionSelect.value : 'center'
        },
        useLLM: this.useLLMCheckbox ? this.useLLMCheckbox.checked : true,
        imageProvider: this.imageProviderSelect ? this.imageProviderSelect.value : 'openai',
        imageModel: this.imageModelSelect ? this.imageModelSelect.value : 'dall-e-3',
        imageQuality: this.imageQualitySelect ? this.imageQualitySelect.value : 'standard',
        imageStyle: this.imageStyleSelect ? this.imageStyleSelect.value : 'natural',
        stabilityModel: this.stabilityModelSelect ? this.stabilityModelSelect.value : ''
      };
      
      // 保存到主進程
      const result = await window.electronAPI.setStoreValue('settings', settings);
      
      if (result) {
        window.showNotification('設置已保存', 'success');
        
        // 更新本地設置
        this.settings = settings;
        
        // 應用主題
        this.applyTheme(settings.theme);
      } else {
        throw new Error('保存設置失敗');
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
          this.outputPathInput.value = path;
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
   * 切換圖片生成服務選項
   */
  toggleImageProviderOptions() {
    const provider = this.imageProviderSelect.value;
    
    // 顯示/隱藏相應選項
    const openaiOptions = document.querySelectorAll('.openai-option');
    const stabilityOptions = document.querySelectorAll('.stability-option');
    
    if (provider === 'openai') {
      openaiOptions.forEach(el => el.style.display = 'block');
      stabilityOptions.forEach(el => el.style.display = 'none');
    } else {
      openaiOptions.forEach(el => el.style.display = 'none');
      stabilityOptions.forEach(el => el.style.display = 'block');
    }
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
}

// 導出模塊
window.SettingsModule = SettingsModule; 