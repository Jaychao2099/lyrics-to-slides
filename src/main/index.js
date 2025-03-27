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
    hasCompletedSetup: false,
    apiKeys: {
      openai: '',
      musixmatch: '',
      genius: '',
      stabilityai: ''
    },
    promptTemplates: {
      default: "為以下歌詞創建背景圖片：\n「{{lyrics}}」\n風格：簡約現代，適合教會或歌唱聚會使用的投影片背景，不要包含任何文字或人物，只需要創作美麗和諧的抽象背景。",
      abstract: "創建一個抽象藝術背景，代表以下歌詞的情感：\n「{{lyrics}}」\n風格：柔和色彩、流動形狀，沒有文字，適合作為投影片背景。",
      nature: "基於以下歌詞創建一個自然風景背景：\n「{{lyrics}}」\n風格：平靜的自然景觀，沒有文字，適合作為投影片背景。",
      worship: "為這段敬拜歌詞創建一個虔誠的背景：\n「{{lyrics}}」\n風格：神聖、平和、簡約，沒有文字，適合教會使用的投影片背景。",
      modern: "為以下歌詞創建一個現代風格背景：\n「{{lyrics}}」\n風格：現代設計、簡約、平滑漸變，沒有文字，適合作為投影片背景。"
    },
    slidesSettings: {
      fontSize: 60,
      fontFamily: 'Microsoft JhengHei, Arial, sans-serif',
      fontColor: '#FFFFFF',
      fontWeight: 'bold',
      textShadow: true,
      lineHeight: 1.5,
      maxLinesPerSlide: 4,
      textPosition: 'center'
    }
  }
});

// 從共用模塊引入服務類
const ProjectManager = require('../shared/services/ProjectManager');
const LyricsService = require('../shared/services/LyricsService');
const ImageGenerationService = require('../shared/services/ImageGenerationService');
const ExportService = require('../shared/services/ExportService');

// 初始化服務實例
const projectManager = new ProjectManager({
  projectsPath: path.join(app.getPath('documents'), '歌曲投影片生成器', 'projects'),
  autoSave: store.get('autoSave', true),
  autoSaveInterval: store.get('autoSaveInterval', 300000)
});

const lyricsService = new LyricsService({
  apiKeys: store.get('apiKeys'),
  defaultLanguage: store.get('locale', 'zh-TW'),
  cacheEnabled: true,
  sourcesPriority: store.get('lyricsSourcesPriority', ['netease', 'kkbox', 'genius', 'musixmatch', 'mojim']),
  useLLM: store.get('useLLM', true)
});

const imageGenerationService = new ImageGenerationService({
  apiKeys: store.get('apiKeys'),
  cacheEnabled: true,
  defaultParams: {
    width: 1920,
    height: 1080,
    provider: store.get('imageProvider', 'openai'),
    model: store.get('imageModel', 'dall-e-3'),
    style: store.get('imageStyle', 'natural'),
    quality: store.get('imageQuality', 'standard'),
    orientation: 'landscape'
  },
  promptTemplates: store.get('promptTemplates')
});

const exportService = new ExportService({
  outputDir: store.get('outputPath', app.getPath('downloads')),
  theme: store.get('theme', 'default'),
  defaultFormat: store.get('exportFormat', 'html')
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
  if (global.onboardingWindow && !global.onboardingWindow.isDestroyed()) {
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
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true
    }
  });
  
  // 保存引導視窗的全局引用，防止被垃圾回收
  global.onboardingWindow = onboardingWindow;
  
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
  
  // 加載歡迎頁面
  onboardingWindow.loadFile(path.join(__dirname, '../renderer/onboarding.html'));
  
  // 為了調試，默認開啟開發者工具
  if (process.argv.includes('--dev')) {
    onboardingWindow.webContents.openDevTools({ mode: 'detach' });
    log.info('在開發模式下開啟開發者工具');
  }
  
  // 當視窗準備好時顯示
  onboardingWindow.once('ready-to-show', () => {
    onboardingWindow.show();
    log.info('顯示引導視窗');
  });
  
  // 監聽引導完成事件
  ipcMain.once('onboarding-complete', (event, data) => {
    handleOnboardingComplete(data, onboardingWindow);
  });
  
  // 當引導視窗關閉時清除引用
  onboardingWindow.on('closed', () => {
    global.onboardingWindow = null;
  });
}

