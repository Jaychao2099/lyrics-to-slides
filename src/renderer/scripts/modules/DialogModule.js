/**
 * 對話框模塊
 * 負責創建和管理彈出對話框
 */
class DialogModule {
  constructor() {
    this.dialogContainer = document.getElementById('dialog-container');
    this.activeDialog = null;
    
    // 如果容器不存在，創建一個
    if (!this.dialogContainer) {
      this.dialogContainer = document.createElement('div');
      this.dialogContainer.id = 'dialog-container';
      this.dialogContainer.className = 'dialog-overlay';
      this.dialogContainer.style.display = 'none';
      document.body.appendChild(this.dialogContainer);
    }
    
    // 添加點擊背景關閉功能
    this.dialogContainer.addEventListener('click', (e) => {
      if (e.target === this.dialogContainer) {
        this.closeDialog();
      }
    });
    
    // 添加ESC鍵關閉功能
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isDialogOpen()) {
        this.closeDialog();
      }
    });
    
    console.log('對話框模塊已初始化');
  }
  
  /**
   * 顯示對話框
   * @param {string} content - 對話框HTML內容
   * @param {string} dialogId - 對話框ID
   * @param {Object} options - 對話框選項
   */
  showDialog(content, dialogId, options = {}) {
    // 如果已有對話框打開，先關閉它
    if (this.isDialogOpen()) {
      this.closeDialog();
    }
    
    // 創建對話框元素
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.id = dialogId || `dialog-${Date.now()}`;
    dialog.innerHTML = content;
    
    // 應用自定義樣式
    if (options.width) {
      dialog.style.width = options.width;
    }
    
    if (options.maxWidth) {
      dialog.style.maxWidth = options.maxWidth;
    }
    
    // 記錄活動對話框
    this.activeDialog = dialog;
    
    // 添加到容器並顯示
    this.dialogContainer.innerHTML = '';
    this.dialogContainer.appendChild(dialog);
    this.dialogContainer.style.display = 'flex';
    
    // 添加動畫類
    setTimeout(() => {
      dialog.classList.add('dialog-visible');
    }, 10);
    
    // 焦點到第一個輸入域或按鈕
    setTimeout(() => {
      const firstInput = dialog.querySelector('input, textarea, button');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
    
    return dialog;
  }
  
  /**
   * 關閉當前對話框
   */
  closeDialog() {
    if (!this.isDialogOpen()) return;
    
    // 添加關閉動畫
    if (this.activeDialog) {
      this.activeDialog.classList.remove('dialog-visible');
      this.activeDialog.classList.add('dialog-closing');
      
      // 動畫結束後隱藏容器
      setTimeout(() => {
        this.dialogContainer.style.display = 'none';
        this.dialogContainer.innerHTML = '';
        this.activeDialog = null;
      }, 300);
    } else {
      // 如果沒有活動對話框，直接隱藏容器
      this.dialogContainer.style.display = 'none';
      this.dialogContainer.innerHTML = '';
    }
  }
  
  /**
   * 檢查是否有對話框打開
   * @returns {boolean} 是否有對話框打開
   */
  isDialogOpen() {
    return this.dialogContainer.style.display !== 'none' && this.activeDialog !== null;
  }
  
  /**
   * 獲取當前活動對話框
   * @returns {HTMLElement} 當前對話框元素
   */
  getActiveDialog() {
    return this.activeDialog;
  }
  
  /**
   * 顯示確認對話框
   * @param {string} message - 確認消息
   * @param {Function} onConfirm - 確認回調
   * @param {Function} onCancel - 取消回調
   * @param {Object} options - 對話框選項
   */
  showConfirmDialog(message, onConfirm, onCancel, options = {}) {
    const title = options.title || '確認';
    const confirmText = options.confirmText || '確認';
    const cancelText = options.cancelText || '取消';
    
    const dialogContent = `
      <div class="dialog-header">
        <h3>${title}</h3>
        <button class="dialog-close" id="close-confirm">✕</button>
      </div>
      <div class="dialog-body">
        <p>${message}</p>
      </div>
      <div class="dialog-footer">
        <button id="cancel-btn" class="action-button">${cancelText}</button>
        <button id="confirm-btn" class="action-button primary">${confirmText}</button>
      </div>
    `;
    
    const dialog = this.showDialog(dialogContent, 'confirm-dialog', options);
    
    // 設置按鈕事件
    const closeBtn = dialog.querySelector('#close-confirm');
    const cancelBtn = dialog.querySelector('#cancel-btn');
    const confirmBtn = dialog.querySelector('#confirm-btn');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeDialog();
        if (onCancel) onCancel();
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.closeDialog();
        if (onCancel) onCancel();
      });
    }
    
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.closeDialog();
        if (onConfirm) onConfirm();
      });
    }
  }
  
  /**
   * 顯示提示對話框
   * @param {string} message - 提示消息
   * @param {Function} onClose - 關閉回調
   * @param {Object} options - 對話框選項
   */
  showAlertDialog(message, onClose, options = {}) {
    const title = options.title || '提示';
    const closeText = options.closeText || '確定';
    
    const dialogContent = `
      <div class="dialog-header">
        <h3>${title}</h3>
        <button class="dialog-close" id="close-alert">✕</button>
      </div>
      <div class="dialog-body">
        <p>${message}</p>
      </div>
      <div class="dialog-footer">
        <button id="alert-close-btn" class="action-button primary">${closeText}</button>
      </div>
    `;
    
    const dialog = this.showDialog(dialogContent, 'alert-dialog', options);
    
    // 設置按鈕事件
    const closeBtn = dialog.querySelector('#close-alert');
    const alertCloseBtn = dialog.querySelector('#alert-close-btn');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeDialog();
        if (onClose) onClose();
      });
    }
    
    if (alertCloseBtn) {
      alertCloseBtn.addEventListener('click', () => {
        this.closeDialog();
        if (onClose) onClose();
      });
    }
  }
  
  /**
   * 顯示輸入對話框
   * @param {string} message - 提示消息
   * @param {Function} onInput - 輸入回調
   * @param {string} defaultValue - 默認值
   * @param {Object} options - 對話框選項
   */
  showPromptDialog(message, onInput, defaultValue = '', options = {}) {
    const title = options.title || '輸入';
    const confirmText = options.confirmText || '確認';
    const cancelText = options.cancelText || '取消';
    const placeholder = options.placeholder || '';
    
    const dialogContent = `
      <div class="dialog-header">
        <h3>${title}</h3>
        <button class="dialog-close" id="close-prompt">✕</button>
      </div>
      <div class="dialog-body">
        <p>${message}</p>
        <input type="text" id="prompt-input" placeholder="${placeholder}" value="${defaultValue}">
      </div>
      <div class="dialog-footer">
        <button id="prompt-cancel-btn" class="action-button">${cancelText}</button>
        <button id="prompt-confirm-btn" class="action-button primary">${confirmText}</button>
      </div>
    `;
    
    const dialog = this.showDialog(dialogContent, 'prompt-dialog', options);
    
    // 設置按鈕事件
    const closeBtn = dialog.querySelector('#close-prompt');
    const cancelBtn = dialog.querySelector('#prompt-cancel-btn');
    const confirmBtn = dialog.querySelector('#prompt-confirm-btn');
    const input = dialog.querySelector('#prompt-input');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeDialog();
        if (onInput) onInput(null);
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.closeDialog();
        if (onInput) onInput(null);
      });
    }
    
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const value = input ? input.value.trim() : '';
        this.closeDialog();
        if (onInput) onInput(value);
      });
    }
    
    if (input) {
      // 焦點到輸入框
      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);
      
      // 按Enter鍵確認
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const value = input.value.trim();
          this.closeDialog();
          if (onInput) onInput(value);
        }
      });
    }
  }
  
  /**
   * 顯示自定義表單對話框
   * @param {string} title - 表單標題
   * @param {Array} fields - 表單字段數組
   * @param {Function} onSubmit - 提交回調
   * @param {Function} onCancel - 取消回調
   * @param {Object} options - 對話框選項
   */
  showFormDialog(title, fields, onSubmit, onCancel, options = {}) {
    const confirmText = options.confirmText || '提交';
    const cancelText = options.cancelText || '取消';
    
    // 構建表單字段HTML
    let fieldsHtml = '';
    
    fields.forEach(field => {
      const id = field.id || `field-${Math.random().toString(36).substring(2, 9)}`;
      const label = field.label || '';
      const type = field.type || 'text';
      const placeholder = field.placeholder || '';
      const value = field.value || '';
      const required = field.required ? 'required' : '';
      const options = field.options || [];
      
      fieldsHtml += `<div class="form-group">`;
      
      if (label) {
        fieldsHtml += `<label for="${id}">${label}</label>`;
      }
      
      if (type === 'select') {
        fieldsHtml += `<select id="${id}" name="${id}" ${required}>`;
        options.forEach(option => {
          const selected = option.value === value ? 'selected' : '';
          fieldsHtml += `<option value="${option.value}" ${selected}>${option.label}</option>`;
        });
        fieldsHtml += `</select>`;
      } else if (type === 'textarea') {
        fieldsHtml += `<textarea id="${id}" name="${id}" placeholder="${placeholder}" ${required}>${value}</textarea>`;
      } else if (type === 'checkbox') {
        fieldsHtml += `
          <div class="checkbox-field">
            <input type="checkbox" id="${id}" name="${id}" ${value ? 'checked' : ''}>
            <span>${placeholder}</span>
          </div>
        `;
      } else if (type === 'radio') {
        fieldsHtml += `<div class="radio-group">`;
        options.forEach(option => {
          const checked = option.value === value ? 'checked' : '';
          fieldsHtml += `
            <label class="radio-label">
              <input type="radio" name="${id}" value="${option.value}" ${checked}>
              <span>${option.label}</span>
            </label>
          `;
        });
        fieldsHtml += `</div>`;
      } else {
        fieldsHtml += `<input type="${type}" id="${id}" name="${id}" placeholder="${placeholder}" value="${value}" ${required}>`;
      }
      
      if (field.help) {
        fieldsHtml += `<div class="field-help">${field.help}</div>`;
      }
      
      fieldsHtml += `</div>`;
    });
    
    const dialogContent = `
      <div class="dialog-header">
        <h3>${title}</h3>
        <button class="dialog-close" id="close-form">✕</button>
      </div>
      <div class="dialog-body">
        <form id="custom-form">
          ${fieldsHtml}
        </form>
      </div>
      <div class="dialog-footer">
        <button id="form-cancel-btn" class="action-button">${cancelText}</button>
        <button id="form-submit-btn" class="action-button primary">${confirmText}</button>
      </div>
    `;
    
    const dialog = this.showDialog(dialogContent, 'form-dialog', options);
    
    // 設置按鈕事件
    const closeBtn = dialog.querySelector('#close-form');
    const cancelBtn = dialog.querySelector('#form-cancel-btn');
    const submitBtn = dialog.querySelector('#form-submit-btn');
    const form = dialog.querySelector('#custom-form');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeDialog();
        if (onCancel) onCancel();
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.closeDialog();
        if (onCancel) onCancel();
      });
    }
    
    if (submitBtn && form) {
      submitBtn.addEventListener('click', () => {
        // 收集表單數據
        const formData = {};
        
        fields.forEach(field => {
          const id = field.id || '';
          const type = field.type || 'text';
          
          if (type === 'checkbox') {
            const checkbox = form.querySelector(`#${id}`);
            formData[id] = checkbox ? checkbox.checked : false;
          } else if (type === 'radio') {
            const radio = form.querySelector(`input[name="${id}"]:checked`);
            formData[id] = radio ? radio.value : '';
          } else {
            const input = form.querySelector(`#${id}, [name="${id}"]`);
            formData[id] = input ? input.value : '';
          }
        });
        
        this.closeDialog();
        if (onSubmit) onSubmit(formData);
      });
    }
  }
}

// 全局導出
window.DialogModule = DialogModule; 