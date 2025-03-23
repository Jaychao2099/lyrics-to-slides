import React, { useState } from 'react';
import { Song, ApiKeys } from '../types';
import { searchLyrics, generateImage } from '../services/api';

interface LyricInputProps {
  onAddSong: (title: string) => void;
  songs: Song[];
  currentSongIndex: number;
  setCurrentSongIndex: (index: number) => void;
  apiKeys: ApiKeys;
  selectedLyricsAPI: string;
  selectedImageAPI: string;
  updateSong: (index: number, song: Partial<Song>) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const LyricInput: React.FC<LyricInputProps> = ({
  onAddSong,
  songs,
  currentSongIndex,
  setCurrentSongIndex,
  apiKeys,
  selectedLyricsAPI,
  selectedImageAPI,
  updateSong,
  isLoading,
  setIsLoading
}) => {
  const [newSongTitle, setNewSongTitle] = useState<string>('');

  const handleAddSong = () => {
    if (newSongTitle.trim()) {
      onAddSong(newSongTitle.trim());
      setNewSongTitle('');
    }
  };

  const handleSongSelect = (index: number) => {
    setCurrentSongIndex(index);
  };

  const handleSearchLyrics = async (songIndex: number) => {
    const song = songs[songIndex];
    
    // 檢查API密鑰是否存在
    if (!apiKeys.lyricsAPI) {
      alert('請先設置歌詞搜索API金鑰');
      return;
    }
    
    // 更新加載狀態
    updateSong(songIndex, { isLoading: true });
    setIsLoading(true);
    
    try {
      // 調用API搜索歌詞
      const lyrics = await searchLyrics(
        song.title,
        selectedLyricsAPI,
        apiKeys.lyricsAPI
      );
      
      // 更新歌曲信息
      updateSong(songIndex, { lyrics, isLoading: false });
    } catch (error) {
      console.error('歌詞搜索失敗:', error);
      alert('歌詞搜索失敗，請檢查API設置和網絡連接');
    } finally {
      setIsLoading(false);
      updateSong(songIndex, { isLoading: false });
    }
  };

  const handleGenerateImage = async (songIndex: number) => {
    const song = songs[songIndex];
    
    // 檢查API密鑰是否存在
    if (!apiKeys.imageAPI) {
      alert('請先設置圖片生成API金鑰');
      return;
    }
    
    // 更新加載狀態
    updateSong(songIndex, { isLoading: true });
    setIsLoading(true);
    
    try {
      // 調用API生成圖片
      const imageUrl = await generateImage(
        song.title,
        selectedImageAPI,
        apiKeys.imageAPI
      );
      
      // 更新歌曲信息
      if (imageUrl) {
        updateSong(songIndex, { imageUrl, isLoading: false });
      } else {
        alert('無法生成圖片，請檢查API設置和網絡連接');
      }
    } catch (error) {
      console.error('圖片生成失敗:', error);
      alert('圖片生成失敗，請檢查API設置和網絡連接');
    } finally {
      setIsLoading(false);
      updateSong(songIndex, { isLoading: false });
    }
  };

  const handleProcessAllSteps = async (songIndex: number) => {
    await handleSearchLyrics(songIndex);
    await handleGenerateImage(songIndex);
  };

  return (
    <div className="lyric-input">
      <h2>歌曲輸入</h2>
      
      <div className="form-group">
        <label htmlFor="new-song">輸入歌曲名稱:</label>
        <div className="input-group">
          <input
            type="text"
            id="new-song"
            className="form-control"
            value={newSongTitle}
            onChange={(e) => setNewSongTitle(e.target.value)}
            placeholder="例如: 月亮代表我的心"
            onKeyPress={(e) => e.key === 'Enter' && handleAddSong()}
          />
          <button 
            onClick={handleAddSong}
            disabled={!newSongTitle.trim() || isLoading}
          >
            添加歌曲
          </button>
        </div>
      </div>
      
      {songs.length > 0 && (
        <div className="song-list">
          <h3>已添加歌曲:</h3>
          <ul>
            {songs.map((song, index) => (
              <li 
                key={index}
                className={`song-item ${index === currentSongIndex ? 'active' : ''}`}
                onClick={() => handleSongSelect(index)}
              >
                <div className="song-title">{song.title}</div>
                <div className="song-actions">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSearchLyrics(index);
                    }}
                    disabled={isLoading}
                    className="secondary"
                  >
                    搜索歌詞
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateImage(index);
                    }}
                    disabled={isLoading}
                    className="secondary"
                  >
                    生成圖片
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProcessAllSteps(index);
                    }}
                    disabled={isLoading}
                  >
                    全部處理
                  </button>
                </div>
                {song.isLoading && (
                  <div className="loading">
                    <div className="spinner"></div>
                    <span>處理中...</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LyricInput; 