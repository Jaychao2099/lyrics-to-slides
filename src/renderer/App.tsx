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
  const theme = createTheme({
    palette: {
      mode: 'light',
    },
  });

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