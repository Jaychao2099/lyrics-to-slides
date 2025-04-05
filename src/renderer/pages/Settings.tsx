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
    } catch (error) {
      console.error('保存設定失敗', error);
    }
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
            onCancel={() => {}} 
          />
        </Paper>
      )}
    </Box>
  );
};

export default Settings; 