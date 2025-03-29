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

// 開發模式標誌
const isDev = process.env.NODE_ENV === 'development';

// 保持對 window 對象的全局引用，避免被 JavaScript 垃圾回收機制回收
let mainWindow: BrowserWindow | null = null;

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
  const rendererPath = path.join(__dirname, '../../src/renderer/index.html');
  mainWindow.loadFile(rendererPath);
  
  // 開發環境下打開開發者工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 當窗口關閉時觸發
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 應用程序準備就緒時創建窗口
app.whenReady().then(() => {
  // 初始化數據庫
  DatabaseService.init();
  
  // 設置 IPC 處理器
  setupIpcHandlers();
  
  createWindow();

  // 在 macOS 中，當點擊 dock 圖標且沒有其他窗口打開時，通常會重新創建一個窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 當所有窗口關閉時退出應用，除了在 macOS 中
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 應用退出時關閉數據庫連接
app.on('quit', () => {
  DatabaseService.close();
});

// 設置 IPC 處理器
function setupIpcHandlers() {
  // 獲取應用版本
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
  
  // 獲取設定
  ipcMain.handle('get-settings', () => {
    return SettingsService.getSettings();
  });
  
  // 保存設定
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
  
  // 歌詞搜尋
  ipcMain.handle('search-lyrics', async (_event, songTitle, artist) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在搜尋歌詞...');
      const results = await LyricsSearchService.searchLyrics(songTitle, artist);
      mainWindow?.webContents.send('progress-update', 100, '搜尋完成');
      return results;
    } catch (error) {
      console.error('搜尋歌詞失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '搜尋失敗');
      throw error;
    }
  });
  
  // 生成背景圖片
  ipcMain.handle('generate-image', async (_event, songId, songTitle, lyrics) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在生成背景圖片...');
      const imagePath = await ImageGenerationService.generateImage(songId, songTitle, lyrics);
      mainWindow?.webContents.send('progress-update', 100, '背景圖片生成完成');
      return imagePath;
    } catch (error) {
      console.error('生成背景圖片失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '生成背景圖片失敗');
      throw error;
    }
  });
  
  // 重新生成背景圖片
  ipcMain.handle('regenerate-image', async (_event, songId, songTitle, lyrics) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在重新生成背景圖片...');
      const imagePath = await ImageGenerationService.regenerateImage(songId, songTitle, lyrics);
      mainWindow?.webContents.send('progress-update', 100, '背景圖片生成完成');
      return imagePath;
    } catch (error) {
      console.error('重新生成背景圖片失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '重新生成背景圖片失敗');
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
  
  // 更新投影片內容
  ipcMain.handle('update-slides', async (_event, songId, slidesContent) => {
    try {
      mainWindow?.webContents.send('progress-update', 10, '正在更新投影片...');
      await SlideGenerationService.updateSlides(songId, slidesContent);
      mainWindow?.webContents.send('progress-update', 100, '投影片更新完成');
      return true;
    } catch (error) {
      console.error('更新投影片失敗:', error);
      mainWindow?.webContents.send('progress-update', 0, '更新投影片失敗');
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
  
  // 在此添加更多 IPC 處理器...
}

// 在這裡可以添加 IPC 事件監聽器，用於主進程與渲染進程通信
// 例如:
// ipcMain.handle('get-app-version', () => app.getVersion()); 