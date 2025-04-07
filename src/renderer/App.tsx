import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import Layout from './components/Layout';
import Home from './pages/Home';
import LyricsSearch from './components/LyricsSearch';
import EditLyrics from './pages/EditLyrics';
import SlidePreview from './pages/SlidePreview';
import Settings from './pages/Settings';
import SlideExport from './components/SlideExport';
import BatchSlidesManager from './pages/BatchSlidesManager';
import { LyricsSearchResult } from '../common/types';

// 創建一個搜索頁面組件，用於包裝 LyricsSearch 組件
const SearchLyricsPage: React.FC = () => {
  const navigate = useNavigate();
  
  const handleSearchComplete = (result: LyricsSearchResult) => {
    if (result && result.songId) {
      navigate(`/edit/${result.songId}`);
    }
  };
  
  return <LyricsSearch onSearchComplete={handleSearchComplete} />;
};

// 創建一個匯出頁面組件，用於包裝 SlideExport 組件
const SlideExportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [songTitle, setSongTitle] = useState('');
  const [slideContent, setSlideContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadSongData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        
        // 獲取歌曲資訊
        const songs = await window.electronAPI.getSongs();
        const songId = Number(id);
        const song = songs.find(s => s.id === songId);
        
        if (song) {
          setSongTitle(song.title);
          
          // 獲取投影片內容
          const content = await window.electronAPI.getSlides(songId);
          setSlideContent(content);
        } else {
          setError(`找不到 ID 為 ${id} 的歌曲`);
        }
        
        setLoading(false);
      } catch (err: any) {
        setError(`載入數據時發生錯誤: ${err.message}`);
        setLoading(false);
      }
    };
    
    loadSongData();
  }, [id]);
  
  if (loading) {
    return <div>載入中...</div>;
  }
  
  if (error) {
    return <div>{error}</div>;
  }
  
  return <SlideExport songTitle={songTitle} slideContent={slideContent} />;
};

function App() {
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('light');
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');
  
  // 創建一個監聽設定變更的函數
  const refreshTheme = async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      setThemeMode(settings.theme);
      console.log('主題設定已更新:', settings.theme);
    } catch (error) {
      console.error('載入主題設定失敗:', error);
    }
  };
  
  useEffect(() => {
    // 載入使用者設定的主題
    refreshTheme();
    
    // 設定一個自定義事件來監聽設定變更
    const handleSettingsChange = () => {
      refreshTheme();
    };
    
    // 添加事件監聽器
    window.addEventListener('settings-changed', handleSettingsChange);
    
    // 清理函數
    return () => {
      window.removeEventListener('settings-changed', handleSettingsChange);
    };
  }, []);
  
  useEffect(() => {
    // 根據主題選項決定實際使用的主題
    if (themeMode === 'system') {
      // 使用系統主題
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setActualTheme(prefersDarkMode ? 'dark' : 'light');
      
      // 監聽系統主題變化
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setActualTheme(e.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // 直接使用用戶設定的主題
      setActualTheme(themeMode === 'dark' ? 'dark' : 'light');
    }
  }, [themeMode]);

  const theme = React.useMemo(() => createTheme({
    palette: {
      mode: actualTheme,
    },
  }), [actualTheme]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="search" element={<SearchLyricsPage />} />
            <Route path="edit/:id" element={<EditLyrics />} />
            <Route path="preview/:id" element={<SlidePreview />} />
            <Route path="batch" element={<BatchSlidesManager />} />
            <Route path="export/:id" element={<SlideExportPage />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App; 