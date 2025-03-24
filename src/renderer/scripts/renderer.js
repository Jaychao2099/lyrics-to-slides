/**
 * 渲染進程主腳本
 * 負責初始化應用界面和模塊
 */

// DOM 加載完成後初始化應用
document.addEventListener('DOMContentLoaded', () => {
  // 初始化應用
  initApp();
});

/**
 * 初始化應用
 */
function initApp() {
  // 設置窗口控制
  setupWindowControls();
  
  // 初始化模塊
  initModules();
  
  // 設置 IPC 通信
  initIPCListeners();
  
  // 設置導航
  setupNavigation();
  
  // 設置頁面處理程序
  setupPageHandlers();
  
  // 綁定全局通知函數
  window.showNotification = showNotification;
  
  // 顯示加載畫面
  document.getElementById('loading-screen').style.display = 'flex';
  
  // 延遲顯示應用界面以確保所有初始化完成
  setTimeout(() => {
    document.getElementById('loading-screen').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('app-container').style.opacity = '1';
    }, 500);
  }, 1000);
}

/**
 * 初始化應用模塊
 */
function initModules() {
  // 創建模塊實例
  const projectModule = new ProjectModule();
  const lyricsModule = new LyricsModule();
  const dialogModule = new DialogModule();
  const slideModule = new SlideModule();
  const previewModule = new PreviewModule();
  const exportModule = new ExportModule();
  const settingsModule = new SettingsModule();
  
  // 初始化依賴關係
  const dependencies = {
    projectModule,
    lyricsModule,
    dialogModule,
    slideModule,
    previewModule,
    exportModule,
    settingsModule
  };
  
  // 依次初始化所有模塊
  dialogModule.init(dependencies);
  projectModule.init(dependencies);
  lyricsModule.init(dependencies);
  slideModule.init(dependencies);
  previewModule.init(dependencies);
  exportModule.init(dependencies);
  settingsModule.init(dependencies);
  
  // 將模塊綁定到窗口對象，方便全局訪問
  window.modules = dependencies;
  
  console.log('所有模塊初始化完成');
}

/**
 * 初始化 IPC 事件監聽器
 */
function initIPCListeners() {
  // 註冊 IPC 事件監聽
  
  // 新項目菜單事件
  window.electronAPI.on('menu-new-project', () => {
    window.modules.projectModule.confirmSaveBeforeNew();
  });
  
  // 打開項目菜單事件
  window.electronAPI.on('menu-open-project', (path) => {
    window.modules.projectModule.confirmSaveBeforeOpen(path);
  });
  
  // 保存項目菜單事件
  window.electronAPI.on('menu-save-project', () => {
    window.modules.projectModule.saveProject();
  });
  
  // 另存為菜單事件
  window.electronAPI.on('menu-save-project-as', (path) => {
    window.modules.projectModule.saveProject(true, path);
  });
  
  // 搜尋歌詞菜單事件
  window.electronAPI.on('menu-search-lyrics', () => {
    window.modules.lyricsModule.openSearchDialog();
  });
  
  // 匯出菜單事件
  window.electronAPI.on('menu-export', (options) => {
    // 切換到匯出標籤頁
    const exportNavItem = document.querySelector('.nav-item[data-section="export-section"]');
    if (exportNavItem) {
      exportNavItem.click();
    }
    
    // 設置匯出選項
    if (options && options.format) {
      const formatRadio = document.querySelector(`input[name="export-format"][value="${options.format}"]`);
      if (formatRadio) {
        formatRadio.checked = true;
        formatRadio.dispatchEvent(new Event('change'));
      }
    }
  });
  
  // 主題變更菜單事件
  window.electronAPI.on('menu-theme-changed', (theme) => {
    window.modules.settingsModule.applyTheme(theme);
  });
  
  // 偏好設定菜單事件
  window.electronAPI.on('menu-preferences', () => {
    // 切換到設置標籤頁
    const settingsNavItem = document.querySelector('.nav-item[data-section="settings-section"]');
    if (settingsNavItem) {
      settingsNavItem.click();
    }
  });
  
  // API金鑰管理菜單事件
  window.electronAPI.on('menu-api-keys', () => {
    // 切換到設置標籤頁並捲動到API區域
    const settingsNavItem = document.querySelector('.nav-item[data-section="settings-section"]');
    if (settingsNavItem) {
      settingsNavItem.click();
      
      // 延遲捲動以確保頁面已切換
      setTimeout(() => {
        const apiSection = document.getElementById('api-settings');
        if (apiSection) {
          apiSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }
  });
  
  // 檢查更新菜單事件
  window.electronAPI.on('menu-check-updates', () => {
    window.electronAPI.checkForUpdates();
  });
  
  // 更新可用事件
  window.electronAPI.on('update-available', (info) => {
    window.modules.dialogModule.showConfirmDialog(
      `有新版本可用: ${info.version}\n要現在下載更新嗎？`,
      () => {
        window.electronAPI.downloadUpdate();
      },
      null,
      {
        title: '更新可用',
        confirmText: '下載',
        cancelText: '稍後'
      }
    );
  });
  
  // 更新下載完成事件
  window.electronAPI.on('update-downloaded', (info) => {
    window.modules.dialogModule.showConfirmDialog(
      `更新 ${info.version} 已下載完成，需要重新啟動應用程序以安裝更新。要現在重啟嗎？`,
      () => {
        window.electronAPI.installUpdate();
      },
      null,
      {
        title: '更新已就緒',
        confirmText: '立即重啟',
        cancelText: '稍後'
      }
    );
  });
}

/**
 * 設置窗口控制按鈕
 */
function setupWindowControls() {
  // 最小化按鈕
  const minimizeButton = document.getElementById('minimize-button');
  if (minimizeButton) {
    minimizeButton.addEventListener('click', () => {
      window.electronAPI.send('minimize-window');
    });
  }
  
  // 最大化/還原按鈕
  const maximizeButton = document.getElementById('maximize-button');
  if (maximizeButton) {
    maximizeButton.addEventListener('click', () => {
      window.electronAPI.send('maximize-window');
    });
  }
  
  // 關閉按鈕
  const closeButton = document.getElementById('close-button');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      window.electronAPI.send('close-window');
    });
  }
  
  // 使標題欄可拖動
  const titleBar = document.querySelector('.title-bar');
  if (titleBar) {
    titleBar.classList.add('draggable');
  }
}

