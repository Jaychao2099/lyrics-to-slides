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
  const loadingScreen = document.getElementById('loading');
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
  }
  
  // 延遲顯示應用界面以確保所有初始化完成
  setTimeout(() => {
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
        const appContainer = document.getElementById('app');
        if (appContainer) {
          appContainer.style.opacity = '1';
        }
      }, 500);
    }
  }, 1000);
}

/**
 * 初始化應用模塊
 */
function initModules() {
  try {
    // 確認所有必要的模組類別已定義
    if (!window.DialogModule || !window.ProjectModule || !window.LyricsModule || 
        !window.SlideModule || !window.PreviewModule || !window.ExportModule || 
        !window.SettingsModule) {
      console.error('模塊類別尚未完全載入，請檢查腳本引用');
      showModuleLoadError();
      return;
    }
    
    // 創建模塊實例
    const dialogModule = new DialogModule();
    const projectModule = new ProjectModule();
    const lyricsModule = new LyricsModule();
    const slideModule = new SlideModule();
    const previewModule = new PreviewModule();
    const exportModule = new ExportModule();
    const settingsModule = new SettingsModule();
    
    // 初始化依賴關係
    const dependencies = {
      dialogModule,
      projectModule,
      lyricsModule,
      slideModule,
      previewModule,
      exportModule,
      settingsModule
    };
    
    // 以正確的順序初始化所有模塊
    try {
      // 檢查每個模塊是否有init方法，如果沒有則提供一個空的init方法
      Object.keys(dependencies).forEach(key => {
        const module = dependencies[key];
        if (typeof module.init !== 'function') {
          console.warn(`${key} 沒有init方法，將提供空實現`);
          module.init = function(deps) {
            console.log(`${key} 使用自動生成的空init方法`);
          };
        }
      });
      
      // 首先初始化對話框模塊，因為它被其他模塊使用
      dialogModule.init(dependencies);
      // 其次初始化項目模塊，它是其他模塊的核心依賴
      projectModule.init(dependencies);
      // 然後初始化其他模塊
      lyricsModule.init(dependencies);
      slideModule.init(dependencies);
      previewModule.init(dependencies);
      exportModule.init(dependencies);
      settingsModule.init(dependencies);
      
      // 將模塊綁定到窗口對象，方便全局訪問
      window.modules = dependencies;
      window.dialogModule = dialogModule; // 為舊代碼提供兼容性
      
      console.log('所有模塊初始化完成');
      
      // 觸發應用程式初始化完成事件
      window.dispatchEvent(new CustomEvent('app-ready'));
    } catch (error) {
      console.error('模塊初始化過程中發生錯誤:', error);
      showModuleInitError(error);
    }
  } catch (error) {
    console.error('模塊創建過程中發生錯誤:', error);
    showModuleCreateError(error);
  }
}

/**
 * 顯示模塊載入錯誤
 */
function showModuleLoadError() {
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.innerHTML = `
      <div class="error-container">
        <h2>應用程式載入失敗</h2>
        <p>無法載入必要的程式模塊。請重新整理頁面或重新啟動應用程式。</p>
        <button onclick="location.reload()">重新載入</button>
      </div>
    `;
  }
}

/**
 * 顯示模塊創建錯誤
 */
function showModuleCreateError(error) {
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.innerHTML = `
      <div class="error-container">
        <h2>應用程式初始化失敗</h2>
        <p>創建模塊時發生錯誤：${error.message}</p>
        <button onclick="location.reload()">重新載入</button>
      </div>
    `;
  }
}

/**
 * 顯示模塊初始化錯誤
 */
function showModuleInitError(error) {
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.innerHTML = `
      <div class="error-container">
        <h2>應用程式初始化失敗</h2>
        <p>初始化模塊時發生錯誤：${error.message}</p>
        <button onclick="location.reload()">重新載入</button>
      </div>
    `;
  }
}

/**
 * 初始化 IPC 事件監聽器
 */
