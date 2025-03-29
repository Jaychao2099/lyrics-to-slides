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
  Snackbar
} from '@mui/material';

// 定義API返回類型
interface ImageGenerationResult {
  songId: number;
  imagePath: string;
}

interface ImageGenerationProps {
  songTitle: string;
  lyrics: string;
  onImageGenerated: (imageUrl: string) => void;
}

const ImageGeneration: React.FC<ImageGenerationProps> = ({ songTitle, lyrics, onImageGenerated }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [songId, setSongId] = useState<number>(-1);
  const [rating, setRating] = useState<number | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');

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
      
      // 通過API生成圖片
      const result = await window.electronAPI.generateImage(songTitle, lyrics, '') as unknown as ImageGenerationResult;
      
      if (result && result.imagePath && result.songId) {
        setImageUrl(result.imagePath);
        setSongId(result.songId);
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
      
      // 通過API重新生成圖片
      const result = await window.electronAPI.generateImage(songTitle, lyrics, '') as unknown as ImageGenerationResult;
      
      if (result && result.imagePath) {
        setImageUrl(result.imagePath);
        setSnackbarMessage('圖片已重新生成');
        setSnackbarOpen(true);
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
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => onImageGenerated(imageUrl)}
          disabled={!imageUrl || isGenerating}
        >
          下一步
        </Button>
        
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