/**
 * 設置側邊欄導航
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');
  
  // 初始切換到歌詞編輯部分
  showSection('lyrics-section');
  
  // 為每個導航項添加點擊事件
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.getAttribute('data-section');
      showSection(sectionId);
    });
  });
  
  // 側邊欄按鈕事件
  
  // 新建項目
  const newProjectButton = document.getElementById('new-project-button');
  if (newProjectButton) {
    newProjectButton.addEventListener('click', () => {
      window.modules.projectModule.confirmSaveBeforeNew();
    });
  }
  
  // 打開項目
  const openProjectButton = document.getElementById('open-project-button');
  if (openProjectButton) {
    openProjectButton.addEventListener('click', () => {
      window.modules.projectModule.confirmSaveBeforeOpen();
    });
  }
  
  // 保存項目
  const saveProjectButton = document.getElementById('save-project-button');
  if (saveProjectButton) {
    saveProjectButton.addEventListener('click', () => {
      window.modules.projectModule.saveProject();
    });
  }
  
  /**
   * 顯示指定的部分
   * @param {string} sectionId - 部分ID
   */
  function showSection(sectionId) {
    // 隱藏所有部分
    sections.forEach(section => {
      section.classList.remove('active-section');
    });
    
    // 顯示指定部分
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
      activeSection.classList.add('active-section');
    }
    
    // 更新導航活動狀態
    navItems.forEach(item => {
      if (item.getAttribute('data-section') === sectionId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}

/**
 * 設置頁面處理程序
 */
function setupPageHandlers() {
  // 歌詞搜尋按鈕
  const lyricsSearchButton = document.getElementById('lyrics-search-button');
  if (lyricsSearchButton) {
    lyricsSearchButton.addEventListener('click', () => {
      window.modules.lyricsModule.openSearchDialog();
    });
  }
  
  // 歌詞手動輸入按鈕
  const lyricsImportButton = document.getElementById('lyrics-import-button');
  if (lyricsImportButton) {
    lyricsImportButton.addEventListener('click', () => {
      window.modules.lyricsModule.openImportDialog();
    });
  }
  
  // 歌詞操作按鈕
  const addParagraphButton = document.getElementById('add-paragraph');
  if (addParagraphButton) {
    addParagraphButton.addEventListener('click', () => {
      window.modules.lyricsModule.addParagraph();
    });
  }
  
  const splitParagraphButton = document.getElementById('split-paragraph');
  if (splitParagraphButton) {
    splitParagraphButton.addEventListener('click', () => {
      window.modules.lyricsModule.splitParagraph();
    });
  }
  
  const mergeParagraphsButton = document.getElementById('merge-paragraphs');
  if (mergeParagraphsButton) {
    mergeParagraphsButton.addEventListener('click', () => {
      window.modules.lyricsModule.mergeParagraphs();
    });
  }
  
  const removeParagraphButton = document.getElementById('remove-paragraph');
  if (removeParagraphButton) {
    removeParagraphButton.addEventListener('click', () => {
      window.modules.lyricsModule.removeParagraph();
    });
  }
  
  // 快捷鍵處理
  document.addEventListener('keydown', (e) => {
    // 如果在輸入框中不處理快捷鍵
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    // Ctrl + S：保存項目
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      window.modules.projectModule.saveProject();
    }
    
    // Ctrl + O：打開項目
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      window.modules.projectModule.confirmSaveBeforeOpen();
    }
    
    // Ctrl + N：新建項目
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      window.modules.projectModule.confirmSaveBeforeNew();
    }
    
    // F1：顯示幫助
    if (e.key === 'F1') {
      e.preventDefault();
      window.modules.dialogModule.showDialog(`
        <h3>鍵盤快捷鍵</h3>
        <div class="shortcuts">
          <div class="shortcut-row">
            <span class="shortcut-key">Ctrl+N</span>
            <span class="shortcut-desc">新建項目</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-key">Ctrl+O</span>
            <span class="shortcut-desc">打開項目</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-key">Ctrl+S</span>
            <span class="shortcut-desc">保存項目</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-key">Ctrl+Shift+S</span>
            <span class="shortcut-desc">項目另存為</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-key">Delete</span>
            <span class="shortcut-desc">刪除所選段落</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-key">Ctrl+D</span>
            <span class="shortcut-desc">添加新段落</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-key">Ctrl+F</span>
            <span class="shortcut-desc">搜尋歌詞</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-key">Ctrl+Left/Right</span>
            <span class="shortcut-desc">預覽模式中切換投影片</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-key">F5</span>
            <span class="shortcut-desc">開始投影片放映</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-key">Esc</span>
            <span class="shortcut-desc">停止投影片放映</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-key">F1</span>
            <span class="shortcut-desc">顯示此幫助</span>
          </div>
        </div>
      `, 'shortcuts-dialog', {
        title: '鍵盤快捷鍵',
        width: '400px',
        height: 'auto'
      });
    }
  });
  
  // 捲曲條調整
  document.querySelectorAll('.scrollable').forEach(element => {
    // 確保容器大小變化時更新捲曲條
    const resizeObserver = new ResizeObserver(() => {
      updateScrollbars(element);
    });
    
    resizeObserver.observe(element);
  });
  
  /**
   * 更新捲曲條
   * @param {HTMLElement} element - 捲曲元素
   */
  function updateScrollbars(element) {
    if (element.scrollHeight > element.clientHeight) {
      element.classList.add('has-y-scrollbar');
    } else {
      element.classList.remove('has-y-scrollbar');
    }
    
    if (element.scrollWidth > element.clientWidth) {
      element.classList.add('has-x-scrollbar');
    } else {
      element.classList.remove('has-x-scrollbar');
    }
  }
}

