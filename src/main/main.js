/**
 * 歌曲投影片生成器 - 主進程入口
 * 負責應用的生命週期管理、窗口管理和所有主進程功能
 */

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const Store = require('electron-store');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

// 從共用模塊引入服務類
const ProjectManager = require('../shared/services/ProjectManager');
const LyricsService = require('../shared/services/LyricsService');
const ImageGenerationService = require('../shared/services/ImageGenerationService');
const ExportService = require('../shared/services/ExportService');

// 設置應用程式日誌
log.transports.file.level = 'debug';
log.info('應用啟動中...');

// 初始化設定存儲
const settings = new Store({
  name: 'settings',
  defaults: {
    windowBounds: { width: 1280, height: 720 },
    theme: 'system',
    language: 'zh-TW',
    autoUpdate: true,
    defaultOutputPath: app.getPath('documents'),
    apiKeys: {
      openai: '',
      stability: ''
    },
    resolution: {
      preset: '16:9',
      width: 1920,
      height: 1080
    }
  }
});

// 初始化服務實例
let projectManager;
let lyricsService;
let imageGenerationService;
let exportService;

// 全局引用窗口對象，避免JavaScript垃圾回收時自動關閉窗口
let mainWindow;
let isQuitting = false;

/**
 * 創建主窗口
 */
function createWindow() {
  // 獲取保存的窗口尺寸
  const { width, height } = settings.get('windowBounds');
  
  // 創建瀏覽器窗口
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#f5f5f5',
    frame: false, // 無邊框窗口，使用自定義標題欄
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png')
  });
  
  // 載入應用的index.html
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  
  // 在生產環境隱藏菜單欄
  if (process.env.NODE_ENV === 'production') {
    Menu.setApplicationMenu(null);
  } else {
    // 開發環境打開開發者工具
    mainWindow.webContents.openDevTools();
  }
  
  // 窗口關閉時的處理
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      checkUnsavedChanges().then((canClose) => {
        if (canClose) {
          isQuitting = true;
          mainWindow.close();
        }
      });
    }
  });
  
  // 儲存窗口尺寸
  mainWindow.on('resize', () => {
    const { width, height } = mainWindow.getBounds();
    settings.set('windowBounds', { width, height });
  });
  
  log.info('主窗口已創建');
}

/**
 * 初始化應用服務
 */
function initServices() {
  // 初始化專案管理器
  projectManager = new ProjectManager({
    appDataPath: app.getPath('userData'),
    documentsPath: app.getPath('documents')
  });
  
  // 初始化歌詞服務
  lyricsService = new LyricsService({
    cachePath: path.join(app.getPath('userData'), 'cache', 'lyrics'),
    apiKeys: settings.get('apiKeys')
  });
  
  // 初始化圖像生成服務
  imageGenerationService = new ImageGenerationService({
    tempPath: path.join(app.getPath('userData'), 'temp'),
    cachePath: path.join(app.getPath('userData'), 'cache', 'images'),
    apiKeys: settings.get('apiKeys')
  });
  
  // 初始化匯出服務
  exportService = new ExportService({
    tempPath: path.join(app.getPath('userData'), 'temp'),
    outputPath: settings.get('defaultOutputPath')
  });
  
  log.info('所有服務已初始化');
}

/**
 * 檢查未保存的更改
 * @returns {Promise<boolean>} 是否可以關閉應用
 */
async function checkUnsavedChanges() {
  // 如果專案未修改，可以直接關閉
  if (!projectManager.hasUnsavedChanges()) {
    return true;
  }
  
  // 顯示確認對話框
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['儲存', '不儲存', '取消'],
    title: '未儲存的更改',
    message: '當前專案有未儲存的更改。',
    detail: '你想要在關閉前儲存它嗎？'
  });
  
  // response: 0 = 儲存, 1 = 不儲存, 2 = 取消
  if (response === 0) {
    // 儲存並關閉
    return await saveProject();
  } else if (response === 1) {
    // 不儲存，直接關閉
    return true;
  } else {
    // 取消關閉操作
    return false;
  }
}

