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
        openai: {
          key: '',
          model: 'dall-e-3',
          usageLimit: 0
        },
        stability: {
          key: '',
          usageLimit: 0
        },
        musixmatch: {
          key: '',
          usageLimit: 0
        }
      },
      // 圖片生成設置
      imageGeneration: {
        preferredProvider: 'openai',
        defaultSize: '1024x1024',
        defaultQuality: 'standard',
        defaultStyle: 'vivid',
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
      apiKeyInputs: {
        openai: document.getElementById('openai-api-key'),
        stability: document.getElementById('stability-api-key'),
        musixmatch: document.getElementById('musixmatch-api-key')
      },
      saveSettingsButton: document.getElementById('save-settings-btn'),
      resetSettingsButton: document.getElementById('reset-settings-btn')
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
    
    // API金鑰輸入框
    Object.keys(this.elements.apiKeyInputs).forEach(provider => {
      const input = this.elements.apiKeyInputs[provider];
      if (input) {
        input.addEventListener('change', (e) => {
          this.settings.api[provider].key = e.target.value;
        });
      }
    });
    
    // 保存設置按鈕
    if (this.elements.saveSettingsButton) {
      this.elements.saveSettingsButton.addEventListener('click', () => {
        this.saveSettings();
      });
    }
    
    // 重置設置按鈕
    if (this.elements.resetSettingsButton) {
      this.elements.resetSettingsButton.addEventListener('click', () => {
        this.confirmResetSettings();
      });
    }
    
    // 驗證API金鑰按鈕
    const validateButtons = document.querySelectorAll('.validate-api-key');
    validateButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const provider = e.target.getAttribute('data-provider');
        if (provider) {
          this.validateApiKey(provider);
        }
      });
    });
    
    // 修改API使用限額
    const usageLimitInputs = document.querySelectorAll('.api-usage-limit');
    usageLimitInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const provider = e.target.getAttribute('data-provider');
        const value = parseFloat(e.target.value);
        if (provider && !isNaN(value) && value >= 0) {
          this.settings.api[provider].usageLimit = value;
        }
      });
    });
    
    // 解析度選擇器
    const resolutionSelect = document.getElementById('resolution-select');
    if (resolutionSelect) {
      resolutionSelect.addEventListener('change', (e) => {
        this.settings.resolution.type = e.target.value;
        
        // 顯示/隱藏自訂解析度選項
        const customResolutionDiv = document.querySelector('.custom-resolution');
        if (customResolutionDiv) {
          customResolutionDiv.style.display = e.target.value === 'custom' ? 'block' : 'none';
        }
      });
    }
    
    // 自訂解析度寬度
    const customWidth = document.getElementById('custom-width');
    if (customWidth) {
      customWidth.addEventListener('change', (e) => {
        const value = parseInt(e.target.value);
        if (!isNaN(value) && value >= 640 && value <= 3840) {
          this.settings.resolution.width = value;
        } else {
          e.target.value = this.settings.resolution.width;
        }
      });
    }
    
    // 自訂解析度高度
    const customHeight = document.getElementById('custom-height');
    if (customHeight) {
      customHeight.addEventListener('change', (e) => {
        const value = parseInt(e.target.value);
        if (!isNaN(value) && value >= 480 && value <= 2160) {
          this.settings.resolution.height = value;
        } else {
          e.target.value = this.settings.resolution.height;
        }
      });
    }
  }
  
  /**
   * 載入保存的設置
   */
  async loadSettings() {
    try {
      // 從存儲中獲取設置
      const savedSettings = await window.electronAPI.getStoreValue('settings');
      
      if (savedSettings) {
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
    
    // API金鑰
    Object.keys(this.elements.apiKeyInputs).forEach(provider => {
      const input = this.elements.apiKeyInputs[provider];
      if (input && this.settings.api[provider]) {
        input.value = this.settings.api[provider].key;
        
        // 替換顯示，顯示部分掩碼的API金鑰
        if (this.settings.api[provider].key) {
          const maskedKey = this.maskApiKey(this.settings.api[provider].key);
          const displayElement = document.getElementById(`${provider}-key-display`);
          if (displayElement) {
            displayElement.textContent = maskedKey;
          }
        }
      }
    });
    
    // API使用限額
    Object.keys(this.settings.api).forEach(provider => {
      const input = document.getElementById(`${provider}-usage-limit`);
      if (input && this.settings.api[provider]) {
        input.value = this.settings.api[provider].usageLimit;
      }
    });
    
    // 解析度設置
    if (this.settings.resolution) {
      const resolutionSelect = document.getElementById('resolution-select');
      const customWidth = document.getElementById('custom-width');
      const customHeight = document.getElementById('custom-height');
      const customResolutionDiv = document.querySelector('.custom-resolution');
      
      if (resolutionSelect) {
        resolutionSelect.value = this.settings.resolution.type || '16:9';
      }
      
      if (customWidth && customHeight) {
        customWidth.value = this.settings.resolution.width || 1920;
        customHeight.value = this.settings.resolution.height || 1080;
      }
      
      if (customResolutionDiv) {
        customResolutionDiv.style.display = 
          (this.settings.resolution.type === 'custom') ? 'block' : 'none';
      }
    }
  }
  
  /**
   * 保存設置
   */
  async saveSettings() {
    try {
      // 保存到存儲
      await window.electronAPI.setStoreValue('settings', this.settings);
      
      // 保存默認輸出路徑作為單獨設置（便於其他模塊直接使用）
      await window.electronAPI.setStoreValue('outputPath', this.settings.output.defaultPath);
      
      // 顯示成功消息
      window.showNotification('設置已保存', 'success');
    } catch (error) {
      console.error('保存設置失敗:', error);
      window.showNotification('保存設置失敗', 'error');
    }
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
        preferredProvider: 'openai',
        defaultSize: '1024x1024',
        defaultQuality: 'standard',
        defaultStyle: 'vivid',
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
   * @param {string} provider - API提供者
   */
  async validateApiKey(provider) {
    const key = this.settings.api[provider]?.key;
    
    if (!key) {
      window.showNotification(`請先輸入${provider}的API金鑰`, 'warning');
      return;
    }
    
    // 顯示驗證中狀態
    const statusElement = document.getElementById(`${provider}-key-status`);
    if (statusElement) {
      statusElement.textContent = '驗證中...';
      statusElement.className = 'api-key-status validating';
    }
    
    try {
      // 發送API金鑰驗證請求
      const result = await window.electronAPI.validateApiKey({
        provider,
        key
      });
      
      if (result.valid) {
        // 顯示成功狀態
        if (statusElement) {
          statusElement.textContent = '有效';
          statusElement.className = 'api-key-status valid';
        }
        window.showNotification(`${provider}的API金鑰驗證成功`, 'success');
      } else {
        // 顯示失敗狀態
        if (statusElement) {
          statusElement.textContent = '無效';
          statusElement.className = 'api-key-status invalid';
        }
        window.showNotification(`${provider}的API金鑰無效: ${result.error || '未知錯誤'}`, 'error');
      }
    } catch (error) {
      console.error(`驗證${provider}的API金鑰失敗:`, error);
      
      // 顯示錯誤狀態
      if (statusElement) {
        statusElement.textContent = '驗證失敗';
        statusElement.className = 'api-key-status error';
      }
      
      window.showNotification(`驗證${provider}的API金鑰失敗: ${error.message || '網絡錯誤'}`, 'error');
    }
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
}

// 導出模塊
window.SettingsModule = SettingsModule; 