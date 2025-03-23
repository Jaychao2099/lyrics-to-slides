import React from 'react';
import { ApiKeys } from '../types';

interface APISettingsProps {
  apiKeys: ApiKeys;
  onApiKeyChange: (key: keyof ApiKeys, value: string) => void;
  selectedLyricsAPI: string;
  selectedImageAPI: string;
  onLyricsAPIChange: (api: string) => void;
  onImageAPIChange: (api: string) => void;
}

const APISettings: React.FC<APISettingsProps> = ({ 
  apiKeys, 
  onApiKeyChange, 
  selectedLyricsAPI, 
  selectedImageAPI, 
  onLyricsAPIChange, 
  onImageAPIChange 
}) => {
  const handleLyricsAPIKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onApiKeyChange('lyricsAPI', e.target.value);
  };

  const handleImageAPIKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onApiKeyChange('imageAPI', e.target.value);
  };

  return (
    <div className="api-settings">
      <h2>API 設置</h2>
      
      <div className="settings-grid">
        <div className="settings-section">
          <h3>歌詞搜索</h3>
          <div className="form-group">
            <label htmlFor="lyrics-api">選擇API服務:</label>
            <select 
              id="lyrics-api" 
              className="form-control"
              value={selectedLyricsAPI}
              onChange={(e) => onLyricsAPIChange(e.target.value)}
            >
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
              <option value="custom">自定義</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="lyrics-api-key">API金鑰:</label>
            <input 
              type="password"
              id="lyrics-api-key"
              className="form-control"
              value={apiKeys.lyricsAPI}
              onChange={handleLyricsAPIKeyChange}
              placeholder="輸入您的API金鑰"
            />
          </div>
        </div>

        <div className="settings-section">
          <h3>圖片生成</h3>
          <div className="form-group">
            <label htmlFor="image-api">選擇API服務:</label>
            <select 
              id="image-api" 
              className="form-control"
              value={selectedImageAPI}
              onChange={(e) => onImageAPIChange(e.target.value)}
            >
              <option value="openai">OpenAI (DALL-E)</option>
              <option value="dalle">DALL-E</option>
              <option value="custom">自定義</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="image-api-key">API金鑰:</label>
            <input 
              type="password"
              id="image-api-key"
              className="form-control"
              value={apiKeys.imageAPI}
              onChange={handleImageAPIKeyChange}
              placeholder="輸入您的API金鑰"
            />
          </div>
        </div>
      </div>

      <div className="api-info">
        <p>
          <strong>提示:</strong> API金鑰安全地存儲在您的本地設備上，不會傳輸到外部服務器。
        </p>
      </div>
    </div>
  );
};

export default APISettings; 