/**
 * 儲存專案
 * @returns {Promise<boolean>} 是否儲存成功
 */
async function saveProject() {
  if (!projectManager.hasCurrentProject()) {
    return await saveProjectAs();
  }
  
  try {
    await projectManager.saveCurrentProject();
    return true;
  } catch (error) {
    log.error('儲存專案時發生錯誤:', error);
    
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'error',
      buttons: ['重試', '另存為', '取消'],
      title: '儲存失敗',
      message: '儲存專案時發生錯誤。',
      detail: error.message
    });
    
    if (response === 0) {
      // 重試
      return await saveProject();
    } else if (response === 1) {
      // 另存為
      return await saveProjectAs();
    } else {
      // 取消
      return false;
    }
  }
}

/**
 * 另存專案
 * @returns {Promise<boolean>} 是否儲存成功
 */
async function saveProjectAs() {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: '儲存專案',
    defaultPath: path.join(app.getPath('documents'), '未命名專案.lss'),
    filters: [
      { name: '歌曲投影片專案', extensions: ['lss'] },
      { name: '所有檔案', extensions: ['*'] }
    ]
  });
  
  if (canceled || !filePath) {
    return false;
  }
  
  try {
    await projectManager.saveCurrentProjectAs(filePath);
    return true;
  } catch (error) {
    log.error('另存專案時發生錯誤:', error);
    
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      buttons: ['確定'],
      title: '儲存失敗',
      message: '另存專案時發生錯誤。',
      detail: error.message
    });
    
    return false;
  }
}

/**
 * 設置IPC通信處理程序
 */
function setupIPC() {
  // 視窗控制
  ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
  });
  
  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  
  ipcMain.on('close-window', async () => {
    const canClose = await checkUnsavedChanges();
    if (canClose) {
      isQuitting = true;
      mainWindow.close();
    }
  });
  
  // 專案操作
  ipcMain.on('new-project', async () => {
    const canProceed = await checkUnsavedChanges();
    if (canProceed) {
      projectManager.createNewProject();
      mainWindow.webContents.send('project-created');
    }
  });
  
  ipcMain.on('open-project', async () => {
    const canProceed = await checkUnsavedChanges();
    if (!canProceed) return;
    
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: '開啟專案',
      filters: [
        { name: '歌曲投影片專案', extensions: ['lss'] },
        { name: '所有檔案', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (canceled || filePaths.length === 0) return;
    
    try {
      const projectData = await projectManager.loadProject(filePaths[0]);
      mainWindow.webContents.send('project-loaded', true, projectData);
    } catch (error) {
      log.error('載入專案時發生錯誤:', error);
      
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        buttons: ['確定'],
        title: '載入失敗',
        message: '載入專案時發生錯誤。',
        detail: error.message
      });
      
      mainWindow.webContents.send('project-loaded', false, null);
    }
  });
  
  ipcMain.on('save-project', async () => {
    await saveProject();
  });
  
  ipcMain.on('save-project-as', async (event, projectData) => {
    // 更新專案數據
    if (projectData) {
      projectManager.updateProjectData(projectData);
    }
    
    await saveProjectAs();
  });
  
  // 歌詞搜索和獲取
  ipcMain.on('search-lyrics', async (event, { title, artist, options }) => {
    try {
      const results = await lyricsService.searchLyrics(title, artist, options);
      mainWindow.webContents.send('lyrics-search-result', true, results);
    } catch (error) {
      log.error('搜索歌詞時發生錯誤:', error);
      mainWindow.webContents.send('lyrics-search-result', false, null);
    }
  });
  
  ipcMain.on('get-lyrics', async (event, { resultId }) => {
    try {
      const { lyrics, language } = await lyricsService.getLyrics(resultId);
      mainWindow.webContents.send('lyrics-content', true, lyrics, language);
    } catch (error) {
      log.error('獲取歌詞內容時發生錯誤:', error);
      mainWindow.webContents.send('lyrics-content', false, null, null);
    }
  });
  
  // 圖像生成
  ipcMain.on('generate-image', async (event, { prompt, options }) => {
    try {
      // 通知前端開始生成
      mainWindow.webContents.send('image-generation-started');
      
      // 設置進度回調
      options.onProgress = (progress) => {
        mainWindow.webContents.send('image-generation-progress', progress);
      };
      
      // 生成圖像
      const imageData = await imageGenerationService.generateImage(prompt, options);
      
      // 返回結果
      mainWindow.webContents.send('image-generated', true, imageData);
    } catch (error) {
      log.error('生成圖像時發生錯誤:', error);
      mainWindow.webContents.send('image-generated', false, null);
    }
  });
  
  // 匯出投影片
  ipcMain.on('export-slideshow', async (event, { slides, options }) => {
    try {
      // 通知前端開始匯出
      mainWindow.webContents.send('export-started');
      
      // 設置進度回調
      options.onProgress = (progress) => {
        mainWindow.webContents.send('export-progress', progress);
      };
      
      // 匯出投影片
      const outputPath = await exportService.exportSlideshow(slides, options);
      
      // 返回結果
      mainWindow.webContents.send('export-complete', true, outputPath);
    } catch (error) {
      log.error('匯出投影片時發生錯誤:', error);
      mainWindow.webContents.send('export-complete', false, null);
    }
  });
  
  // 選擇輸出路徑
  ipcMain.on('select-output-path', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: '選擇輸出資料夾',
      properties: ['openDirectory']
    });
    
    if (!canceled && filePaths.length > 0) {
      const outputPath = filePaths[0];
      mainWindow.webContents.send('output-path-selected', outputPath);
      settings.set('defaultOutputPath', outputPath);
    }
  });
  
  // 應用設定
  ipcMain.on('get-settings', () => {
    mainWindow.webContents.send('settings-data', settings.store);
  });
  
  ipcMain.on('update-settings', (event, newSettings) => {
    // 合併新設定
    Object.assign(settings.store, newSettings);
    settings.save();
    
    // 更新服務的設定
    if (newSettings.apiKeys) {
      lyricsService.updateApiKeys(newSettings.apiKeys);
      imageGenerationService.updateApiKeys(newSettings.apiKeys);
    }
    
    if (newSettings.defaultOutputPath) {
      exportService.updateOptions({ outputPath: newSettings.defaultOutputPath });
    }
    
    // 確認設定已更新
    mainWindow.webContents.send('settings-updated');
  });
  
  log.info('IPC處理程序已設置');
}

