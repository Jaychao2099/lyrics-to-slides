// 歌曲類型定義
export interface Song {
  title: string;
  lyrics: string;
  imageUrl: string;
  isLoading: boolean;
}

// API 金鑰類型定義
export interface ApiKeys {
  lyricsAPI: string;
  imageAPI: string;
}

// 支持的API服務類型
export type LyricsAPIService = 'openai' | 'google' | 'custom';
export type ImageAPIService = 'openai' | 'dalle' | 'custom';

// 導出格式類型
export type ExportFormat = 'pdf' | 'pptx' | 'html'; 