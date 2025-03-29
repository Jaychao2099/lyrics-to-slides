import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  CircularProgress, 
  Alert, 
  FormControl, 
  FormControlLabel, 
  RadioGroup, 
  Radio, 
  TextField,
  Card,
  CardContent,
  Divider,
  Stack,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Snackbar
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SlideShowIcon from '@mui/icons-material/Slideshow';
import CodeIcon from '@mui/icons-material/Code';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface SlideExportProps {
  songTitle: string;
  slideContent: string;
}

interface ExportResult {
  success: boolean;
  path: string;
  format: string;
  message?: string;
}

const SlideExport: React.FC<SlideExportProps> = ({ songTitle, slideContent }) => {
  const [exportFormat, setExportFormat] = useState<string>('pdf');
  const [isBatchExport, setIsBatchExport] = useState<boolean>(false);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['pdf']);
  const [outputPath, setOutputPath] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [exportResults, setExportResults] = useState<ExportResult[]>([]);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');

  // 載入預設輸出路徑
  useEffect(() => {
    const loadDefaultPath = async () => {
      try {
        const settings = await window.electronAPI.getSettings();
        if (settings && settings.defaultOutputDirectory) {
          setOutputPath(settings.defaultOutputDirectory);
        }
      } catch (err) {
        console.error('載入預設輸出路徑失敗:', err);
      }
    };
    
    loadDefaultPath();
  }, []);

  // 處理匯出格式變更
  const handleFormatChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setExportFormat(event.target.value);
  };

  // 處理批量匯出選項變更
  const handleBatchExportChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsBatchExport(event.target.checked);
  };

  // 處理批量匯出格式選擇
  const handleFormatSelectionChange = (format: string) => {
    setSelectedFormats(prev => {
      if (prev.includes(format)) {
        return prev.filter(f => f !== format);
      } else {
        return [...prev, format];
      }
    });
  };

  // 選擇輸出目錄
  const selectOutputDirectory = async () => {
    try {
      const dirPath = await window.electronAPI.selectDirectory();
      if (dirPath) {
        setOutputPath(dirPath);
      }
    } catch (err: any) {
      setError(err.message || '選擇輸出目錄時發生錯誤');
      console.error('選擇輸出目錄錯誤:', err);
    }
  };

  // 匯出投影片
  const exportSlides = async () => {
    if (!slideContent) {
      setError('沒有投影片內容可供匯出');
      return;
    }

    if (!outputPath) {
      setError('請選擇輸出目錄');
      return;
    }

    try {
      setIsExporting(true);
      setError('');
      setExportResults([]);
      
      if (isBatchExport) {
        // 批量匯出
        if (selectedFormats.length === 0) {
          throw new Error('請至少選擇一種匯出格式');
        }
        
        const fullPath = `${outputPath}/${songTitle.replace(/[<>:"/\\|?*]/g, '_')}`;
        const results = await window.electronAPI.exportSlides(slideContent, 'batch', fullPath);
        
        // 為了符合接口，構造結果對象
        const exportResults: ExportResult[] = selectedFormats.map(format => ({
          success: true,
          path: `${fullPath}.${format}`,
          format
        }));
        
        setExportResults(exportResults);
        setSnackbarMessage(`批量匯出完成: ${exportResults.length} 個文件`);
      } else {
        // 單一格式匯出
        const fullPath = `${outputPath}/${songTitle.replace(/[<>:"/\\|?*]/g, '_')}.${exportFormat}`;
        const result = await window.electronAPI.exportSlides(slideContent, exportFormat, fullPath);
        
        setExportResults([{ 
          success: true, 
          path: result,
          format: exportFormat
        }]);
        setSnackbarMessage(`已成功匯出為 ${exportFormat.toUpperCase()} 格式`);
      }
      
      setSnackbarOpen(true);
    } catch (err: any) {
      setError(err.message || '匯出投影片時發生錯誤');
      console.error('匯出投影片錯誤:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // 關閉提示訊息
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // 打開匯出的檔案
  const openExportedFile = (path: string) => {
    if (!path) return;
    
    // 目前API中沒有提供openFile方法，這部分需要在後續實現
    // 暫時使用消息提示
    setSnackbarMessage(`文件位置: ${path}`);
    setSnackbarOpen(true);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        投影片匯出
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
        <Typography variant="subtitle1" gutterBottom>
          匯出選項
        </Typography>
        
        <Divider sx={{ mb: 2 }} />
        
        <FormControlLabel
          control={
            <Checkbox 
              checked={isBatchExport}
              onChange={handleBatchExportChange}
            />
          }
          label="批量匯出多種格式"
        />
        
        {isBatchExport ? (
          <Box sx={{ ml: 3, mt: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              選擇匯出格式:
            </Typography>
            
            <FormControlLabel
              control={
                <Checkbox 
                  checked={selectedFormats.includes('pdf')}
                  onChange={() => handleFormatSelectionChange('pdf')}
                />
              }
              label="PDF 格式"
            />
            
            <FormControlLabel
              control={
                <Checkbox 
                  checked={selectedFormats.includes('pptx')}
                  onChange={() => handleFormatSelectionChange('pptx')}
                />
              }
              label="PowerPoint 格式 (PPTX)"
            />
            
            <FormControlLabel
              control={
                <Checkbox 
                  checked={selectedFormats.includes('html')}
                  onChange={() => handleFormatSelectionChange('html')}
                />
              }
              label="HTML 格式"
            />
          </Box>
        ) : (
          <Box sx={{ ml: 3, mt: 1 }}>
            <FormControl component="fieldset">
              <RadioGroup
                name="export-format"
                value={exportFormat}
                onChange={handleFormatChange}
              >
                <FormControlLabel value="pdf" control={<Radio />} label="PDF 格式" />
                <FormControlLabel value="pptx" control={<Radio />} label="PowerPoint 格式 (PPTX)" />
                <FormControlLabel value="html" control={<Radio />} label="HTML 格式" />
              </RadioGroup>
            </FormControl>
          </Box>
        )}
        
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            輸出位置:
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              placeholder="選擇輸出目錄"
              disabled={isExporting}
            />
            
            <Tooltip title="選擇目錄">
              <IconButton 
                onClick={selectOutputDirectory}
                color="primary"
                disabled={isExporting}
                size="small"
              >
                <FolderOpenIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={exportSlides}
            disabled={isExporting || !outputPath}
            sx={{ minWidth: 150 }}
          >
            {isExporting ? '匯出中...' : '開始匯出'}
          </Button>
        </Box>
        
        {isExporting && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ ml: 1 }}>
              正在匯出投影片...
            </Typography>
          </Box>
        )}
        
        {exportResults.length > 0 && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                匯出結果:
              </Typography>
              
              <List dense>
                {exportResults.map((result, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      result.success && (
                        <Tooltip title="顯示文件位置">
                          <IconButton edge="end" onClick={() => openExportedFile(result.path)}>
                            {result.format === 'pdf' ? <PictureAsPdfIcon /> : 
                             result.format === 'pptx' ? <SlideShowIcon /> : 
                             <CodeIcon />}
                          </IconButton>
                        </Tooltip>
                      )
                    }
                  >
                    <ListItemIcon>
                      {result.success ? 
                        <CheckCircleOutlineIcon color="success" /> : 
                        <ErrorOutlineIcon color="error" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${result.format.toUpperCase()} 格式`}
                      secondary={result.success ? result.path : result.message}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}
      </Paper>
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default SlideExport; 