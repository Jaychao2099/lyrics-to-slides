import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tooltip,
  Container,
  Grid,
  Snackbar
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PreviewIcon from '@mui/icons-material/Preview';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import { Song } from '../../common/types';

const EditLyrics: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const songId = Number(id);

  const [song, setSong] = useState<Song | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [hasImage, setHasImage] = useState(false);
  const [hasSlide, setHasSlide] = useState(false);

  // 載入歌曲數據
  useEffect(() => {
    const loadSong = async () => {
      try {
        if (!songId) {
          setError('無效的歌曲 ID');
          setLoading(false);
          return;
        }
        
        setLoading(true);
        
        // 獲取所有歌曲
        const songs = await window.electronAPI.getSongs();
        const currentSong = songs.find(s => s.id === songId);
        
        if (!currentSong) {
          setError(`找不到 ID 為 ${songId} 的歌曲`);
          setLoading(false);
          return;
        }
        
        // 載入歌曲數據
        setSong(currentSong);
        setTitle(currentSong.title);
        setArtist(currentSong.artist || '');
        setLyrics(currentSong.lyrics);
        
        // 檢查是否有關聯圖片
        const imageResult = await window.electronAPI.checkRelatedImage(songId);
        setHasImage(imageResult.hasRelatedImage);
        if (imageResult.hasRelatedImage && imageResult.imagePath) {
          setImageUrl(imageResult.imagePath);
        }
        
        // 檢查是否有關聯投影片
        const slideResult = await window.electronAPI.checkRelatedSlide(songId);
        setHasSlide(slideResult.hasRelatedSlide);
        
        setLoading(false);
      } catch (err: any) {
        setError(`載入歌曲時發生錯誤: ${err.message}`);
        setLoading(false);
      }
    };
    
    loadSong();
  }, [songId]);

  // 保存歌詞 (現在改為保存歌曲詳情)
  const handleSave = async () => {
    if (!title.trim()) {
      setError('歌曲標題不能為空');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      // 準備要保存的數據
      const songDetails = {
        title,
        artist,
        lyrics,
        imageUrl: imageUrl === null ? undefined : imageUrl, // 將 null 轉換為 undefined
      };
      
      // 呼叫新的 IPC Handler 來保存完整的歌曲詳情
      const result = await window.electronAPI.saveSongDetails(songId, songDetails);
      
      if (result && result.success) {
        setSnackbarMessage('歌曲詳情已成功保存');
        setSnackbarOpen(true);
        // 可以選擇性地重新加載數據或更新狀態
        // loadSong(); // 例如，重新載入以確認
      } else {
        throw new Error('後端保存失敗');
      }
      setSaving(false);
    } catch (err: any) {
      setError(`保存歌曲詳情時發生錯誤: ${err.message}`);
      setSaving(false);
    }
  };

  // 生成/重新生成圖片
  const handleGenerateImage = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let result;
      if (hasImage) {
        // 重新生成圖片
        result = await window.electronAPI.regenerateImage(songId, title, lyrics);
      } else {
        // 首次生成圖片
        result = await window.electronAPI.generateImage(title, lyrics, songId);
      }
      
      if (result && result.imagePath) {
        // 自動保存圖片關聯
        await window.electronAPI.saveSongImageAssociation(
          result.songId || songId, 
          result.imagePath
        );
        
        // 更新界面
        setImageUrl(result.imagePath);
        setHasImage(true);
        setSnackbarMessage('圖片已成功生成並關聯');
        setSnackbarOpen(true);
      }
      
      setLoading(false);
    } catch (err: any) {
      setError(`生成圖片時發生錯誤: ${err.message}`);
      setLoading(false);
    }
  };

  // 選擇並匯入本地圖片
  const handleImportLocalImage = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 選擇本地圖片
      const localImagePath = await window.electronAPI.selectLocalImage();
      
      if (!localImagePath) {
        setLoading(false);
        return; // 使用者取消了選擇
      }
      
      // 匯入圖片
      const result = await window.electronAPI.importLocalImage(songId, localImagePath);
      
      if (result && result.imagePath) {
        // 自動保存圖片關聯
        await window.electronAPI.saveSongImageAssociation(
          result.songId || songId, 
          result.imagePath
        );
        
        // 更新界面
        setImageUrl(result.imagePath);
        setHasImage(true);
        setSnackbarMessage('本地圖片已成功匯入並關聯');
        setSnackbarOpen(true);
      }
      
      setLoading(false);
    } catch (err: any) {
      setError(`匯入本地圖片時發生錯誤: ${err.message}`);
      setLoading(false);
    }
  };

  // 預覽投影片
  const handlePreview = async () => {
    try {
      // 導航到預覽頁面
      navigate(`/preview/${songId}`);
    } catch (err: any) {
      setError(`導航到預覽頁面時發生錯誤: ${err.message}`);
    }
  };

  // 返回搜尋頁
  const handleBackSearch = () => {
    navigate('/search');
  };

  // 關閉提示訊息
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBackSearch} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">
            {loading ? '載入中...' : `編輯歌詞 - ${title}`}
          </Typography>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            <Box sx={{ width: '100%', px: 2, py: 1 }} gridColumn={{ xs: 'span 12', md: 'span 6' }}>
              <TextField
                label="歌曲標題"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                margin="normal"
                variant="outlined"
                required
              />
              
              <TextField
                label="歌手"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                fullWidth
                margin="normal"
                variant="outlined"
              />
              
              <TextField
                label="歌詞"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                fullWidth
                multiline
                rows={16}
                margin="normal"
                variant="outlined"
                required
                placeholder="請輸入歌詞，使用空行分隔每個段落..."
                helperText="提示：空行（連續兩個換行）將被用於分隔投影片頁面"
              />
              
              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存歌詞'}
                </Button>
                
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<PreviewIcon />}
                  onClick={handlePreview}
                  disabled={!hasImage || !songId}
                >
                  預覽投影片
                </Button>
              </Box>
            </Box>
            
            <Box sx={{ width: '100%', px: 2, py: 1 }} gridColumn={{ xs: 'span 12', md: 'span 6' }}>
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    背景圖片
                  </Typography>
                  
                  {imageUrl ? (
                    <Box sx={{ mt: 2, mb: 2, textAlign: 'center' }}>
                      <img 
                        src={`file://${imageUrl}`} 
                        alt="背景圖片" 
                        style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} 
                      />
                    </Box>
                  ) : (
                    <Box sx={{ mt: 2, mb: 2, textAlign: 'center', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }}>
                      <Typography color="textSecondary">
                        尚未生成圖片
                      </Typography>
                    </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<ImageIcon />}
                      onClick={handleGenerateImage}
                      disabled={loading}
                      fullWidth
                    >
                      {hasImage ? '重新生成圖片' : '生成背景圖片'}
                    </Button>
                    
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={handleImportLocalImage}
                      disabled={loading}
                      fullWidth
                    >
                      匯入本地圖片
                    </Button>
                  </Box>
                </CardContent>
              </Card>
              
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    投影片狀態
                  </Typography>
                  
                  <Alert severity={hasSlide ? "success" : "info"} sx={{ mt: 2 }}>
                    {hasSlide 
                      ? '此歌曲已有關聯投影片，可以直接預覽或導出。' 
                      : '此歌曲尚未生成投影片，請點擊"預覽投影片"按鈕生成。'}
                  </Alert>
                  
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={<PreviewIcon />}
                      onClick={handlePreview}
                      disabled={!hasImage || !songId}
                      fullWidth
                    >
                      預覽投影片
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Grid>
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

export default EditLyrics;
