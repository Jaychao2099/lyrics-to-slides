const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');

// 配置日誌
log.transports.file.level = 'info';
log.info('應用程序啟動');

// 初始化設置存儲
const store = new Store({
  name: 'config',
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    theme: 'light',
    outputPath: app.getPath('downloads'),
    autoUpdate: true,
    lastProject: null,
    locale: 'zh-TW',
    hasCompletedSetup: false
  }
});

// 主視窗
let mainWindow;
// 基於儲存狀態決定是否為首次運行
let isFirstRun = !store.get('hasCompletedSetup');

log.info('初始設置完成狀態:', store.get('hasCompletedSetup'));
log.info('是否為首次運行:', isFirstRun);

function createWindow() {
  const { width, height } = store.get('windowBounds');
  
  // 創建主視窗
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 900,
    minHeight: 600,
    show: false, // 先不顯示，等加載完成後再顯示
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true  // 確保開發者工具可用
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png')
  });

  // 加載主頁面
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 開發模式下自動打開開發者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    log.info('在開發模式下開啟開發者工具');
  }

  // 當視窗準備好時顯示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // 如果是首次運行，顯示歡迎嚮導
    if (isFirstRun) {
      showOnboarding();
    }
  });

  // 存儲視窗大小
  mainWindow.on('resize', () => {
    const { width, height } = mainWindow.getBounds();
    store.set('windowBounds', { width, height });
  });

  // 視窗關閉
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 顯示歡迎嚮導
function showOnboarding() {
  log.info('開始顯示引導嚮導');
  
  // 釋放前一個引導視窗如果存在
  if (global.onboardingWindow) {
    log.info('關閉先前的引導視窗');
    try {
      global.onboardingWindow.close();
    } catch (err) {
      log.error('關閉先前引導視窗時出錯:', err);
    }
    global.onboardingWindow = null;
  }
  
  // 創建新的引導視窗
  let onboardingWindow = new BrowserWindow({
    width: 800,
    height: 600,
    parent: mainWindow,
    modal: true,
    show: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'), // 確保這個路徑指向正確的預加載腳本
      devTools: true,  // 確保開發者工具可用
    }
  });
  
  // 保存引導視窗的全局引用，防止被垃圾回收
  global.onboardingWindow = onboardingWindow;
  
  log.info('使用預加載腳本路徑:', path.join(__dirname, 'preload.js'));
  
  // 在頁面加載前檢查預加載腳本是否存在
  const preloadPath = path.join(__dirname, 'preload.js');
  try {
    if (fs.existsSync(preloadPath)) {
      log.info('預加載腳本文件存在:', preloadPath);
    } else {
      log.error('預加載腳本文件不存在:', preloadPath);
    }
  } catch (err) {
    log.error('檢查預加載腳本時出錯:', err);
  }
  
  onboardingWindow.loadFile(path.join(__dirname, '../renderer/onboarding.html'));
  
  // 為了調試，默認開啟開發者工具
  if (process.argv.includes('--dev')) {
    onboardingWindow.webContents.openDevTools({ mode: 'detach' });
    log.info('在開發模式下開啟開發者工具');
  }
  
  onboardingWindow.once('ready-to-show', () => {
    onboardingWindow.show();
    log.info('顯示引導視窗');
  });
  
  // 在頁面載入完成後，驗證預加載腳本是否正確注入
  onboardingWindow.webContents.on('did-finish-load', () => {
    log.info('引導頁面加載完成');
    // 執行腳本來檢查預加載的API是否可用
    onboardingWindow.webContents.executeJavaScript(`
      console.log('檢查electronAPI是否可用:', typeof window.electronAPI);
      if (window.electronAPI) {
        console.log('可用的API方法:', Object.keys(window.electronAPI).join(', '));
      } else {
        console.warn('預加載腳本未正確載入，嘗試直接注入備用功能');
      }
      typeof window.electronAPI;
    `).then((result) => {
      log.info('預加載腳本檢查結果:', result);
      
      // 如果API不存在，嘗試直接注入一些基本功能
      if (result !== 'object') {
        log.info('API不可用，嘗試直接注入備用功能');
        onboardingWindow.webContents.executeJavaScript(`
          // 創建一個簡單的備用API
          window.electronAPI = {
            onboardingComplete: function(data) {
              console.log('使用注入的備用方法發送完成事件', data);
              // 將數據保存到localStorage
              localStorage.setItem('userSettings', JSON.stringify(data));
              // 關閉視窗
              setTimeout(() => window.close(), 1000);
              return true;
            },
            getAppPath: function(name) {
              return Promise.resolve('${app.getPath('downloads')}');
            }
          };
          console.log('已注入備用API');
        `).catch(err => {
          log.error('注入備用API失敗:', err);
        });
      }
    }).catch(err => {
      log.error('執行預加載腳本檢查時出錯:', err);
    });
  });

  // 監聽引導完成事件
  ipcMain.once('onboarding-complete', (event, data) => {
    log.info('收到引導完成事件', data);
    
    // 保存用戶設置
    try {
      if (data) {
        log.info('儲存使用者設定：', data);
        if (data.outputPath) {
          store.set('outputPath', data.outputPath);
          log.info('已設定輸出路徑：', data.outputPath);
        }
        if (data.locale) {
          store.set('locale', data.locale);
          log.info('已設定語言：', data.locale);
        }
        if (data.autoUpdate !== undefined) {
          store.set('autoUpdate', data.autoUpdate);
          log.info('已設定自動更新：', data.autoUpdate);
        }
        log.info('用戶設置已保存');
        
        // 輸出存儲的值，以便確認是否正確儲存
        log.info('儲存後的輸出路徑:', store.get('outputPath'));
        log.info('儲存後的語言:', store.get('locale'));
        log.info('儲存後的自動更新設置:', store.get('autoUpdate'));
      }
      
      // 標記設置已完成
      store.set('hasCompletedSetup', true);
      log.info('已標記設置完成狀態為 true');
      isFirstRun = false;
      
      // 關閉引導視窗
      if (onboardingWindow && !onboardingWindow.isDestroyed()) {
        onboardingWindow.close();
        onboardingWindow = null;
        global.onboardingWindow = null;
        log.info('引導視窗已關閉');
      }
      
      // 重新加載主視窗以應用新設置
      if (mainWindow && !mainWindow.isDestroyed()) {
        // 在傳遞設置之前確保主窗口處於活動狀態
        mainWindow.show();
        mainWindow.focus();
        
        // 傳遞設置給主視窗
        log.info('正在向主窗口發送設置完成事件');
        mainWindow.webContents.send('setup-completed', {
          outputPath: store.get('outputPath'),
          locale: store.get('locale'),
          autoUpdate: store.get('autoUpdate')
        });
        log.info('已向主窗口發送設置完成事件');
        
        // 如果主窗口載入到一半，嘗試重新加載
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            log.info('嘗試重新加載主窗口');
            mainWindow.reload();
          }
        }, 1000);
      } else {
        log.warn('主窗口不存在或已銷毀，無法發送設置完成事件');
      }
    } catch (error) {
      log.error('處理引導完成事件時出錯', error);
    }
  });
  
  // 監聽關閉事件
  onboardingWindow.on('closed', () => {
    log.info('引導視窗被關閉');
    global.onboardingWindow = null;
    
    // 如果用戶關閉窗口但未完成設置，強制設置為已完成以避免循環
    if (!store.get('hasCompletedSetup')) {
      log.info('用戶在未完成引導的情況下關閉了視窗，標記設置為已完成');
      store.set('hasCompletedSetup', true);
      isFirstRun = false;
    }
  });
}

