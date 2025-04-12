/// <reference types="electron" />
/// <reference types="node" />

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import url from 'url';
import { SettingsService } from './services/settings';
import { DatabaseService } from './services/database';
import { LyricsSearchService } from './services/lyricsSearch';
import { ImageGenerationService } from './services/imageGeneration';
import { SlideGenerationService } from './services/slideGeneration';
import { SlideExportService } from './services/slideExport';
import { LoggerService } from './services/logger';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { SlideFormatter } from './services/slideFormatter';
import { BatchSlideService } from './services/batchSlideService';
import { Song, Settings } from '../common/types';
import { spawn } from 'child_process';

// 開發模式標誌
const isDev = process.env.NODE_ENV === 'development';

// 保持對 window 對象的全域引用，避免被 JavaScript 垃圾回收機制回收
let mainWindow: BrowserWindow | null = null;

// 發送日誌到渲染進程
function sendLogToRenderer(type: string, message: string, level: 'info' | 'error' | 'warn' = 'info') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log-message', { 
      source: 'main',
      message,
      level
    });
  }
}

// 創建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  // 載入應用主頁面
  const rendererPath = path.join(__dirname, '../renderer/index.html');
  console.log(`嘗試載入渲染器路徑: ${rendererPath}`);
  
  // 檢查文件是否存在
  if (fs.existsSync(rendererPath)) {
    console.log(`渲染器路徑存在，正在載入...`);
    const fileUrl = url.format({
      pathname: rendererPath,
      protocol: 'file:',
      slashes: true
    });
    mainWindow.loadURL(fileUrl);
  } else {
    console.error(`渲染器路徑不存在: ${rendererPath}`);
    // 嘗試使用絕對路徑
    const absolutePath = path.resolve(__dirname, '../renderer/index.html');
    console.log(`嘗試使用絕對路徑: ${absolutePath}`);
    
    if (fs.existsSync(absolutePath)) {
      console.log(`絕對路徑存在，正在載入...`);
      const fileUrl = url.format({
        pathname: absolutePath,
        protocol: 'file:',
        slashes: true
      });
      mainWindow.loadURL(fileUrl);
    } else {
      console.error(`絕對路徑也不存在: ${absolutePath}`);
      mainWindow.loadFile(rendererPath);
    }
  }
  
  // 開發環境下打開開發者工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 當窗口關閉時觸發
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // 監聽頁面加載完成事件
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('頁面加載完成');
  });
  
  // 監聽頁面加載失敗事件
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`頁面加載失敗: ${errorCode} - ${errorDescription}`);
  });
}

// 清理現有歌詞數據
// async function cleanAllExistingLyrics() {
//   try {
//     console.log('開始清理所有現有歌詞數據...');
    
//     // 獲取所有歌曲
//     const songs = DatabaseService.getSongs();
    
//     // 對每首歌曲的歌詞進行清理
//     let updatedCount = 0;
    
//     for (const song of songs) {
//       if (song.lyrics) {
//         // 清理歌詞
//         const cleanedLyrics = LyricsSearchService.cleanLyrics(song.lyrics);
        
//         // 如果清理後的歌詞與原歌詞不同，則更新數據庫
//         if (cleanedLyrics !== song.lyrics) {
//           const updated = DatabaseService.updateSong(song.id, {
//             lyrics: cleanedLyrics
//           });
          
//           if (updated) {
//             updatedCount++;
//           }
//         }
//       }
//     }
    
//     console.log(`完成歌詞清理，已更新 ${updatedCount} 首歌曲的歌詞`);
//     await LoggerService.info(`完成歌詞清理，已更新 ${updatedCount} 首歌曲的歌詞`);
//   } catch (error) {
//     console.error('清理歌詞數據時發生錯誤:', error);
//     await LoggerService.error('清理歌詞數據失敗', error);
//   }
// }

// 應用程序準備就緒時創建窗口
app.whenReady().then(async () => {
  try {
    const userDataPath = app.getPath('userData');
    console.log(`應用數據目錄位置：${userDataPath}`);
    
    // 列出應用數據目錄內容（如果存在）
    try {
      const entries = await fsPromises.readdir(userDataPath, { withFileTypes: true });
      console.log(`應用數據目錄內容：${entries.map(entry => `${entry.name}${entry.isDirectory() ? '/' : ''}`).join(', ')}`);
    } catch (e: any) {
      console.log(`無法讀取應用數據目錄：${e.message}`);
    }
    
    // 初始化應用目錄結構
    await initAppDirectories();
    
    // 初始化日誌服務
    await LoggerService.info('應用程序啟動');
    
    // 初始化數據庫
    DatabaseService.init();
    await LoggerService.info('數據庫初始化完成');
    
    // 設置 IPC 處理器
    setupIpcHandlers();
    await LoggerService.info('IPC 處理器設置完成');
    
    // 創建主窗口
    createWindow();
    await LoggerService.info('主窗口創建完成');
    
    // 不再每次應用啟動時清理所有歌詞
    // 如果有必要，可以通過設置一個標記，只在應用更新或用戶主動要求時執行
    // 或者改為只在添加新歌詞時進行清理
    // try {
    //   await cleanAllExistingLyrics();
    // } catch (error: any) {
    //   console.error('清理歌詞數據失敗:', error);
    //   await LoggerService.error('清理歌詞數據失敗', error);
    // }

    // 在 macOS 中，當點擊 dock 圖標且沒有其他窗口打開時，通常會重新創建一個窗口
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    await LoggerService.error('應用程序啟動過程中發生錯誤', error);
  }
});

// 當所有窗口關閉時退出應用，除了在 macOS 中
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    (async () => {
      // 檢查快取目錄是否存在並記錄
      const userDataPath = app.getPath('userData');
      const cachePath = path.join(userDataPath, 'app_cache');
      try {
        await fsPromises.access(cachePath);
        console.log(`退出前快取目錄存在：${cachePath}`);
        // 列出快取目錄中的內容
        const entries = await fsPromises.readdir(cachePath, { withFileTypes: true });
        console.log(`快取目錄內容：${entries.map(entry => `${entry.name}${entry.isDirectory() ? '/' : ''}`).join(', ')}`);
      } catch (e: any) {
        console.log(`退出前快取目錄不存在：${cachePath}`);
      }
      
      await LoggerService.info('所有窗口已關閉，應用退出');
      app.quit();
    })();
  }
});

