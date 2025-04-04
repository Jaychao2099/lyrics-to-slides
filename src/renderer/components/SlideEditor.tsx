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

interface SlideEditorProps {
  lyrics: string;
  imageUrl: string;
  songId?: number;
  onSlidesCreated: (slideContent: string) => void;
}

const SlideEditor: React.FC<SlideEditorProps> = ({ lyrics, imageUrl, songId: propsSongId, onSlidesCreated }) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [slideContent, setSlideContent] = useState<string>('');
  const [songId, setSongId] = useState<number>(propsSongId || -1);
  const [tabValue, setTabValue] = useState<number>(0);
  const [previewHtml, setPreviewHtml] = useState<string>('');
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
      hasSlideContent: !!slideContent
    });
    
    const checkRelatedSlide = async () => {
      if (songId > 0) {
        try {
          console.log('開始檢查歌曲ID', songId, '的關聯投影片');
          // 檢查是否有關聯投影片
          const result = await window.electronAPI.checkRelatedSlide(songId);
          console.log('關聯投影片檢查結果:', result);
          
          if (result && result.hasRelatedSlide && result.slideContent) {
            console.log('找到關聯投影片，長度:', result.slideContent.length);
            // 找到關聯投影片，直接加載
            setSlideContent(result.slideContent);
            setEditingContent(result.slideContent);
            updatePreview(result.slideContent);
            
            // 可以添加提示
            setSnackbarMessage('已加載關聯投影片');
            setSnackbarOpen(true);
            return;
          } else {
            console.log('未找到關聯投影片或內容無效');
          }
        } catch (err) {
          console.error('檢查關聯投影片失敗:', err);
        }
      } else {
        console.log('songId無效，跳過關聯投影片檢查:', songId);
      }
      
      // 如果沒有關聯投影片並且有歌詞和圖片，則生成新的投影片
      if (lyrics && imageUrl && !slideContent && !isGenerating) {
        console.log('未找到關聯投影片，開始生成新投影片');
        generateSlides();
      }
    };
    
    checkRelatedSlide();
  }, [lyrics, imageUrl, songId]);

  const generateSlides = async () => {
    try {
      setIsGenerating(true);
      setError('');
      
      const result = await window.electronAPI.generateSlides(
        songId,
        'Untitled',
        '',
        lyrics, 
        imageUrl
      );
      
      if (result) {
        setSlideContent(result);
        setEditingContent(result);
        updatePreview(result);
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

  const updatePreview = async (content: string) => {
    try {
      const html = await window.electronAPI.previewSlides(content);
      setPreviewHtml(typeof html === 'string' ? html : '預覽載入中...');
    } catch (err: any) {
      console.error('預覽生成錯誤:', err);
      setPreviewHtml('<div>預覽生成錯誤</div>');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 1) {
      updatePreview(editingContent);
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
      updatePreview(editingContent);
      
      if (songId > 0) {
        const saved = await window.electronAPI.updateSlides(songId, editingContent);
        if (saved) {
          setSnackbarMessage('已保存變更到數據庫');
        } else {
          throw new Error('保存到數據庫失敗');
        }
      } else {
        setSnackbarMessage('已保存變更（本地）');
        console.warn('songId不正確，無法保存到數據庫，仅保存到本地。songId:', songId);
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

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        投影片編輯
      </Typography>
      
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
        <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
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
                minRows={10}
                maxRows={20}
                variant="outlined"
                value={editingContent}
                onChange={handleContentChange}
                sx={{ fontFamily: 'monospace' }}
              />
              
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button variant="contained" onClick={saveChanges}>
                  保存變更
                </Button>
                <Button variant="outlined" onClick={regenerateSlides}>
                  重新生成
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box 
              sx={{ 
                p: 2, 
                minHeight: '300px', 
                border: '1px solid #ddd',
                borderRadius: 1,
                overflow: 'auto'
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          )}
        </Paper>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={handleNext}
          disabled={!slideContent || isGenerating}
        >
          下一步
        </Button>
      </Box>
      
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