// 處理引導完成事件
function handleOnboardingComplete(data, onboardingWindow) {
  log.info('收到引導完成事件', data);
  
  try {
    // 保存用戶設置
    if (data) {
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
    }
    
    // 標記設置已完成
    store.set('hasCompletedSetup', true);
    log.info('已標記設置完成狀態為 true');
    isFirstRun = false;
    
    // 關閉引導視窗
    if (onboardingWindow && !onboardingWindow.isDestroyed()) {
      onboardingWindow.close();
      log.info('引導視窗已關閉');
    }
    
    // 重新加載主視窗以應用新設置
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 傳遞設置給主視窗
      log.info('正在向主窗口發送設置完成事件');
      mainWindow.webContents.send('setup-completed', {
        outputPath: store.get('outputPath'),
        locale: store.get('locale'),
        autoUpdate: store.get('autoUpdate')
      });
      
      // 重新加載主窗口
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          log.info('重新加載主窗口');
          mainWindow.reload();
        }
      }, 1000);
    }
  } catch (error) {
    log.error('處理引導完成事件時出錯:', error);
  }
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
  
  // 設置IPC處理程序
  setupIPC();
  
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
      app.quit();
    }
  });
  
  // 項目操作
  ipcMain.on('new-project', async () => {
    const canProceed = await checkUnsavedChanges();
    if (canProceed) {
      projectManager.createNewProject();
      mainWindow.webContents.send('project-created', { success: true });
    }
  });
  
  ipcMain.on('open-project', async () => {
    const canProceed = await checkUnsavedChanges();
    if (!canProceed) return;
    
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: '開啟專案',
      filters: [
        { name: '歌曲投影片專案', extensions: ['lsp'] },
        { name: '所有檔案', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (canceled || filePaths.length === 0) return;
    
    try {
      const projectData = await projectManager.loadProject(filePaths[0]);
      mainWindow.webContents.send('project-loaded', { success: true, project: projectData });
      
      // 保存最近打開的項目
      store.set('lastProject', filePaths[0]);
    } catch (error) {
      log.error('載入專案時發生錯誤:', error);
      
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        buttons: ['確定'],
        title: '載入失敗',
        message: '載入專案時發生錯誤。',
        detail: error.message
      });
      
      mainWindow.webContents.send('project-loaded', { success: false, error: error.message });
    }
  });
  
  ipcMain.handle('load-project', async (event, filePath) => {
    try {
      const canProceed = await checkUnsavedChanges();
      if (!canProceed) return { success: false, cancelled: true };
      
      const projectData = await projectManager.loadProject(filePath);
      
      // 保存最近打開的項目
      store.set('lastProject', filePath);
      
      return { success: true, data: projectData };
    } catch (error) {
      log.error('載入專案時發生錯誤:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.on('save-project', async () => {
    await saveProject();
  });
  
  ipcMain.on('save-project-as', async () => {
    await saveProjectAs();
  });
  
  // 歌詞搜索
  ipcMain.handle('search-lyrics', async (event, query) => {
    try {
      log.info('搜索歌詞:', query);
      
      let results = [];
      
      // 首先使用常規API搜索
      const apiResults = await lyricsService.searchLyrics(query);
      results = apiResults;
      
      // 如果啟用了LLM並且有API金鑰，使用LLM搜索補充
      if (store.get('useLLM', true) && store.get('apiKeys.openai')) {
        try {
          const llmResults = await lyricsService.searchLyricsWithLLM(query);
          
          // 合併結果
          if (llmResults && llmResults.length > 0) {
            results = [...results, ...llmResults];
          }
        } catch (llmError) {
          log.error('LLM歌詞搜尋錯誤:', llmError);
          // 繼續使用API結果
        }
      }
      
      return { success: true, results };
    } catch (error) {
      log.error('搜索歌詞時出錯:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('get-lyrics', async (event, lyricInfo) => {
    try {
      log.info('獲取歌詞內容:', lyricInfo);
      
      const lyrics = await lyricsService.getLyrics(lyricInfo);
      
      // 如果啟用了LLM並獲取到歌詞，嘗試優化
      if (store.get('useLLM', true) && store.get('apiKeys.openai') && lyrics.success && lyrics.text) {
        try {
          const maxLines = store.get('slidesSettings.maxLinesPerSlide', 4);
          const processed = await lyricsService.processLyricsWithLLM(lyrics.text, { maxLines });
          
          if (processed.success) {
            return {
              success: true,
              ...lyrics,
              processedText: processed.processedLyrics,
              paragraphs: processed.paragraphs || lyrics.paragraphs,
              slides: processed.slides
            };
          }
        } catch (llmError) {
          log.error('LLM處理歌詞錯誤:', llmError);
          // 繼續使用原始歌詞
        }
      }
      
      return lyrics;
    } catch (error) {
      log.error('獲取歌詞時出錯:', error);
      return { success: false, error: error.message };
    }
  });
  
  // 圖片生成
  ipcMain.handle('generate-image', async (event, params) => {
    try {
      log.info('生成圖片請求:', {
        provider: params.provider,
        lyrics: params.lyrics ? `${params.lyrics.substring(0, 20)}...` : 'none',
        width: params.width,
        height: params.height
      });
      
      // 設置進度報告回調
      const progressCallback = (progress) => {
        event.sender.send('image-generation-progress', progress);
      };
      
      // 合併參數
      const mergedParams = {
        ...params,
        apiKeys: store.get('apiKeys')
      };
      
      // 生成圖片
      const result = await imageGenerationService.generateImage(mergedParams, progressCallback);
      
      return result;
    } catch (error) {
      log.error('生成圖片時出錯:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.on('cancel-image-generation', (event, requestId) => {
    try {
      const success = imageGenerationService.cancelGeneration(requestId);
      event.sender.send('image-generation-cancelled', { success, requestId });
    } catch (error) {
      log.error('取消圖片生成時出錯:', error);
      event.sender.send('image-generation-cancelled', { success: false, error: error.message });
    }
  });
  
  // 導出投影片
  ipcMain.handle('export-slideshow', async (event, options) => {
    try {
      log.info('導出投影片請求:', options);
      
      // 設置進度報告回調
      const progressCallback = (progress) => {
        event.sender.send('export-progress', progress);
      };
      
      // 如果沒有指定輸出路徑，請用戶選擇
      let outputPath = options.outputPath;
      if (!outputPath) {
        const format = options.format || 'html';
        const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
          title: '保存投影片',
          defaultPath: path.join(store.get('outputPath', app.getPath('downloads')), `slideshow.${format}`),
          filters: [
            { name: 'HTML投影片', extensions: ['html'] },
            { name: 'PDF文檔', extensions: ['pdf'] },
            { name: 'PowerPoint演示文稿', extensions: ['pptx'] },
            { name: '圖片文件夾', extensions: ['zip'] }
          ]
        });
        
        if (canceled || !filePath) {
          return { success: false, cancelled: true };
        }
        
        outputPath = filePath;
      }
      
      // 導出投影片
      const result = await exportService.exportSlideshow(
        options.slideshow, 
        outputPath, 
        {
          format: options.format || 'html',
          title: options.title || '歌曲投影片',
          ...store.get('slidesSettings')
        },
        progressCallback
      );
      
      return result;
    } catch (error) {
      log.error('導出投影片時出錯:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.on('cancel-export', () => {
    try {
      exportService.cancelExport()
        .then(success => {
          mainWindow.webContents.send('export-cancelled', { success });
        })
        .catch(error => {
          log.error('取消導出時出錯:', error);
          mainWindow.webContents.send('export-cancelled', { success: false, error: error.message });
        });
    } catch (error) {
      log.error('取消導出時出錯:', error);
      mainWindow.webContents.send('export-cancelled', { success: false, error: error.message });
    }
  });
  
  // 設置相關
  ipcMain.handle('get-settings', () => {
    return {
      theme: store.get('theme', 'light'),
      outputPath: store.get('outputPath', app.getPath('downloads')),
      autoUpdate: store.get('autoUpdate', true),
      locale: store.get('locale', 'zh-TW'),
      apiKeys: store.get('apiKeys', {}),
      promptTemplates: store.get('promptTemplates', {}),
      slidesSettings: store.get('slidesSettings', {}),
      lyricsSourcesPriority: store.get('lyricsSourcesPriority', ['netease', 'kkbox', 'genius', 'musixmatch', 'mojim']),
      useLLM: store.get('useLLM', true),
      imageProvider: store.get('imageProvider', 'openai'),
      imageModel: store.get('imageModel', 'dall-e-3'),
      imageStyle: store.get('imageStyle', 'natural'),
      imageQuality: store.get('imageQuality', 'standard')
    };
  });
  
  ipcMain.handle('update-settings', (event, settings) => {
    try {
      // 更新設置
      Object.entries(settings).forEach(([key, value]) => {
        store.set(key, value);
      });
      
      // 如果更新了API金鑰，則更新服務
      if (settings.apiKeys) {
        lyricsService.updateOptions({ apiKeys: settings.apiKeys });
        imageGenerationService.updateOptions({ apiKeys: settings.apiKeys });
      }
      
      // 如果更新了提示詞模板，則更新服務
      if (settings.promptTemplates) {
        imageGenerationService.updateOptions({ promptTemplates: settings.promptTemplates });
      }
      
      // 如果更新了輸出路徑，則更新服務
      if (settings.outputPath) {
        exportService.options.outputDir = settings.outputPath;
      }
      
      return { success: true };
    } catch (error) {
      log.error('更新設置時出錯:', error);
      return { success: false, error: error.message };
    }
  });
  
  // 檢查API金鑰
  ipcMain.handle('check-api-key', async (event, { provider, apiKey }) => {
    try {
      let isValid = false;
      
      if (provider === 'openai' || provider === 'stabilityai') {
        isValid = await imageGenerationService.checkApiKey(provider, apiKey);
      } else if (provider === 'genius' || provider === 'musixmatch') {
        isValid = await lyricsService.checkApiKey(provider, apiKey);
      }
      
      return { success: true, isValid };
    } catch (error) {
      log.error('檢查API金鑰時出錯:', error);
      return { success: false, error: error.message };
    }
  });
  
  // 選擇輸出路徑
  ipcMain.on('select-output-path', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: '選擇輸出目錄',
      defaultPath: store.get('outputPath', app.getPath('downloads')),
      properties: ['openDirectory', 'createDirectory']
    });
    
    if (!canceled && filePaths.length > 0) {
      store.set('outputPath', filePaths[0]);
      exportService.options.outputDir = filePaths[0];
      mainWindow.webContents.send('output-path-selected', filePaths[0]);
    }
  });
  
  // 緩存清理
  ipcMain.handle('clear-cache', async (event, { type }) => {
    try {
      if (type === 'lyrics' || type === 'all') {
        lyricsService.clearCache();
      }
      
      if (type === 'images' || type === 'all') {
        imageGenerationService.clearCache();
      }
      
      return { success: true };
    } catch (error) {
      log.error('清理緩存時出錯:', error);
      return { success: false, error: error.message };
    }
  });
  
  // 標準對話框
  ipcMain.handle('show-open-dialog', async (event, options) => {
    try {
      const sender = event.sender;
      const win = BrowserWindow.fromWebContents(sender);
      const parentWindow = win || mainWindow;
      
      const dialogOptions = {
        ...options,
        defaultPath: options.defaultPath || app.getPath('downloads'),
        modal: true,
        properties: [...(options.properties || []), 'createDirectory']
      };
      
      const result = await dialog.showOpenDialog(parentWindow, dialogOptions);
      return result;
    } catch (error) {
      log.error('show-open-dialog錯誤:', error);
      throw error;
    }
  });
  
  ipcMain.handle('show-save-dialog', async (event, options) => {
    try {
      const sender = event.sender;
      const win = BrowserWindow.fromWebContents(sender);
      const parentWindow = win || mainWindow;
      
      const dialogOptions = {
        ...options,
        defaultPath: options.defaultPath || app.getPath('downloads'),
        modal: true,
        properties: [...(options.properties || []), 'createDirectory', 'showOverwriteConfirmation']
      };
      
      const result = await dialog.showSaveDialog(parentWindow, dialogOptions);
      return result;
    } catch (error) {
      log.error('show-save-dialog錯誤:', error);
      throw error;
    }
  });
  
  ipcMain.handle('show-message-box', async (event, options) => {
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
}

/**
 * 檢查未保存的更改
 * @returns {Promise<boolean>} 是否可以繼續
 */
async function checkUnsavedChanges() {
  if (projectManager.hasUnsavedChanges()) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['保存', '不保存', '取消'],
      title: '未保存的更改',
      message: '當前項目有未保存的更改。',
      detail: '是否要保存當前項目？'
    });
    
    if (response === 0) { // 保存
      const saved = await saveProject();
      return saved;
    } else if (response === 1) { // 不保存
      return true;
    } else { // 取消
      return false;
    }
  }
  
  return true;
}

/**
 * 保存當前項目
 * @returns {Promise<boolean>} 是否成功保存
 */
async function saveProject() {
  try {
    if (!projectManager.hasUnsavedChanges()) {
      return true;
    }
    
    // 如果已有保存路徑，直接保存
    if (projectManager.currentProjectPath) {
      const result = await projectManager.saveProject();
      
      if (result.success) {
        mainWindow.webContents.send('project-saved', { success: true, path: result.path });
        store.set('lastProject', result.path);
        return true;
      } else {
        throw new Error('保存項目失敗');
      }
    } else {
      // 否則，提示用戶選擇保存路徑
      return await saveProjectAs();
    }
  } catch (error) {
    log.error('保存項目時出錯:', error);
    
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      buttons: ['確定'],
      title: '保存失敗',
      message: '保存項目時發生錯誤。',
      detail: error.message
    });
    
    return false;
  }
}

/**
 * 另存當前項目
 * @returns {Promise<boolean>} 是否成功保存
 */
async function saveProjectAs() {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: '保存項目',
      defaultPath: projectManager.currentProject?.name
        ? path.join(projectManager.options.projectsPath, projectManager.currentProject.name + '.lsp')
        : path.join(projectManager.options.projectsPath, '未命名項目.lsp'),
      filters: [
        { name: '歌曲投影片項目', extensions: ['lsp'] },
        { name: '所有檔案', extensions: ['*'] }
      ],
      properties: ['showOverwriteConfirmation']
    });
    
    if (canceled || !filePath) {
      return false;
    }
    
    const result = await projectManager.saveProject(filePath);
    
    if (result.success) {
      mainWindow.webContents.send('project-saved', { success: true, path: result.path });
      store.set('lastProject', result.path);
      return true;
    } else {
      throw new Error('保存項目失敗');
    }
  } catch (error) {
    log.error('另存項目時出錯:', error);
    
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      buttons: ['確定'],
      title: '保存失敗',
      message: '保存項目時發生錯誤。',
      detail: error.message
    });
    
    return false;
  }
}

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