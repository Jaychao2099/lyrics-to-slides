/// <reference types="electron" />
/// <reference types="node" />

import { contextBridge, ipcRenderer } from 'electron';

// 定義 ElectronAPI 接口以支持 TypeScript 檢查
interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  searchLyrics: (songTitle: string, artist: string) => Promise<any>;
  generateImage: (songTitle: string, lyrics: string, songId?: number) => Promise<{songId: number, imagePath: string}>;
  generateSlides: (songId: number, songTitle: string, artist: string, lyrics: string, imagePath: string) => Promise<string>;
  updateSlides: (songId: number, slidesContent: string) => Promise<boolean>;
  getSlides: (songId: number) => Promise<string>;
  previewSlides: (marpContent: string) => Promise<{success: boolean}>;
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
  clearImagesCache: () => Promise<any>;
  clearSlidesCache: () => Promise<any>;
  clearLyricsCache: () => Promise<any>;
  updateLyricsCache: (title: string, artist: string, lyrics: string, source: string) => Promise<{success: boolean, songId: number}>;
  addNewSong: (title: string, artist: string, lyrics: string, source: string) => Promise<boolean>;
  checkRelatedImage: (songId: number) => Promise<RelatedImageResult>;
  checkRelatedSlide: (songId: number) => Promise<RelatedSlideResult>;
  saveSongImageAssociation: (songId: number, imagePath: string) => Promise<{success: boolean, message: string}>;
  saveSongSlideAssociation: (songId: number, slideContent: string) => Promise<{success: boolean, message: string}>;
  saveSongDetails: (songId: number, songDetails: { 
    title: string, 
    artist?: string, 
    lyrics?: string, 
    imageUrl?: string,
    textColor?: string,
    strokeColor?: string,
    strokeSize?: number,
    fontWeight?: string 
  }) => Promise<{success: boolean}>;
  getSongById: (songId: number) => Promise<any>;
  getTempPath: () => Promise<string>;
}

// 定義返回類型
interface RelatedImageResult {
  hasRelatedImage: boolean;
  imagePath?: string;
}

interface RelatedSlideResult {
  hasRelatedSlide: boolean;
  slideContent?: string;
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
  
  // 新增：根據 ID 獲取單首歌曲
  getSongById: (songId: number) => ipcRenderer.invoke('get-song-by-id', songId),
  
  // 更新歌詞快取
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
  
  // 新增：儲存歌曲詳情
  saveSongDetails: (songId: number, songDetails: { 
    title: string, 
    artist?: string, 
    lyrics?: string, 
    imageUrl?: string,
    textColor?: string,
    strokeColor?: string,
    strokeSize?: number,
    fontWeight?: string 
  }) => ipcRenderer.invoke('save-song-details', songId, songDetails),
  
  // 獲取快取大小
  getCacheSize: () => ipcRenderer.invoke('get-cache-size'),
  
  // 清除所有快取
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  
  // 清除圖片快取
  clearImagesCache: () => ipcRenderer.invoke('clear-images-cache'),
  
  // 清除投影片快取
  clearSlidesCache: () => ipcRenderer.invoke('clear-slides-cache'),
  
  // 清除歌詞快取
  clearLyricsCache: () => ipcRenderer.invoke('clear-lyrics-cache'),
  
  // 清除批次投影片快取
  clearBatchSlidesCache: () => ipcRenderer.invoke('clear-batch-slides-cache'),
  
  // 監聽進度更新
  onProgressUpdate: (callback: (progress: number, status: string) => void) => {
    const listener = (_event: any, progress: number, status: string) => callback(progress, status);
    ipcRenderer.on('progress-update', listener);
    return () => {
      ipcRenderer.removeListener('progress-update', listener);
    };
  },
  
  // 取得日誌
  getLogs: (logType?: string) => 
    ipcRenderer.invoke('get-logs', logType),
    
  // 監聽主進程日誌
  onMainProcessLog: (callback: (log: {source: string, message: string, level: string}) => void) => {
    const listener = (_event: any, log: {source: string, message: string, level: string}) => callback(log);
    ipcRenderer.on('main-process-log', listener);
    return () => {
      ipcRenderer.removeListener('main-process-log', listener);
    };
  },
  
  // 檢查歌曲是否有關聯圖片
  checkRelatedImage: (songId: number) => ipcRenderer.invoke('check-related-image', songId),
  
  // 檢查歌曲是否有關聯投影片  
  checkRelatedSlide: (songId: number) => ipcRenderer.invoke('check-related-slide', songId),
  
  // 儲存歌曲與圖片的關聯
  saveSongImageAssociation: (songId: number, imagePath: string) => 
    ipcRenderer.invoke('save-song-image-association', songId, imagePath),
    
  // 儲存歌曲與投影片的關聯
  saveSongSlideAssociation: (songId: number, slideContent: string) => 
    ipcRenderer.invoke('save-song-slide-association', songId, slideContent),
  
  // 投影片集管理
  createSlideSet: (name: string) => ipcRenderer.invoke('create-slide-set', name),
  getSlideSets: () => ipcRenderer.invoke('get-slide-sets'),
  getSlideSetSongs: (slideSetId: number) => ipcRenderer.invoke('get-slide-set-songs', slideSetId),
  addSongToSlideSet: (slideSetId: number, songId: number, displayOrder: number) => ipcRenderer.invoke('add-song-to-slide-set', slideSetId, songId, displayOrder),
  removeSongFromSlideSet: (slideSetId: number, songId: number) => ipcRenderer.invoke('remove-song-from-slide-set', slideSetId, songId),
  updateSongOrderInSlideSet: (slideSetId: number, songId: number, newOrder: number) => ipcRenderer.invoke('update-song-order-in-slide-set', slideSetId, songId, newOrder),
  deleteSlideSet: (slideSetId: number) => ipcRenderer.invoke('delete-slide-set', slideSetId),
  updateSlideSetName: (slideSetId: number, newName: string) => ipcRenderer.invoke('update-slide-set-name', slideSetId, newName),
  
  // 批次處理
  generateBatchSlides: (slideSetId: number) => ipcRenderer.invoke('generate-batch-slides', slideSetId),
  previewBatchSlides: (slideSetId: number) => ipcRenderer.invoke('preview-batch-slides', slideSetId),
  getBatchSlideContent: (slideSetId: number) => ipcRenderer.invoke('get-batch-slide-content', slideSetId),
  updateBatchSlideContent: (slideSetId: number, slidesContent: string) => ipcRenderer.invoke('update-batch-slide-content', slideSetId, slidesContent),
  exportBatchSlides: (slideSetId: number, outputPath: string, format: string) => ipcRenderer.invoke('export-batch-slides', slideSetId, outputPath, format),
  
  // 新增：獲取系統臨時目錄路徑
  getTempPath: () => ipcRenderer.invoke('get-temp-path'),
} as ElectronAPI); 