// 應用退出時關閉數據庫連接
app.on('quit', () => {
  (async () => {
    // 檢查快取目錄是否存在並記錄
    const userDataPath = app.getPath('userData');
    const cachePath = path.join(userDataPath, 'cache');
    try {
      await fsPromises.access(cachePath);
      console.log(`quit事件中快取目錄存在：${cachePath}`);
    } catch (e: any) {
      console.log(`quit事件中快取目錄不存在：${cachePath}`);
    }
    
    await LoggerService.info('應用退出，關閉數據庫連接');
    DatabaseService.close();
  })();
});

// 添加將被銷毀前的檢查
app.on('will-quit', () => {
  (async () => {
    // 檢查快取目錄是否存在並記錄
    const userDataPath = app.getPath('userData');
    const cachePath = path.join(userDataPath, 'cache');
    try {
      await fsPromises.access(cachePath);
      console.log(`will-quit事件中快取目錄存在：${cachePath}`);
    } catch (e: any) {
      console.log(`will-quit事件中快取目錄不存在：${cachePath}`);
    }
  })();
});

// 設置 IPC 處理器
function setupIpcHandlers() {
  // 獲取應用版本
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
  
  // 獲取設定
  ipcMain.handle('get-settings', () => {
    return getSettings();
  });
  
  // 獲取默認設定
  ipcMain.handle('get-default-settings', () => {
    return SettingsService.getDefaultSettings();
  });
  
  // 儲存設定
  ipcMain.handle('save-settings', (_event, settings) => {
    SettingsService.saveSettings(settings);
    return true;
  });
  
  // 選擇目錄
  ipcMain.handle('select-directory', async () => {
    if (!mainWindow) return '';
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    if (result.canceled) {
      return '';
    } else {
      return result.filePaths[0];
    }
  });
  
  // 獲取歌曲列表
  ipcMain.handle('get-songs', () => {
    return DatabaseService.getSongs();
  });
  
  // 新增：根據 ID 獲取單首歌曲
  ipcMain.handle('get-song-by-id', async (_event, songId: number) => {
    const startTime = LoggerService.apiStart('IPC', 'get-song-by-id', { songId });
    try {
      const song = DatabaseService.getSongById(songId);
      await LoggerService.apiSuccess('IPC', 'get-song-by-id', { songId }, { success: !!song }, startTime);
      return song; // 返回找到的歌曲對象或 null
    } catch (error) {
      console.error(`獲取歌曲 ID ${songId} 失敗:`, error);
      await LoggerService.apiError('IPC', 'get-song-by-id', { songId }, error, startTime);
      throw error;
    }
  });
  
  // 歌詞搜尋
  ipcMain.handle('search-lyrics', async (_event, songTitle, artist) => {
    const startTime = LoggerService.apiStart('IPC', 'search-lyrics', { songTitle, artist });
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在搜尋歌詞...');
      const results = await LyricsSearchService.searchLyrics(songTitle, artist);
      mainWindow?.webContents.send('progress-update', 100, '搜尋完成');
      await LoggerService.apiSuccess('IPC', 'search-lyrics', { songTitle, artist }, { success: true }, startTime);
      return results;
    } catch (error) {
      console.error('搜尋歌詞失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '搜尋失敗');
      await LoggerService.apiError('IPC', 'search-lyrics', { songTitle, artist }, error, startTime);
      throw error;
    }
  });
  
  // 生成背景圖片
  ipcMain.handle('generate-image', async (_event, songTitle, lyrics, songId = -1) => {
    const startTime = LoggerService.apiStart('IPC', 'generate-image', { songTitle, lyricsLength: lyrics?.length, songId });
    try {
      // 檢查是否選擇了不使用AI
      const imageProvider = SettingsService.getSetting('imageGenerationProvider');
      if (imageProvider === 'none') {
        throw new Error('您已選擇不使用AI生成圖片，請使用本地圖片');
      }
      
      mainWindow?.webContents.send('progress-update', 10, '正在生成背景圖片...');
      
      // 記錄請求參數
      await LoggerService.info(`生成圖片請求: 標題=${songTitle}, 歌詞長度=${lyrics?.length || 0}, songId=${songId}, 提供商=${imageProvider}`);
      
      const result = await ImageGenerationService.generateImage(songId, songTitle, lyrics);
      
      // 從數據庫獲取生成後的 songId
      if (songId <= 0) {
        const db = DatabaseService.init();
        const query = 'SELECT id FROM songs WHERE title = ? ORDER BY created_at DESC LIMIT 1';
        const song = db.prepare(query).get(songTitle) as { id: number } | undefined;
        if (song) {
          songId = song.id;
          await LoggerService.info(`找到歌曲ID: ${songId}`);
        }
      }
      
      mainWindow?.webContents.send('progress-update', 100, '背景圖片生成完成');
      
      const response = { songId, imagePath: result };
      await LoggerService.apiSuccess('IPC', 'generate-image', { songTitle, provider: imageProvider }, response, startTime);
      
      return response;
    } catch (error: any) {
      console.error('生成背景圖片失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, `生成背景圖片失敗: ${error.message || '未知錯誤'}`);
      await LoggerService.apiError('IPC', 'generate-image', { songTitle, lyricsLength: lyrics?.length }, error, startTime);
      throw error;
    }
  });
  
  // 生成投影片
  ipcMain.handle('generate-slides', async (_event, songId, songTitle, artist, lyrics, imagePath) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在生成投影片...');
      const slidesContent = await SlideGenerationService.generateSlides(songId, songTitle, artist, lyrics, imagePath);
      mainWindow?.webContents.send('progress-update', 100, '投影片生成完成');
      return slidesContent;
    } catch (error) {
      console.error('生成投影片失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '生成投影片失敗');
      throw error;
    }
  });
  
  // 新增API監控端點
  ipcMain.handle('get-logs', async (_event, logType = 'api') => {
    try {
      const logDir = path.join(app.getPath('userData'), 'logs');
      const logDate = new Date().toISOString().split('T')[0];
      const logPath = path.join(logDir, `${logType}_${logDate}.log`);
      
      try {
        const logContent = await require('fs').promises.readFile(logPath, 'utf-8');
        return logContent;
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          return `尚無${logType}日誌記錄`;
        }
        throw err;
      }
    } catch (error: any) {
      console.error('獲取日誌失敗:', error);
      return `獲取日誌失敗: ${error.message}`;
    }
  });
  
  // 更新投影片內容
  ipcMain.handle('update-slides', async (_event, songId: number, slidesContent: string) => {
    try {
      console.log(`[IPC] 收到更新投影片內容請求，歌曲ID: ${songId}, 內容長度: ${slidesContent?.length || 0}`);
      
      if (!songId || songId <= 0) {
        console.error('[IPC] 更新投影片內容失敗: 無效的歌曲ID');
        return false;
      }
      
      if (!slidesContent) {
        console.error('[IPC] 更新投影片內容失敗: 沒有提供內容');
        return false;
      }
      
      await SlideGenerationService.updateSlides(songId, slidesContent);
      console.log(`[IPC] 成功更新歌曲ID ${songId} 的投影片內容`);
      return true;
    } catch (error) {
      console.error('[IPC] 更新投影片內容失敗:', error);
      return false;
    }
  });
  
  // 更新歌詞快取
  ipcMain.handle('update-lyrics-cache', async (_event, title, artist, lyrics, source) => {
    try {
      const startTime = LoggerService.apiStart('IPC', 'update-lyrics-cache', { title });
      mainWindow?.webContents.send('progress-update', 10, '正在更新歌詞快取...');
      
      const result = await LyricsSearchService.updateLyricsCache(title, artist, lyrics, source);
      
      mainWindow?.webContents.send('progress-update', 100, '歌詞快取更新完成');
      await LoggerService.apiSuccess('IPC', 'update-lyrics-cache', { title }, { success: result.success, songId: result.songId }, startTime);
      
      return result;
    } catch (error) {
      console.error('更新歌詞快取失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '更新歌詞快取失敗');
      await LoggerService.apiError('IPC', 'update-lyrics-cache', { title }, error, Date.now());
      throw error;
    }
  });
  
  // 添加新歌曲
  ipcMain.handle('add-new-song', async (_event, title, artist, lyrics, source) => {
    try {
      const startTime = LoggerService.apiStart('IPC', 'add-new-song', { title });
      mainWindow?.webContents.send('progress-update', 10, '正在添加新歌曲...');
      
      // 先對歌詞進行清理處理
      const cleanedLyrics = LyricsSearchService.cleanLyrics(lyrics);
      
      // 直接調用數據庫服務添加新歌曲
      const songId = DatabaseService.addSong({
        title,
        artist,
        lyrics: cleanedLyrics
      });
      
      LoggerService.info(`成功添加新歌曲: ${title}, ID: ${songId}`);
      mainWindow?.webContents.send('progress-update', 100, '新歌曲添加完成');
      await LoggerService.apiSuccess('IPC', 'add-new-song', { title }, { success: true, songId }, startTime);
      
      return songId;
    } catch (error) {
      console.error('添加新歌曲失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '添加新歌曲失敗');
      await LoggerService.apiError('IPC', 'add-new-song', { title }, error, Date.now());
      throw error;
    }
  });
  
  // 取得投影片內容
  ipcMain.handle('get-slides', async (_event, songId) => {
    try {
      return await SlideGenerationService.getSlidesFromCache(songId);
    } catch (error) {
      console.error('獲取投影片失敗:', error);
      throw error;
    }
  });
  
  // 匯出為 PDF
  ipcMain.handle('export-to-pdf', async (_event, marpContent, outputPath) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在匯出 PDF 檔案...');
      const finalPath = await SlideExportService.exportToPDF(marpContent, outputPath);
      mainWindow?.webContents.send('progress-update', 100, 'PDF 匯出完成');
      return finalPath;
    } catch (error) {
      console.error('匯出 PDF 失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '匯出 PDF 失敗');
      throw error;
    }
  });
  
  // 匯出為 PPTX
  ipcMain.handle('export-to-pptx', async (_event, marpContent, outputPath) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在匯出 PPTX 檔案...');
      const finalPath = await SlideExportService.exportToPPTX(marpContent, outputPath);
      mainWindow?.webContents.send('progress-update', 100, 'PPTX 匯出完成');
      return finalPath;
    } catch (error) {
      console.error('匯出 PPTX 失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '匯出 PPTX 失敗');
      throw error;
    }
  });
  
  // 匯出為 HTML
  ipcMain.handle('export-to-html', async (_event, marpContent, outputPath) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在匯出 HTML 檔案...');
      const finalPath = await SlideExportService.exportToHTML(marpContent, outputPath);
      mainWindow?.webContents.send('progress-update', 100, 'HTML 匯出完成');
      return finalPath;
    } catch (error) {
      console.error('匯出 HTML 失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '匯出 HTML 失敗');
      throw error;
    }
  });
  
  // 批量匯出
  ipcMain.handle('batch-export', async (_event, marpContent, formats, outputPath) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在批量匯出檔案...');
      const results = await SlideExportService.batchExport(marpContent, formats, outputPath);
      mainWindow?.webContents.send('progress-update', 100, '批量匯出完成');
      return results;
    } catch (error) {
      console.error('批量匯出失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '批量匯出失敗');
      throw error;
    }
  });
  
  // 打開已生成的文件
  ipcMain.handle('open-file', async (_event, filePath) => {
    try {
      const result = await shell.openPath(filePath);
      if (result !== '') {
        throw new Error(result);
      }
      return true;
    } catch (error) {
      console.error('打開檔案失敗:', error);
      throw error;
    }
  });
  
  // 打開包含文件的目錄
  ipcMain.handle('open-directory', async (_event, filePath) => {
    try {
      const dirPath = path.dirname(filePath);
      await shell.openPath(dirPath);
      return true;
    } catch (error) {
      console.error('打開目錄失敗:', error);
      throw error;
    }
  });
  
  // 預覽投影片
  ipcMain.handle('preview-slides', async (_event, marpContent) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在預覽投影片...');
      
      // 檢查是否有正在運行的預覽視窗
      const existingPreview = BrowserWindow.getAllWindows().find(win => 
        win.getTitle() === '投影片預覽' && !win.isDestroyed()
      );
      
      if (existingPreview) {
        // 如果已有預覽視窗，則激活它而不是創建新的
        if (existingPreview.isMinimized()) existingPreview.restore();
        existingPreview.focus();
        
        // 更新現有視窗的內容 (可選)
        mainWindow?.webContents.send('progress-update', 100, '更新現有預覽視窗內容');
        return { success: true };
      }
      
      // 使用臨時文件實現預覽
      const tempDir = path.join(app.getPath('temp'), 'lyrics-slides-preview');
      await fs.promises.mkdir(tempDir, { recursive: true });
      const tempFile = path.join(tempDir, 'preview.md');
      const tempHtmlFile = path.join(tempDir, 'preview.html');
      
      // 修復投影片內容中的圖片路徑
      const fixedMarpContent = SlideGenerationService.fixImagePathsInSlides(marpContent);
      
      // 將 Marp 內容寫入臨時檔案
      await fs.promises.writeFile(tempFile, fixedMarpContent, 'utf-8');
      
      // 使用 Marp CLI 將 Markdown 轉換為 HTML
      const isWin = process.platform === 'win32';
      const marpCliPath = path.join(process.cwd(), 'node_modules', '.bin', isWin ? 'marp.cmd' : 'marp');
      
      // 準備 Marp CLI 參數
      const marpArgs = [
        tempFile,
        '--html',
        '--allow-local-files',
        '--output',
        tempHtmlFile,
        '--theme-set',
        'default',
        '--no-stdin'
      ];
      
      // 執行 Marp CLI 轉換
      const childProcess = isWin
        ? spawn('cmd.exe', ['/c', marpCliPath, ...marpArgs], { stdio: 'pipe' })
        : spawn(marpCliPath, marpArgs, { stdio: 'pipe' });
        
      await new Promise((resolve, reject) => {
        childProcess.on('close', (code) => {
          if (code === 0) {
            resolve(null);
          } else {
            reject(new Error(`Marp CLI 退出碼: ${code}`));
          }
        });
        childProcess.on('error', reject);
      });
      
      mainWindow?.webContents.send('progress-update', 100, '投影片預覽準備完成');
      
      // 獲取主窗口（如果不存在則創建）
      let mainWin = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
      
      if (!mainWin) {
        return { success: false, error: '找不到主窗口' };
      }
      
      // 創建預覽窗口
      const previewWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        parent: mainWin,
        title: '投影片預覽',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      
      // 設置關閉時的行為
      previewWindow.on('closed', () => {
        // 釋放引用
        // 由於這是一個局部變數，GC 會自動處理
      });
      
      // 載入生成的HTML文件
      await previewWindow.loadFile(tempHtmlFile);
      
      // 如果在開發模式中，打開開發者工具
      if (isDev) {
        previewWindow.webContents.openDevTools();
      }
      
      // 返回成功狀態
      return { success: true };
    } catch (error) {
      console.error('預覽投影片失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '預覽投影片失敗');
      throw error;
    }
  });
  
  // 添加日誌監聽處理器
  ipcMain.handle('log-message', (_event, message, level = 'info') => {
    if (level === 'error') {
      console.error(message);
    } else if (level === 'warn') {
      console.warn(message);
    } else {
      console.log(message);
    }
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-message', { 
        source: 'renderer',
        message,
        level
      });
    }
    return true;
  });
  
  // 匯入本地圖片
  ipcMain.handle('import-local-image', async (_event, songId, localImagePath) => {
    const startTime = LoggerService.apiStart('IPC', 'import-local-image', { songId, localImagePath });
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在匯入本地圖片...');
      
      await LoggerService.info(`匯入本地圖片請求: songId=${songId}, localImagePath=${localImagePath}`);
      
      const imagePath = await ImageGenerationService.importLocalImage(songId, localImagePath);
      
      mainWindow?.webContents.send('progress-update', 100, '本地圖片匯入完成');
      
      // 獲取正確的songId - 因為importLocalImage可能已創建新的歌曲記錄
      const db = DatabaseService.init();
      const query = 'SELECT song_id FROM images WHERE image_path = ? ORDER BY created_at DESC LIMIT 1';
      const imageRecord = db.prepare(query).get(imagePath) as { song_id: number } | undefined;
      
      // 如果找到了image記錄，使用其song_id，否則保留原始songId
      const updatedSongId = imageRecord ? imageRecord.song_id : songId;
      await LoggerService.info(`本地圖片匯入完成，使用的歌曲ID: ${updatedSongId}`);
      
      const response = { songId: updatedSongId, imagePath };
      await LoggerService.apiSuccess('IPC', 'import-local-image', { songId: updatedSongId }, response, startTime);
      
      return response;
    } catch (error) {
      console.error('匯入本地圖片失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '匯入本地圖片失敗');
      await LoggerService.apiError('IPC', 'import-local-image', { songId, localImagePath }, error, startTime);
      throw error;
    }
  });
  
  // 選擇本地圖片
  ipcMain.handle('select-local-image', async () => {
    if (!mainWindow) return '';
    
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: '圖片檔案', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
        ]
      });
      
      if (result.canceled) {
        return '';
      } else {
        return result.filePaths[0];
      }
    } catch (error) {
      console.error('選擇本地圖片失敗:', error);
      throw error;
    }
  });
  
  // 獲取快取大小
  ipcMain.handle('get-cache-size', async () => {
    try {
      // 獲取各個快取的大小
      const imgCacheSize = await ImageGenerationService.getCacheSize();
      const slidesCacheSize = await SlideGenerationService.getCacheSize();
      const lyricsCacheSize = await LyricsSearchService.getCacheSize();
      const batchSlidesCacheSize = await BatchSlideService.getCacheSize();
      
      // 計算總大小
      const totalSizeBytes = imgCacheSize.totalSizeBytes + slidesCacheSize.totalSizeBytes + lyricsCacheSize.totalSizeBytes + batchSlidesCacheSize.totalSizeBytes;
      const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
      
      // 組合結果
      return {
        totalSize: {
          totalSizeBytes,
          totalSizeMB: `${totalSizeMB} MB`,
        },
        images: imgCacheSize,
        slides: slidesCacheSize,
        lyrics: lyricsCacheSize,
        batchSlides: batchSlidesCacheSize
      };
    } catch (error) {
      console.error('獲取快取大小失敗:', error);
      throw error;
    }
  });
  
  // 獲取系統臨時目錄路徑
  ipcMain.handle('get-temp-path', () => {
    try {
      return app.getPath('temp');
    } catch (error) {
      console.error('獲取臨時目錄路徑失敗:', error);
      throw error;
    }
  });
  
  // 清除所有快取
  ipcMain.handle('clear-cache', async () => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在清除快取...');
      
      // 清除各個快取
      const imgCacheResult = await ImageGenerationService.clearCache();
      const slidesCacheResult = await SlideGenerationService.clearCache();
      const lyricsCacheResult = await LyricsSearchService.clearCache();
      const batchSlidesCacheResult = await BatchSlideService.clearCache();
      
      // 確保所有資源關聯都被清除
      mainWindow?.webContents.send('progress-update', 90, '確保所有關聯記錄被清除...');
      DatabaseService.clearAllSongResources();
      
      // 刪除資料庫中所有投影片集
      const db = DatabaseService.init();
      const slideSetExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='slide_sets'").get();
      
      if (slideSetExists) {
        db.prepare('DELETE FROM slide_sets').run();
        console.log('資料庫中的所有投影片集已清除');
      }
      
      mainWindow?.webContents.send('progress-update', 100, '快取清除完成');
      
      // 重設焦點以解決文本輸入框問題
      mainWindow?.blur();
      setTimeout(() => mainWindow?.focus(), 100);
      
      // 組合結果
      return {
        success: imgCacheResult.success && slidesCacheResult.success && lyricsCacheResult.success && batchSlidesCacheResult.success,
        deletedImages: imgCacheResult.deletedCount,
        deletedSlides: slidesCacheResult.deletedCount,
        deletedLyrics: lyricsCacheResult.deletedCount,
        deletedBatchSlides: batchSlidesCacheResult.deletedCount
      };
    } catch (error) {
      console.error('清除快取失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '清除快取失敗');
      throw error;
    }
  });
  
  // 只清除圖片快取
  ipcMain.handle('clear-images-cache', async () => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在清除圖片快取...');
      
      // 清除圖片快取
      const imgCacheResult = await ImageGenerationService.clearCache();
      
      mainWindow?.webContents.send('progress-update', 100, '圖片快取清除完成');
      
      // 重設焦點以解決文本輸入框問題
      mainWindow?.blur();
      setTimeout(() => mainWindow?.focus(), 100);
      
      // 返回結果
      return {
        success: imgCacheResult.success,
        deletedCount: imgCacheResult.deletedCount
      };
    } catch (error) {
      console.error('清除圖片快取失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '清除圖片快取失敗');
      throw error;
    }
  });
  
  // 只清除投影片快取
  ipcMain.handle('clear-slides-cache', async () => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在清除投影片快取...');
      
      // 清除投影片快取
      const slidesCacheResult = await SlideGenerationService.clearCache();
      
      mainWindow?.webContents.send('progress-update', 100, '投影片快取清除完成');
      
      // 重設焦點以解決文本輸入框問題
      mainWindow?.blur();
      setTimeout(() => mainWindow?.focus(), 100);
      
      // 返回結果
      return {
        success: slidesCacheResult.success,
        deletedCount: slidesCacheResult.deletedCount
      };
    } catch (error) {
      console.error('清除投影片快取失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '清除投影片快取失敗');
      throw error;
    }
  });
  
  // 清除歌詞快取
  ipcMain.handle('clear-lyrics-cache', async () => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在清除歌詞快取...');
      
      // 清除歌詞快取
      const lyricsCacheResult = await LyricsSearchService.clearCache();
      
      mainWindow?.webContents.send('progress-update', 100, '歌詞快取清除完成');
      
      // 重設焦點以解決文本輸入框問題
      mainWindow?.blur();
      setTimeout(() => mainWindow?.focus(), 100);
      
      // 返回結果
      return {
        success: lyricsCacheResult.success,
        deletedCount: lyricsCacheResult.deletedCount
      };
    } catch (error) {
      console.error('清除歌詞快取失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '清除歌詞快取失敗');
      throw error;
    }
  });
  
  // 清除批次投影片快取
  ipcMain.handle('clear-batch-slides-cache', async () => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在清除投影片集快取...');
      
      // 清除批次投影片快取
      const batchSlidesCacheResult = await BatchSlideService.clearCache();
      
      // 刪除資料庫中所有投影片集
      const db = DatabaseService.init();
      const slideSetExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='slide_sets'").get();
      
      if (slideSetExists) {
        db.prepare('DELETE FROM slide_sets').run();
        console.log('資料庫中的所有投影片集已清除');
      }
      
      mainWindow?.webContents.send('progress-update', 100, '投影片集快取清除完成');
      
      // 重設焦點以解決文本輸入框問題
      mainWindow?.blur();
      setTimeout(() => mainWindow?.focus(), 100);
      
      // 返回結果
      return {
        success: batchSlidesCacheResult.success,
        deletedCount: batchSlidesCacheResult.deletedCount
      };
    } catch (error) {
      console.error('清除投影片集快取失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '清除投影片集快取失敗');
      throw error;
    }
  });

  // 檢查歌曲是否有關聯圖片
  ipcMain.handle('check-related-image', async (_event, songId: number) => {
    try {
      if (!songId || songId < 0) {
        return { hasRelatedImage: false };
      }
      
      console.log(`檢查歌曲ID ${songId} 是否有關聯圖片`);
      
      // 從關聯表中獲取圖片路徑
      const imagePath = DatabaseService.getSongResource(songId, 'image');
      
      if (!imagePath) {
        console.log(`歌曲ID ${songId} 沒有關聯圖片`);
        return { hasRelatedImage: false };
      }
      
      // 檢查文件是否存在
      try {
        await fsPromises.access(imagePath);
        console.log(`歌曲ID ${songId} 有關聯圖片: ${imagePath}`);
        return { 
          hasRelatedImage: true,
          imagePath: imagePath 
        };
      } catch (e) {
        console.log(`歌曲ID ${songId} 的關聯圖片文件不存在: ${imagePath}`);
        return { hasRelatedImage: false };
      }
    } catch (error) {
      console.error('檢查關聯圖片失敗:', error);
      return { hasRelatedImage: false };
    }
  });

  // 檢查歌曲是否有關聯投影片
  ipcMain.handle('check-related-slide', async (_event, songId: number) => {
    try {
      if (!songId || songId < 0) {
        return { hasRelatedSlide: false };
      }
      
      console.log(`檢查歌曲ID ${songId} 是否有關聯投影片`);
      
      // 從關聯表中獲取投影片路徑
      const slidePath = DatabaseService.getSongResource(songId, 'slide');
      
      if (!slidePath) {
        console.log(`歌曲ID ${songId} 沒有關聯投影片`);
        return { hasRelatedSlide: false };
      }
      
      // 檢查文件是否存在
      try {
        await fsPromises.access(slidePath);
        // 讀取檔案內容
        const slideContent = await fsPromises.readFile(slidePath, 'utf-8');
        console.log(`歌曲ID ${songId} 有關聯投影片: ${slidePath}`);
        return { 
          hasRelatedSlide: true,
          slideContent: slideContent 
        };
      } catch (e) {
        console.log(`歌曲ID ${songId} 的關聯投影片文件不存在: ${slidePath}`);
        return { hasRelatedSlide: false };
      }
    } catch (error) {
      console.error('檢查關聯投影片失敗:', error);
      return { hasRelatedSlide: false };
    }
  });

  // 儲存圖片關聯
  ipcMain.handle('save-song-image-association', async (_event, songId: number, imagePath: string) => {
    try {
      if (!songId || songId < 0 || !imagePath) {
        return { success: false, message: '無效的參數' };
      }
      
      console.log(`儲存歌曲ID ${songId} 與圖片的關聯: ${imagePath}`);
      
      // 儲存關聯
      const result = DatabaseService.saveSongResource(songId, 'image', imagePath);
      
      if (result) {
        console.log(`歌曲ID ${songId} 的圖片關聯儲存成功`);
        return { success: true, message: '圖片關聯儲存成功' };
      } else {
        console.log(`歌曲ID ${songId} 的圖片關聯儲存失敗`);
        return { success: false, message: '圖片關聯儲存失敗' };
      }
    } catch (error) {
      console.error('儲存圖片關聯失敗:', error);
      return { success: false, message: '儲存圖片關聯時發生錯誤' };
    }
  });
  
  // 儲存投影片關聯
  ipcMain.handle('save-song-slide-association', async (_event, songId: number, slideContent: string) => {
    try {
      console.log(`[IPC] 收到儲存投影片關聯請求，歌曲ID: ${songId}, 內容長度: ${slideContent?.length || 0}`);
      
      if (!songId || songId < 0 || !slideContent) {
        console.error('[IPC] 儲存投影片關聯失敗: 無效的參數');
        return { success: false, message: '無效的參數' };
      }
      
      // 將投影片內容儲存到檔案
      const slidesDir = path.join(app.getPath('userData'), 'app_cache', 'slides');
      
      // 確保目錄存在
      try {
        await fsPromises.access(slidesDir);
      } catch (e) {
        await fsPromises.mkdir(slidesDir, { recursive: true });
      }
      
      // 儲存檔案
      const slideFilePath = path.join(slidesDir, `${songId}.md`);
      await fsPromises.writeFile(slideFilePath, slideContent, 'utf-8');
      console.log(`[IPC] 已將投影片內容寫入檔案: ${slideFilePath}`);
      
      // 儲存關聯
      const result = DatabaseService.saveSongResource(songId, 'slide', slideFilePath);
      
      if (result) {
        console.log(`[IPC] 歌曲ID ${songId} 的投影片關聯儲存成功`);
        return { success: true, message: '投影片關聯儲存成功' };
      } else {
        console.error(`[IPC] 歌曲ID ${songId} 的投影片關聯儲存失敗`);
        return { success: false, message: '投影片關聯儲存失敗' };
      }
    } catch (error) {
      console.error('[IPC] 儲存投影片關聯失敗:', error);
      return { success: false, message: '儲存投影片關聯時發生錯誤' };
    }
  });
  
  // 投影片集相關操作 =========================================
  
  // 創建投影片集
  ipcMain.handle('create-slide-set', async (_event, name: string) => {
    try {
      const startTime = LoggerService.apiStart('IPC', 'create-slide-set', { name });
      
      const slideSetId = DatabaseService.createSlideSet(name);
      
      await LoggerService.apiSuccess('IPC', 'create-slide-set', { name }, { slideSetId }, startTime);
      return slideSetId;
    } catch (error) {
      console.error('創建投影片集失敗:', error);
      await LoggerService.apiError('IPC', 'create-slide-set', { name: name }, error, Date.now());
      throw error;
    }
  });
  
  // 獲取所有投影片集
  ipcMain.handle('get-slide-sets', async () => {
    try {
      const startTime = LoggerService.apiStart('IPC', 'get-slide-sets', {});
      
      const slideSets = DatabaseService.getSlideSets();
      
      await LoggerService.apiSuccess('IPC', 'get-slide-sets', {}, { slideSetCount: slideSets.length }, startTime);
      return slideSets;
    } catch (error) {
      console.error('獲取投影片集失敗:', error);
      await LoggerService.apiError('IPC', 'get-slide-sets', {}, error, Date.now());
      throw error;
    }
  });
  
  // 獲取投影片集中的歌曲
  ipcMain.handle('get-slide-set-songs', async (_event, slideSetId: number) => {
    try {
      const startTime = LoggerService.apiStart('IPC', 'get-slide-set-songs', { slideSetId });
      
      const songs = DatabaseService.getSlideSetSongs(slideSetId);
      
      await LoggerService.apiSuccess('IPC', 'get-slide-set-songs', { slideSetId }, { songCount: songs.length }, startTime);
      return songs;
    } catch (error) {
      console.error('獲取投影片集歌曲失敗:', error);
      await LoggerService.apiError('IPC', 'get-slide-set-songs', { slideSetId }, error, Date.now());
      throw error;
    }
  });
  
  // 添加歌曲到投影片集
  ipcMain.handle('add-song-to-slide-set', async (_event, slideSetId: number, songId: number, displayOrder: number) => {
    try {
      const startTime = LoggerService.apiStart('IPC', 'add-song-to-slide-set', { slideSetId, songId, displayOrder });
      
      const result = DatabaseService.addSongToSlideSet(slideSetId, songId, displayOrder);
      
      await LoggerService.apiSuccess('IPC', 'add-song-to-slide-set', { slideSetId, songId, displayOrder }, { success: result }, startTime);
      return result;
    } catch (error) {
      console.error('添加歌曲到投影片集失敗:', error);
      await LoggerService.apiError('IPC', 'add-song-to-slide-set', { slideSetId, songId, displayOrder }, error, Date.now());
      throw error;
    }
  });
  
  // 從投影片集移除歌曲
  ipcMain.handle('remove-song-from-slide-set', async (_event, slideSetId: number, songId: number) => {
    try {
      const startTime = LoggerService.apiStart('IPC', 'remove-song-from-slide-set', { slideSetId, songId });
      
      const result = DatabaseService.removeSongFromSlideSet(slideSetId, songId);
      
      await LoggerService.apiSuccess('IPC', 'remove-song-from-slide-set', { slideSetId, songId }, { success: result }, startTime);
      return result;
    } catch (error) {
      console.error('從投影片集移除歌曲失敗:', error);
      await LoggerService.apiError('IPC', 'remove-song-from-slide-set', { slideSetId, songId }, error, Date.now());
      throw error;
    }
  });
  
  // 更新歌曲在投影片集中的順序
  ipcMain.handle('update-song-order-in-slide-set', async (_event, slideSetId: number, songId: number, newOrder: number) => {
    try {
      const startTime = LoggerService.apiStart('IPC', 'update-song-order-in-slide-set', { slideSetId, songId, newOrder });
      
      const result = DatabaseService.updateSongOrderInSlideSet(slideSetId, songId, newOrder);
      
      await LoggerService.apiSuccess('IPC', 'update-song-order-in-slide-set', { slideSetId, songId, newOrder }, { success: result }, startTime);
      return result;
    } catch (error) {
      console.error('更新歌曲順序失敗:', error);
      await LoggerService.apiError('IPC', 'update-song-order-in-slide-set', { slideSetId, songId, newOrder }, error, Date.now());
      throw error;
    }
  });
  
  // 刪除投影片集
  ipcMain.handle('delete-slide-set', async (_event, slideSetId: number) => {
    try {
      const startTime = LoggerService.apiStart('IPC', 'delete-slide-set', { slideSetId });
      
      const result = DatabaseService.deleteSlideSet(slideSetId);
      
      await LoggerService.apiSuccess('IPC', 'delete-slide-set', { slideSetId }, { success: result }, startTime);
      return result;
    } catch (error) {
      console.error('刪除投影片集失敗:', error);
      await LoggerService.apiError('IPC', 'delete-slide-set', { slideSetId }, error, Date.now());
      throw error;
    }
  });
  
  // 更新投影片集名稱
  ipcMain.handle('update-slide-set-name', async (_event, slideSetId: number, newName: string) => {
    try {
      const startTime = LoggerService.apiStart('IPC', 'update-slide-set-name', { slideSetId, newName });
      
      const result = DatabaseService.updateSlideSetName(slideSetId, newName);
      
      await LoggerService.apiSuccess('IPC', 'update-slide-set-name', { slideSetId, newName }, { success: result }, startTime);
      return result;
    } catch (error) {
      console.error('更新投影片集名稱失敗:', error);
      await LoggerService.apiError('IPC', 'update-slide-set-name', { slideSetId, newName }, error, Date.now());
      throw error;
    }
  });
  
  // 批次處理相關操作 =========================================
  
  // 生成批次投影片
  ipcMain.handle('generate-batch-slides', async (_event, slideSetId: number) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在生成批次投影片...');
      
      const slidesContent = await BatchSlideService.generateBatchSlides(slideSetId);
      
      mainWindow?.webContents.send('progress-update', 100, '批次投影片生成完成');
      return slidesContent;
    } catch (error) {
      console.error('生成批次投影片失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '生成批次投影片失敗');
      throw error;
    }
  });
  
  // 獲取批次投影片內容
  ipcMain.handle('get-batch-slide-content', async (_event, slideSetId: number) => {
    try {
      return await BatchSlideService.getBatchSlideContent(slideSetId);
    } catch (error) {
      console.error('獲取批次投影片內容失敗:', error);
      throw error;
    }
  });
  
  // 更新批次投影片內容
  ipcMain.handle('update-batch-slide-content', async (_event, slideSetId: number, slidesContent: string) => {
    try {
      const result = await BatchSlideService.updateBatchSlideContent(slideSetId, slidesContent);
      return result;
    } catch (error) {
      console.error('更新批次投影片內容失敗:', error);
      throw error;
    }
  });
  
  // 預覽批次投影片
  ipcMain.handle('preview-batch-slides', async (_event, slideSetId: number) => {
    try {
      // 檢查是否有正在運行的批次預覽視窗
      const existingPreview = BrowserWindow.getAllWindows().find(win => 
        win.getTitle() === '批次投影片預覽' && !win.isDestroyed()
      );
      
      if (existingPreview) {
        // 如果已有預覽視窗，則激活它而不是創建新的
        if (existingPreview.isMinimized()) existingPreview.restore();
        existingPreview.focus();
        
        // 可以選擇重新生成內容
        return;
      }
      
      const slidesContent = await BatchSlideService.getBatchSlideContent(slideSetId);
      
      // 將批次投影片暫存為臨時文件，以便預覽
      const tempDir = path.join(app.getPath('temp'), 'lyrics-slides-preview');
      
      // 確保臨時目錄存在
      try {
        await fsPromises.access(tempDir);
      } catch (e) {
        await fsPromises.mkdir(tempDir, { recursive: true });
      }
      
      const tempFile = path.join(tempDir, 'batch_preview.md');
      const tempHtmlFile = path.join(tempDir, 'batch_preview.html');
      
      // 修復投影片內容中的圖片路徑
      const fixedMarpContent = SlideGenerationService.fixImagePathsInSlides(slidesContent);
      
      // 將 Marp 內容寫入臨時檔案
      await fsPromises.writeFile(tempFile, fixedMarpContent, 'utf-8');
      
      // 使用 Marp CLI 將 Markdown 轉換為 HTML
      const isWin = process.platform === 'win32';
      const marpCliPath = path.join(process.cwd(), 'node_modules', '.bin', isWin ? 'marp.cmd' : 'marp');
      
      // 準備 Marp CLI 參數
      const marpArgs = [
        tempFile,
        '--html',
        '--allow-local-files',
        '--output',
        tempHtmlFile,
        '--theme-set',
        'default',
        '--no-stdin'
      ];
      
      // 執行 Marp CLI 轉換
      const childProcess = isWin
        ? spawn('cmd.exe', ['/c', marpCliPath, ...marpArgs], { stdio: 'pipe' })
        : spawn(marpCliPath, marpArgs, { stdio: 'pipe' });
        
      await new Promise((resolve, reject) => {
        childProcess.on('close', (code) => {
          if (code === 0) {
            resolve(null);
          } else {
            reject(new Error(`Marp CLI 退出碼: ${code}`));
          }
        });
        childProcess.on('error', reject);
      });
      
      // 獲取主窗口（如果不存在則創建）
      let mainWin = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
      
      if (!mainWin) {
        // 如果找不到窗口，則返回錯誤
        return;
      }
      
      // 創建預覽窗口
      const previewWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        parent: mainWin,
        title: '批次投影片預覽',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      
      // 設置關閉時的行為
      previewWindow.on('closed', () => {
        // 釋放引用
        // 由於這是一個局部變數，GC 會自動處理
      });
      
      // 載入生成的HTML文件
      await previewWindow.loadFile(tempHtmlFile);
      
      // 如果在開發模式中，打開開發者工具
      if (isDev) {
        previewWindow.webContents.openDevTools();
      }
      
      return;
    } catch (error) {
      console.error('預覽批次投影片失敗:', error);
      throw error;
    }
  });
  
  // 導出批次投影片
  ipcMain.handle('export-batch-slides', async (_event, slideSetId: number, outputPath: string, format: string) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, `正在導出批次投影片為 ${format.toUpperCase()}...`);
      
      const slidesContent = await BatchSlideService.getBatchSlideContent(slideSetId);
      
      let exportedPath = '';
      
      switch (format.toLowerCase()) {
        case 'pdf':
          exportedPath = await SlideExportService.exportToPDF(slidesContent, outputPath);
          break;
        case 'pptx':
          exportedPath = await SlideExportService.exportToPPTX(slidesContent, outputPath);
          break;
        case 'html':
          exportedPath = await SlideExportService.exportToHTML(slidesContent, outputPath);
          break;
        default:
          throw new Error(`不支持的導出格式: ${format}`);
      }
      
      mainWindow?.webContents.send('progress-update', 100, '導出完成');
      return exportedPath;
    } catch (error) {
      console.error('導出批次投影片失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '導出失敗');
      throw error;
    }
  });

  // 儲存歌曲詳情
  ipcMain.handle('save-song-details', async (_event, songId: number, songDetails: { 
    title: string, 
    artist?: string, 
    lyrics?: string, 
    imageUrl?: string,
    textColor?: string,
    strokeColor?: string,
    strokeSize?: number,
    fontWeight?: string
  }) => {
    const startTime = LoggerService.apiStart('IPC', 'save-song-details', { songId, songDetails });
    try {
      await LoggerService.info(`儲存歌曲詳情請求: songId=${songId}, Details: ${JSON.stringify(songDetails)}`);
      
      // 清理歌詞（如果存在）
      const cleanedLyrics = songDetails.lyrics ? LyricsSearchService.cleanLyrics(songDetails.lyrics) : undefined;
      
      // 準備更新的數據
      const dataToUpdate: Partial<Song> = {
        title: songDetails.title,
        artist: songDetails.artist,
        lyrics: cleanedLyrics,
        imageUrl: songDetails.imageUrl,
        textColor: songDetails.textColor,
        strokeColor: songDetails.strokeColor,
        strokeSize: songDetails.strokeSize,
        fontWeight: songDetails.fontWeight
      };
      
      // 過濾掉 undefined 的值，避免覆蓋資料庫中的現有值
      (Object.keys(dataToUpdate) as Array<keyof typeof dataToUpdate>).forEach(key => {
        if (dataToUpdate[key] === undefined) {
          delete dataToUpdate[key];
        }
      });
      
      const success = DatabaseService.updateSong(songId, dataToUpdate);
      
      if (success) {
        await LoggerService.apiSuccess('IPC', 'save-song-details', { songId }, { success: true }, startTime);
        return { success: true };
      } else {
        throw new Error('更新歌曲到資料庫失敗');
      }
    } catch (error) {
      console.error('儲存歌曲詳情失敗:', error);
      await LoggerService.apiError('IPC', 'save-song-details', { songId, songDetails }, error, startTime);
      return { success: false };
    }
  });

  // 新增：手動清理所有歌詞
  // ipcMain.handle('clean-all-lyrics', async () => {
  //   try {
  //     await cleanAllExistingLyrics();
  //     return { success: true };
  //   } catch (error) {
  //     console.error('手動清理歌詞數據失敗:', error);
  //     await LoggerService.error('手動清理歌詞數據失敗', error);
  //     return { success: false, error: String(error) };
  //   }
  // });

  // 清除AI服務緩存
  ipcMain.handle('clear-ai-services-cache', async () => {
    try {
      // 引入AIServiceFactory
      const { AIServiceFactory } = require('./services/aiService');
      
      // 清除服務緩存
      AIServiceFactory.clearServices();
      
      console.log('AI服務緩存已清除');
      return { success: true };
    } catch (error) {
      console.error('清除AI服務緩存失敗:', error);
      return { success: false, error: (error as Error).message };
    }
  });
}

