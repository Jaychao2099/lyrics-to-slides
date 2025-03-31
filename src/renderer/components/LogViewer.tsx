import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';

/**
 * 日誌查看器組件
 * 用於查看和分析應用程式的日誌文件
 */
const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<string>('');
  const [logType, setLogType] = useState<string>('api');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [filteredLogs, setFilteredLogs] = useState<string>('');

  // 加載日誌
  const loadLogs = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 調用API獲取日誌
      const logContent = await window.electronAPI.getLogs(logType);
      setLogs(logContent);
      setFilteredLogs(logContent);
    } catch (err: any) {
      setError(err.message || '獲取日誌失敗');
      console.error('獲取日誌失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  // 當組件載入或日誌類型改變時加載日誌
  useEffect(() => {
    loadLogs();
  }, [logType]);

  // 處理搜尋
  const handleSearch = () => {
    if (!searchText.trim()) {
      setFilteredLogs(logs);
      return;
    }

    try {
      // 使用正則表達式搜尋
      const regex = new RegExp(searchText, 'gi');
      const lines = logs.split('\n');
      const matchedLines = lines.filter(line => regex.test(line));
      
      if (matchedLines.length > 0) {
        setFilteredLogs(matchedLines.join('\n'));
      } else {
        setFilteredLogs('未找到符合的日誌記錄');
      }
    } catch (err) {
      setFilteredLogs(`搜尋錯誤: ${err}`);
    }
  };

  // 處理日誌類型變更
  const handleLogTypeChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setLogType(event.target.value as string);
  };

  // 清除搜尋
  const clearSearch = () => {
    setSearchText('');
    setFilteredLogs(logs);
  };

  // 尋找外鍵約束錯誤
  const findForeignKeyErrors = () => {
    setSearchText('FOREIGN KEY constraint failed');
    handleSearch();
  };

  // 尋找API通訊錯誤
  const findApiErrors = () => {
    setSearchText('error|failed|失敗');
    handleSearch();
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        日誌查看器
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="log-type-label">日誌類型</InputLabel>
            <Select
              labelId="log-type-label"
              value={logType}
              onChange={handleLogTypeChange as any}
              label="日誌類型"
            >
              <MenuItem value="api">API 通訊日誌</MenuItem>
              <MenuItem value="app">應用程式日誌</MenuItem>
            </Select>
          </FormControl>
          
          <Button 
            variant="outlined" 
            onClick={loadLogs}
            disabled={loading}
          >
            刷新日誌
          </Button>
        </Stack>
        
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="搜尋日誌"
            variant="outlined"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            fullWidth
            size="small"
          />
          
          <Button 
            variant="contained" 
            onClick={handleSearch}
            disabled={loading}
          >
            搜尋
          </Button>
          
          <Button 
            variant="outlined" 
            onClick={clearSearch}
            disabled={loading}
          >
            清除
          </Button>
        </Stack>
        
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
          <Button 
            variant="outlined" 
            onClick={findForeignKeyErrors}
            disabled={loading}
            color="warning"
            size="small"
          >
            查找外鍵約束錯誤
          </Button>
          
          <Button 
            variant="outlined" 
            onClick={findApiErrors}
            disabled={loading}
            color="error"
            size="small"
          >
            查找API錯誤
          </Button>
        </Stack>
      </Box>
      
      <Paper 
        elevation={3} 
        sx={{ 
          p: 2, 
          maxHeight: 'calc(100vh - 300px)', 
          overflow: 'auto',
          bgcolor: '#f5f5f5'
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Typography 
            component="pre" 
            sx={{ 
              whiteSpace: 'pre-wrap', 
              fontFamily: 'monospace',
              fontSize: '0.85rem'
            }}
          >
            {filteredLogs || '無日誌記錄'}
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default LogViewer; 