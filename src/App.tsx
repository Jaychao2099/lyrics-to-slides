import React, { useState, useEffect } from 'react';
import './App.css';
import LyricInput from './components/LyricInput';
import APISettings from './components/APISettings';
import LyricPreview from './components/LyricPreview';
import SlidePreview from './components/SlidePreview';
import ExportOptions from './components/ExportOptions';
import { Song, ApiKeys } from './types';

const App: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    lyricsAPI: '',
    imageAPI: ''
  });
  const [selectedLyricsAPI, setSelectedLyricsAPI] = useState<string>('openai');
  const [selectedImageAPI, setSelectedImageAPI] = useState<string>('openai');
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 在本地存儲中加載API密鑰
  useEffect(() => {
    const savedApiKeys = localStorage.getItem('apiKeys');
    if (savedApiKeys) {
      setApiKeys(JSON.parse(savedApiKeys));
    }
    
    const savedLyricsAPI = localStorage.getItem('selectedLyricsAPI');
    if (savedLyricsAPI) {
      setSelectedLyricsAPI(savedLyricsAPI);
    }
    
    const savedImageAPI = localStorage.getItem('selectedImageAPI');
    if (savedImageAPI) {
      setSelectedImageAPI(savedImageAPI);
    }
  }, []);

  // 保存API密鑰到本地存儲
  useEffect(() => {
    localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  // 保存所選API
  useEffect(() => {
    localStorage.setItem('selectedLyricsAPI', selectedLyricsAPI);
  }, [selectedLyricsAPI]);

  useEffect(() => {
    localStorage.setItem('selectedImageAPI', selectedImageAPI);
  }, [selectedImageAPI]);

  // 添加新歌曲
  const addSong = (title: string) => {
    const newSong: Song = {
      title,
      lyrics: '',
      imageUrl: '',
      isLoading: false
    };
    setSongs([...songs, newSong]);
    setCurrentSongIndex(songs.length);
  };

  // 更新歌曲信息
  const updateSong = (index: number, updatedSong: Partial<Song>) => {
    const updatedSongs = [...songs];
    updatedSongs[index] = { ...updatedSongs[index], ...updatedSong };
    setSongs(updatedSongs);
  };

  // 處理API設置更改
  const handleApiKeyChange = (key: keyof ApiKeys, value: string) => {
    setApiKeys({ ...apiKeys, [key]: value });
  };

  // 處理所選API更改
  const handleLyricsAPIChange = (api: string) => {
    setSelectedLyricsAPI(api);
  };

  const handleImageAPIChange = (api: string) => {
    setSelectedImageAPI(api);
  };

  return (
    <div className="app-container">
      <header>
        <h1>歌曲投影片生成器</h1>
      </header>
      
      <main>
        <div className="settings-panel">
          <APISettings 
            apiKeys={apiKeys}
            onApiKeyChange={handleApiKeyChange}
            selectedLyricsAPI={selectedLyricsAPI}
            selectedImageAPI={selectedImageAPI}
            onLyricsAPIChange={handleLyricsAPIChange}
            onImageAPIChange={handleImageAPIChange}
          />
        </div>

        <div className="input-panel">
          <LyricInput 
            onAddSong={addSong}
            songs={songs}
            currentSongIndex={currentSongIndex}
            setCurrentSongIndex={setCurrentSongIndex}
            apiKeys={apiKeys}
            selectedLyricsAPI={selectedLyricsAPI}
            selectedImageAPI={selectedImageAPI}
            updateSong={updateSong}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        </div>

        <div className="preview-panel">
          {currentSongIndex >= 0 && (
            <>
              <LyricPreview 
                song={songs[currentSongIndex]} 
                updateSong={updatedSong => updateSong(currentSongIndex, updatedSong)}
              />
              <SlidePreview song={songs[currentSongIndex]} />
            </>
          )}
        </div>
      </main>

      <footer>
        <ExportOptions 
          songs={songs}
          isLoading={isLoading}
        />
      </footer>
    </div>
  );
};

export default App; 