// 確保應用程序在 macOS 上正常運行
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 應用程序初始化完成後創建視窗
app.whenReady().then(() => {
  createWindow();
  
  // 檢查更新（如果啟用）
  if (store.get('autoUpdate')) {
    autoUpdater.checkForUpdatesAndNotify();
  }
  
  // 監聽開發者工具請求
  ipcMain.on('open-dev-tools', (event) => {
    // 獲取發送事件的窗口
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    
    if (win) {
      win.webContents.openDevTools({ mode: 'detach' });
      log.info('應用程序請求開啟開發者工具');
    }
  });
  
  // 監聽渲染進程準備就緒事件
  ipcMain.on('renderer-ready', (event) => {
    log.info('收到渲染進程準備就緒事件');
    try {
      // 獲取發送事件的窗口
      const webContents = event.sender;
      const win = BrowserWindow.fromWebContents(webContents);
      
      if (win === mainWindow) {
        log.info('主窗口已準備就緒');
        
        // 如果是主窗口且有設置數據，則發送設置數據
        const outputPath = store.get('outputPath');
        const locale = store.get('locale');
        const autoUpdate = store.get('autoUpdate');
        
        log.info('向準備就緒的主窗口發送設置數據：', { outputPath, locale, autoUpdate });
        
        // 延遲一點再發送，確保渲染進程已完全準備好
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('setup-completed', {
              outputPath,
              locale,
              autoUpdate
            });
            log.info('已向主窗口發送設置數據');
          }
        }, 500);
      }
    } catch (error) {
      log.error('處理渲染進程準備就緒事件時出錯', error);
    }
  });
  
  // 監聽引導視窗關閉事件 - 備用方案
  // 當引導視窗關閉時，檢查是否儲存了設定
  app.on('browser-window-closed', (event, window) => {
    // 檢查是否是引導視窗
    if (global.onboardingWindow === window) {
      log.info('偵測到引導視窗關閉');
      
      // 確保標記為已完成設置
      if (!store.get('hasCompletedSetup')) {
        log.info('設置標記為已完成');
        store.set('hasCompletedSetup', true);
        isFirstRun = false;
      }
      
      // 釋放引用
      global.onboardingWindow = null;
    }
  });
  
  // 設置應用程序選單
  require('./menu');
});

