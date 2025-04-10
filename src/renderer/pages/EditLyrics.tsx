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
  Snackbar,
  Stack,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PreviewIcon from '@mui/icons-material/Preview';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import EditIcon from '@mui/icons-material/Edit';
import { Song } from '../../common/types';
import SlideEditor from '../components/SlideEditor';
import ImageGeneration from '../components/ImageGeneration';
import { Refresh, FileDownload, Delete } from '@mui/icons-material';

const EditLyrics: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const songId = Number(id);

  const [song, setSong] = useState<Song | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [textColor, setTextColor] = useState('#000000');
  const [strokeColor, setStrokeColor] = useState('#ffffff');
  const [strokeSize, setStrokeSize] = useState(5);
  const [fontWeight, setFontWeight] = useState('400');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [hasImage, setHasImage] = useState(false);
  const [hasSlide, setHasSlide] = useState(false);
  const [showSlideEditor, setShowSlideEditor] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportPath, setExportPath] = useState('');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [exportFileName, setExportFileName] = useState('');

  // 載入歌曲資料
  useEffect(() => {
    const loadSong = async () => {
      try {
        console.log('開始載入歌曲資料，歌曲ID:', songId);
        const songData = await window.electronAPI.getSongById(songId);
        if (songData) {
          setSong(songData);
          setTitle(songData.title);
          setArtist(songData.artist || '');
          setLyrics(songData.lyrics || '');
          setImageUrl(songData.imageUrl || null);
          setTextColor(songData.textColor || '#000000');
          setStrokeColor(songData.strokeColor || '#ffffff');
          setStrokeSize(songData.strokeSize || 5);
          setFontWeight(songData.fontWeight || '400');
          
          console.log('歌曲資料載入成功，imageUrl:', songData.imageUrl);
          
          // 檢查是否有關聯的圖片和投影片
          const imageResult = await window.electronAPI.checkRelatedImage(songId);
          const slideResult = await window.electronAPI.checkRelatedSlide(songId);
          
          console.log('關聯圖片檢查結果:', imageResult, '關聯投影片檢查結果:', slideResult);
          
          // 如果有imageUrl或檢查到關聯圖片，則設置hasImage為true
          setHasImage(!!songData.imageUrl || imageResult.hasRelatedImage);
          setHasSlide(slideResult.hasRelatedSlide);
          
          // 如果有圖片，自動顯示投影片編輯器
          if (!!songData.imageUrl || imageResult.hasRelatedImage) {
            setShowSlideEditor(true);
          }
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
    console.log('imageUrl變更:', imageUrl, '當前hasImage:', hasImage);
    if (imageUrl) {
      setHasImage(true);
    }
  }, [imageUrl]);

  // 儲存歌曲資料
  const handleSave = async () => {
    setSaving(true);
    try {
      // 記錄當前保存的值
      console.log('正在保存歌曲資料，文字粗細值為:', fontWeight, typeof fontWeight);
      
      // 先儲存歌曲基本資料
      const result = await window.electronAPI.saveSongDetails(songId, {
        title,
        artist,
        lyrics,
        imageUrl: imageUrl || undefined,
        textColor,
        strokeColor,
        strokeSize,
        fontWeight
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
        
        // 儲存成功後重新生成投影片以應用新設定
        // if (hasImage && imageUrl) {
        //   try {
        //     console.log('正在重新生成投影片以應用新設定...');
        //     await handleRegenerateSlides();
        //   } catch (regenerateError) {
        //     console.error('儲存後重新生成投影片失敗:', regenerateError);
        //   }
        // }
        
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

  // 處理圖片生成完成
  const handleImageGenerated = (imagePath: string, newSongId: number) => {
    console.log('接收到生成的圖片:', imagePath, '歌曲ID:', newSongId);
    
    // 檢查newSongId與當前頁面的songId是否一致
    if (newSongId !== songId) {
      console.warn(`警告：生成圖片返回的songId(${newSongId})與當前頁面的songId(${songId})不一致，將使用當前頁面的songId`);
    }
    
    // 使用當前頁面的songId，因為是在編輯頁面
    const targetSongId = songId;
    
    // 無論之前是否有圖片，都直接更新
    setImageUrl(imagePath);
    setHasImage(true);
    setShowSlideEditor(true);
    
    // 確保儲存歌曲詳情，使用新圖片覆蓋舊圖片
    window.electronAPI.saveSongDetails(targetSongId, {
      title,
      artist,
      lyrics,
      imageUrl: imagePath,
      textColor,
      strokeColor,
      strokeSize,
      fontWeight
    }).then(() => {
      console.log('已使用新生成的圖片更新歌曲詳情');
      // 同時更新圖片關聯
      return window.electronAPI.saveSongImageAssociation(targetSongId, imagePath);
    }).then(() => {
      console.log('已更新圖片關聯');
      setSnackbarMessage('已更新背景圖片');
      setSnackbarOpen(true);
    }).catch(error => {
      console.error('儲存生成圖片後的歌曲詳情或關聯失敗:', error);
      setError('更新歌曲圖片失敗');
    });
  };

  // 前往設定頁面
  const handleNavigateToSettings = () => {
    navigate('/settings');
  };

  // 預覽投影片
  const handlePreview = async () => {
    try {
      if (!imageUrl) {
        setError('請先生成或選擇背景圖片，圖片URL不存在');
        return;
      }

      // 確保儲存歌曲詳情和圖片關聯
      await window.electronAPI.saveSongDetails(songId, {
        title,
        artist,
        lyrics,
        imageUrl,
        textColor,
        strokeColor,
        strokeSize,
        fontWeight
      });
      
      // 確保圖片關聯
      if (!hasImage) {
        try {
          await window.electronAPI.saveSongImageAssociation(songId, imageUrl);
          setHasImage(true);
          setSnackbarMessage('已修復圖片關聯');
          setSnackbarOpen(true);
        } catch (repairError) {
          setError('修復圖片關聯失敗，請重新生成或選擇圖片');
          console.error('修復圖片關聯失敗:', repairError);
          return;
        }
      }

      // 顯示投影片編輯器
      setShowSlideEditor(true);
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

      // 確保儲存歌曲詳情和圖片關聯
      await window.electronAPI.saveSongDetails(songId, {
        title,
        artist,
        lyrics,
        imageUrl,
        textColor,
        strokeColor,
        strokeSize,
        fontWeight
      });
      
      // 確保圖片關聯
      if (!hasImage) {
        try {
          await window.electronAPI.saveSongImageAssociation(songId, imageUrl);
          setHasImage(true);
          setSnackbarMessage('已修復圖片關聯');
          setSnackbarOpen(true);
        } catch (repairError) {
          setError('修復圖片關聯失敗，請重新生成或選擇圖片');
          console.error('修復圖片關聯失敗:', repairError);
          return;
        }
      }

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

  // 匯出投影片 - 開啟導出對話框
  const handleExport = async () => {
    try {
      if (!hasSlide) {
        setError('請先生成投影片');
        return;
      }

      // 設置預設檔名為歌曲標題
      setExportFileName(title.replace(/[\\/:*?"<>|]/g, '_') || 'slides');
      
      // 獲取預設輸出路徑和預設匯出格式
      const settings = await window.electronAPI.getSettings();
      if (settings.defaultOutputDirectory) {
        setExportPath(settings.defaultOutputDirectory);
      }
      if (settings.defaultExportFormat) {
        setExportFormat(settings.defaultExportFormat);
      }
      
      setExportDialogOpen(true);
    } catch (error) {
      setError('準備匯出失敗');
      console.error('準備匯出失敗:', error);
    }
  };

  // 選擇導出路徑
  const handleSelectExportPath = async () => {
    try {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        setExportPath(path);
      }
    } catch (error) {
      setError('選擇導出路徑失敗');
      console.error('選擇導出路徑失敗:', error);
    }
  };

  // 執行導出投影片
  const handleExportSlides = async () => {
    try {
      if (!exportPath || !exportFileName) {
        setError('請選擇導出路徑並輸入檔案名稱');
        return;
      }

      const slideContent = await window.electronAPI.getSlides(songId);
      if (!slideContent) {
        setError('找不到投影片內容');
        return;
      }

      // 添加檔案名稱
      const fileName = `${exportFileName}.${exportFormat}`;
      const fullPath = `${exportPath}/${fileName}`;
      
      // 根據格式選擇對應的導出函數
      let resultPath;
      switch (exportFormat) {
        case 'pdf':
          resultPath = await window.electronAPI.exportToPDF(slideContent, fullPath);
          break;
        case 'pptx':
          resultPath = await window.electronAPI.exportToPPTX(slideContent, fullPath);
          break;
        case 'html':
          resultPath = await window.electronAPI.exportToHTML(slideContent, fullPath);
          break;
        default:
          // 批量導出所有格式
          const formats = ['pdf', 'pptx', 'html'];
          const results = await window.electronAPI.batchExport(slideContent, formats, exportPath);
          resultPath = results[0];
      }
      
      setExportDialogOpen(false);
      setSnackbarMessage(`投影片已成功導出到: ${fullPath}`);
      setSnackbarOpen(true);
    } catch (error) {
      setError('匯出失敗');
      console.error('匯出失敗:', error);
    }
  };

  // 選擇本地圖片
  // const handleSelectLocalImage = async () => {
  //   try {
  //     const imagePath = await window.electronAPI.selectLocalImage();
  //     if (imagePath) {
  //       const result = await window.electronAPI.importLocalImage(songId, imagePath);
  //       if (result) {
  //         setImageUrl(result.imagePath);
  //         setHasImage(true);
          
  //         // 確保儲存圖片關聯
  //         await window.electronAPI.saveSongImageAssociation(songId, result.imagePath);
          
  //         // 更新歌曲詳情中的imageUrl
  //         await window.electronAPI.saveSongDetails(songId, {
  //           title,
  //           artist,
  //           lyrics,
  //           imageUrl: result.imagePath,
  //           textColor,
  //           strokeColor,
  //           strokeSize
  //         });
          
  //         setSnackbarMessage('圖片匯入成功並已關聯');
  //         setSnackbarOpen(true);
          
  //         // 確保顯示投影片編輯器
  //         setShowSlideEditor(true);
  //       }
  //     }
  //   } catch (error) {
  //     setError('匯入圖片失敗');
  //     console.error('匯入圖片失敗:', error);
  //   }
  // };

  // 返回上一頁
  const handleBack = () => {
    navigate(-1);
  };

  // 處理投影片編輯器顯示/隱藏
  const toggleSlideEditor = () => {
    if (!imageUrl) {
      setError('請先生成或選擇背景圖片，圖片URL不存在');
      return;
    }
    setShowSlideEditor(!showSlideEditor);
  };

  // 刪除投影片
  const handleDeleteSlides = async () => {
    try {
      if (!hasSlide) {
        setError('沒有投影片可刪除');
        return;
      }

      const confirmed = window.confirm('確定要刪除此歌曲的投影片嗎？此操作無法撤銷。');
      if (!confirmed) {
        return;
      }

      // 使用正確的API
      const result = await window.electronAPI.clearSlidesCache();
      if (result.success) {
        setHasSlide(false);
        setSnackbarMessage('投影片已刪除');
        setSnackbarOpen(true);
      } else {
        setError('刪除投影片失敗');
      }
    } catch (error) {
      setError('刪除投影片失敗');
      console.error('刪除投影片失敗:', error);
    }
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
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            編輯歌詞
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
              <Box sx={{ flex: 1, minWidth: '250px' }}>
                <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    基本資訊
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      fullWidth
                      label="歌曲標題"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      margin="normal"
                      variant="outlined"
                    />
                    <TextField
                      fullWidth
                      label="歌手"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      margin="normal"
                      variant="outlined"
                    />
                  </Box>
                </Paper>

                <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    歌詞內容
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={8}
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    variant="outlined"
                    placeholder="輸入歌詞..."
                  />
                </Paper>

                {/* 圖片生成組件 */}
                <ImageGeneration
                  songTitle={title}
                  lyrics={lyrics}
                  onImageGenerated={handleImageGenerated}
                  onNavigateToSettings={handleNavigateToSettings}
                  songId={songId}
                />
              </Box>

              <Box sx={{ flex: 2 }}>
                <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    文字格式設定
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <TextField
                      label="文字顏色"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      margin="normal"
                      type="color"
                      sx={{ flex: 1, minWidth: '120px' }}
                    />
                    <TextField
                      label="邊框顏色"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      margin="normal"
                      type="color"
                      sx={{ flex: 1, minWidth: '120px' }}
                    />
                    <FormControl sx={{ flex: 1, minWidth: '180px', margin: '16px 0 8px 0' }}>
                      <InputLabel id="font-weight-label">文字粗細</InputLabel>
                      <Select
                        labelId="font-weight-label"
                        value={fontWeight}
                        label="文字粗細"
                        onChange={(e) => setFontWeight(e.target.value)}
                      >
                        <MenuItem value="100">100 = 淡</MenuItem>
                        <MenuItem value="200">200 = 特細</MenuItem>
                        <MenuItem value="300">300 = 細</MenuItem>
                        <MenuItem value="400">400 = 標準</MenuItem>
                        <MenuItem value="500">500 = 適中</MenuItem>
                        <MenuItem value="600">600 = 次粗體</MenuItem>
                        <MenuItem value="700">700 = 粗體</MenuItem>
                        <MenuItem value="800">800 = 黑體</MenuItem>
                        <MenuItem value="900">900 = 特黑體</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      label="邊框粗細"
                      value={strokeSize}
                      onChange={(e) => setStrokeSize(Number(e.target.value))}
                      margin="normal"
                      type="number"
                      inputProps={{ min: 0, max: 20 }}
                      sx={{ flex: 1, minWidth: '120px' }}
                    />
                  </Box>
                </Paper>

                {imageUrl && (
                  <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      投影片控制
                    </Typography>
                    <Stack direction="column" spacing={2}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleRegenerateSlides}
                        startIcon={<Refresh />}
                        fullWidth
                      >
                        生成投影片
                      </Button>
                      
                      <Button
                        variant="outlined"
                        onClick={toggleSlideEditor}
                        startIcon={<PreviewIcon />}
                        fullWidth
                      >
                        編輯/預覽投影片
                      </Button>
                      
                      <Button
                        variant="outlined"
                        onClick={handleExport}
                        startIcon={<FileDownload />}
                        fullWidth
                        disabled={!hasSlide}
                      >
                        匯出投影片
                      </Button>
                      
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={handleDeleteSlides}
                        startIcon={<Delete />}
                        fullWidth
                        disabled={!hasSlide}
                      >
                        刪除投影片
                      </Button>
                    </Stack>
                  </Paper>
                )}
                
                {/* 投影片編輯器 */}
                {showSlideEditor && imageUrl && (
                  <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      投影片文本編輯
                    </Typography>
                    <SlideEditor 
                      lyrics={lyrics} 
                      imageUrl={imageUrl} 
                      songId={songId}
                      onSlidesCreated={handleRegenerateSlides} 
                    />
                  </Paper>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
                sx={{ mr: 2 }}
              >
                {saving ? '儲存中...' : '儲存所有修改'}
              </Button>
            </Box>
          </>
        )}

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          message={snackbarMessage}
        />

        {/* 導出對話框 */}
        <Dialog 
          open={exportDialogOpen} 
          onClose={() => setExportDialogOpen(false)}
        >
          <DialogTitle>導出投影片</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, mt: 1 }}>
              <TextField
                margin="dense"
                label="導出路徑"
                fullWidth
                variant="outlined"
                value={exportPath}
                InputProps={{ readOnly: true }}
                sx={{ mr: 1 }}
              />
              <Button 
                variant="outlined" 
                onClick={handleSelectExportPath}
              >
                選擇
              </Button>
            </Box>

            <TextField
              margin="dense"
              label="檔案名稱"
              fullWidth
              variant="outlined"
              value={exportFileName}
              onChange={(e) => setExportFileName(e.target.value)}
              sx={{ mb: 2 }}
            />
            
            <TextField
              select
              label="格式"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              fullWidth
              variant="outlined"
              SelectProps={{
                native: true,
              }}
            >
              <option value="pdf">PDF</option>
              <option value="pptx">PowerPoint (PPTX)</option>
              <option value="html">HTML</option>
              <option value="all">所有格式</option>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportDialogOpen(false)}>取消</Button>
            <Button 
              onClick={handleExportSlides}
              variant="contained"
              disabled={!exportPath || !exportFileName.trim()}
            >
              導出
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default EditLyrics;
