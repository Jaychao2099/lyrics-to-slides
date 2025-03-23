const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 保持對window對象的全局引用，避免JavaScript對象被垃圾回收時窗口關閉
let mainWindow;

function createWindow() {
  // 創建瀏覽器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    }
  });

  // 根據環境加載應用
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173/');
    // 開啟開發者工具
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // 當窗口關閉時發出
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// 當Electron完成初始化並準備創建瀏覽器窗口時調用此方法
app.whenReady().then(createWindow);

// 當所有窗口關閉時退出應用
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// 處理保存文件對話框
ipcMain.handle('save-file', async (event, { defaultPath, filters }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath,
    filters
  });
  
  if (canceled) return null;
  return filePath;
});

// 處理打開文件對話框
ipcMain.handle('open-file', async (event, { filters }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters
  });
  
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
}); 