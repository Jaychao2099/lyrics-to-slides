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
  Link,
  Divider
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

// 定義API返回類型
interface ImageGenerationResult {
  songId: number;
  imagePath: string;
}

interface ImageGenerationProps {
  songTitle: string;
  lyrics: string;
  onImageGenerated: (imageUrl: string) => void;
  onNavigateToSettings?: () => void;
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

  // 當組件載入後自動生成圖片
  useEffect(() => {
    if (songTitle && lyrics && !imageUrl && !isGenerating) {
      generateImage();
    }
  }, [songTitle, lyrics]);

  // 生成圖片
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

  // 重新生成圖片
  const regenerateImage = async () => {
    try {
      setIsGenerating(true);
      setError('');
      setRating(null);
      setIsConfirmed(false);
      
      // 通過API重新生成圖片 - 根據main/index.ts中的定義:
      // ipcMain.handle('regenerate-image', async (_event, songId, songTitle, lyrics)
      // 和preload/index.ts中的定義:
      // regenerateImage: (songId: number, songTitle: string, lyrics: string)
      const result = await window.electronAPI.regenerateImage(
        songId,
        songTitle,
        lyrics
      );
      
      if (result && typeof result === 'object' && 'imagePath' in result) {
        setImageUrl(result.imagePath);
        setSnackbarMessage('圖片已重新生成');
        setSnackbarOpen(true);
        // 不再自動調用 onImageGenerated，等待用戶確認
      } else {
        throw new Error('重新生成圖片失敗');
      }
    } catch (err: any) {
      setError(err.message || '重新生成圖片時發生錯誤');
      console.error('圖片重新生成錯誤:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // 處理圖片評分
  const handleRatingChange = (event: React.SyntheticEvent, newValue: number | null) => {
    setRating(newValue);
    if (newValue && newValue < 3) {
      setSnackbarMessage('評分較低，您可以點擊"重新生成"嘗試獲得更好的結果');
      setSnackbarOpen(true);
    }
  };

  // 關閉提示訊息
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // 確認圖片並進入下一步
  const confirmImage = () => {
    setIsConfirmed(true);
    onImageGenerated(imageUrl);
  };

  // 導航到設定頁面
  const goToSettings = () => {
    if (onNavigateToSettings) {
      onNavigateToSettings();
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        圖片生成
      </Typography>
      
      <Typography variant="body1" paragraph>
        歌曲標題: {songTitle}
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ width: '100%' }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              生成的背景圖片:
            </Typography>
            
            {/* 提示詞設定提示 */}
            <Alert severity="info" sx={{ mb: 2 }}>
              如需更改圖片生成效果，您可以先
              <Link 
                component="button"
                variant="body2"
                onClick={goToSettings}
                sx={{ mx: 1 }}
              >
                <SettingsIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                前往設定頁面
              </Link>
              進行提示詞修改，保存設定後再回來。
            </Alert>
          </Box>
          
          <Box>
            {isGenerating ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ ml: 2 }}>
                  正在生成符合歌詞風格的背景圖片...
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
                  >
                    重新生成
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                尚未生成圖片
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>
      
      <Divider sx={{ my: 2 }} />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        {imageUrl && !isGenerating && (
          <Button 
            variant="contained" 
            color="primary"
            onClick={confirmImage}
            disabled={isConfirmed}
          >
            確認圖片並前往下一步
          </Button>
        )}
        
        {!isGenerating && !imageUrl && (
          <Button 
            variant="outlined" 
            onClick={generateImage}
          >
            生成圖片
          </Button>
        )}
      </Box>
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default ImageGeneration; 