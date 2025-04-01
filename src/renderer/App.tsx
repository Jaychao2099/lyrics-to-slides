import React, { useState, useEffect } from 'react';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline, 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  Container,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Drawer
} from '@mui/material';
import { 
  Settings as SettingsIcon,
  BugReport as BugReportIcon,
  Search as SearchIcon,
  Image as ImageIcon,
  Slideshow as SlideshowIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { Settings } from '../common/types';
import LyricsSearch from './components/LyricsSearch';
import ImageGeneration from './components/ImageGeneration';
import SlideEditor from './components/SlideEditor';
import SlideExport from './components/SlideExport';
import SettingsPanel from './components/SettingsPanel';
import LogViewer from './components/LogViewer';

// 步驟定義
const steps = [
  { label: '歌詞搜尋', key: 'lyrics-search', icon: <SearchIcon /> },
  { label: '圖片生成', key: 'image-generation', icon: <ImageIcon /> },
  { label: '投影片編輯', key: 'slide-editor', icon: <SlideshowIcon /> },
  { label: '匯出', key: 'export', icon: <SaveIcon /> }
];

// 創建應用主題
const createAppTheme = (mode: 'light' | 'dark' | 'system') => {
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const actualMode = mode === 'system' ? (prefersDarkMode ? 'dark' : 'light') : mode;
  
  return createTheme({
    palette: {
      mode: actualMode as 'light' | 'dark',
      primary: {
        main: '#3f51b5',
      },
      secondary: {
        main: '#f50057',
      },
    },
  });
};

const App: React.FC = () => {
  // 狀態管理
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState({ value: 0, status: '' });
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [songData, setSongData] = useState({
    title: '',
    artist: '',
    lyrics: '',
    imageUrl: '',
    slideContent: '',
    songId: -1
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  // 載入設定
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await window.electronAPI.getSettings();
        setSettings(settings);
        setTheme(settings.theme);
      } catch (error) {
        console.error('載入設定失敗:', error);
      }
    };
    
    loadSettings();
  }, []);

  // 監聽進度更新
  useEffect(() => {
    if (!window.electronAPI?.onProgressUpdate) return;
    
    const unsubscribe = window.electronAPI.onProgressUpdate((value, status) => {
      setProgress({ value, status });
    });
    
    return () => {
      unsubscribe?.();
    };
  }, []);

  // 處理設定變更
  const handleSettingsChange = async (newSettings: Settings) => {
    try {
      await window.electronAPI.saveSettings(newSettings);
      setSettings(newSettings);
      setTheme(newSettings.theme);
      setShowSettings(false);
    } catch (error) {
      console.error('保存設定失敗:', error);
    }
  };

  // 處理步驟變更
  const handleNext = () => {
    setActiveStep((prevStep) => Math.min(prevStep + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveStep((prevStep) => Math.max(prevStep - 1, 0));
  };

  // 切換抽屜
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  // 根據當前步驟渲染對應內容
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <LyricsSearch 
            onSearchComplete={(result) => {
              setSongData(prev => ({
                ...prev, 
                title: result.title,
                artist: result.artist,
                lyrics: result.lyrics
              }));
              handleNext();
            }} 
          />
        );
      case 1:
        return (
          <ImageGeneration 
            songTitle={songData.title}
            lyrics={songData.lyrics}
            onImageGenerated={(imageUrl, generatedSongId) => {
              setSongData(prev => ({ 
                ...prev, 
                imageUrl,
                songId: generatedSongId || prev.songId 
              }));
              handleNext();
            }}
            onNavigateToSettings={() => setActiveStep(4)}
          />
        );
      case 2:
        return (
          <SlideEditor 
            lyrics={songData.lyrics}
            imageUrl={songData.imageUrl}
            songId={songData.songId}
            onSlidesCreated={(slideContent) => {
              setSongData(prev => ({ ...prev, slideContent }));
              handleNext();
            }}
          />
        );
      case 3:
        return (
          <SlideExport 
            songTitle={songData.title}
            slideContent={songData.slideContent}
          />
        );
      case 4:
        return (
          <SettingsPanel 
            settings={settings!} 
            onSave={handleSettingsChange}
            onCancel={() => setActiveStep(0)}
          />
        );
      case 5:
        return <LogViewer />;
      default:
        return <div>未知步驟</div>;
    }
  };

  // 如果設定還未載入，顯示載入中
  if (!settings) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>載入中...</Typography>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={createAppTheme(theme)}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              歌曲投影片生成器
            </Typography>
            <Button color="inherit" onClick={() => setActiveStep(4)}>
              設定
            </Button>
            <Button color="inherit" onClick={() => setActiveStep(5)}>
              調試日誌
            </Button>
          </Toolbar>
        </AppBar>
        
        {progress.value > 0 && progress.value < 100 && (
          <Box sx={{ width: '100%' }}>
            <LinearProgress variant="determinate" value={progress.value} />
            <Typography variant="caption" align="center" sx={{ display: 'block' }}>
              {progress.status}
            </Typography>
          </Box>
        )}
        
        <Box sx={{ display: 'flex', flexGrow: 1 }}>
          <Drawer
            variant="permanent"
            open={drawerOpen}
            sx={{
              width: 240,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: 240,
                boxSizing: 'border-box',
                position: 'relative'
              },
            }}
          >
            <List>
              {steps.map((step, index) => (
                <ListItem key={step.key} disablePadding>
                  <ListItemButton
                    selected={activeStep === index}
                    onClick={() => setActiveStep(index)}
                    disabled={index > 0 && !songData.title}
                  >
                    <ListItemIcon>
                      {step.icon}
                    </ListItemIcon>
                    <ListItemText primary={step.label} />
                  </ListItemButton>
                </ListItem>
              ))}
              
              <Divider sx={{ my: 2 }} />
              
              <ListItem disablePadding>
                <ListItemButton
                  selected={activeStep === 4}
                  onClick={() => setActiveStep(4)}
                >
                  <ListItemIcon>
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText primary="設定" />
                </ListItemButton>
              </ListItem>
              
              <ListItem disablePadding>
                <ListItemButton
                  selected={activeStep === 5}
                  onClick={() => setActiveStep(5)}
                >
                  <ListItemIcon>
                    <BugReportIcon />
                  </ListItemIcon>
                  <ListItemText primary="調試日誌" />
                </ListItemButton>
              </ListItem>
            </List>
          </Drawer>
          
          <Container component="main" sx={{ flexGrow: 1, p: 3 }}>
            <Paper elevation={3} sx={{ p: 3 }}>
              {activeStep < 4 && (
                <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                  {steps.map((step) => (
                    <Step key={step.key}>
                      <StepLabel>{step.label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              )}
              
              <Box sx={{ mb: 2 }}>
                {renderStepContent()}
              </Box>
              
              {activeStep < 4 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
                  <Button 
                    color="inherit"
                    disabled={activeStep === 0} 
                    onClick={handleBack}
                  >
                    返回
                  </Button>
                </Box>
              )}
            </Paper>
          </Container>
        </Box>
        
        <Box component="footer" sx={{ py: 2, bgcolor: 'background.paper', textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            歌曲投影片生成器 © {new Date().getFullYear()}
          </Typography>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App; 