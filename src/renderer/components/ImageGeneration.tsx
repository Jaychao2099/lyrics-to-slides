import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardMedia, 
  CircularProgress, 
  Alert, 
  Paper, 
  Stack,
  Rating,
  Snackbar,
  Tabs,
  Tab
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CachedIcon from '@mui/icons-material/Cached';

// 定義API返回類型
interface ImageGenerationResult {
  songId: number;
  imagePath: string;
}

// 定義組件屬性
interface ImageGenerationProps {
  songTitle: string;
  lyrics: string;
  onImageGenerated: (imagePath: string, songId: number) => void;
  onNavigateToSettings: () => void;
}

// 定義圖片來源選項
enum ImageSourceOption {
  AI = 'ai',
  LOCAL = 'local'
}

const ImageGeneration: React.FC<ImageGenerationProps> = ({ 
  songTitle, 
  lyrics, 
  onImageGenerated, 
  onNavigateToSettings 
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [songId, setSongId] = useState<number>(-1);
  const [rating, setRating] = useState<number | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [imageSource, setImageSource] = useState<ImageSourceOption>(ImageSourceOption.AI);

  // 移除自動生成，用戶需要手動點擊生成按鈕
  useEffect(() => {
    // 不再自動生成圖片
  }, []);

  // 生成圖片 - AI 方式
  const generateImage = async () => {
    try {
      setIsGenerating(true);
      setError('');
      setIsConfirmed(false);
      
      // 通過API生成圖片 - 根據main/index.ts中的定義:
      // ipcMain.handle('generate-image', async (_event, songTitle, lyrics, songId = -1)
      const result = await window.electronAPI.generateImage(
        songTitle, 
        lyrics, 
        songId >= 0 ? songId : undefined
      );
      
      if (result && typeof result === 'object' && 'imagePath' in result && 'songId' in result) {
        setImageUrl(result.imagePath);
        setSongId(result.songId);
        // 不再自動調用 onImageGenerated，等待用戶確認
      } else {
        throw new Error('生成圖片失敗');
      }
    } catch (err: any) {
      setError(err.message || '生成圖片時發生錯誤');
      console.error('圖片生成錯誤:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // 匯入本地圖片
  const importLocalImage = async () => {
    try {
      // 選擇本地圖片
      const localImagePath = await window.electronAPI.selectLocalImage();
      if (!localImagePath) return;
      
      setIsGenerating(true);
      setError('');
      setIsConfirmed(false);
      
      // 匯入本地圖片
      const result = await window.electronAPI.importLocalImage(
        songId >= 0 ? songId : -1,
        localImagePath
      );
      
      if (result && typeof result === 'object' && 'imagePath' in result && 'songId' in result) {
        setImageUrl(result.imagePath);
        setSongId(result.songId);
        // 不再自動調用 onImageGenerated，等待用戶確認
      } else {
        throw new Error('匯入圖片失敗');
      }
    } catch (err: any) {
      setError(err.message || '匯入圖片時發生錯誤');
      console.error('圖片匯入錯誤:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // 重新生成圖片
  const regenerateImage = async () => {
    try {
      if (songId < 0) {
        setError('無法重新生成圖片，沒有有效的歌曲ID');
        return;
      }

      setIsGenerating(true);
      setError('');
      setIsConfirmed(false);
      
      // 根據圖片來源選擇重新生成或匯入
      if (imageSource === ImageSourceOption.AI) {
        const result = await window.electronAPI.regenerateImage(
          songId,
          songTitle,
          lyrics
        );
        
        if (result && 'imagePath' in result) {
          setImageUrl(result.imagePath);
          setRating(null);
        } else {
          throw new Error('重新生成圖片失敗');
        }
      } else {
        await importLocalImage();
      }
    } catch (err: any) {
      setError(err.message || '重新生成圖片時發生錯誤');
      console.error('重新生成圖片錯誤:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // 處理圖片評分變化
  const handleRatingChange = (_event: React.ChangeEvent<{}>, newValue: number | null) => {
    setRating(newValue);
  };

  // 確認圖片選擇
  const confirmImage = () => {
    if (imageUrl && songId >= 0) {
      onImageGenerated(imageUrl, songId);
      setIsConfirmed(true);
      setSnackbarMessage('已確認使用此背景圖片');
      setSnackbarOpen(true);
    }
  };

  // 處理圖片來源切換
  const handleImageSourceChange = (_event: React.SyntheticEvent, newValue: ImageSourceOption) => {
    setImageSource(newValue);
  };

  // 關閉提示消息
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Box>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
      
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">背景圖片</Typography>
          <Button 
            startIcon={<SettingsIcon />}
            onClick={onNavigateToSettings}
            size="small"
          >
            API設定
          </Button>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={imageSource}
            onChange={handleImageSourceChange}
            aria-label="image source options"
          >
            <Tab 
              icon={<AutoAwesomeIcon />} 
              label="AI生成圖片" 
              value={ImageSourceOption.AI}
            />
            <Tab 
              icon={<UploadFileIcon />} 
              label="匯入本地圖片" 
              value={ImageSourceOption.LOCAL}
            />
          </Tabs>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box>
          {imageSource === ImageSourceOption.AI ? (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={generateImage}
                disabled={isGenerating || !songTitle || !lyrics}
              >
                {isGenerating ? '生成中...' : '使用AI生成圖片'}
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={importLocalImage}
                disabled={isGenerating}
                startIcon={<UploadFileIcon />}
              >
                選擇本地圖片
              </Button>
            </Box>
          )}
          
          <Box>
            {isGenerating ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ ml: 2 }}>
                  {imageSource === ImageSourceOption.AI ? '正在生成符合歌詞風格的背景圖片...' : '正在匯入本地圖片...'}
                </Typography>
              </Box>
            ) : imageUrl ? (
              <Box>
                <Card>
                  <CardMedia
                    component="img"
                    height="300"
                    image={imageUrl}
                    alt={`${songTitle} 背景圖片`}
                    sx={{ objectFit: 'contain' }}
                  />
                </Card>
                
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
                  <Typography component="legend">圖片評分:</Typography>
                  <Rating
                    name="image-rating"
                    value={rating}
                    onChange={handleRatingChange}
                  />
                  
                  <Button 
                    variant="outlined" 
                    color="primary"
                    onClick={regenerateImage}
                    disabled={isGenerating}
                    startIcon={<CachedIcon />}
                  >
                    {imageSource === ImageSourceOption.AI ? '重新生成' : '更換圖片'}
                  </Button>
                  
                  <Button
                    variant="contained"
                    color="success"
                    onClick={confirmImage}
                    disabled={isConfirmed}
                  >
                    確認使用此圖片
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {imageSource === ImageSourceOption.AI ? '尚未生成圖片' : '尚未選擇本地圖片'}
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ImageGeneration; 