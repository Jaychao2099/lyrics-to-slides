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
    outputPath: app.getPath('documents'),
    autoUpdate: true,
    lastProject: null,
    locale: 'zh-TW',
    hasCompletedSetup: false
  }
});

// 主視窗
let mainWindow;
let isFirstRun = !store.get('hasCompletedSetup');

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
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png')
  });

  // 加載主頁面
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

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
      preload: path.join(__dirname, 'preload.js')
    }
  });

  onboardingWindow.loadFile(path.join(__dirname, '../renderer/onboarding.html'));
  
  onboardingWindow.once('ready-to-show', () => {
    onboardingWindow.show();
  });

  // 監聽引導完成事件
  ipcMain.once('onboarding-complete', (event, data) => {
    // 保存用戶設置
    if (data) {
      if (data.outputPath) store.set('outputPath', data.outputPath);
      if (data.locale) store.set('locale', data.locale);
      if (data.autoUpdate !== undefined) store.set('autoUpdate', data.autoUpdate);
    }
    
    // 標記設置已完成
    store.set('hasCompletedSetup', true);
    isFirstRun = false;
    
    // 關閉引導視窗
    onboardingWindow.close();
    onboardingWindow = null;
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
  const result = await dialog.showOpenDialog(options);
  return result;
});

// 打開保存對話框
ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(options);
  return result;
});

// 顯示消息框
ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(options);
  return result;
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