function initIPCListeners() {
  // 檢查是否有electronAPI
  if (!window.electronAPI) {
    console.warn('electronAPI不可用，跳過IPC事件監聽器設置');
    
    // 創建模擬的electronAPI以避免錯誤
    window.electronAPI = {
      on: (channel, callback) => {
        console.log(`模擬監聽${channel}事件`);
        return () => {}; // 返回移除監聽器函數
      },
      send: (channel, ...args) => {
        console.log(`模擬發送${channel}事件:`, args);
      },
      showOpenDialog: () => Promise.resolve({ canceled: true }),
      showSaveDialog: () => Promise.resolve({ canceled: true }),
      getAppPath: () => ''
    };
    
    return;
  }

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
  window.electronAPI.on('menu-save-project-as', () => {
    window.modules.projectModule.saveProject(true);
  });
  
  // 搜尋歌詞菜單事件
  window.electronAPI.on('menu-search-lyrics', () => {
    window.modules.lyricsModule.openSearchDialog();
  });
  
  // 匯出菜單事件
  window.electronAPI.on('menu-export', (options) => {
    // 切換到匯出標籤頁
    const exportNavItem = document.querySelector('.nav-item[data-section="export"]');
    if (exportNavItem) {
      exportNavItem.click();
    } else if (window.exportMenuItem) {
      window.exportMenuItem.click();
    } else {
      console.error('找不到匯出導航項');
      // 嘗試直接顯示匯出部分
      showSection('export-section');
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
    const settingsNavItem = document.querySelector('.nav-item[data-section="settings"]');
    if (settingsNavItem) {
      settingsNavItem.click();
    } else if (window.settingsMenuItem) {
      window.settingsMenuItem.click();
    } else {
      console.error('找不到設定導航項');
      // 嘗試直接顯示設定部分
      showSection('settings-section');
    }
  });
  
  // API金鑰管理菜單事件
  window.electronAPI.on('menu-api-keys', () => {
    // 切換到設置標籤頁並捲動到API區域
    const settingsNavItem = document.querySelector('.nav-item[data-section="settings"]');
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
 * 設置導航功能
 */
function setupNavigation() {
  // 定義部分到ID的映射
  const sectionMapping = {
    'lyrics': 'lyrics-section',
    'design': 'design-section',
    'preview': 'preview-section',
    'export': 'export-section',
    'settings': 'settings-section'
  };
  
  // 初始顯示歌詞部分
  showSection('lyrics-section');
  
  // 為導航項添加點擊事件
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.getAttribute('data-section');
      console.log(`嘗試切換到頁面: ${section}`);
      
      // 獲取對應的部分ID
      const sectionId = sectionMapping[section];
      
      if (!sectionId) {
        console.error(`找不到對應的部分ID: ${section}`);
        return;
      }
      
      console.log(`映射到部分ID: ${sectionId}`);
      
      // 顯示相應部分
      showSection(sectionId);
      
      // 更新活動導航項
      navItems.forEach(navItem => {
        navItem.classList.remove('active');
      });
      
      item.classList.add('active');
    });
  });
  
  // 修正其他地方使用的選擇器
  const exportMenuItem = document.querySelector('.nav-item[data-section="export"]');
  if (exportMenuItem) {
    // 保存對匯出菜單項的引用
    window.exportMenuItem = exportMenuItem;
  }
  
  const settingsMenuItem = document.querySelector('.nav-item[data-section="settings"]');
  if (settingsMenuItem) {
    // 保存對設置菜單項的引用
    window.settingsMenuItem = settingsMenuItem;
  }
  
  // 側邊欄按鈕事件
  setupSidebarButtons();
}

/**
 * 設置側邊欄按鈕事件
 */
function setupSidebarButtons() {
  // 新建項目
  const newProjectButton = document.getElementById('new-project-btn');
  if (newProjectButton) {
    newProjectButton.addEventListener('click', () => {
      const projectModule = window.modules?.projectModule || window.projectModule;
      if (projectModule && typeof projectModule.confirmSaveBeforeNew === 'function') {
        projectModule.confirmSaveBeforeNew();
      } else {
        console.error('projectModule 不可用或缺少confirmSaveBeforeNew方法');
      }
    });
  }
  
  // 打開項目
  const openProjectButton = document.getElementById('open-project-btn');
  if (openProjectButton) {
    openProjectButton.addEventListener('click', () => {
      const projectModule = window.modules?.projectModule || window.projectModule;
      if (projectModule && typeof projectModule.confirmSaveBeforeOpen === 'function') {
        projectModule.confirmSaveBeforeOpen();
      } else {
        console.error('projectModule 不可用或缺少confirmSaveBeforeOpen方法');
      }
    });
  }
  
  // 保存項目
  const saveProjectButton = document.getElementById('save-project-btn');
  if (saveProjectButton) {
    saveProjectButton.addEventListener('click', () => {
      const projectModule = window.modules?.projectModule || window.projectModule;
      if (projectModule && typeof projectModule.saveProject === 'function') {
        projectModule.saveProject();
      } else {
        console.error('projectModule 不可用或缺少saveProject方法');
      }
    });
  }
}

/**
 * 顯示指定部分
 * @param {string} sectionId - 部分的ID
 */
function showSection(sectionId) {
  console.log(`嘗試顯示部分: ${sectionId}`);
  
  // 獲取部分元素
  const section = document.getElementById(sectionId);
  
  // 檢查部分是否存在
  if (!section) {
    console.error(`部分不存在: ${sectionId}`);
    return;
  }
  
  // 獲取所有部分
  const allSections = document.querySelectorAll('.section, .active-section');
  console.log(`找到 ${allSections.length} 個部分`);
  
  // 隱藏所有部分 (移除active-section類並添加section類)
  allSections.forEach(s => {
    console.log(`處理部分: ${s.id}`);
    s.classList.remove('active-section');
    s.classList.add('section');
  });
  
  // 顯示選定的部分 (移除section類並添加active-section類)
  section.classList.remove('section');
  section.classList.add('active-section');
  
  console.log(`頁面已切換至: ${sectionId}`);
  
  // 在部分切換時處理任何相關行為
  handleSectionChange(sectionId);
}

/**
 * 處理部分變更
 * @param {string} sectionId - 部分的ID
 */
