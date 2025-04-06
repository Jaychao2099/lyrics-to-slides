import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, NavLink } from 'react-router-dom';
import {
  AppBar,
  Box,
  Container,
  Drawer,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Settings as SettingsIcon,
  Home as HomeIcon,
  BugReport as BugReportIcon,
  ViewCarousel as ViewCarouselIcon,
  Collections as CollectionsIcon,
} from '@mui/icons-material';

const Layout = () => {
  const location = useLocation();
  const [progress, setProgress] = useState({ value: 0, status: '' });
  
  // 監聽進度更新
  useEffect(() => {
    console.log('Layout 組件已載入');
    console.log('當前路徑:', location.pathname);
    
    const unsubscribe = window.electronAPI.onProgressUpdate((value, status) => {
      setProgress({ value, status });
    });
    
    return () => {
      unsubscribe();
    };
  }, [location]);
  
  // 導航項目
  const navItems = [
    { path: '/', label: '首頁', icon: <HomeIcon /> },
    { path: '/search', label: '搜尋歌詞', icon: <SearchIcon /> },
    { path: '/batch', label: '批次投影片', icon: <ViewCarouselIcon /> },
    { path: '/settings', label: '設定', icon: <SettingsIcon /> },
  ];
  
  console.log('Layout 組件正在渲染');
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            歌曲投影片生成器
          </Typography>
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
          open={true}
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
            {navItems.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  sx={(theme) => ({
                    '&.active': {
                      backgroundColor: theme.palette.action.selected,
                    },
                  })}
                  onClick={() => console.log('點擊了導航項目:', item.label)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>
        
        <Container component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Paper elevation={3} sx={{ p: 3, minHeight: 'calc(100vh - 180px)' }}>
            <div style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '10px' }}>
              <Typography variant="caption" color="text.secondary">
                當前路徑: {location.pathname}
              </Typography>
            </div>
            <Outlet />
          </Paper>
        </Container>
      </Box>
      
      <Box component="footer" sx={{ py: 2, bgcolor: 'background.paper', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          歌曲投影片生成器 © {new Date().getFullYear()}
        </Typography>
      </Box>
    </Box>
  );
};

export default Layout; 