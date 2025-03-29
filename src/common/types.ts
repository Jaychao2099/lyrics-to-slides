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
  generateImage: (songTitle: string, lyrics: string, promptTemplate: string) => Promise<string>;
  generateSlides: (lyrics: string, imageUrl: string, promptTemplate: string) => Promise<string>;
  previewSlides: (marpContent: string) => Promise<void>;
  exportToPDF: (marpContent: string, outputPath: string) => Promise<string>;
  exportToPPTX: (marpContent: string, outputPath: string) => Promise<string>;
  exportToHTML: (marpContent: string, outputPath: string) => Promise<string>;
  batchExport: (marpContent: string, formats: string[], outputPath: string) => Promise<string[]>;
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;
  selectDirectory: () => Promise<string>;
  getSongs: () => Promise<Song[]>;
  openFile: (filePath: string) => Promise<boolean>;
  openDirectory: (filePath: string) => Promise<boolean>;
  onProgressUpdate: (callback: (progress: number, status: string) => void) => () => void;
}

// 擴展 Window 接口
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 