function handleSectionChange(sectionId) {
  // 檢查項目模塊是否可用
  const projectModule = window.modules?.projectModule || window.projectModule;
  
  if (!projectModule) {
    console.warn('項目模塊不可用，無法處理部分變更');
    return;
  }
  
  // 如果切換到預覽部分，更新預覽
  if (sectionId === 'preview-section') {
    if (typeof projectModule.updatePreview === 'function') {
      projectModule.updatePreview();
    } else {
      console.warn('項目模塊缺少updatePreview方法');
    }
  }
  
  // 如果切換到設計部分，更新設計
  if (sectionId === 'design-section') {
    if (typeof projectModule.updateDesignView === 'function') {
      projectModule.updateDesignView();
    } else {
      console.warn('項目模塊缺少updateDesignView方法');
    }
  }
}

/**
 * 設置頁面處理程序
 */
function setupPageHandlers() {
  // 歌詞搜尋按鈕
  const lyricsSearchButton = document.getElementById('search-lyrics-btn');
  if (lyricsSearchButton) {
    lyricsSearchButton.addEventListener('click', () => {
      if (window.modules && window.modules.lyricsModule) {
        window.modules.lyricsModule.openSearchDialog();
      } else {
        console.error('lyricsModule 不可用');
        // 嘗試使用全局變量
        if (window.lyricsModule && typeof window.lyricsModule.openSearchDialog === 'function') {
          window.lyricsModule.openSearchDialog();
        } else {
          // 最後嘗試使用事件
          window.dispatchEvent(new CustomEvent('open-search-dialog'));
        }
      }
    });
  }
  
  // 歌詞手動輸入按鈕
  const lyricsImportButton = document.getElementById('import-lyrics-btn');
  if (lyricsImportButton) {
    lyricsImportButton.addEventListener('click', () => {
      if (window.modules && window.modules.lyricsModule) {
        window.modules.lyricsModule.openImportDialog();
      } else {
        console.error('lyricsModule 不可用');
        // 嘗試使用全局變量
        if (window.lyricsModule && typeof window.lyricsModule.openImportDialog === 'function') {
          window.lyricsModule.openImportDialog();
        } else {
          // 最後嘗試使用事件
          window.dispatchEvent(new CustomEvent('open-import-dialog'));
        }
      }
    });
  }
  
  // 歌詞操作按鈕
  const addParagraphButton = document.getElementById('add-paragraph-btn');
  if (addParagraphButton) {
    addParagraphButton.addEventListener('click', () => {
      if (window.modules && window.modules.lyricsModule) {
        window.modules.lyricsModule.addParagraph();
      } else if (window.lyricsModule && typeof window.lyricsModule.addParagraph === 'function') {
        window.lyricsModule.addParagraph();
      }
    });
  }
  
  const splitParagraphButton = document.getElementById('split-paragraph-btn');
  if (splitParagraphButton) {
    splitParagraphButton.addEventListener('click', () => {
      if (window.modules && window.modules.lyricsModule) {
        window.modules.lyricsModule.splitParagraph();
      } else if (window.lyricsModule && typeof window.lyricsModule.splitParagraph === 'function') {
        window.lyricsModule.splitParagraph();
      }
    });
  }
  
  const mergeParagraphsButton = document.getElementById('merge-paragraphs-btn');
  if (mergeParagraphsButton) {
    mergeParagraphsButton.addEventListener('click', () => {
      if (window.modules && window.modules.lyricsModule) {
        window.modules.lyricsModule.mergeParagraphs();
      } else if (window.lyricsModule && typeof window.lyricsModule.mergeParagraphs === 'function') {
        window.lyricsModule.mergeParagraphs();
      }
    });
  }
  
  const removeParagraphButton = document.getElementById('remove-paragraph-btn');
  if (removeParagraphButton) {
    removeParagraphButton.addEventListener('click', () => {
      if (window.modules && window.modules.lyricsModule) {
        window.modules.lyricsModule.removeParagraph();
      } else if (window.lyricsModule && typeof window.lyricsModule.removeParagraph === 'function') {
        window.lyricsModule.removeParagraph();
      }
    });
  }
  
  // 空狀態的歌詞搜尋按鈕
  const emptySearchButton = document.getElementById('empty-search-btn');
  if (emptySearchButton) {
    emptySearchButton.addEventListener('click', () => {
      if (window.modules && window.modules.lyricsModule) {
        window.modules.lyricsModule.openSearchDialog();
      } else if (window.lyricsModule && typeof window.lyricsModule.openSearchDialog === 'function') {
        window.lyricsModule.openSearchDialog();
      }
    });
  }
  
  // 空狀態的歌詞匯入按鈕
  const emptyImportButton = document.getElementById('empty-import-btn');
  if (emptyImportButton) {
    emptyImportButton.addEventListener('click', () => {
      if (window.modules && window.modules.lyricsModule) {
        window.modules.lyricsModule.openImportDialog();
      } else if (window.lyricsModule && typeof window.lyricsModule.openImportDialog === 'function') {
        window.lyricsModule.openImportDialog();
      }
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