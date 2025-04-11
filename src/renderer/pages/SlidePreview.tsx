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
  Tab,
  TextField,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Dialog
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EditIcon from '@mui/icons-material/Edit';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import CodeIcon from '@mui/icons-material/Code';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
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
  const [editedSlideContent, setEditedSlideContent] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const [totalSlides, setTotalSlides] = useState<number>(0);
  const [tabValue, setTabValue] = useState<number>(0);
  const [showMarkdown, setShowMarkdown] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState<boolean>(false);

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
        setEditedSlideContent(slideContent);
        
        // 設置臨時 HTML 文件的路徑（需要與 main/index.ts 中的設定保持一致）
        const tempDir = 'lyrics-slides-preview';
        const previewPath = `file:///${await window.electronAPI.getTempPath()}/${tempDir}/preview.html`;
        setPreviewUrl(previewPath);
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
      
      // --- 修改：先從後端獲取最新的歌曲資料 ---
      const latestSongData = await window.electronAPI.getSongById(songId);
      
      if (!latestSongData) {
        setError(`無法獲取歌曲 ID ${songId} 的最新資料`);
        setLoading(false);
        return;
      }
      
      // 使用獲取到的最新資料來生成投影片
      const { title, artist, lyrics, imageUrl } = latestSongData;
      const imagePath = imageUrl || ''; // 確保 imagePath 是字串
      
      await window.electronAPI.generateSlides(
        songId, 
        title, 
        artist || '', 
        lyrics || '', 
        imagePath
      );
      
      // --- 結束修改 ---
      
      // 重新獲取投影片內容和預覽 URL
      const slideContent = await window.electronAPI.getSlides(songId);
      
      if (slideContent) {
        setSlideContent(slideContent);
        setEditedSlideContent(slideContent);
        
        // 設置預覽 URL (由 previewSlides API 生成的臨時文件)
        const tempDir = 'lyrics-slides-preview';
        const previewPath = `file:///${await window.electronAPI.getTempPath()}/${tempDir}/preview.html`;
        setPreviewUrl(previewPath);
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

  // 新增：切換編輯模式
  const handleToggleEdit = () => {
    if (isEditing) {
      // 如果當前是編輯模式，則詢問是否儲存
      if (editedSlideContent !== slideContent) {
        setConfirmDialogOpen(true);
      } else {
        setIsEditing(false);
      }
    } else {
      // 進入編輯模式
      setEditedSlideContent(slideContent);
      setIsEditing(true);
      setShowMarkdown(true); // 確保源碼可見
    }
  };

  // 新增：處理源碼編輯變更
  const handleSlideContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedSlideContent(event.target.value);
  };

  // 新增：儲存編輯後的源碼
  const handleSaveSlideContent = async () => {
    try {
      setLoading(true);
      
      if (songId <= 0) {
        throw new Error('無效的歌曲ID，無法保存投影片');
      }
      
      // 先使用 updateSlides API 更新數據庫和快取
      const updateResult = await window.electronAPI.updateSlides(songId, editedSlideContent);
      if (!updateResult) {
        throw new Error('更新投影片內容失敗');
      }
      
      // 然後再使用 saveSongSlideAssociation 確保資源關聯
      const associationResult = await window.electronAPI.saveSongSlideAssociation(songId, editedSlideContent);
      if (!associationResult.success) {
        console.warn('儲存投影片關聯失敗，但內容已更新:', associationResult.message);
      }
      
      // 更新當前顯示的源碼
      setSlideContent(editedSlideContent);
      
      // 設置預覽 URL (由 previewSlides API 生成的臨時文件)
      const tempDir = 'lyrics-slides-preview';
      const previewPath = `file:///${await window.electronAPI.getTempPath()}/${tempDir}/preview.html`;
      setPreviewUrl(previewPath);
      
      // 重新計算總頁數
      const slideCount = (editedSlideContent?.match(/^---$/gm) || []).length + 1;
      setTotalSlides(slideCount);
      
      // 顯示成功訊息
      setSnackbarMessage('投影片源碼已成功更新');
      setSnackbarOpen(true);
      
      // 退出編輯模式
      setIsEditing(false);
      setLoading(false);
    } catch (err: any) {
      setError(`儲存投影片源碼時發生錯誤: ${err.message}`);
      setLoading(false);
    }
  };

  // 新增：取消編輯
  const handleCancelEdit = () => {
    setEditedSlideContent(slideContent);
    setIsEditing(false);
    setConfirmDialogOpen(false);
  };

  // 新增：處理確認對話框的確認按鈕
  const handleConfirmSave = async () => {
    setConfirmDialogOpen(false);
    await handleSaveSlideContent();
  };

  // 新增：打開預覽視窗
  const handleOpenPreview = async () => {
    try {
      setLoading(true);
      await window.electronAPI.previewSlides(slideContent);
      setLoading(false);
    } catch (err: any) {
      setError(`打開預覽視窗時發生錯誤: ${err.message}`);
      setLoading(false);
    }
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
          <IconButton onClick={handleEditLyrics} sx={{ mr: 2 }}>
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
              <Tab label="投影片操作" />
              <Tab label="源代碼與設置" />
            </Tabs>
            
            {tabValue === 0 && (
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom>
                  {song?.title || '投影片'}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, my: 3 }}>
                  <Button
                    variant="contained"
                    startIcon={<FullscreenIcon />}
                    onClick={handleOpenPreview}
                    color="primary"
                  >
                    預覽
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<CloudDownloadIcon />}
                    onClick={handleExport}
                  >
                    匯出投影片
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRegenerateSlides}
                    disabled={loading}
                  >
                    重新生成投影片
                  </Button>
                </Box>
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    投影片總頁數: {totalSlides} 頁
                  </Typography>
                </Box>
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
                      <Box>
                        {isEditing ? (
                          <>
                            <Button
                              variant="contained"
                              color="primary"
                              startIcon={<SaveIcon />}
                              onClick={handleSaveSlideContent}
                              size="small"
                              sx={{ mr: 1 }}
                            >
                              儲存
                            </Button>
                            <Button
                              variant="outlined"
                              onClick={handleCancelEdit}
                              size="small"
                            >
                              取消
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={handleToggleEdit}
                            size="small"
                            sx={{ mr: 1 }}
                          >
                            編輯源代碼
                          </Button>
                        )}
                        {!isEditing && (
                          <Button
                            variant="outlined"
                            startIcon={<CodeIcon />}
                            onClick={handleToggleMarkdown}
                            size="small"
                          >
                            {showMarkdown ? '隱藏源代碼' : '顯示源代碼'}
                          </Button>
                        )}
                      </Box>
                    </Box>
                    
                    {showMarkdown && (
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: '#f5f5f5',
                          borderRadius: 1,
                          mb: 2,
                          maxHeight: isEditing ? 'none' : '400px',
                          overflow: isEditing ? 'visible' : 'auto'
                        }}
                      >
                        {isEditing ? (
                          <TextField
                            fullWidth
                            multiline
                            rows={15}
                            variant="outlined"
                            value={editedSlideContent}
                            onChange={handleSlideContentChange}
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.9rem',
                              '& .MuiInputBase-root': { fontFamily: 'monospace' }
                            }}
                          />
                        ) : (
                          <Box 
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.9rem',
                              whiteSpace: 'pre-wrap'
                            }}
                          >
                            {slideContent || '無源代碼可顯示'}
                          </Box>
                        )}
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
                  提示：投影片是使用 Marp 格式生成的，您可以通過「匯出」功能導出為 PDF、PPTX 或其他格式。您也可以直接編輯源代碼來自定義投影片。
                </Alert>
              </Box>
            )}
          </Box>
        )}
      </Paper>
      
      {/* 新增：確認對話框 */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          確認儲存修改
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            您已編輯投影片源碼，是否要儲存這些更改？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelEdit} color="primary">
            取消
          </Button>
          <Button onClick={handleConfirmSave} color="primary" autoFocus>
            儲存
          </Button>
        </DialogActions>
      </Dialog>
      
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
