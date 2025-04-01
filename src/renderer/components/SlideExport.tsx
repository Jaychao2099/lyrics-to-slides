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
  Snackbar,
  LinearProgress
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

interface ExportProgress {
  format: string;
  progress: number;
  status: string;
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
  const [exportProgress, setExportProgress] = useState<ExportProgress[]>([]);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);

  // 載入預設輸出路徑並設置日誌監聽器
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
    
    // 監聽主進程發送的日誌
    const unsubscribe = window.electronAPI.onMainProcessLog((log) => {
      setLogs(prevLogs => [...prevLogs, `[${log.level}] ${log.message}`]);
      
      // 如果是匯出相關的錯誤，直接顯示在界面上
      if (log.level === 'error' && log.message.includes('匯出')) {
        setError(log.message);
      }
    });
    
    // 卸載時清理監聽器
    return () => {
      unsubscribe();
    };
  }, []);
  
  // 清除日誌
  const clearLogs = () => {
    setLogs([]);
  };

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

  // 批量匯出投影片
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
        
        // 準備進度跟踪
        const initialProgress: ExportProgress[] = selectedFormats.map(format => ({
          format,
          progress: 0,
          status: `準備匯出 ${format.toUpperCase()} 格式...`
        }));
        setExportProgress(initialProgress);
        setOverallProgress(10);
        
        try {
          // 嘗試使用批量匯出 API
          const baseFilePath = `${outputPath}/${songTitle.replace(/[<>:"/\\|?*]/g, '_')}`;
          const resultPaths = await window.electronAPI.batchExport(slideContent, selectedFormats, baseFilePath);
          
          // 構建結果
          const results: ExportResult[] = selectedFormats.map((format, index) => ({
            success: true,
            path: resultPaths[index] || `${baseFilePath}.${format}`,
            format
          }));
          
          setExportResults(results);
          setOverallProgress(100);
          setExportProgress(prev => prev.map(p => ({ 
            ...p, 
            progress: 100, 
            status: `${p.format.toUpperCase()} 格式匯出完成` 
          })));
          
          setSnackbarMessage(`批量匯出完成: ${results.length} 個文件`);
        } catch (err) {
          console.error('批量匯出失敗，嘗試單獨匯出每種格式:', err);
          
          // 批量匯出失敗，改為逐個匯出
          const results: ExportResult[] = [];
          
          for (let i = 0; i < selectedFormats.length; i++) {
            const format = selectedFormats[i];
            const fullPath = `${outputPath}/${songTitle.replace(/[<>:"/\\|?*]/g, '_')}.${format}`;
            
            // 更新進度
            setExportProgress(prev => 
              prev.map(p => p.format === format ? 
                { ...p, progress: 10, status: `正在匯出 ${format.toUpperCase()} 格式...` } : 
                p
              )
            );
            setOverallProgress(Math.round((i / selectedFormats.length) * 100));
            
            try {
              // 調用匯出API
              let result: string;
              
              switch (format) {
                case 'pdf':
                  result = await window.electronAPI.exportToPDF(slideContent, fullPath);
                  break;
                case 'pptx':
                  result = await window.electronAPI.exportToPPTX(slideContent, fullPath);
                  break;
                case 'html':
                  result = await window.electronAPI.exportToHTML(slideContent, fullPath);
                  break;
                default:
                  throw new Error(`不支援的格式: ${format}`);
              }
              
              // 更新進度和結果
              setExportProgress(prev => 
                prev.map(p => p.format === format ? 
                  { ...p, progress: 100, status: `${format.toUpperCase()} 格式匯出完成` } : 
                  p
                )
              );
              
              results.push({
                success: true,
                path: result,
                format
              });
            } catch (err: any) {
              console.error(`匯出 ${format} 格式失敗:`, err);
              
              // 更新進度和結果
              setExportProgress(prev => 
                prev.map(p => p.format === format ? 
                  { ...p, progress: 0, status: `${format.toUpperCase()} 格式匯出失敗` } : 
                  p
                )
              );
              
              results.push({
                success: false,
                path: fullPath,
                format,
                message: err.message || `匯出 ${format.toUpperCase()} 格式失敗`
              });
            }
          }
          
          // 設置最終結果
          setExportResults(results);
          setOverallProgress(100);
          
          // 計算成功和失敗的數量
          const successCount = results.filter(r => r.success).length;
          const failCount = results.length - successCount;
          
          // 顯示結果訊息
          if (failCount === 0) {
            setSnackbarMessage(`批量匯出完成: ${successCount} 個文件全部成功`);
          } else if (successCount === 0) {
            setSnackbarMessage(`批量匯出失敗: ${failCount} 個文件全部失敗`);
            setError('所有文件匯出失敗，請檢查錯誤訊息');
          } else {
            setSnackbarMessage(`批量匯出部分完成: ${successCount} 個成功, ${failCount} 個失敗`);
          }
        }
      } else {
        // 單一格式匯出
        const fullPath = `${outputPath}/${songTitle.replace(/[<>:"/\\|?*]/g, '_')}.${exportFormat}`;
        setOverallProgress(10);
        
        let result: string;
        
        switch (exportFormat) {
          case 'pdf':
            result = await window.electronAPI.exportToPDF(slideContent, fullPath);
            break;
          case 'pptx':
            result = await window.electronAPI.exportToPPTX(slideContent, fullPath);
            break;
          case 'html':
            result = await window.electronAPI.exportToHTML(slideContent, fullPath);
            break;
          default:
            throw new Error(`不支援的格式: ${exportFormat}`);
        }
        
        setExportResults([{ 
          success: true, 
          path: result,
          format: exportFormat
        }]);
        
        setOverallProgress(100);
        setSnackbarMessage(`已成功匯出為 ${exportFormat.toUpperCase()} 格式`);
      }
      
      setSnackbarOpen(true);
    } catch (err: any) {
      setError(err.message || '匯出投影片時發生錯誤');
      console.error('匯出投影片錯誤:', err);
      setOverallProgress(0);
    } finally {
      setIsExporting(false);
    }
  };

  // 關閉提示訊息
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // 打開匯出的檔案
  const openExportedFile = async (path: string) => {
    if (!path) return;
    
    try {
      await window.electronAPI.openFile(path);
      setSnackbarMessage(`已打開文件: ${path}`);
      setSnackbarOpen(true);
    } catch (err: any) {
      setError(err.message || '打開檔案時發生錯誤');
      console.error('打開檔案錯誤:', err);
    }
  };

  // 打開包含文件的目錄
  const openContainingDirectory = async (path: string) => {
    if (!path) return;
    
    try {
      await window.electronAPI.openDirectory(path);
      setSnackbarMessage(`已打開包含目錄`);
      setSnackbarOpen(true);
    } catch (err: any) {
      setError(err.message || '打開目錄時發生錯誤');
      console.error('打開目錄錯誤:', err);
    }
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
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              總體進度:
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={overallProgress} 
              sx={{ width: '100%', mb: 2 }}
            />
            
            {isBatchExport && exportProgress.length > 0 && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  各格式進度:
                </Typography>
                {exportProgress.map((progress, index) => (
                  <Box key={index} sx={{ mb: 1 }}>
                    <Typography variant="caption">
                      {progress.format.toUpperCase()} 格式: {progress.status}
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={progress.progress} 
                      sx={{ width: '100%', height: 8 }}
                    />
                  </Box>
                ))}
              </Box>
            )}
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
                        <Box>
                          <Tooltip title="打開文件">
                            <IconButton edge="end" onClick={() => openExportedFile(result.path)}>
                              {result.format === 'pdf' ? <PictureAsPdfIcon /> : 
                               result.format === 'pptx' ? <SlideShowIcon /> : 
                               <CodeIcon />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="打開所在目錄">
                            <IconButton edge="end" onClick={() => openContainingDirectory(result.path)}>
                              <FolderOpenIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
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
        
        {/* 添加日誌顯示區域 */}
        {isExporting && logs.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              匯出日誌:
            </Typography>
            <Card variant="outlined" sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
              <CardContent sx={{ p: 1 }}>
                <Button size="small" onClick={clearLogs} sx={{ mb: 1 }}>
                  清除日誌
                </Button>
                {logs.map((log, index) => (
                  <Typography key={index} variant="body2" component="div" sx={{ 
                    fontFamily: 'monospace', 
                    fontSize: '0.8rem',
                    color: log.includes('[error]') ? 'error.main' : 
                           log.includes('[warn]') ? 'warning.main' : 'text.primary'
                  }}>
                    {log}
                  </Typography>
                ))}
              </CardContent>
            </Card>
          </Box>
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