import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Container,
  Divider,
  Tooltip,
  Card,
  CardContent,
  Grid,
  Snackbar,
  Tabs,
  Tab
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EditIcon from '@mui/icons-material/Edit';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import CodeIcon from '@mui/icons-material/Code';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Song } from '../../common/types';

interface SlideData {
  content: string;
  filePath: string;
}

const SlidePreview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const songId = Number(id);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideContent, setSlideContent] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const [totalSlides, setTotalSlides] = useState<number>(0);
  const [tabValue, setTabValue] = useState<number>(0);
  const [showMarkdown, setShowMarkdown] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // 載入歌曲和投影片數據
  useEffect(() => {
    const loadSongAndSlides = async () => {
      try {
        if (!songId) {
          setError('無效的歌曲 ID');
          setLoading(false);
          return;
        }
        
        setLoading(true);
        
        // 獲取歌曲資訊
        const songs = await window.electronAPI.getSongs();
        const currentSong = songs.find(s => s.id === songId);
        
        if (!currentSong) {
          setError(`找不到 ID 為 ${songId} 的歌曲`);
          setLoading(false);
          return;
        }
        
        setSong(currentSong);
        
        // 生成並獲取投影片內容
        await generateSlides();
        
        setLoading(false);
      } catch (err: any) {
        setError(`載入歌曲和投影片時發生錯誤: ${err.message}`);
        setLoading(false);
      }
    };
    
    loadSongAndSlides();
  }, [songId]);

  // 生成投影片
  const generateSlides = async () => {
    try {
      setLoading(true);
      
      // 檢查是否有已生成的投影片
      const slideResult = await window.electronAPI.checkRelatedSlide(songId);
      
      if (!slideResult.hasRelatedSlide) {
        // 沒有投影片，生成新的
        // 正確的 API: generateSlides(songId, songTitle, artist, lyrics, imagePath)
        // 先檢查是否有關聯圖片
        const imageResult = await window.electronAPI.checkRelatedImage(songId);
        const imagePath = imageResult.imagePath || '';
        
        await window.electronAPI.generateSlides(
          songId, 
          song?.title || '', 
          song?.artist || '', // 這是 artist 參數
          song?.lyrics || '', 
          imagePath
        );
      }
      
      // 獲取投影片內容
      const slideContent = await window.electronAPI.getSlides(songId);
      
      if (slideContent) {
        setSlideContent(slideContent);
        
        // 預覽投影片
        await window.electronAPI.previewSlides(slideContent);
        
        // 設置預覽 URL (由 previewSlides API 生成的臨時文件)
        // 注意：這裡依賴於 previewSlides 函數在內部設置好臨時預覽文件
        // 如果有單獨的 API 來獲取預覽 URL，應該使用那個
      } else {
        setError('無法獲取投影片內容');
      }
      
      // 計算總頁數（根據 Marp 分隔符號 --- 來計算）
      const slideCount = (slideContent?.match(/^---$/gm) || []).length + 1;
      setTotalSlides(slideCount);
      
      setLoading(false);
    } catch (err: any) {
      setError(`生成投影片時發生錯誤: ${err.message}`);
      setLoading(false);
    }
  };

  // 重新生成投影片
  const handleRegenerateSlides = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 強制重新生成投影片
      // 正確的 API: generateSlides(songId, songTitle, artist, lyrics, imagePath)
      // 先檢查是否有關聯圖片
      const imageResult = await window.electronAPI.checkRelatedImage(songId);
      const imagePath = imageResult.imagePath || '';
      
      await window.electronAPI.generateSlides(
        songId, 
        song?.title || '', 
        song?.artist || '', // 這是 artist 參數
        song?.lyrics || '', 
        imagePath
      );
      
      // 重新獲取投影片內容和預覽 URL
      const slideContent = await window.electronAPI.getSlides(songId);
      
      if (slideContent) {
        setSlideContent(slideContent);
        
        // 預覽投影片
        await window.electronAPI.previewSlides(slideContent);
        
        // 設置預覽 URL (由 previewSlides API 生成的臨時文件)
        // 注意：這裡依賴於 previewSlides 函數在內部設置好臨時預覽文件
        // 如果有單獨的 API 來獲取預覽 URL，應該使用那個
      } else {
        setError('無法獲取投影片內容');
        return;
      }
      
      // 重新計算總頁數
      const slideCount = (slideContent?.match(/^---$/gm) || []).length + 1;
      setTotalSlides(slideCount);
      
      setSnackbarMessage('投影片已成功重新生成');
      setSnackbarOpen(true);
      setCurrentSlide(1);
      setLoading(false);
    } catch (err: any) {
      setError(`重新生成投影片時發生錯誤: ${err.message}`);
      setLoading(false);
    }
  };

  // 切換到上一張投影片
  const handlePreviousSlide = () => {
    if (currentSlide > 1) {
      setCurrentSlide(currentSlide - 1);
      if (previewIframeRef.current && previewIframeRef.current.contentWindow) {
        previewIframeRef.current.contentWindow.postMessage({ method: 'previousSlide' }, '*');
      }
    }
  };

  // 切換到下一張投影片
  const handleNextSlide = () => {
    if (currentSlide < totalSlides) {
      setCurrentSlide(currentSlide + 1);
      if (previewIframeRef.current && previewIframeRef.current.contentWindow) {
        previewIframeRef.current.contentWindow.postMessage({ method: 'nextSlide' }, '*');
      }
    }
  };

  // 進入全屏預覽
  const handleFullScreen = () => {
    if (previewIframeRef.current) {
      // 使用 Marp 全屏功能
      if (previewIframeRef.current.contentWindow) {
        previewIframeRef.current.contentWindow.postMessage({ method: 'fullScreen' }, '*');
      }
    }
  };

  // 導航到編輯頁面
  const handleEditLyrics = () => {
    navigate(`/edit/${songId}`);
  };

  // 導航到導出頁面
  const handleExport = () => {
    navigate(`/export/${songId}`);
  };

  // 返回首頁
  const handleBack = () => {
    navigate('/');
  };

  // 切換標簽頁
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // 切換顯示 Markdown 源代碼
  const handleToggleMarkdown = () => {
    setShowMarkdown(!showMarkdown);
  };

  // 關閉提示訊息
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // 處理鍵盤控制
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        handlePreviousSlide();
      } else if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === 'Space') {
        handleNextSlide();
      } else if (event.key === 'f' || event.key === 'F') {
        handleFullScreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentSlide, totalSlides]);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ flexGrow: 1 }}>
            {loading ? '載入中...' : `預覽投影片 - ${song?.title || ''}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="編輯歌詞">
              <IconButton color="primary" onClick={handleEditLyrics}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="匯出投影片">
              <IconButton color="primary" onClick={handleExport}>
                <CloudDownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="重新生成投影片">
              <IconButton color="secondary" onClick={handleRegenerateSlides} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ width: '100%' }}>
            <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
              <Tab label="投影片預覽" />
              <Tab label="源代碼與設置" />
            </Tabs>
            
            {tabValue === 0 && (
              <Box sx={{ mb: 3 }}>
                {previewUrl ? (
                  <Box sx={{ position: 'relative' }}>
                    <Box
                      sx={{
                        width: '100%',
                        height: '500px',
                        border: '1px solid #ddd',
                        overflow: 'hidden',
                        bgcolor: '#000',
                        mb: 2
                      }}
                    >
                      <iframe
                        ref={previewIframeRef}
                        src={previewUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="投影片預覽"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Button
                        variant="outlined"
                        startIcon={<ArrowBackIcon />}
                        onClick={handlePreviousSlide}
                        disabled={currentSlide <= 1}
                      >
                        上一頁
                      </Button>
                      
                      <Typography>
                        {currentSlide} / {totalSlides}
                      </Typography>
                      
                      <Button
                        variant="outlined"
                        endIcon={<ArrowForwardIcon />}
                        onClick={handleNextSlide}
                        disabled={currentSlide >= totalSlides}
                      >
                        下一頁
                      </Button>
                      
                      <Button
                        variant="contained"
                        startIcon={<FullscreenIcon />}
                        onClick={handleFullScreen}
                      >
                        全屏播放
                      </Button>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" align="center">
                      提示：可使用鍵盤方向鍵（←→）或 PageUp/PageDown 切換投影片，按 F 鍵全屏
                    </Typography>
                  </Box>
                ) : (
                  <Alert severity="warning">
                    無法載入投影片預覽，請嘗試重新生成投影片。
                  </Alert>
                )}
              </Box>
            )}
            
            {tabValue === 1 && (
              <Box sx={{ width: '100%' }}>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        投影片源代碼 (Marp Markdown)
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<CodeIcon />}
                        onClick={handleToggleMarkdown}
                        size="small"
                      >
                        {showMarkdown ? '隱藏源代碼' : '顯示源代碼'}
                      </Button>
                    </Box>
                    
                    {showMarkdown && (
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: '#f5f5f5',
                          borderRadius: 1,
                          fontFamily: 'monospace',
                          fontSize: '0.9rem',
                          overflow: 'auto',
                          maxHeight: '400px',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {slideContent || '無源代碼可顯示'}
                      </Box>
                    )}
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleExport}
                        startIcon={<CloudDownloadIcon />}
                      >
                        匯出投影片
                      </Button>
                      
                      <Button
                        variant="outlined"
                        color="secondary"
                        onClick={handleRegenerateSlides}
                        startIcon={<RefreshIcon />}
                        disabled={loading}
                      >
                        重新生成投影片
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
                
                <Alert severity="info" sx={{ mb: 2 }}>
                  提示：投影片是使用 Marp 格式生成的，您可以通過「匯出」功能導出為 PDF、PPTX 或其他格式。
                </Alert>
              </Box>
            )}
            </Box>
        )}
      </Paper>
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Container>
  );
};

export default SlidePreview;
