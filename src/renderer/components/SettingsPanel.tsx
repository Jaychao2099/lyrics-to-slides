import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Tabs,
  Tab,
  InputAdornment,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Divider,
  LinearProgress,
  Snackbar,
  Alert
} from '@mui/material';
import { Visibility, VisibilityOff, FolderOpen, Delete, Refresh, RestartAlt } from '@mui/icons-material';
import { Settings } from '../../common/types';

interface SettingsPanelProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onCancel: () => void;
}

// 定義選項卡索引對應的內容
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = (props) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSave, onCancel }) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [formData, setFormData] = useState<Settings>({ ...settings });
  const [showGoogleApiKey, setShowGoogleApiKey] = useState(false);
  const [showOpenaiApiKey, setShowOpenaiApiKey] = useState(false);
  
  // 快取管理狀態
  const [cacheInfo, setCacheInfo] = useState<any>(null);
  const [isCacheLoading, setIsCacheLoading] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('info');
  
  // 默認設定
  const [defaultSettings, setDefaultSettings] = useState<Settings | null>(null);
  
  // 獲取快取信息
  const fetchCacheInfo = async () => {
    try {
      setIsCacheLoading(true);
      const cacheData = await window.electronAPI.getCacheSize();
      setCacheInfo(cacheData);
    } catch (err) {
      console.error('獲取快取信息失敗:', err);
      setSnackbarMessage('獲取快取信息失敗');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setIsCacheLoading(false);
    }
  };

  // 清除所有快取
  const handleClearCache = async () => {
    try {
      // 確認對話框
      const confirmed = window.confirm('提醒：這將清除所有檔案。\n確定要繼續嗎？');
      if (!confirmed) return;

      setIsCacheLoading(true);
      const result = await window.electronAPI.clearCache();
      if (result && result.success) {
        setSnackbarMessage(`快取清除成功，共刪除 ${result.deletedImages + result.deletedSlides + result.deletedLyrics + result.deletedBatchSlides} 個文件`);
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        fetchCacheInfo();
      } else {
        setSnackbarMessage('快取清除失敗');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('清除快取失敗:', err);
      setSnackbarMessage('清除快取失敗');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setIsCacheLoading(false);
    }
  };
  
  // 清除圖片快取
  const handleClearImagesCache = async () => {
    try {
      // 確認對話框
      const confirmed = window.confirm('提醒：這將刪除所有圖片紀錄，所有投影片文本也將需要重新製作。\n確定要繼續嗎？');
      if (!confirmed) return;

      setIsCacheLoading(true);
      const result = await window.electronAPI.clearImagesCache();
      if (result && result.success) {
        setSnackbarMessage(`圖片快取清除成功，共刪除 ${result.deletedCount} 個檔案`);
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        fetchCacheInfo();
      } else {
        setSnackbarMessage('圖片快取清除失敗');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('清除圖片快取失敗:', err);
      setSnackbarMessage('清除圖片快取失敗');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setIsCacheLoading(false);
    }
  };
  
  // 清除投影片文本快取
  const handleClearSlidesCache = async () => {
    try {
      setIsCacheLoading(true);
      const result = await window.electronAPI.clearSlidesCache();
      if (result && result.success) {
        setSnackbarMessage(`投影片文本快取清除成功，共刪除 ${result.deletedCount} 個檔案`);
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        fetchCacheInfo();
      } else {
        setSnackbarMessage('投影片文本快取清除失敗');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('清除投影片文本快取失敗:', err);
      setSnackbarMessage('清除投影片文本快取失敗');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setIsCacheLoading(false);
    }
  };
  
  // 清除歌詞快取
  const handleClearLyricsCache = async () => {
    try {
      // 確認對話框
      const confirmed = window.confirm('提醒：這將刪除所有歌詞紀錄，之後搜尋的歌曲皆需要重新製作。\n確定要繼續嗎？');
      if (!confirmed) return;

      setIsCacheLoading(true);
      const result = await window.electronAPI.clearLyricsCache();
      if (result && result.success) {
        setSnackbarMessage(`歌詞快取清除成功，共刪除 ${result.deletedCount} 首歌詞`);
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        fetchCacheInfo();
      } else {
        setSnackbarMessage('歌詞快取清除失敗');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('清除歌詞快取失敗:', err);
      setSnackbarMessage('清除歌詞快取失敗');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setIsCacheLoading(false);
    }
  };
  
  // 清除投影片集快取
  const handleClearBatchSlidesCache = async () => {
    try {
      // 確認對話框
      const confirmed = window.confirm('提醒：這將刪除所有投影片集。確定要繼續嗎？');
      if (!confirmed) return;
      
      setIsCacheLoading(true);
      const result = await window.electronAPI.clearBatchSlidesCache();
      if (result && result.success) {
        setSnackbarMessage(`投影片集快取清除成功，共刪除 ${result.deletedCount} 個檔案`);
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        fetchCacheInfo();
      } else {
        setSnackbarMessage('投影片集快取清除失敗');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('清除投影片集快取失敗:', err);
      setSnackbarMessage('清除投影片集快取失敗');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setIsCacheLoading(false);
    }
  };
  
  // 關閉提示消息
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };
  
  // 當切換到快取管理選項卡時加載快取信息
  useEffect(() => {
    if (tabIndex === 3) {
      fetchCacheInfo();
    }
  }, [tabIndex]);
  
  // 獲取默認設定
  const fetchDefaultSettings = async () => {
    try {
      const defaults = await window.electronAPI.getDefaultSettings();
      setDefaultSettings(defaults);
    } catch (err) {
      console.error('獲取默認設定失敗:', err);
      setSnackbarMessage('獲取默認設定失敗');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };
  
  // 初始化時獲取默認設定
  useEffect(() => {
    fetchDefaultSettings();
  }, []);
  
  // 處理表單變更
  const handleChange = (field: keyof Settings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  
  // 處理選擇輸出目錄
  const handleSelectOutputDirectory = async () => {
    const directory = await window.electronAPI.selectDirectory();
    if (directory) {
      handleChange('defaultOutputDirectory', directory);
    }
  };
  
  // 處理儲存按鈕
  const handleSave = () => {
    onSave(formData);
  };
  
  // 處理取消按鈕
  const handleCancel = () => {
    // 重置表單數據為初始設定
    setFormData({ ...settings });
    onCancel();
  };
  
  // 處理選項卡變更
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };
  
  // 恢復基本設定默認值
  const handleResetBasicSettings = () => {
    if (!defaultSettings) return;
    
    setFormData(prevData => ({
      ...prevData,
      theme: defaultSettings.theme,
      language: defaultSettings.language,
      defaultExportFormat: defaultSettings.defaultExportFormat,
      defaultOutputDirectory: defaultSettings.defaultOutputDirectory,
    }));
    
    setSnackbarMessage('已恢復基本設定預設值');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
  };
  
  // 恢復文件模板默認值
  const handleResetPromptTemplates = () => {
    if (!defaultSettings) return;
    
    setFormData(prevData => ({
      ...prevData,
      imagePromptTemplate: defaultSettings.imagePromptTemplate,
      customMarpHeader: defaultSettings.customMarpHeader,
    }));
    
    setSnackbarMessage('已恢復文件模板預設值');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
  };
  
  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        應用程式設定
      </Typography>
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={handleTabChange} aria-label="settings tabs">
          <Tab label="基本設定" />
          <Tab label="API 金鑰" />
          <Tab label="文件模板" />
          <Tab label="快取管理" />
        </Tabs>
      </Box>
      
      {/* 基本設定選項卡 */}
      <TabPanel value={tabIndex} index={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <FormControl fullWidth margin="normal">
              <InputLabel id="theme-select-label">主題</InputLabel>
              <Select
                labelId="theme-select-label"
                value={formData.theme}
                label="主題"
                onChange={(e) => handleChange('theme', e.target.value)}
              >
                <MenuItem value="light">淺色主題</MenuItem>
                <MenuItem value="dark">深色主題</MenuItem>
                <MenuItem value="system">跟隨系統</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <Box>
            <FormControl fullWidth margin="normal">
              <InputLabel id="language-select-label">語言</InputLabel>
              <Select
                labelId="language-select-label"
                value={formData.language}
                label="語言"
                onChange={(e) => handleChange('language', e.target.value)}
              >
                <MenuItem value="zh-TW">繁體中文</MenuItem>
                <MenuItem value="zh-CN">簡體中文</MenuItem>
                <MenuItem value="en">英文</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <Box>
            <FormControl fullWidth margin="normal">
              <InputLabel id="export-format-select-label">預設匯出格式</InputLabel>
              <Select
                labelId="export-format-select-label"
                value={formData.defaultExportFormat}
                label="預設匯出格式"
                onChange={(e) => handleChange('defaultExportFormat', e.target.value)}
              >
                <MenuItem value="pdf">PDF</MenuItem>
                <MenuItem value="pptx">PPTX</MenuItem>
                <MenuItem value="html">HTML</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <Box>
            <TextField
              fullWidth
              label="預設輸出路徑"
              value={formData.defaultOutputDirectory}
              onChange={(e) => handleChange('defaultOutputDirectory', e.target.value)}
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleSelectOutputDirectory} edge="end">
                      <FolderOpen />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RestartAlt />}
              onClick={handleResetBasicSettings}
              disabled={!defaultSettings}
            >
              恢復預設值
            </Button>
          </Box>
        </Box>
      </TabPanel>
      
      {/* API 金鑰選項卡 */}
      <TabPanel value={tabIndex} index={1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Google API 設定
            </Typography>
            <TextField
              fullWidth
              label="Google API 金鑰"
              value={formData.googleApiKey}
              onChange={(e) => handleChange('googleApiKey', e.target.value)}
              margin="normal"
              type={showGoogleApiKey ? 'text' : 'password'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowGoogleApiKey(!showGoogleApiKey)}
                      edge="end"
                    >
                      {showGoogleApiKey ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Google 自訂搜尋引擎 ID"
              value={formData.googleSearchEngineId}
              onChange={(e) => handleChange('googleSearchEngineId', e.target.value)}
              margin="normal"
              helperText="需在 Google Custom Search 控制台創建自訂搜尋引擎"
            />
          </Box>
          
          <Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              OpenAI API 設定
            </Typography>
            <TextField
              fullWidth
              label="OpenAI API 金鑰"
              value={formData.openaiApiKey}
              onChange={(e) => handleChange('openaiApiKey', e.target.value)}
              margin="normal"
              type={showOpenaiApiKey ? 'text' : 'password'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowOpenaiApiKey(!showOpenaiApiKey)}
                      edge="end"
                    >
                      {showOpenaiApiKey ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <FormHelperText>
              請從 OpenAI 官網獲取 API 金鑰以啟用圖片生成功能
            </FormHelperText>
          </Box>
        </Box>
      </TabPanel>
      
      {/* 文件模板選項卡 */}
      <TabPanel value={tabIndex} index={2}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              圖片生成提示詞
            </Typography>
            <TextField
              fullWidth
              label="圖片生成提示詞"
              value={formData.imagePromptTemplate}
              onChange={(e) => handleChange('imagePromptTemplate', e.target.value)}
              margin="normal"
              multiline
              rows={4}
              helperText="可使用 {{songTitle}} 和 {{lyrics}} 變數"
            />
          </Box>
          
          <Box>
            <Typography variant="h6" gutterBottom>
              Marp標頭文本
            </Typography>
            <TextField
              fullWidth
              label="Marp標頭文本"
              value={formData.customMarpHeader}
              onChange={(e) => handleChange('customMarpHeader', e.target.value)}
              margin="normal"
              multiline
              rows={8}
              helperText="自定義Marp投影片格式的標頭文本，影響全域投影片樣式"
            />
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RestartAlt />}
              onClick={handleResetPromptTemplates}
              disabled={!defaultSettings}
            >
              恢復預設值
            </Button>
          </Box>
        </Box>
      </TabPanel>
      
      {/* 快取管理選項卡 */}
      <TabPanel value={tabIndex} index={3}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6" gutterBottom>
            快取管理
          </Typography>
          
          {isCacheLoading && <LinearProgress sx={{ mb: 2 }} />}
          
          {cacheInfo ? (
            <Box>
              <Typography variant="body1" gutterBottom>
                總快取大小: <strong>{cacheInfo.totalSize.totalSizeMB}</strong>
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 2 }}>
                <Paper elevation={1} sx={{ p: 2, flex: 1 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="subtitle1">圖片快取</Typography>
                    <Typography variant="body2">
                      {cacheInfo.images.fileCount} 個檔案 ({cacheInfo.images.totalSizeMB})
                    </Typography>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={handleClearImagesCache}
                      disabled={isCacheLoading || cacheInfo.images.fileCount === 0}
                      size="small"
                      startIcon={<Delete />}
                    >
                      清除圖片快取
                    </Button>
                  </Box>
                </Paper>
                
                <Paper elevation={1} sx={{ p: 2, flex: 1 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="subtitle1">投影片文本快取</Typography>
                    <Typography variant="body2">
                      {cacheInfo.slides.fileCount} 個檔案 ({cacheInfo.slides.totalSizeMB})
                    </Typography>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={handleClearSlidesCache}
                      disabled={isCacheLoading || cacheInfo.slides.fileCount === 0}
                      size="small"
                      startIcon={<Delete />}
                    >
                      清除投影片文本快取
                    </Button>
                  </Box>
                </Paper>
                
                <Paper elevation={1} sx={{ p: 2, flex: 1 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="subtitle1">歌詞快取</Typography>
                    <Typography variant="body2">
                      {cacheInfo.lyrics?.songCount || 0} 首歌詞 ({cacheInfo.lyrics?.totalSizeMB || '0 MB'})
                    </Typography>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={handleClearLyricsCache}
                      disabled={isCacheLoading || !(cacheInfo.lyrics?.songCount > 0)}
                      size="small"
                      startIcon={<Delete />}
                    >
                      清除歌詞快取
                    </Button>
                  </Box>
                </Paper>
              </Box>
              
              {/* 投影片集快取管理 */}
              <Paper elevation={1} sx={{ p: 2, mt: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="subtitle1">投影片集快取</Typography>
                  <Typography variant="body2">
                    {cacheInfo.batchSlides?.fileCount || 0} 個檔案 ({cacheInfo.batchSlides?.totalSizeMB || '0 MB'})
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleClearBatchSlidesCache}
                    disabled={isCacheLoading || (cacheInfo.batchSlides?.fileCount === 0)}
                    size="small"
                    startIcon={<Delete />}
                  >
                    清除投影片集快取
                  </Button>
                </Box>
              </Paper>
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2 }}>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleClearCache}
                  disabled={isCacheLoading}
                  startIcon={<Delete />}
                  sx={{ mr: 1 }}
                >
                  清除所有快取
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={fetchCacheInfo}
                  disabled={isCacheLoading}
                  startIcon={<Refresh />}
                >
                  刷新快取信息
                </Button>
              </Box>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  快取包含生成的背景圖片、投影片內容和搜尋的歌詞。清除快取將刪除這些檔案，並完全刪除所有歌詞資料，這意味著您必須重新搜索歌詞。
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography variant="body1">
              {isCacheLoading ? '正在獲取快取信息...' : '無法獲取快取信息'}
            </Typography>
          )}
        </Box>
      </TabPanel>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button variant="outlined" onClick={handleCancel} sx={{ mr: 1 }}>
          取消
        </Button>
        <Button variant="contained" onClick={handleSave}>
          儲存設定
        </Button>
      </Box>
    </Paper>
  );
};

export default SettingsPanel; 