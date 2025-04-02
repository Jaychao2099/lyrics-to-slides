/// <reference types="electron" />
/// <reference types="node" />

import { contextBridge, ipcRenderer } from 'electron';

// 定義 ElectronAPI 接口以支持 TypeScript 檢查
interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  searchLyrics: (songTitle: string, artist: string) => Promise<any>;
  generateImage: (songTitle: string, lyrics: string, songId?: number) => Promise<{songId: number, imagePath: string}>;
  regenerateImage: (songId: number, songTitle: string, lyrics: string) => Promise<{songId: number, imagePath: string}>;
  generateSlides: (songId: number, songTitle: string, artist: string, lyrics: string, imagePath: string) => Promise<string>;
  updateSlides: (songId: number, slidesContent: string) => Promise<boolean>;
  getSlides: (songId: number) => Promise<string>;
  previewSlides: (marpContent: string) => Promise<string>;
  exportToPDF: (marpContent: string, outputPath: string) => Promise<string>;
  exportToPPTX: (marpContent: string, outputPath: string) => Promise<string>;
  exportToHTML: (marpContent: string, outputPath: string) => Promise<string>;
  batchExport: (marpContent: string, formats: string[], outputPath: string) => Promise<string[]>;
  getSettings: () => Promise<any>;
  getDefaultSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<boolean>;
  selectDirectory: () => Promise<string>;
  getSongs: () => Promise<any[]>;
  openFile: (filePath: string) => Promise<boolean>;
  openDirectory: (filePath: string) => Promise<boolean>;
  onProgressUpdate: (callback: (progress: number, status: string) => void) => (() => void);
  getLogs: (logType?: string) => Promise<string>;
  onMainProcessLog: (callback: (log: {source: string, message: string, level: string}) => void) => (() => void);
  selectLocalImage: () => Promise<string>;
  importLocalImage: (songId: number, localImagePath: string) => Promise<{songId: number, imagePath: string}>;
  getCacheSize: () => Promise<any>;
  clearCache: () => Promise<any>;
  updateLyricsCache: (title: string, artist: string, lyrics: string, source: string) => Promise<boolean>;
  addNewSong: (title: string, artist: string, lyrics: string, source: string) => Promise<boolean>;
}

// 暴露給渲染進程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 獲取應用版本
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // 歌詞搜尋
  searchLyrics: (songTitle: string, artist: string) => 
    ipcRenderer.invoke('search-lyrics', songTitle, artist),
  
  // 圖片生成
  generateImage: (songTitle: string, lyrics: string, songId?: number) => 
    ipcRenderer.invoke('generate-image', songTitle, lyrics, songId),
  
  // 重新生成圖片
  regenerateImage: (songId: number, songTitle: string, lyrics: string) => 
    ipcRenderer.invoke('regenerate-image', songId, songTitle, lyrics),
  
  // 投影片生成
  generateSlides: (songId: number, songTitle: string, artist: string, lyrics: string, imagePath: string) => 
    ipcRenderer.invoke('generate-slides', songId, songTitle, artist, lyrics, imagePath),
  
  // 更新投影片內容
  updateSlides: (songId: number, slidesContent: string) => 
    ipcRenderer.invoke('update-slides', songId, slidesContent),
  
  // 取得投影片內容
  getSlides: (songId: number) => 
    ipcRenderer.invoke('get-slides', songId),
  
  // 投影片預覽
  previewSlides: (marpContent: string) => 
    ipcRenderer.invoke('preview-slides', marpContent),
  
  // 投影片匯出為 PDF
  exportToPDF: (marpContent: string, outputPath: string) => 
    ipcRenderer.invoke('export-to-pdf', marpContent, outputPath),
  
  // 投影片匯出為 PPTX 
  exportToPPTX: (marpContent: string, outputPath: string) => 
    ipcRenderer.invoke('export-to-pptx', marpContent, outputPath),
  
  // 投影片匯出為 HTML
  exportToHTML: (marpContent: string, outputPath: string) => 
    ipcRenderer.invoke('export-to-html', marpContent, outputPath),
  
  // 批量匯出投影片
  batchExport: (marpContent: string, formats: string[], outputPath: string) => 
    ipcRenderer.invoke('batch-export', marpContent, formats, outputPath),
  
  // 取得設定
  getSettings: () => ipcRenderer.invoke('get-settings'),
  
  // 取得默認設定
  getDefaultSettings: () => ipcRenderer.invoke('get-default-settings'),
  
  // 儲存設定
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  
  // 選擇目錄
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // 取得歌曲列表
  getSongs: () => ipcRenderer.invoke('get-songs'),
  
  // 更新歌詞緩存
  updateLyricsCache: (title: string, artist: string, lyrics: string, source: string) => 
    ipcRenderer.invoke('update-lyrics-cache', title, artist, lyrics, source),
  
  // 添加新歌曲
  addNewSong: (title: string, artist: string, lyrics: string, source: string) => 
    ipcRenderer.invoke('add-new-song', title, artist, lyrics, source),
  
  // 打開文件
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  
  // 打開目錄
  openDirectory: (filePath: string) => ipcRenderer.invoke('open-directory', filePath),
  
  // 選擇本地圖片
  selectLocalImage: () => ipcRenderer.invoke('select-local-image'),
  
  // 匯入本地圖片
  importLocalImage: (songId: number, localImagePath: string) => 
    ipcRenderer.invoke('import-local-image', songId, localImagePath),
  
  // 獲取緩存大小
  getCacheSize: () => ipcRenderer.invoke('get-cache-size'),
  
  // 清除緩存
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  
  // 監聽進度更新
  onProgressUpdate: (callback: (progress: number, status: string) => void) => {
    const listener = (_event: any, progress: number, status: string) => callback(progress, status);
    ipcRenderer.on('progress-update', listener);
    return () => {
      ipcRenderer.removeListener('progress-update', listener);
    };
  },
  
  // 取得日誌
  getLogs: (logType: string = 'api') => 
    ipcRenderer.invoke('get-logs', logType),
    
  // 監聽主進程日誌
  onMainProcessLog: (callback: (log: {source: string, message: string, level: string}) => void) => {
    const listener = (_event: any, log: {source: string, message: string, level: string}) => callback(log);
    ipcRenderer.on('main-process-log', listener);
    return () => {
      ipcRenderer.removeListener('main-process-log', listener);
    };
  }
} as ElectronAPI); 