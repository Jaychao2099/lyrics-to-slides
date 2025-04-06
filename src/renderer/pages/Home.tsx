import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, CardActionArea, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Search, ViewCarousel, Settings } from '@mui/icons-material';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [appVersion, setAppVersion] = useState('');
  
  useEffect(() => {
    console.log('Home 組件已載入');
    
    const getVersion = async () => {
      try {
        console.log('正在獲取應用版本...');
        const version = await window.electronAPI.getAppVersion();
        console.log('應用版本獲取成功:', version);
        setAppVersion(version);
      } catch (error) {
        console.error('獲取應用版本失敗', error);
      }
    };
    
    getVersion();
  }, []);
  
  console.log('Home 組件正在渲染');
  
  return (
    <Box>
      <Typography variant="h4" align="center" gutterBottom>
        歡迎使用歌曲投影片生成器
      </Typography>
      
      <Typography variant="subtitle1" align="center" color="text.secondary" sx={{ mb: 4 }}>
        輕鬆搜尋歌詞、生成投影片，批次處理多首歌曲
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, mt: 2, justifyContent: 'center' }}>
        <Box sx={{ flex: { sm: '0 0 auto', md: '0 0 33.33%' } }}>
          <Card sx={{ height: '100%' }}>
            <CardActionArea sx={{ height: '100%' }} onClick={() => navigate('/search')}>
              <CardContent sx={{ textAlign: 'center', p: 4 }}>
                <Search sx={{ fontSize: 60, mb: 2, color: 'primary.main' }} />
                <Typography variant="h5" gutterBottom>
                  搜尋歌詞
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  搜尋並編輯歌詞，生成投影片
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Box>
        
        <Box sx={{ flex: { sm: '0 0 auto', md: '0 0 33.33%' } }}>
          <Card sx={{ height: '100%' }}>
            <CardActionArea sx={{ height: '100%' }} onClick={() => navigate('/batch')}>
              <CardContent sx={{ textAlign: 'center', p: 4 }}>
                <ViewCarousel sx={{ fontSize: 60, mb: 2, color: 'primary.main' }} />
                <Typography variant="h5" gutterBottom>
                  批次投影片
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  批次處理多首歌曲，一次生成投影片
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Box>
        
        <Box sx={{ flex: { sm: '0 0 auto', md: '0 0 33.33%' } }}>
          <Card sx={{ height: '100%' }}>
            <CardActionArea sx={{ height: '100%' }} onClick={() => navigate('/settings')}>
              <CardContent sx={{ textAlign: 'center', p: 4 }}>
                <Settings sx={{ fontSize: 60, mb: 2, color: 'primary.main' }} />
                <Typography variant="h5" gutterBottom>
                  設定
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  設定應用參數，自定義投影片格式
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Box>
      </Box>
      
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          版本: {appVersion}
        </Typography>
      </Box>
    </Box>
  );
};

export default Home; 