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
  LinearProgress
} from '@mui/material';
import { Settings } from '../common/types';
import LyricsSearch from './components/LyricsSearch';
import ImageGeneration from './components/ImageGeneration';
import SlideEditor from './components/SlideEditor';
import SlideExport from './components/SlideExport';
import SettingsPanel from './components/SettingsPanel';

// 步驟定義
const steps = [
  { label: '歌詞搜尋', key: 'lyrics-search' },
  { label: '圖片生成', key: 'image-generation' },
  { label: '投影片編輯', key: 'slide-editor' },
  { label: '匯出', key: 'export' }
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
    slideContent: ''
  });
  const [showSettings, setShowSettings] = useState(false);

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
            onImageGenerated={(imageUrl) => {
              setSongData(prev => ({ ...prev, imageUrl }));
              handleNext();
            }}
          />
        );
      case 2:
        return (
          <SlideEditor 
            lyrics={songData.lyrics}
            imageUrl={songData.imageUrl}
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
            <Button color="inherit" onClick={() => setShowSettings(!showSettings)}>
              設定
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
        
        <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
          {showSettings ? (
            <SettingsPanel 
              settings={settings} 
              onSave={handleSettingsChange}
              onCancel={() => setShowSettings(false)}
            />
          ) : (
            <Paper elevation={3} sx={{ p: 3 }}>
              <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((step) => (
                  <Step key={step.key}>
                    <StepLabel>{step.label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
              
              <Box sx={{ mb: 2 }}>
                {renderStepContent()}
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
                <Button 
                  color="inherit"
                  disabled={activeStep === 0} 
                  onClick={handleBack}
                >
                  返回
                </Button>
              </Box>
            </Paper>
          )}
        </Container>
        
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