// 設定類型
export interface Settings {
  // API 密鑰
  googleApiKey: string;
  googleSearchEngineId: string;
  openaiApiKey: string;

  // 輸出設定
  defaultOutputDirectory: string;
  defaultExportFormat: 'pdf' | 'pptx' | 'html';

  // 提示詞模板
  imagePromptTemplate: string;
  slidesPromptTemplate: string;

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
  createdAt: string;
  updatedAt: string;
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

// 預加載 API 類型定義
export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  searchLyrics: (songTitle: string, artist: string) => Promise<LyricsSearchResult[]>;
  generateImage: (songTitle: string, lyrics: string, songId?: number) => Promise<{songId: number, imagePath: string}>;
  regenerateImage: (songId: number, songTitle: string, lyrics: string) => Promise<{songId: number, imagePath: string}>;
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
  updateLyricsCache: (title: string, artist: string, lyrics: string, source: string) => Promise<boolean>;
  addNewSong: (title: string, artist: string, lyrics: string, source: string) => Promise<number>;
  openFile: (filePath: string) => Promise<boolean>;
  openDirectory: (filePath: string) => Promise<boolean>;
  onProgressUpdate: (callback: (progress: number, status: string) => void) => () => void;
  getLogs: (logType?: string) => Promise<string>;
  onMainProcessLog: (callback: (log: {source: string, message: string, level: string}) => void) => () => void;
  // 新增的功能 - 本地圖片匯入
  selectLocalImage: () => Promise<string>;
  importLocalImage: (songId: number, localImagePath: string) => Promise<{songId: number, imagePath: string}>;
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
  }>;
}

// 擴展 Window 接口
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 