// 初始化應用所需的所有目錄結構
async function initAppDirectories() {
  const userDataPath = app.getPath('userData');
  
  try {
    await LoggerService.info('開始初始化應用目錄結構');
  } catch (error) {
    console.error('記錄初始化開始訊息失敗:', error);
  }
  
  // 需要確儲存在的目錄列表
  const directories = [
    // 快取目錄 - 使用 app_cache 而非 cache 以避免與 Electron 內部快取機制衝突
    path.join(userDataPath, 'app_cache'),
    path.join(userDataPath, 'app_cache', 'images'),
    path.join(userDataPath, 'app_cache', 'slides'),
    path.join(userDataPath, 'app_cache', 'lyrics'),
    // 日誌目錄
    path.join(userDataPath, 'logs'),
    // 導出文件目錄
    path.join(userDataPath, 'exports')
  ];
  
  // 檢查並創建所有目錄
  for (const dir of directories) {
    try {
      // 先檢查目錄是否存在
      try {
        await fsPromises.access(dir);
        console.log(`目錄已存在: ${dir}`);
      } catch (e) {
        // 目錄不存在，創建它
        await fsPromises.mkdir(dir, { recursive: true });
        console.log(`目錄創建成功: ${dir}`);
      }
    } catch (error) {
      console.error(`無法創建或訪問目錄 ${dir}:`, error);
    }
  }
  
  try {
    await LoggerService.info(`初始化應用目錄結構完成，確保了 ${directories.length} 個目錄存在`);
  } catch (error) {
    console.error('記錄初始化完成訊息失敗:', error);
  }
}

