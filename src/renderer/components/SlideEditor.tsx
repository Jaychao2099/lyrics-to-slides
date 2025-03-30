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
  onSlidesCreated: (slideContent: string) => void;
}

const SlideEditor: React.FC<SlideEditorProps> = ({ lyrics, imageUrl, onSlidesCreated }) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [slideContent, setSlideContent] = useState<string>('');
  const [songId, setSongId] = useState<number>(-1);
  const [tabValue, setTabValue] = useState<number>(0);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [editingContent, setEditingContent] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');

  // 當組件載入後自動生成投影片
  useEffect(() => {
    if (lyrics && imageUrl && !slideContent && !isGenerating) {
      generateSlides();
    }
  }, [lyrics, imageUrl]);

  // 生成投影片
  const generateSlides = async () => {
    try {
      setIsGenerating(true);
      setError('');
      
      // 通過API生成投影片
      // 按照 generateSlides: (songId: number, songTitle: string, artist: string, lyrics: string, imagePath: string)
      const result = await window.electronAPI.generateSlides(
        -1, // 臨時songId
        'Untitled', // 臨時標題
        '', // 臨時藝術家
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

  // 更新預覽
  const updatePreview = async (content: string) => {
    try {
      const html = await window.electronAPI.previewSlides(content);
      setPreviewHtml(typeof html === 'string' ? html : '預覽載入中...');
    } catch (err: any) {
      console.error('預覽生成錯誤:', err);
      setPreviewHtml('<div>預覽生成錯誤</div>');
    }
  };

  // 處理標籤切換
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 1) {
      updatePreview(editingContent);
    }
  };

  // 處理內容變更
  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditingContent(event.target.value);
  };

  // 保存編輯的內容
  const saveChanges = async () => {
    try {
      setSnackbarMessage('保存中...');
      setSnackbarOpen(true);
      
      setSlideContent(editingContent);
      updatePreview(editingContent);
      
      setSnackbarMessage('已保存變更');
      setSnackbarOpen(true);
    } catch (err: any) {
      setError(err.message || '保存投影片內容時發生錯誤');
      console.error('保存投影片錯誤:', err);
    }
  };

  // 重新生成投影片
  const regenerateSlides = async () => {
    await generateSlides();
  };

  // 插入格式化標記
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
    
    // 設置焦點並更新選擇範圍
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
    }, 10);
  };

  // 關閉提示訊息
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