/**
 * 顯示通知消息
 * @param {string} message - 通知消息
 * @param {string} type - 通知類型 (info, success, warning, error)
 * @param {number} duration - 顯示時間 (毫秒)
 */
function showNotification(message, type = 'info', duration = 3000) {
  // 檢查是否已存在通知容器
  let notificationContainer = document.getElementById('notification-container');
  
  if (!notificationContainer) {
    // 創建通知容器
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    document.body.appendChild(notificationContainer);
  }
  
  // 創建新通知
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-icon">
      ${getNotificationIcon(type)}
    </div>
    <div class="notification-message">${message}</div>
    <div class="notification-close">×</div>
  `;
  
  // 添加到容器
  notificationContainer.appendChild(notification);
  
  // 設置淡入動畫
  setTimeout(() => {
    notification.classList.add('visible');
  }, 10);
  
  // 設置關閉按鈕事件
  const closeButton = notification.querySelector('.notification-close');
  closeButton.addEventListener('click', () => {
    closeNotification(notification);
  });
  
  // 設置自動關閉
  if (duration > 0) {
    setTimeout(() => {
      closeNotification(notification);
    }, duration);
  }
  
  /**
   * 關閉通知
   * @param {HTMLElement} notification - 通知元素
   */
  function closeNotification(notification) {
    notification.classList.remove('visible');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }
  
  /**
   * 根據類型獲取圖標
   * @param {string} type - 通知類型
   * @returns {string} 圖標HTML
   */
  function getNotificationIcon(type) {
    switch (type) {
      case 'success':
        return '<i class="icon">check_circle</i>';
      case 'warning':
        return '<i class="icon">warning</i>';
      case 'error':
        return '<i class="icon">error</i>';
      default:
        return '<i class="icon">info</i>';
    }
  }
}

// 添加一個全局錯誤處理器
window.addEventListener('error', (event) => {
  console.error('應用錯誤:', event.error);
  showNotification('應用發生錯誤: ' + event.error.message, 'error');
}); 