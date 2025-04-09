// 設定類型
export interface Settings {
  // API 密鑰
  googleApiKey: string;
  googleSearchEngineId: string;
  openaiApiKey: string;

  // 輸出設定
  defaultOutputDirectory: string;
  defaultExportFormat: 'pdf' | 'pptx' | 'html';

  // 文件模板
  imagePromptTemplate: string;
  customMarpHeader: string; // 新增: 自定義 Marp 標頭

  // 界面設定
  language: 'zh-TW' | 'zh-CN' | 'en';
  theme: 'light' | 'dark' | 'system';
}

// 歌曲類型
export interface Song {
  id: number;
  title: string;
  artist: string;
  lyrics: string;
  imageUrl?: string;
  slideContent?: string;
  textColor?: string;
  strokeColor?: string;
  strokeSize?: number;
  createdAt: string;
  updatedAt: string;
}

// 投影片集類型
export interface SlideSet {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  songCount?: number; // 前端展示用
}

// 投影片集歌曲關聯類型
export interface SlideSetSong {
  id: number;
  slideSetId: number;
  songId: number;
  displayOrder: number;
  song?: Song; // 關聯的完整歌曲信息
}

// 歌詞搜尋結果
export interface LyricsSearchResult {
  title: string;
  artist: string;
  lyrics: string;
  source: string;
  isEdited?: boolean;
  isNew?: boolean;     // 標記是否為新建的歌曲
  fromCache?: boolean; // 標記是否來自快取
  fromApi?: boolean;   // 標記是否來自API搜尋
  songId?: number;     // 歌曲ID
}

// 生成狀態
export interface GenerationStatus {
  progress: number;  // 0-100
  status: string;
}

// 檢查關聯圖片結果
export interface RelatedImageResult {
  hasRelatedImage: boolean;
  imagePath?: string;
}

// 檢查關聯投影片結果
export interface RelatedSlideResult {
  hasRelatedSlide: boolean;
  slideContent?: string;
}

// 預加載 API 類型定義
export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  searchLyrics: (songTitle: string, artist: string) => Promise<LyricsSearchResult[]>;
  generateImage: (songTitle: string, lyrics: string, songId?: number) => Promise<{songId: number, imagePath: string}>;
  generateSlides: (songId: number, songTitle: string, artist: string, lyrics: string, imagePath: string) => Promise<string>;
  updateSlides: (songId: number, slidesContent: string) => Promise<boolean>;
  getSlides: (songId: number) => Promise<string>;
  previewSlides: (marpContent: string) => Promise<void>;
  exportToPDF: (marpContent: string, outputPath: string) => Promise<string>;
  exportToPPTX: (marpContent: string, outputPath: string) => Promise<string>;
  exportToHTML: (marpContent: string, outputPath: string) => Promise<string>;
  batchExport: (marpContent: string, formats: string[], outputPath: string) => Promise<string[]>;
  getSettings: () => Promise<Settings>;
  getDefaultSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;
  selectDirectory: () => Promise<string>;
  getSongs: () => Promise<Song[]>;
  getSongById: (songId: number) => Promise<Song | null>;
  updateLyricsCache: (title: string, artist: string, lyrics: string, source: string) => Promise<{success: boolean, songId: number}>;
  addNewSong: (title: string, artist: string, lyrics: string, source: string) => Promise<number>;
  openFile: (filePath: string) => Promise<boolean>;
  openDirectory: (filePath: string) => Promise<boolean>;
  onProgressUpdate: (callback: (progress: number, status: string) => void) => () => void;
  getLogs: (logType?: string) => Promise<string>;
  onMainProcessLog: (callback: (log: {source: string, message: string, level: string}) => void) => () => void;
  // 新增的功能 - 本地圖片匯入
  selectLocalImage: () => Promise<string>;
  importLocalImage: (songId: number, localImagePath: string) => Promise<{songId: number, imagePath: string}>;
  // 新增：保存歌曲詳情
  saveSongDetails: (songId: number, songDetails: { 
    title: string, 
    artist?: string, 
    lyrics?: string, 
    imageUrl?: string,
    textColor?: string,
    strokeColor?: string,
    strokeSize?: number 
  }) => Promise<{success: boolean}>;
  // 新增：獲取臨時目錄路徑
  getTempPath: () => Promise<string>;
  // 新增的功能 - 快取管理
  getCacheSize: () => Promise<{
    totalSize: { totalSizeBytes: number; totalSizeMB: string };
    images: { totalSizeBytes: number; totalSizeMB: string; fileCount: number };
    slides: { totalSizeBytes: number; totalSizeMB: string; fileCount: number };
    lyrics: { totalSizeBytes: number; totalSizeMB: string; fileCount: number; songCount: number };
  }>;
  clearCache: () => Promise<{
    success: boolean;
    deletedImages: number;
    deletedSlides: number;
    deletedLyrics: number;
    deletedBatchSlides: number;
  }>;
  clearImagesCache: () => Promise<{
    success: boolean;
    deletedCount: number;
  }>;
  clearSlidesCache: () => Promise<{
    success: boolean;
    deletedCount: number;
  }>;
  clearLyricsCache: () => Promise<{
    success: boolean;
    deletedCount: number;
  }>;
  clearBatchSlidesCache: () => Promise<{
    success: boolean;
    deletedCount: number;
  }>;
  // 檢查關聯資源
  checkRelatedImage: (songId: number) => Promise<RelatedImageResult>;
  checkRelatedSlide: (songId: number) => Promise<RelatedSlideResult>;
  // 保存關聯資源
  saveSongImageAssociation: (songId: number, imagePath: string) => Promise<{success: boolean, message: string}>;
  saveSongSlideAssociation: (songId: number, slideContent: string) => Promise<{success: boolean, message: string}>;
  
  // 投影片集管理
  createSlideSet: (name: string) => Promise<number>;
  getSlideSets: () => Promise<SlideSet[]>;
  getSlideSetSongs: (slideSetId: number) => Promise<SlideSetSong[]>;
  addSongToSlideSet: (slideSetId: number, songId: number, displayOrder: number) => Promise<boolean>;
  removeSongFromSlideSet: (slideSetId: number, songId: number) => Promise<boolean>;
  updateSongOrderInSlideSet: (slideSetId: number, songId: number, newOrder: number) => Promise<boolean>;
  deleteSlideSet: (slideSetId: number) => Promise<boolean>;
  updateSlideSetName: (slideSetId: number, newName: string) => Promise<boolean>;
  
  // 批次處理
  generateBatchSlides: (slideSetId: number) => Promise<string>;
  previewBatchSlides: (slideSetId: number) => Promise<void>;
  getBatchSlideContent: (slideSetId: number) => Promise<string>;
  updateBatchSlideContent: (slideSetId: number, slidesContent: string) => Promise<boolean>;
  exportBatchSlides: (slideSetId: number, outputPath: string, format: string) => Promise<string>;
}

// 擴展 Window 接口
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 