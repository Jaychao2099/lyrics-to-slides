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
  Snackbar,
  Tabs,
  Tab
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import UploadFileIcon from '@mui/icons-material/UploadFile';

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
  songId?: number; // 添加歌曲ID作為屬性
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
  onNavigateToSettings,
  songId: propsSongId = -1
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [songId, setSongId] = useState<number>(propsSongId);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [imageSource, setImageSource] = useState<ImageSourceOption>(ImageSourceOption.AI);
  const [hasRelatedImage, setHasRelatedImage] = useState<boolean>(false);

  // 初始化時檢查是否有關聯圖片
  useEffect(() => {
    // 添加診斷日誌
    console.log('ImageGeneration useEffect 觸發，songId:', propsSongId, '當前songId:', songId);
    
    // 更新本地狀態的songId
    if (propsSongId && propsSongId !== songId) {
      console.log('更新 ImageGeneration 組件中的 songId:', propsSongId);
      setSongId(propsSongId);
    }
    
    // 重置確認狀態
    setIsConfirmed(false);
    
    // 檢查是否有關聯圖片
    const checkRelatedImage = async () => {
      if (propsSongId > 0) {
        try {
          console.log('開始檢查歌曲ID', propsSongId, '的關聯圖片');
          setIsGenerating(true);
          // 檢查關聯圖片
          const result = await window.electronAPI.checkRelatedImage(propsSongId);
          console.log('關聯圖片檢查結果:', result);
          
          if (result && result.hasRelatedImage && result.imagePath) {
            console.log('找到關聯圖片:', result.imagePath);
            // 有關聯圖片，顯示關聯圖片，但始終默認選擇AI生成模式
            setImageUrl(result.imagePath);
            setHasRelatedImage(true);
            setImageSource(ImageSourceOption.AI); // 默認選擇AI生成模式
            
            // 可以添加一個提示
            setSnackbarMessage('已找到關聯圖片，您可以使用AI重新生成');
            setSnackbarOpen(true);
          } else {
            console.log('未找到關聯圖片或圖片路徑無效');
            setImageSource(ImageSourceOption.AI); // 確保默認為AI生成模式
          }
        } catch (err) {
          console.error('檢查關聯圖片失敗:', err);
        } finally {
          setIsGenerating(false);
        }
      } else {
        console.log('songId無效，跳過關聯圖片檢查:', propsSongId);
      }
    };
    
    checkRelatedImage();
  }, [propsSongId, songId]);

  // 生成圖片 - AI 方式
  const generateImage = async () => {
    try {
      setIsGenerating(true);
      setError('');
      
      // 即使已有關聯圖片，也可以重新生成
      console.log('開始生成新圖片，無論是否已有關聯圖片');
      
      // 通過API生成圖片 - 根據main/index.ts中的定義:
      // ipcMain.handle('generate-image', async (_event, songTitle, lyrics, songId = -1)
      const result = await window.electronAPI.generateImage(
        songTitle, 
        lyrics, 
        songId >= 0 ? songId : undefined
      );
      
      if (result && typeof result === 'object' && 'imagePath' in result && 'songId' in result) {
        console.log('成功生成新圖片:', result.imagePath);
        
        // 更新組件中的圖片URL和歌曲ID
        setImageUrl(result.imagePath);
        setSongId(result.songId);
        
        // 如果之前已有關聯圖片，則overwrite
        if (hasRelatedImage) {
          console.log('已有關聯圖片，將被新生成的圖片替換');
        }
        
        // 自動儲存圖片關聯並調用onImageGenerated
        try {
          // 使用AI生成的新圖片替代之前的
          await window.electronAPI.saveSongImageAssociation(result.songId, result.imagePath);
          
          // 調用回調函數
          onImageGenerated(result.imagePath, result.songId);
          
          setIsConfirmed(true);
          setHasRelatedImage(true); // 設置為有關聯圖片
          setSnackbarMessage('已更新背景圖片');
          setSnackbarOpen(true);
        } catch (err) {
          console.error('儲存圖片關聯失敗:', err);
          // 即使關聯儲存失敗，也繼續流程
          onImageGenerated(result.imagePath, result.songId);
        }
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
      const localImagePath = await window.electronAPI.selectLocalImage();
      
      if (!localImagePath) {
        setError('未選擇圖片');
        return;
      }
      
      setIsGenerating(true);
      setError('');
      
      // 匯入本地圖片
      const result = await window.electronAPI.importLocalImage(
        songId >= 0 ? songId : -1,
        localImagePath
      );
      
      if (result && typeof result === 'object' && 'imagePath' in result && 'songId' in result) {
        setImageUrl(result.imagePath);
        setSongId(result.songId);
        
        // 自動儲存圖片關聯並調用onImageGenerated
        try {
          await window.electronAPI.saveSongImageAssociation(result.songId, result.imagePath);
          onImageGenerated(result.imagePath, result.songId);
          setIsConfirmed(true);
          setSnackbarMessage('已設定背景圖片');
          setSnackbarOpen(true);
        } catch (err) {
          console.error('儲存圖片關聯失敗:', err);
          // 即使關聯儲存失敗，也繼續流程
          onImageGenerated(result.imagePath, result.songId);
        }
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

  // 處理圖片來源切換
  const handleImageSourceChange = (_event: React.SyntheticEvent, newValue: ImageSourceOption) => {
    console.log(`切換圖片來源從 ${imageSource} 到 ${newValue}`);
    setImageSource(newValue);
    
    // 清除錯誤
    setError('');
    
    // 如果切換到本地圖片，但還沒有選擇過，可以顯示提示
    if (newValue === ImageSourceOption.LOCAL && !hasRelatedImage && !imageUrl) {
      setSnackbarMessage('請選擇本地圖片');
      setSnackbarOpen(true);
    }
    
    // 如果切換到AI生成，但還沒有生成過，可以顯示提示
    if (newValue === ImageSourceOption.AI && !imageUrl) {
      setSnackbarMessage('請輸入歌詞後生成圖片');
      setSnackbarOpen(true);
    }
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
      
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
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
                title={!songTitle ? '請輸入歌曲標題' : !lyrics ? '請輸入歌詞' : isGenerating ? '正在生成中...' : hasRelatedImage ? '將會替換現有的背景圖片' : '生成新的背景圖片'}
              >
                {isGenerating ? '生成中...' : hasRelatedImage ? '重新生成AI圖片' : '使用AI生成圖片'}
              </Button>
              {hasRelatedImage && !isGenerating && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2, alignSelf: 'center' }}>
                  圖片將被替換
                </Typography>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={importLocalImage}
                disabled={isGenerating}
                startIcon={<UploadFileIcon />}
                title={hasRelatedImage ? '將會替換現有的背景圖片' : '選擇本地圖片作為背景'}
              >
                {hasRelatedImage ? '更換本地圖片' : '選擇本地圖片'}
              </Button>
              {hasRelatedImage && !isGenerating && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2, alignSelf: 'center' }}>
                  圖片將被替換
                </Typography>
              )}
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