// 自動更新相關事件
autoUpdater.on('checking-for-update', () => {
  log.info('正在檢查更新...');
});

autoUpdater.on('update-available', (info) => {
  log.info('有可用更新:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', () => {
  log.info('當前已是最新版本');
});

autoUpdater.on('error', (err) => {
  log.error('自動更新錯誤:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let logMessage = `下載速度: ${progressObj.bytesPerSecond} - 已下載 ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
  log.info(logMessage);
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('更新已下載:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
    
    dialog.showMessageBox({
      type: 'info',
      title: '應用程序更新',
      message: '有新版本可用。要現在重啟應用程序以安裝更新嗎？',
      buttons: ['立即重啟', '稍後']
    }).then((returnValue) => {
      if (returnValue.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }
});

// IPC事件處理
// 打開文件選擇對話框
ipcMain.handle('show-open-dialog', async (event, options) => {
  log.info('收到show-open-dialog請求，選項:', options);
  try {
    // 確定正確的父視窗，使用dialog.showOpenDialog時需要保證對話框顯示在正確的視窗上方
    const sender = event.sender;
    const win = BrowserWindow.fromWebContents(sender);
    const parentWindow = win || mainWindow;
    
    // 添加一些默認選項，確保對話框正常顯示
    const dialogOptions = {
      ...options,
      // 如果沒有指定預設路徑，使用默認下載目錄
      defaultPath: options.defaultPath || app.getPath('downloads'),
      // 確保對話框總是顯示在前面
      modal: true,
      // 確保對話框不會被阻擋
      properties: [...(options.properties || []), 'createDirectory']
    };
    
    log.info('打開檔案對話框，配置: ', dialogOptions);
    const result = await dialog.showOpenDialog(parentWindow, dialogOptions);
    log.info('show-open-dialog結果:', result);
    return result;
  } catch (error) {
    log.error('show-open-dialog錯誤:', error);
    throw error;
  }
});

// 打開保存對話框
ipcMain.handle('show-save-dialog', async (event, options) => {
  log.info('收到show-save-dialog請求');
  try {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
  } catch (error) {
    log.error('show-save-dialog錯誤:', error);
    throw error;
  }
});

// 顯示消息框
ipcMain.handle('show-message-box', async (event, options) => {
  log.info('收到show-message-box請求');
  try {
    const result = await dialog.showMessageBox(options);
    return result;
  } catch (error) {
    log.error('show-message-box錯誤:', error);
    throw error;
  }
});

// 在瀏覽器中打開URL
ipcMain.handle('open-external-link', async (event, url) => {
  if (url.startsWith('https://') || url.startsWith('http://')) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// 獲取app路徑
ipcMain.handle('get-app-path', (event, name) => {
  return app.getPath(name);
});

// 獲取設置
ipcMain.handle('get-store-value', (event, key) => {
  return store.get(key);
});

// 設置配置值
ipcMain.handle('set-store-value', (event, key, value) => {
  store.set(key, value);
  return true;
});

// 錯誤報告
process.on('uncaughtException', (error) => {
  log.error('未捕獲的異常:', error);
  
  // 記錄錯誤詳情到日誌文件
  const errorDetails = {
    message: error.message,
    stack: error.stack,
    time: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(app.getPath('logs'), 'error.log'),
    JSON.stringify(errorDetails, null, 2)
  );
  
  // 如果主視窗存在，顯示錯誤對話框
  if (mainWindow) {
    dialog.showMessageBox({
      type: 'error',
      title: '應用程序錯誤',
      message: '很抱歉，應用程序遇到了錯誤',
      detail: `錯誤信息: ${error.message}\n\n錯誤報告已保存至日誌。`,
      buttons: ['重新啟動應用', '關閉應用']
    }).then(({ response }) => {
      if (response === 0) {
        app.relaunch();
      }
      app.exit(1);
    });
  }
}); 