import React from 'react';
import { Box, Typography } from '@mui/material';
import SettingsPanel from './SettingsPanel';
import { Settings as SettingsType } from '../../common/types';

interface SettingsProps {
  settings?: SettingsType;
  onSave?: (settings: SettingsType) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave }) => {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        設定
      </Typography>
      
      {settings ? (
        <SettingsPanel 
          settings={settings} 
          onSave={onSave || (() => {})}
          onCancel={() => {}}
        />
      ) : (
        <Typography>載入設定中...</Typography>
      )}
    </Box>
  );
};

export default Settings; 