/**
 * 檢查更新
 */
function checkForUpdates() {
  if (process.env.NODE_ENV === 'development') {
    return;
  }
  
  const autoCheckUpdate = settings.get('autoUpdate');
  if (!autoCheckUpdate) {
    return;
  }
  
  autoUpdater.logger = log;
  autoUpdater.checkForUpdatesAndNotify();
  
  // 設置自動更新事件處理
  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-available');
  });
  
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['立即重啟', '稍後'],
      title: '應用程式更新',
      message: '應用程式已下載新版本，是否立即重啟並安裝？'
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
  
  log.info('自動更新檢查已設置');
}

// 應用就緒時創建窗口
app.whenReady().then(() => {
  // 初始化服務
  initServices();
  
  // 創建主窗口
  createWindow();
  
  // 設置IPC通信
  setupIPC();
  
  // 檢查更新
  checkForUpdates();
  
  // 在macOS中，當點擊dock圖標且沒有其他窗口打開時，重新創建一個窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 當所有窗口都關閉時退出應用
app.on('window-all-closed', () => {
  // 在macOS上，除非用戶使用Cmd + Q退出，否則應用和菜單欄將保持活動狀態
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 應用退出前的清理
app.on('before-quit', () => {
  isQuitting = true;
});

// 處理未捕獲的異常
process.on('uncaughtException', (error) => {
  log.error('未捕獲的異常:', error);
  
  // 顯示錯誤對話框
  if (mainWindow) {
    dialog.showErrorBox(
      '應用程式發生錯誤',
      `發生未預期的錯誤: ${error.message}\n\n詳細錯誤已記錄到日誌檔案。`
    );
  }
}); 