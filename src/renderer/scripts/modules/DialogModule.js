/**
 * 對話框模塊
 * 負責處理應用程式的各種對話框
 */
class DialogModule {
  constructor() {
    this.activeDialog = null;
    this.dialogOverlay = null;
    
    // 創建對話框覆蓋層
    this.createDialogOverlay();
    
    console.log('對話框模塊已初始化');
  }
  
  /**
   * 初始化模塊
   * @param {Object} dependencies - 依賴模塊
   */
  init(dependencies) {
    console.log('對話框模塊已初始化依賴');
  }
  
  /**
   * 創建對話框覆蓋層
   */
  createDialogOverlay() {
    // 移除現有覆蓋層（如果有）
    const existingOverlay = document.getElementById('dialog-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    // 創建新覆蓋層
    this.dialogOverlay = document.createElement('div');
    this.dialogOverlay.id = 'dialog-overlay';
    this.dialogOverlay.className = 'dialog-overlay';
    
    // 默認隱藏
    this.dialogOverlay.style.display = 'none';
    
    // 添加到文檔
    document.body.appendChild(this.dialogOverlay);
  }
  
  /**
   * 顯示通用對話框
   * @param {string} content - 對話框內容
   * @param {string} dialogId - 對話框ID
   * @param {Object} options - 選項
   */
  showDialog(content, dialogId = 'dialog', options = {}) {
    // 如果已經有活動對話框，先關閉它
    if (this.activeDialog) {
      this.closeDialog();
    }
    
    // 確保對話框覆蓋層存在
    if (!this.dialogOverlay) {
      this.createDialogOverlay();
    }
    
    // 創建對話框元素
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.id = dialogId;
    dialog.innerHTML = content;
    
    // 應用自定義樣式
    if (options.width) {
      dialog.style.width = options.width;
    }
    
    if (options.height) {
      dialog.style.height = options.height;
    }
    
    // 添加對話框到覆蓋層
    this.dialogOverlay.innerHTML = '';
    this.dialogOverlay.appendChild(dialog);
    
    // 顯示覆蓋層
    this.dialogOverlay.style.display = 'flex';
    
    // 保存活動對話框引用
    this.activeDialog = dialog;
    
    // 為關閉按鈕添加事件監聽器
    const closeButtons = dialog.querySelectorAll('.dialog-close');
    closeButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.closeDialog();
      });
    });
    
    // 返回對話框引用
    return dialog;
  }
  
  /**
   * 關閉當前對話框
   */
  closeDialog() {
    if (this.dialogOverlay) {
      this.dialogOverlay.style.display = 'none';
      this.dialogOverlay.innerHTML = '';
    }
    
    this.activeDialog = null;
  }
  
  /**
   * 顯示確認對話框
   * @param {string} message - 確認信息
   * @param {Function} onConfirm - 確認時的回調
   * @param {Function} onCancel - 取消時的回調
   * @param {Object} options - 對話框選項
   */
  showConfirmDialog(message, onConfirm, onCancel, options = {}) {
    const title = options.title || '確認';
    const confirmText = options.confirmText || '確認';
    const cancelText = options.cancelText || '取消';
    const type = options.type || 'confirm'; // confirm, info, warning, error
    
    // 根據類型選擇圖標
    let icon = '';
    switch (type) {
      case 'info':
        icon = '<div class="dialog-icon info">i</div>';
        break;
      case 'warning':
        icon = '<div class="dialog-icon warning">⚠</div>';
        break;
      case 'error':
        icon = '<div class="dialog-icon error">⛔</div>';
        break;
      default:
        icon = '<div class="dialog-icon confirm">?</div>';
    }
    
    const content = `
      <div class="dialog-header">
        <h3>${title}</h3>
        <button class="dialog-close" id="close-confirm-dialog">✕</button>
      </div>
      <div class="dialog-body">
        <div class="confirm-content">
          ${icon}
          <div class="confirm-message">${message}</div>
        </div>
      </div>
      <div class="dialog-footer">
        <button id="cancel-btn" class="action-button">${cancelText}</button>
        <button id="confirm-btn" class="action-button primary">${confirmText}</button>
      </div>
    `;
    
    // 顯示對話框
    const dialog = this.showDialog(content, 'confirm-dialog', {
      width: options.width || '400px'
    });
    
    // 綁定按鈕事件
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.closeDialog();
        if (typeof onConfirm === 'function') {
          onConfirm();
        }
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.closeDialog();
        if (typeof onCancel === 'function') {
          onCancel();
        }
      });
    }
    
    return dialog;
  }
  
  /**
   * 顯示警告對話框
   * @param {string} message - 警告信息
   * @param {string} title - 標題
   * @param {string} type - 類型：info, warning, error
   */
  showAlertDialog(message, title = '提示', type = 'info') {
    // 根據類型選擇圖標
    let icon = '';
    switch (type) {
      case 'info':
        icon = '<div class="dialog-icon info">i</div>';
        break;
      case 'warning':
        icon = '<div class="dialog-icon warning">⚠</div>';
        break;
      case 'error':
        icon = '<div class="dialog-icon error">⛔</div>';
        break;
      default:
        icon = '<div class="dialog-icon info">i</div>';
    }
    
    const content = `
      <div class="dialog-header">
        <h3>${title}</h3>
        <button class="dialog-close" id="close-alert-dialog">✕</button>
      </div>
      <div class="dialog-body">
        <div class="alert-content">
          ${icon}
          <div class="alert-message">${message}</div>
        </div>
      </div>
      <div class="dialog-footer">
        <button id="alert-ok-btn" class="action-button primary">確定</button>
      </div>
    `;
    
    // 顯示對話框
    const dialog = this.showDialog(content, 'alert-dialog', {
      width: '400px'
    });
    
    // 綁定按鈕事件
    const okBtn = document.getElementById('alert-ok-btn');
    if (okBtn) {
      okBtn.addEventListener('click', () => {
        this.closeDialog();
      });
      
      // 聚焦確定按鈕
      setTimeout(() => okBtn.focus(), 100);
    }
    
    return dialog;
  }
  
  /**
   * 顯示輸入對話框
   * @param {string} message - 提示信息
   * @param {string} defaultValue - 默認值
   * @param {Function} onSubmit - 提交時的回調
   * @param {Object} options - 對話框選項
   */
  showInputDialog(message, defaultValue = '', onSubmit, options = {}) {
    const title = options.title || '輸入';
    const submitText = options.submitText || '確認';
    const cancelText = options.cancelText || '取消';
    const placeholder = options.placeholder || '';
    const type = options.type || 'text'; // text, number, password
    const required = options.required !== false;
    
    const content = `
      <div class="dialog-header">
        <h3>${title}</h3>
        <button class="dialog-close" id="close-input-dialog">✕</button>
      </div>
      <div class="dialog-body">
        <div class="input-content">
          <div class="input-message">${message}</div>
          <input 
            type="${type}" 
            id="input-value" 
            class="dialog-input" 
            value="${defaultValue}"
            placeholder="${placeholder}"
            ${required ? 'required' : ''}
          >
        </div>
      </div>
      <div class="dialog-footer">
        <button id="cancel-input-btn" class="action-button">${cancelText}</button>
        <button id="submit-input-btn" class="action-button primary">${submitText}</button>
      </div>
    `;
    
    // 顯示對話框
    const dialog = this.showDialog(content, 'input-dialog', {
      width: options.width || '400px'
    });
    
    // 獲取輸入元素
    const inputElement = document.getElementById('input-value');
    
    // 綁定按鈕事件
    const submitBtn = document.getElementById('submit-input-btn');
    const cancelBtn = document.getElementById('cancel-input-btn');
    
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        if (required && (!inputElement || !inputElement.value.trim())) {
          // 如果必填但沒有值，則顯示錯誤
          if (inputElement) {
            inputElement.classList.add('error');
            inputElement.focus();
          }
          return;
        }
        
        const value = inputElement ? inputElement.value : '';
        this.closeDialog();
        if (typeof onSubmit === 'function') {
          onSubmit(value);
        }
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.closeDialog();
      });
    }
    
    // 支持按Enter提交
    if (inputElement) {
      inputElement.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          if (submitBtn) submitBtn.click();
        }
        
        // 移除錯誤標記
        inputElement.classList.remove('error');
      });
      
      // 聚焦輸入框
      setTimeout(() => inputElement.focus(), 100);
    }
    
    return dialog;
  }
  
  /**
   * 顯示加載對話框
   * @param {string} message - 加載信息
   * @param {boolean} canCancel - 是否可以取消
   * @param {Function} onCancel - 取消時的回調
   * @returns {Object} 對話框和更新函數
   */
  showLoadingDialog(message, canCancel = false, onCancel = null) {
    let content = `
      <div class="dialog-header">
        <h3>請稍候</h3>
        ${canCancel ? '<button class="dialog-close" id="close-loading-dialog">✕</button>' : ''}
      </div>
      <div class="dialog-body">
        <div class="loading-content">
          <div class="spinner"></div>
          <div id="loading-message" class="loading-message">${message}</div>
        </div>
      </div>
    `;
    
    if (canCancel) {
      content += `
        <div class="dialog-footer">
          <button id="cancel-loading-btn" class="action-button">取消</button>
        </div>
      `;
    }
    
    // 顯示對話框
    const dialog = this.showDialog(content, 'loading-dialog', {
      width: '400px'
    });
    
    // 綁定取消按鈕事件
    if (canCancel) {
      const cancelBtn = document.getElementById('cancel-loading-btn');
      const closeBtn = document.getElementById('close-loading-dialog');
      
      const cancelHandler = () => {
        this.closeDialog();
        if (typeof onCancel === 'function') {
          onCancel();
        }
      };
      
      if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelHandler);
      }
      
      if (closeBtn) {
        closeBtn.addEventListener('click', cancelHandler);
      }
    }
    
    // 返回對話框和更新消息的函數
    return {
      dialog,
      updateMessage: (newMessage) => {
        const messageElement = document.getElementById('loading-message');
        if (messageElement) {
          messageElement.textContent = newMessage;
        }
      }
    };
  }
  
  /**
   * 顯示進度對話框
   * @param {string} message - 進度信息
   * @param {boolean} canCancel - 是否可以取消
   * @param {Function} onCancel - 取消時的回調
   * @returns {Object} 對話框和更新函數
   */
  showProgressDialog(message, canCancel = false, onCancel = null) {
    let content = `
      <div class="dialog-header">
        <h3>進度</h3>
        ${canCancel ? '<button class="dialog-close" id="close-progress-dialog">✕</button>' : ''}
      </div>
      <div class="dialog-body">
        <div class="progress-content">
          <div id="progress-message" class="progress-message">${message}</div>
          <div class="progress-container">
            <div id="progress-bar" class="progress-bar" style="width: 0%"></div>
          </div>
          <div id="progress-percentage" class="progress-percentage">0%</div>
        </div>
      </div>
    `;
    
    if (canCancel) {
      content += `
        <div class="dialog-footer">
          <button id="cancel-progress-btn" class="action-button">取消</button>
        </div>
      `;
    }
    
    // 顯示對話框
    const dialog = this.showDialog(content, 'progress-dialog', {
      width: '400px'
    });
    
    // 綁定取消按鈕事件
    if (canCancel) {
      const cancelBtn = document.getElementById('cancel-progress-btn');
      const closeBtn = document.getElementById('close-progress-dialog');
      
      const cancelHandler = () => {
        this.closeDialog();
        if (typeof onCancel === 'function') {
          onCancel();
        }
      };
      
      if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelHandler);
      }
      
      if (closeBtn) {
        closeBtn.addEventListener('click', cancelHandler);
      }
    }
    
    // 返回對話框和更新進度的函數
    return {
      dialog,
      updateProgress: (percent, newMessage = null) => {
        const progressBar = document.getElementById('progress-bar');
        const percentageElement = document.getElementById('progress-percentage');
        const messageElement = document.getElementById('progress-message');
        
        if (progressBar) {
          progressBar.style.width = `${percent}%`;
        }
        
        if (percentageElement) {
          percentageElement.textContent = `${Math.round(percent)}%`;
        }
        
        if (newMessage && messageElement) {
          messageElement.textContent = newMessage;
        }
      }
    };
  }
}

// 全局導出
window.DialogModule = DialogModule; 