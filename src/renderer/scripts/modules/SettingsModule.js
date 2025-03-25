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
 * 設定管理模塊
 * 負責應用程式設置和API金鑰管理
 */
class SettingsModule {
  constructor() {
    this.settings = {
      // 一般設置
      general: {
        theme: 'system', // light, dark, system
        language: 'zh-TW',
        autoSave: true,
        autoSaveInterval: 5, // 分鐘
        checkUpdates: true
      },
      // 輸出設置
      output: {
        defaultPath: '',
        defaultFormat: 'pptx',
        defaultQuality: 'high'
      },
      // API設置
      api: {
        lyrics: {
          apis: [],
          defaultApi: null
        },
        background: {
          apis: [],
          defaultApi: null
        }
      },
      // 圖片生成設置
      imageGeneration: {
        defaultSize: '1920x1080', // 與投影片解析度同步
        promptConfig: {
          useAIAssistant: true,
          appendKeywords: true,
          preferredLanguage: 'zh-TW'
        }
      },
      // 投影片模板設置
      templates: {
        defaultTemplate: 'standard',
        fontFamily: 'Microsoft JhengHei, Arial, sans-serif',
        fontSize: 60,
        fontColor: '#FFFFFF',
        fontWeight: 'bold',
        textShadow: true
      },
      // 投影片解析度設置
      resolution: {
        type: '16:9',
        width: 1920,
        height: 1080
      }
    };
    
    // 常用的DOM元素引用
    this.elements = {
      settingsContainer: document.getElementById('settings-container'),
      themeSelector: document.getElementById('theme-select'),
      languageSelector: document.getElementById('language-select'),
      autoSaveToggle: document.getElementById('auto-update-check'),
      autoSaveInterval: document.getElementById('auto-save-interval'),
      outputPathInput: document.getElementById('default-output-path'),
      browseOutputButton: document.getElementById('browse-output-path'),
      defaultFormatSelector: document.getElementById('default-format'),
      saveSettingsButton: document.getElementById('save-settings-btn'),
      resetSettingsButton: document.getElementById('reset-settings-btn'),
      // API相關元素
      lyricsApiRows: document.getElementById('lyrics-api-rows'),
      backgroundApiRows: document.getElementById('background-api-rows'),
      addLyricsApiBtn: document.getElementById('add-lyrics-api'),
      addBackgroundApiBtn: document.getElementById('add-background-api')
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
    this.dialogModule = dependencies.dialogModule;
    
    // 載入保存的設置
    this.loadSettings();
    
    console.log('設定模塊已初始化');
  }
  
  /**
   * 初始化事件監聽器
   */
  initEventListeners() {
    // 主題選擇器
    if (this.elements.themeSelector) {
      this.elements.themeSelector.addEventListener('change', (e) => {
        this.settings.general.theme = e.target.value;
        this.applyTheme(e.target.value);
      });
    }
    
    // 語言選擇器
    if (this.elements.languageSelector) {
      this.elements.languageSelector.addEventListener('change', (e) => {
        this.settings.general.language = e.target.value;
      });
    }
    
    // 自動保存開關
    if (this.elements.autoSaveToggle) {
      this.elements.autoSaveToggle.addEventListener('change', (e) => {
        this.settings.general.autoSave = e.target.checked;
        
        // 更新自動保存間隔輸入框的啟用狀態
        if (this.elements.autoSaveInterval) {
          this.elements.autoSaveInterval.disabled = !e.target.checked;
        }
      });
    }
    
    // 自動保存間隔
    if (this.elements.autoSaveInterval) {
      this.elements.autoSaveInterval.addEventListener('change', (e) => {
        const value = parseInt(e.target.value);
        if (!isNaN(value) && value > 0) {
          this.settings.general.autoSaveInterval = value;
        } else {
          e.target.value = this.settings.general.autoSaveInterval;
        }
      });
    }
    
    // 默認輸出路徑瀏覽按鈕
    if (this.elements.browseOutputButton) {
      this.elements.browseOutputButton.addEventListener('click', () => {
        this.browseOutputPath();
      });
    }
    
    // 默認格式選擇器
    if (this.elements.defaultFormatSelector) {
      this.elements.defaultFormatSelector.addEventListener('change', (e) => {
        this.settings.output.defaultFormat = e.target.value;
      });
    }
    
    // API相關事件監聽器
    if (this.elements.addLyricsApiBtn) {
      this.elements.addLyricsApiBtn.addEventListener('click', () => {
        this.addApiRow('lyrics');
      });
    }
    
    if (this.elements.addBackgroundApiBtn) {
      this.elements.addBackgroundApiBtn.addEventListener('click', () => {
        this.addApiRow('background');
      });
    }
    
    // 委派事件監聽器
    document.addEventListener('click', (e) => {
      // 刪除API列
      if (e.target.classList.contains('delete-api-row')) {
        const row = e.target.closest('.api-row');
        if (row) {
          row.remove();
        }
      }
      
      // 驗證API金鑰
      if (e.target.classList.contains('validate-api-key')) {
        const row = e.target.closest('.api-row');
        const type = e.target.dataset.type;
        if (row && type) {
          this.validateApiKey(row, type);
        }
      }
      
      // 切換API金鑰可見性
      if (e.target.classList.contains('toggle-key-visibility')) {
        const input = e.target.closest('.api-input-group').querySelector('.api-key');
        if (input) {
          this.toggleApiKeyVisibility(input, e.target);
        }
      }
      
      // 保存設定按鈕
      if (e.target.id === 'save-settings-btn') {
        this.saveSettings();
      }
      
      // 重置設定按鈕
      if (e.target.id === 'reset-settings-btn') {
        this.confirmResetSettings();
      }
    });
    
    // 監聽預設API變更
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('set-default-api')) {
        const row = e.target.closest('.api-row');
        const type = e.target.dataset.type;
        if (row && type) {
          this.setDefaultApi(row, type);
        }
      }
    });
  }
  
  /**
   * 載入保存的設置
   */
  async loadSettings() {
    try {
      // 從存儲中獲取設置
      const savedSettings = await window.electronAPI.getStoreValue('settings');
      
      if (savedSettings) {
        // 確保API設置的結構正確
        if (!savedSettings.api) {
          savedSettings.api = {
            lyrics: { apis: [], defaultApi: null },
            background: { apis: [], defaultApi: null }
          };
        }
        
        // 確保apis陣列存在
        if (!Array.isArray(savedSettings.api.lyrics.apis)) {
          savedSettings.api.lyrics.apis = [];
        }
        if (!Array.isArray(savedSettings.api.background.apis)) {
          savedSettings.api.background.apis = [];
        }
        
        // 合併保存的設置與默認設置
        this.settings = this.mergeSettings(this.settings, savedSettings);
      }
      
      // 將設置應用到UI
      this.applySettingsToUI();
      
      // 應用主題
      this.applyTheme(this.settings.general.theme);
      
      // 獲取默認輸出路徑（如果尚未設置）
      if (!this.settings.output.defaultPath) {
        const documentsPath = await window.electronAPI.getAppPath('documents');
        this.settings.output.defaultPath = documentsPath;
        
        // 更新UI
        if (this.elements.outputPathInput) {
          this.elements.outputPathInput.value = documentsPath;
        }
      }
    } catch (error) {
      console.error('載入設置失敗:', error);
    }
  }
  
  /**
   * 將保存的設置應用到UI
   */
  applySettingsToUI() {
    // 主題選擇器
    if (this.elements.themeSelector) {
      this.elements.themeSelector.value = this.settings.general.theme;
    }
    
    // 語言選擇器
    if (this.elements.languageSelector) {
      this.elements.languageSelector.value = this.settings.general.language;
    }
    
    // 自動保存開關
    if (this.elements.autoSaveToggle) {
      this.elements.autoSaveToggle.checked = this.settings.general.autoSave;
    }
    
    // 自動保存間隔
    if (this.elements.autoSaveInterval) {
      this.elements.autoSaveInterval.value = this.settings.general.autoSaveInterval;
      this.elements.autoSaveInterval.disabled = !this.settings.general.autoSave;
    }
    
    // 默認輸出路徑
    if (this.elements.outputPathInput) {
      this.elements.outputPathInput.value = this.settings.output.defaultPath;
    }
    
    // 默認格式
    if (this.elements.defaultFormatSelector) {
      this.elements.defaultFormatSelector.value = this.settings.output.defaultFormat;
    }
    
    // 應用API設置
    this.applyApiSettings();
  }
  
  /**
   * 應用API設置到UI
   */
  applyApiSettings() {
    // 確保API設置的結構正確
    if (!this.settings.api) {
      this.settings.api = {
        lyrics: { apis: [], defaultApi: null },
        background: { apis: [], defaultApi: null }
      };
    }
    
    // 確保apis陣列存在
    if (!Array.isArray(this.settings.api.lyrics.apis)) {
      this.settings.api.lyrics.apis = [];
    }
    if (!Array.isArray(this.settings.api.background.apis)) {
      this.settings.api.background.apis = [];
    }
    
    // 清空現有API列
    if (this.elements.lyricsApiRows) {
      this.elements.lyricsApiRows.innerHTML = '';
    }
    if (this.elements.backgroundApiRows) {
      this.elements.backgroundApiRows.innerHTML = '';
    }
    
    // 添加歌詞API
    this.settings.api.lyrics.apis.forEach(api => {
      const row = this.createApiRow('lyrics', api);
      if (this.elements.lyricsApiRows) {
        this.elements.lyricsApiRows.appendChild(row);
      }
    });
    
    // 添加背景API
    this.settings.api.background.apis.forEach(api => {
      const row = this.createApiRow('background', api);
      if (this.elements.backgroundApiRows) {
        this.elements.backgroundApiRows.appendChild(row);
      }
    });
  }
  
  /**
   * 創建API列元素
   * @param {string} type - API類型
   * @param {Object} api - API資訊
   * @returns {HTMLElement} API列元素
   */
  createApiRow(type, api) {
    const row = document.createElement('div');
    row.className = 'api-row';
    row.innerHTML = `
      <div class="api-input-group">
        <input type="text" class="api-name" placeholder="API名稱" value="${api.name || ''}">
        <div style="position: relative; flex: 1; display: flex;">
          <input type="password" class="api-key" placeholder="API金鑰" value="${api.key || ''}">
          <button type="button" class="toggle-key-visibility" title="顯示/隱藏">👁️</button>
        </div>
        <button class="action-button small validate-api-key" data-type="${type}">驗證</button>
        <button class="action-button small delete-api-row">🗑️</button>
      </div>
      <div class="api-checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" class="set-default-api" data-type="${type}" ${api.isDefault ? 'checked' : ''}>
          <span>設為預設</span>
        </label>
      </div>
    `;
    return row;
  }
  
  /**
   * 保存設置
   */
  async saveSettings() {
    try {
      console.log('正在保存設置...');
      
      // 收集API設置
      this.settings.api.lyrics.apis = this.collectApiSettings('lyrics');
      this.settings.api.background.apis = this.collectApiSettings('background');
      
      // 收集其他設置
      this.collectGeneralSettings();
      
      // 保存到存儲
      console.log('保存設置到電子存儲...', this.settings);
      const result = await window.electronAPI.setStoreValue('settings', this.settings);
      console.log('設置保存結果:', result);
      
      // 保存默認輸出路徑作為單獨設置（便於其他模塊直接使用）
      if (this.settings.output.defaultPath) {
        await window.electronAPI.setStoreValue('outputPath', this.settings.output.defaultPath);
      }
      
      // 顯示成功消息
      window.showNotification('設置已保存', 'success');
      
      // 顯示確認對話框
      if (this.dialogModule && typeof this.dialogModule.showConfirmDialog === 'function') {
        this.dialogModule.showConfirmDialog(
          '您的設定已成功保存',
          () => {
            // 不需要額外的操作，對話框會自動關閉
            console.log('設置保存確認對話框已關閉');
          },
          null,
          {
            title: '設定已保存',
            confirmText: '確定',
            cancelText: null, // 不顯示取消按鈕
            type: 'info'
          }
        );
      }
    } catch (error) {
      console.error('保存設置失敗:', error);
      window.showNotification('保存設置失敗: ' + (error.message || '未知錯誤'), 'error');
      
      // 顯示錯誤對話框
      if (this.dialogModule && typeof this.dialogModule.showConfirmDialog === 'function') {
        this.dialogModule.showConfirmDialog(
          `錯誤信息: ${error.message || '未知錯誤'}`,
          () => {
            // 不需要額外的操作，對話框會自動關閉
            console.log('設置保存錯誤對話框已關閉');
          },
          null,
          {
            title: '保存設定失敗',
            confirmText: '確定',
            cancelText: null, // 不顯示取消按鈕
            type: 'error'
          }
        );
      }
    }
  }
  
  /**
   * 收集一般設置
   */
  collectGeneralSettings() {
    // 主題
    if (this.elements.themeSelector) {
      this.settings.general.theme = this.elements.themeSelector.value;
    }
    
    // 語言
    if (this.elements.languageSelector) {
      this.settings.general.language = this.elements.languageSelector.value;
    }
    
    // 自動檢查更新
    if (this.elements.autoSaveToggle) {
      this.settings.general.checkUpdates = this.elements.autoSaveToggle.checked;
    }
    
    // 解析度設置
    const resolutionSelect = document.getElementById('resolution-select');
    if (resolutionSelect) {
      this.settings.resolution.type = resolutionSelect.value;
    }
    
    // 自訂解析度
    const customWidth = document.getElementById('custom-width');
    const customHeight = document.getElementById('custom-height');
    
    if (customWidth && customHeight) {
      const width = parseInt(customWidth.value);
      const height = parseInt(customHeight.value);
      
      if (!isNaN(width) && width >= 640 && width <= 3840) {
        this.settings.resolution.width = width;
      }
      
      if (!isNaN(height) && height >= 480 && height <= 2160) {
        this.settings.resolution.height = height;
      }
    }
    
    // 輸出位置
    const outputPath = document.getElementById('output-path');
    if (outputPath) {
      this.settings.output.defaultPath = outputPath.value;
    }
  }
  
  /**
   * 收集API設置
   * @param {string} type - API類型
   * @returns {Array} API設置陣列
   */
  collectApiSettings(type) {
    const container = type === 'lyrics' ? this.elements.lyricsApiRows : this.elements.backgroundApiRows;
    if (!container) return [];
    
    const apis = [];
    container.querySelectorAll('.api-row').forEach(row => {
      const nameInput = row.querySelector('.api-name');
      const keyInput = row.querySelector('.api-key');
      const defaultCheckbox = row.querySelector('.set-default-api');
      
      if (nameInput && keyInput) {
        apis.push({
          name: nameInput.value.trim(),
          key: keyInput.value.trim(),
          isDefault: defaultCheckbox ? defaultCheckbox.checked : false
        });
      }
    });
    
    return apis;
  }
  
  /**
   * 確認重置設置
   */
  confirmResetSettings() {
    // 檢查dialogModule是否可用
    if (this.dialogModule && typeof this.dialogModule.showConfirmDialog === 'function') {
      this.dialogModule.showConfirmDialog(
        '確定要重置所有設置嗎？這將恢復默認設置，但不會刪除API金鑰。',
        () => {
          this.resetSettings();
        },
        null,
        {
          title: '重置設置',
          confirmText: '重置',
          cancelText: '取消'
        }
      );
    } else {
      // 如果dialogModule不可用，直接顯示瀏覽器原生確認對話框
      if (confirm('確定要重置所有設置嗎？這將恢復默認設置，但不會刪除API金鑰。')) {
        this.resetSettings();
      }
    }
  }
  
  /**
   * 重置設置為默認值
   */
  resetSettings() {
    // 保存API金鑰
    const apiKeys = {};
    Object.keys(this.settings.api).forEach(provider => {
      apiKeys[provider] = {
        key: this.settings.api[provider].key,
        usageLimit: this.settings.api[provider].usageLimit
      };
    });
    
    // 重置設置
    this.settings = {
      // 一般設置
      general: {
        theme: 'system',
        language: 'zh-TW',
        autoSave: true,
        autoSaveInterval: 5,
        checkUpdates: true
      },
      // 輸出設置
      output: {
        defaultPath: this.settings.output.defaultPath, // 保留路徑設置
        defaultFormat: 'pptx',
        defaultQuality: 'high'
      },
      // API設置（保留原有金鑰）
      api: apiKeys,
      // 圖片生成設置
      imageGeneration: {
        defaultSize: '1920x1080', // 與投影片解析度同步
        promptConfig: {
          useAIAssistant: true,
          appendKeywords: true,
          preferredLanguage: 'zh-TW'
        }
      },
      // 投影片模板設置
      templates: {
        defaultTemplate: 'standard',
        fontFamily: 'Microsoft JhengHei, Arial, sans-serif',
        fontSize: 60,
        fontColor: '#FFFFFF',
        fontWeight: 'bold',
        textShadow: true
      },
      // 投影片解析度設置
      resolution: {
        type: '16:9',
        width: 1920,
        height: 1080
      }
    };
    
    // 更新UI
    this.applySettingsToUI();
    
    // 應用主題
    this.applyTheme(this.settings.general.theme);

    // 更新投影片解析度選擇器
    const resolutionSelect = document.getElementById('resolution-select');
    if (resolutionSelect) {
      resolutionSelect.value = this.settings.resolution.type;
      
      // 如果有自訂解析度相關UI，也更新它們
      const customWidth = document.getElementById('custom-width');
      const customHeight = document.getElementById('custom-height');
      const customResolutionDiv = document.querySelector('.custom-resolution');
      
      if (customWidth && customHeight) {
        customWidth.value = this.settings.resolution.width;
        customHeight.value = this.settings.resolution.height;
      }
      
      if (customResolutionDiv) {
        customResolutionDiv.style.display = this.settings.resolution.type === 'custom' ? 'block' : 'none';
      }
    }
    
    // 顯示成功消息
    window.showNotification('設置已重置為默認值', 'info');
  }
  
  /**
   * 應用主題
   * @param {string} theme - 主題名稱
   */
  applyTheme(theme) {
    // 移除現有主題類
    document.body.classList.remove('light-theme', 'dark-theme');
    
    if (theme === 'system') {
      // 跟隨系統主題
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.classList.add(prefersDark ? 'dark-theme' : 'light-theme');
      
      // 監聽系統主題變化
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (this.settings.general.theme === 'system') {
          document.body.classList.remove('light-theme', 'dark-theme');
          document.body.classList.add(e.matches ? 'dark-theme' : 'light-theme');
        }
      });
    } else {
      // 使用指定主題
      document.body.classList.add(`${theme}-theme`);
    }
  }
  
  /**
   * 瀏覽默認輸出路徑
   */
  async browseOutputPath() {
    try {
      const result = await window.electronAPI.showOpenDialog({
        title: '選擇默認輸出位置',
        properties: ['openDirectory']
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        const outputPath = result.filePaths[0];
        this.settings.output.defaultPath = outputPath;
        
        // 更新UI
        if (this.elements.outputPathInput) {
          this.elements.outputPathInput.value = outputPath;
        }
      }
    } catch (error) {
      console.error('選擇輸出位置失敗:', error);
      window.showNotification('選擇輸出位置失敗', 'error');
    }
  }
  
  /**
   * 驗證API金鑰
   * @param {HTMLElement} row - API列元素
   * @param {string} type - API類型
   */
  async validateApiKey(row, type) {
    const nameInput = row.querySelector('.api-name');
    const keyInput = row.querySelector('.api-key');
    
    if (!nameInput || !keyInput) return;
    
    const name = nameInput.value.trim();
    const key = keyInput.value.trim();
    
    if (!name || !key) {
      window.showNotification('請輸入API名稱和金鑰', 'warning');
      return;
    }
    
    // 顯示驗證中狀態
    const button = row.querySelector('.validate-api-key');
    const originalText = button.textContent;
    button.textContent = '驗證中...';
    button.disabled = true;
    
    try {
      // 發送API金鑰驗證請求
      const result = await window.electronAPI.validateApiKey({
        type,
        name,
        key
      });
      
      if (result.valid) {
        window.showNotification(`${name}的API金鑰驗證成功`, 'success');
      } else {
        window.showNotification(`${name}的API金鑰無效: ${result.error || '未知錯誤'}`, 'error');
      }
    } catch (error) {
      console.error(`驗證${name}的API金鑰失敗:`, error);
      window.showNotification(`驗證${name}的API金鑰失敗: ${error.message || '網絡錯誤'}`, 'error');
    } finally {
      // 恢復按鈕狀態
      button.textContent = originalText;
      button.disabled = false;
    }
  }
  
  /**
   * 設置預設API
   * @param {HTMLElement} row - API列元素
   * @param {string} type - API類型
   */
  setDefaultApi(row, type) {
    const container = type === 'lyrics' ? this.elements.lyricsApiRows : this.elements.backgroundApiRows;
    if (!container) return;
    
    // 取消其他API的預設狀態
    container.querySelectorAll('.set-default-api').forEach(checkbox => {
      if (checkbox !== row.querySelector('.set-default-api')) {
        checkbox.checked = false;
      }
    });
    
    // 更新設定
    const nameInput = row.querySelector('.api-name');
    if (nameInput) {
      this.settings.api[type].defaultApi = nameInput.value.trim();
    }
  }
  
  /**
   * 新增API列
   * @param {string} type - API類型（lyrics或background）
   */
  addApiRow(type) {
    const container = type === 'lyrics' ? this.elements.lyricsApiRows : this.elements.backgroundApiRows;
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'api-row';
    row.innerHTML = `
      <div class="api-input-group">
        <input type="text" class="api-name" placeholder="API名稱">
        <div style="position: relative; flex: 1; display: flex;">
          <input type="password" class="api-key" placeholder="API金鑰">
          <button type="button" class="toggle-key-visibility" title="顯示/隱藏">👁️</button>
        </div>
        <button class="action-button small validate-api-key" data-type="${type}">驗證</button>
        <button class="action-button small delete-api-row">🗑️</button>
      </div>
      <div class="api-checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" class="set-default-api" data-type="${type}">
          <span>設為預設</span>
        </label>
      </div>
    `;
    
    container.appendChild(row);
  }
  
  /**
   * 獲取設置值
   * @param {string} key - 設置鍵（可使用點號分隔的路徑）
   * @returns {any} 設置值或undefined
   */
  getSetting(key) {
    const keys = key.split('.');
    let result = this.settings;
    
    for (const k of keys) {
      if (result === undefined || result === null) return undefined;
      result = result[k];
    }
    
    return result;
  }
  
  /**
   * 設置設置值
   * @param {string} key - 設置鍵（可使用點號分隔的路徑）
   * @param {any} value - 設置值
   */
  setSetting(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let target = this.settings;
    
    for (const k of keys) {
      if (target[k] === undefined) {
        target[k] = {};
      }
      target = target[k];
    }
    
    target[lastKey] = value;
  }
  
  /**
   * 掩蓋API金鑰（僅顯示部分字符）
   * @param {string} key - API金鑰
   * @returns {string} 掩蓋後的金鑰
   */
  maskApiKey(key) {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  }
  
  /**
   * 合併設置對象
   * @param {Object} target - 目標設置對象
   * @param {Object} source - 源設置對象
   * @returns {Object} 合併後的設置對象
   */
  mergeSettings(target, source) {
    const result = { ...target };
    
    Object.keys(source).forEach(key => {
      if (typeof source[key] === 'object' && source[key] !== null && target[key]) {
        result[key] = this.mergeSettings(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    });
    
    return result;
  }
  
  /**
   * 取得API提供者顯示名稱
   * @param {string} provider - API提供者
   * @returns {string} 顯示名稱
   */
  getProviderDisplayName(provider) {
    const displayNames = {
      'openai': 'OpenAI (DALL-E)',
      'stability': 'Stability AI',
      'musixmatch': 'Musixmatch'
    };
    
    return displayNames[provider] || provider;
  }
  
  /**
   * 取得API使用單位
   * @param {string} provider - API提供者
   * @returns {string} 使用單位
   */
  getUsageUnit(provider) {
    const units = {
      'openai': '美元',
      'stability': '美元',
      'musixmatch': '次請求'
    };
    
    return units[provider] || '單位';
  }
  
  /**
   * 格式化使用百分比
   * @param {number} used - 已使用額度
   * @param {number} limit - 限制額度
   * @returns {string} 格式化的百分比
   */
  formatPercentage(used, limit) {
    if (!limit) return '無限制';
    
    const percentage = (used / limit) * 100;
    return `${percentage.toFixed(1)}%`;
  }
  
  /**
   * 顯示API使用統計
   */
  async showApiUsageStats() {
    try {
      // 獲取API使用統計
      const stats = await window.electronAPI.getApiUsageStats();
      
      // 顯示統計對話框
      this.dialogModule.showDialog(`
        <h3>API使用統計</h3>
        <div class="api-usage-stats">
          ${Object.keys(stats).map(provider => `
            <div class="api-provider-stats">
              <h4>${this.getProviderDisplayName(provider)}</h4>
              <div class="stats-row">
                <span>本月使用額度:</span>
                <span>${stats[provider].used} ${this.getUsageUnit(provider)}</span>
              </div>
              <div class="stats-row">
                <span>設置限額:</span>
                <span>${this.settings.api[provider].usageLimit || '無限制'} ${this.getUsageUnit(provider)}</span>
              </div>
              <div class="stats-row">
                <span>API調用次數:</span>
                <span>${stats[provider].calls}</span>
              </div>
              <div class="stats-row">
                <span>上次使用時間:</span>
                <span>${stats[provider].lastUsed ? new Date(stats[provider].lastUsed).toLocaleString() : '無記錄'}</span>
              </div>
              <div class="usage-progress">
                <progress value="${stats[provider].used}" max="${this.settings.api[provider].usageLimit || 100}"></progress>
                <span>${this.formatPercentage(stats[provider].used, this.settings.api[provider].usageLimit)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `, 'api-usage-dialog', {
        width: '500px',
        height: 'auto'
      });
    } catch (error) {
      console.error('獲取API使用統計失敗:', error);
      window.showNotification('獲取API使用統計失敗', 'error');
    }
  }
  
  /**
   * 切換API金鑰的可見性
   * @param {HTMLElement} input - 輸入框元素
   * @param {HTMLElement} button - 按鈕元素
   */
  toggleApiKeyVisibility(input, button) {
    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = '🔒';
      button.title = '隱藏';
    } else {
      input.type = 'password';
      button.textContent = '👁️';
      button.title = '顯示';
    }
  }
}

// 導出模塊
window.SettingsModule = SettingsModule; 