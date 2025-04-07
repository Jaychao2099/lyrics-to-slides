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
  const [textColor, setTextColor] = useState('black');
  const [strokeColor, setStrokeColor] = useState('white');
  const [strokeSize, setStrokeSize] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [hasImage, setHasImage] = useState(false);
  const [hasSlide, setHasSlide] = useState(false);

  // 載入歌曲資料
  useEffect(() => {
    const loadSong = async () => {
      try {
        const songData = await window.electronAPI.getSongById(songId);
        if (songData) {
          setSong(songData);
          setTitle(songData.title);
          setArtist(songData.artist || '');
          setLyrics(songData.lyrics || '');
          setImageUrl(songData.imageUrl || null);
          setTextColor(songData.textColor || 'black');
          setStrokeColor(songData.strokeColor || 'white');
          setStrokeSize(songData.strokeSize || 5);
          
          // 檢查是否有關聯的圖片和投影片
          const imageResult = await window.electronAPI.checkRelatedImage(songId);
          const slideResult = await window.electronAPI.checkRelatedSlide(songId);
          
          // 如果有imageUrl或檢查到關聯圖片，則設置hasImage為true
          setHasImage(!!songData.imageUrl || imageResult.hasRelatedImage);
          setHasSlide(slideResult.hasRelatedSlide);
        }
      } catch (error) {
        setError('載入歌曲資料失敗');
        console.error('載入歌曲資料失敗:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSong();
  }, [songId]);

  // 添加一個useEffect來監控imageUrl變化
  useEffect(() => {
    // 當imageUrl存在時，自動設置hasImage為true
    if (imageUrl) {
      setHasImage(true);
    }
  }, [imageUrl]);

  // 儲存歌曲資料
  const handleSave = async () => {
    setSaving(true);
    try {
      // 先儲存歌曲基本資料
      const result = await window.electronAPI.saveSongDetails(songId, {
        title,
        artist,
        lyrics,
        imageUrl: imageUrl || undefined,
        textColor,
        strokeColor,
        strokeSize
      });

      if (result.success) {
        // 如果有圖片但hasImage為false，嘗試修復關聯
        if (imageUrl && !hasImage) {
          try {
            await window.electronAPI.saveSongImageAssociation(songId, imageUrl);
            setHasImage(true);
            setSnackbarMessage('儲存成功並修復圖片關聯');
          } catch (imageError) {
            console.error('修復圖片關聯失敗:', imageError);
            setSnackbarMessage('儲存成功，但圖片關聯修復失敗');
          }
        } else {
          setSnackbarMessage('儲存成功');
        }
        setSnackbarOpen(true);
      } else {
        setError('儲存失敗');
      }
    } catch (error) {
      setError('儲存失敗');
      console.error('儲存失敗:', error);
    } finally {
      setSaving(false);
    }
  };

  // 預覽投影片
  const handlePreview = async () => {
    try {
      if (!imageUrl) {
        setError('請先生成或選擇背景圖片，圖片URL不存在');
        return;
      }

      if (!hasImage) {
        // 雖然有imageUrl但hasImage為false，嘗試修復關聯
        setError('圖片關聯似乎有問題，嘗試修復...');
        
        try {
          // 先保存圖片關聯
          await window.electronAPI.saveSongImageAssociation(songId, imageUrl);
          setHasImage(true);
          setError(null);
          setSnackbarMessage('已修復圖片關聯');
          setSnackbarOpen(true);
        } catch (repairError) {
          setError('修復圖片關聯失敗，請重新生成或選擇圖片');
          console.error('修復圖片關聯失敗:', repairError);
          return;
        }
      }

      // 獲取投影片內容
      const slideContent = await window.electronAPI.getSlides(songId);
      if (slideContent) {
        await window.electronAPI.previewSlides(slideContent);
      } else {
        setError('找不到投影片內容，請先重新生成投影片');
      }
    } catch (error) {
      setError('預覽投影片失敗');
      console.error('預覽投影片失敗:', error);
    }
  };

  // 重新生成投影片
  const handleRegenerateSlides = async () => {
    try {
      if (!imageUrl) {
        setError('請先生成或選擇背景圖片，圖片URL不存在');
        return;
      }

      if (!hasImage) {
        // 嘗試修復圖片關聯
        setError('圖片關聯似乎有問題，嘗試修復...');
        
        try {
          // 先保存圖片關聯
          await window.electronAPI.saveSongImageAssociation(songId, imageUrl);
          setHasImage(true);
          setError(null);
          setSnackbarMessage('已修復圖片關聯');
          setSnackbarOpen(true);
        } catch (repairError) {
          setError('修復圖片關聯失敗，請重新生成或選擇圖片');
          console.error('修復圖片關聯失敗:', repairError);
          return;
        }
      }

      // 更新歌曲詳情，確保imageUrl正確保存
      await window.electronAPI.saveSongDetails(songId, {
        title,
        artist,
        lyrics,
        imageUrl,
        textColor,
        strokeColor,
        strokeSize
      });

      const slideContent = await window.electronAPI.generateSlides(
        songId,
        title,
        artist,
        lyrics,
        imageUrl
      );

      if (slideContent) {
        await window.electronAPI.previewSlides(slideContent);
        setHasSlide(true);
        setSnackbarMessage('投影片重新生成成功');
        setSnackbarOpen(true);
      } else {
        setError('投影片生成失敗，未返回內容');
      }
    } catch (error) {
      setError('重新生成投影片失敗');
      console.error('重新生成投影片失敗:', error);
    }
  };

  // 匯出投影片
  const handleExport = async () => {
    try {
      if (!hasSlide) {
        setError('請先生成投影片');
        return;
      }

      const slideContent = await window.electronAPI.getSlides(songId);
      if (!slideContent) {
        setError('找不到投影片內容');
        return;
      }

      const outputPath = await window.electronAPI.selectDirectory();
      if (!outputPath) {
        return;
      }

      const formats = ['pdf', 'pptx', 'html'];
      const results = await window.electronAPI.batchExport(slideContent, formats, outputPath);
      
      setSnackbarMessage('匯出成功');
      setSnackbarOpen(true);
    } catch (error) {
      setError('匯出失敗');
      console.error('匯出失敗:', error);
    }
  };

  // 選擇本地圖片
  const handleSelectLocalImage = async () => {
    try {
      const imagePath = await window.electronAPI.selectLocalImage();
      if (imagePath) {
        const result = await window.electronAPI.importLocalImage(songId, imagePath);
        if (result) {
          setImageUrl(result.imagePath);
          setHasImage(true);
          
          // 確保保存圖片關聯
          await window.electronAPI.saveSongImageAssociation(songId, result.imagePath);
          
          // 更新歌曲詳情中的imageUrl
          await window.electronAPI.saveSongDetails(songId, {
            title,
            artist,
            lyrics,
            imageUrl: result.imagePath,
            textColor,
            strokeColor,
            strokeSize
          });
          
          setSnackbarMessage('圖片匯入成功並已關聯');
          setSnackbarOpen(true);
        }
      }
    } catch (error) {
      setError('匯入圖片失敗');
      console.error('匯入圖片失敗:', error);
    }
  };

  // 返回上一頁
  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            編輯歌詞
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                基本資訊
              </Typography>
              <TextField
                fullWidth
                label="歌曲標題"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                margin="normal"
              />
              <TextField
                fullWidth
                label="歌手"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                margin="normal"
              />
              <TextField
                fullWidth
                label="歌詞"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                margin="normal"
                multiline
                rows={10}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                文字格式設定
              </Typography>
              <TextField
                fullWidth
                label="文字顏色"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                margin="normal"
                type="color"
              />
              <TextField
                fullWidth
                label="邊框顏色"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                margin="normal"
                type="color"
              />
              <TextField
                fullWidth
                label="邊框粗細"
                value={strokeSize}
                onChange={(e) => setStrokeSize(Number(e.target.value))}
                margin="normal"
                type="number"
                inputProps={{ min: 0, max: 20 }}
              />
            </CardContent>
          </Card>

          <Box>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  背景圖片
                </Typography>
                {imageUrl ? (
                  <Box sx={{ mt: 2 }}>
                    <img
                      src={imageUrl}
                      alt="背景圖片"
                      style={{ maxWidth: '100%', maxHeight: '200px' }}
                    />
                  </Box>
                ) : (
                  <Typography color="text.secondary">
                    尚未設定背景圖片
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={async () => {
                      try {
                        const result = await window.electronAPI.generateImage(
                          title,
                          lyrics,
                          songId
                        );
                        if (result && result.imagePath && result.songId) {
                          setImageUrl(result.imagePath);
                          setHasImage(true);
                          
                          // 確保保存圖片關聯
                          await window.electronAPI.saveSongImageAssociation(
                            result.songId, 
                            result.imagePath
                          );
                          
                          // 更新歌曲詳情中的imageUrl
                          await window.electronAPI.saveSongDetails(songId, {
                            title,
                            artist,
                            lyrics,
                            imageUrl: result.imagePath,
                            textColor,
                            strokeColor,
                            strokeSize
                          });
                          
                          setSnackbarMessage('AI圖片生成成功並已關聯');
                          setSnackbarOpen(true);
                        }
                      } catch (error) {
                        setError('生成AI圖片失敗');
                        console.error('生成AI圖片失敗:', error);
                      }
                    }}
                  >
                    使用AI生成圖片
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ImageIcon />}
                    onClick={handleSelectLocalImage}
                  >
                    選擇本地圖片
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            startIcon={<SaveIcon />}
            disabled={saving}
          >
            儲存
          </Button>

          <Box>
            <Button
              variant="outlined"
              color="primary"
              onClick={handlePreview}
              sx={{ mr: 1 }}
              disabled={!hasSlide}
            >
              預覽投影片
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleRegenerateSlides}
              disabled={!hasImage}
            >
              重新生成投影片
            </Button>
          </Box>
        </Box>

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={() => setSnackbarOpen(false)}
          message={snackbarMessage}
        />
      </Paper>
    </Container>
  );
};

export default EditLyrics;