// 匯入舊設定時，確保轉換為新格式
const getSettings = (): Settings => {
  const settings = SettingsService.getSettings();
  
  // 如果是舊格式的設定，轉換為新格式
  if (!settings.lyricsSearchModel || !settings.promptGenerationModel || !settings.imageGenerationModel) {
    const newSettings: Settings = {
      ...settings,
      lyricsSearchModel: {
        openai: (settings as any).openaiModel || 'gpt-4o',
        gemini: (settings as any).geminiModel || 'gemini-2.5-pro-exp-03-25',
        grok: (settings as any).grokModel || 'grok-3-beta',
        anthropic: (settings as any).anthropicModel || 'claude-3-7-sonnet-20250219'
      },
      promptGenerationModel: {
        openai: (settings as any).openaiModel || 'gpt-4o',
        gemini: (settings as any).geminiModel || 'gemini-2.5-pro-exp-03-25',
        grok: (settings as any).grokModel || 'grok-3-beta',
        anthropic: (settings as any).anthropicModel || 'claude-3-7-sonnet-20250219'
      },
      imageGenerationModel: {
        openai: (settings as any).openaiModel || 'dall-e-3',
        gemini: 'gemini-2.0-flash-exp-image-generation',
        grok: 'grok-2-image-1212'
      }
    };
    
    // 刪除舊的設定項
    delete (newSettings as any).openaiModel;
    delete (newSettings as any).geminiModel;
    delete (newSettings as any).grokModel;
    delete (newSettings as any).anthropicModel;
    
    // 儲存新格式的設定
    SettingsService.saveSettings(newSettings);
    return newSettings;
  }
  
  return settings;
};

// 在這裡可以添加 IPC 事件監聽器，用於主進程與渲染進程通信
// 例如:
// ipcMain.handle('get-app-version', () => app.getVersion()); 