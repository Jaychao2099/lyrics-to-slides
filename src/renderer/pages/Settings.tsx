import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import SettingsPanel from '../components/SettingsPanel';
import { Settings as SettingsType } from '../../common/types';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const settings = await window.electronAPI.getSettings();
        setSettings(settings);
      } catch (error) {
        console.error('載入設定失敗', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  const handleSaveSettings = async (newSettings: SettingsType) => {
    try {
      await window.electronAPI.saveSettings(newSettings);
      setSettings(newSettings);
      
      // 觸發自定義事件通知其他組件設定已變更
      const event = new CustomEvent('settings-changed');
      window.dispatchEvent(event);
      
      // 如果主題已變更，立即應用
      if (settings && settings.theme !== newSettings.theme) {
        console.log('主題已從', settings.theme, '變更為', newSettings.theme);
      }
    } catch (error) {
      console.error('儲存設定失敗', error);
    }
  };
  
  const handleCancelSettings = () => {
    // 重新載入現有設定
    const loadSettings = async () => {
      try {
        const settings = await window.electronAPI.getSettings();
        setSettings(settings);
      } catch (error) {
        console.error('重新載入設定失敗', error);
      }
    };
    
    loadSettings();
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        應用設定
      </Typography>
      
      {settings && (
        <Paper sx={{ p: 3 }}>
          <SettingsPanel 
            settings={settings} 
            onSave={handleSaveSettings}
            onCancel={handleCancelSettings}
          />
        </Paper>
      )}
    </Box>
  );
};

export default Settings; 