import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  CircularProgress, 
  Alert, 
  Divider, 
  Tabs, 
  Tab, 
  TextField,
  Stack,
  IconButton,
  Tooltip,
  Snackbar
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto';
import TitleIcon from '@mui/icons-material/Title';
import PreviewIcon from '@mui/icons-material/Preview';

interface SlideEditorProps {
  lyrics: string;
  imageUrl: string;
  songId?: number;
  onSlidesCreated: (slideContent: string) => void;
  isBatchMode?: boolean;
}

const SlideEditor: React.FC<SlideEditorProps> = ({ lyrics, imageUrl, songId: propsSongId, onSlidesCreated, isBatchMode = false }) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [slideContent, setSlideContent] = useState<string>('');
  const [songId, setSongId] = useState<number>(propsSongId || 0);
  const [tabValue, setTabValue] = useState<number>(0);
  const [editingContent, setEditingContent] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');

  useEffect(() => {
    if (propsSongId && propsSongId !== songId) {
      console.log('更新 SlideEditor 組件中的 songId:', propsSongId, '舊值:', songId);
      setSongId(propsSongId);
    }
  }, [propsSongId, songId]);

  useEffect(() => {
    console.log('SlideEditor 檢查關聯投影片 useEffect 觸發', {
      songId,
      hasLyrics: !!lyrics,
      hasImageUrl: !!imageUrl,
      hasSlideContent: !!slideContent,
      isBatchMode
    });
    
    // 批量模式下，直接使用傳入的 lyrics 作為投影片內容
    if (isBatchMode && lyrics) {
      setSlideContent(lyrics);
      setEditingContent(lyrics);
      // 不自動觸發預覽窗口
      return;
    }
    
    const loadExistingSlides = async () => {
      if (songId > 0) {
        try {
          await checkRelatedSlide();
        } catch (err) {
          console.error('加載已有投影片失敗:', err);
          // 失敗時仍然嘗試生成投影片
          await generateSlides();
        }
      } else {
        generateSlides();
      }
    };
    
    // 只有當有歌詞和圖片時才嘗試加載或生成投影片
    if (lyrics && imageUrl) {
      loadExistingSlides();
    } else {
      setError('需要歌詞和背景圖片才能生成投影片');
    }
  }, [songId, lyrics, imageUrl, isBatchMode]);

  const checkRelatedSlide = async () => {
    try {
      const slideResult = await window.electronAPI.checkRelatedSlide(songId);
      
      if (slideResult.hasRelatedSlide) {
        const slidesContent = await window.electronAPI.getSlides(songId);
        if (slidesContent) {
          setSlideContent(slidesContent);
          setEditingContent(slidesContent);
        } else {
          await generateSlides();
        }
      } else {
        await generateSlides();
      }
    } catch (err: any) {
      console.error('檢查關聯投影片失敗:', err);
      setError(err.message || '檢查關聯投影片時發生錯誤');
      await generateSlides();
    }
  };
  
  const generateSlides = async () => {
    try {
      setIsGenerating(true);
      setError('');
      
      // 獲取歌曲標題和歌手
      let songTitle = 'Untitled';
      let songArtist = '';
      
      if (songId > 0) {
        try {
          const songDetails = await window.electronAPI.getSongById(songId);
          if (songDetails) {
            songTitle = songDetails.title || 'Untitled';
            songArtist = songDetails.artist || '';
          }
        } catch (err) {
          console.error('獲取歌曲詳情失敗:', err);
        }
      }
      
      const result = await window.electronAPI.generateSlides(
        songId,
        songTitle,
        songArtist,
        lyrics, 
        imageUrl
      );
      
      if (result) {
        setSlideContent(result);
        setEditingContent(result);
        
        // 預覽投影片
        await window.electronAPI.previewSlides(result);
        
        // 通知上層組件投影片已創建
        onSlidesCreated(result);
      } else {
        throw new Error('生成投影片失敗');
      }
    } catch (err: any) {
      setError(err.message || '生成投影片時發生錯誤');
      console.error('投影片生成錯誤:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    // 如果切換到預覽標籤，嘗試打開預覽窗口
    if (newValue === 1) {
      openPreviewWindow();
    }
  };

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditingContent(event.target.value);
  };

  const saveChanges = async () => {
    try {
      setSnackbarMessage('保存中...');
      setSnackbarOpen(true);
      
      setSlideContent(editingContent);
      
      if (songId > 0) {
        const saved = await window.electronAPI.updateSlides(songId, editingContent);
        if (saved) {
          setSnackbarMessage('已保存變更到數據庫');
        } else {
          throw new Error('保存到數據庫失敗');
        }
        
        // 整合handleNext功能 - 確保保存資源關聯
        console.log('確認使用投影片，歌曲ID:', songId);
        const saveResult = await window.electronAPI.saveSongSlideAssociation(songId, editingContent);
        console.log('保存投影片關聯結果:', saveResult);
        
        // 繼續流程
        onSlidesCreated(editingContent);
      } else {
        setSnackbarMessage('已保存變更（本地）');
        console.warn('songId不正確，無法保存到數據庫，僅保存到本地。songId:', songId);
        
        // 即使沒有songId，也仍然通知上層組件投影片已創建
        onSlidesCreated(editingContent);
      }
      
      setSnackbarOpen(true);
    } catch (err: any) {
      setError(err.message || '保存投影片內容時發生錯誤');
      console.error('保存投影片錯誤:', err);
    }
  };

  const regenerateSlides = async () => {
    await generateSlides();
  };

  const insertFormatting = (format: string) => {
    const textarea = document.getElementById('slide-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editingContent.substring(start, end);
    let formattedText = '';

    switch(format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'heading':
        formattedText = `### ${selectedText}`;
        break;
      case 'list':
        formattedText = `- ${selectedText}`;
        break;
      case 'image':
        formattedText = `![bg](${imageUrl})\n\n${selectedText}`;
        break;
      default:
        formattedText = selectedText;
    }

    const newContent = editingContent.substring(0, start) + formattedText + editingContent.substring(end);
    setEditingContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
    }, 10);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const handleNext = async () => {
    if (slideContent) {
      try {
        console.log('確認使用投影片，歌曲ID:', songId);
        
        // 確保保存資源關聯
        const saveResult = await window.electronAPI.saveSongSlideAssociation(songId, slideContent);
        console.log('保存投影片關聯結果:', saveResult);
        
        // 繼續流程
        onSlidesCreated(slideContent);
      } catch (err) {
        console.error('保存投影片關聯失敗:', err);
        // 即使關聯保存失敗，也繼續流程
        onSlidesCreated(slideContent);
      }
    }
  };

  // 打開預覽窗口
  const openPreviewWindow = async () => {
    try {
      // 先保存當前編輯的內容
      setSlideContent(editingContent);
      
      // 使用 previewSlides API 來打開預覽窗口
      await window.electronAPI.previewSlides(editingContent);
      
      // 顯示成功訊息
      setSnackbarMessage('預覽窗口已打開');
      setSnackbarOpen(true);
    } catch (err: any) {
      setError('打開預覽窗口失敗: ' + (err.message || '未知錯誤'));
      console.error('預覽錯誤:', err);
    }
  };

  return (
    <Box>
      {/* <Typography variant="h5" gutterBottom sx={{ color: 'primary.main' }}>
        投影片文本編輯器
      </Typography> */}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {isGenerating ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <CircularProgress />
          <Typography variant="body2" sx={{ ml: 2 }}>
            正在生成投影片...
          </Typography>
        </Box>
      ) : (
        <Paper elevation={3} sx={{ p: 2, mb: 3, border: '2px solid', borderColor: 'primary.main' }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            在這裡編輯投影片的Markdown文本，可直接修改文字內容和格式
          </Alert>
          <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
            <Tab label="編輯" />
            <Tab label="預覽" />
          </Tabs>
          
          <Divider sx={{ mb: 2 }} />
          
          {tabValue === 0 ? (
            <Box>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Tooltip title="加粗">
                  <IconButton onClick={() => insertFormatting('bold')}>
                    <FormatBoldIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="斜體">
                  <IconButton onClick={() => insertFormatting('italic')}>
                    <FormatItalicIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="標題">
                  <IconButton onClick={() => insertFormatting('heading')}>
                    <TitleIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="列表">
                  <IconButton onClick={() => insertFormatting('list')}>
                    <FormatListBulletedIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="插入背景圖片">
                  <IconButton onClick={() => insertFormatting('image')}>
                    <InsertPhotoIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
              
              <TextField
                id="slide-editor"
                multiline
                fullWidth
                rows={10}
                variant="outlined"
                value={editingContent}
                onChange={handleContentChange}
                sx={{ fontFamily: 'monospace', backgroundColor: 'background.paper' }}
              />
              
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button variant="contained" color="primary" onClick={saveChanges} sx={{ fontWeight: 'bold' }}>
                  保存變更
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box sx={{ height: '500px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                預覽視窗已在獨立窗口中打開
              </Typography>
            </Box>
          )}
        </Paper>
      )}
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default SlideEditor; 