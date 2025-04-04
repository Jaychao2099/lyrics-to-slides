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
      setSongId(propsSongId);
    }
  }, [propsSongId]);

  useEffect(() => {
    if (lyrics && imageUrl && !slideContent && !isGenerating) {
      generateSlides();
    }
  }, [lyrics, imageUrl]);

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
          onClick={() => onSlidesCreated(slideContent)}
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