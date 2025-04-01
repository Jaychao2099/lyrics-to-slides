import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import { LyricsSearchResult } from '../../common/types';

interface LyricsSearchProps {
  onSearchComplete: (result: LyricsSearchResult) => void;
}

const LyricsSearch: React.FC<LyricsSearchProps> = ({ onSearchComplete }) => {
  const [songTitle, setSongTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<LyricsSearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<LyricsSearchResult | null>(null);

  const handleSearch = async () => {
    // 驗證輸入
    if (!songTitle.trim()) {
      setError('請輸入歌曲名稱');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // 調用歌詞搜尋 API
      const results = await window.electronAPI.searchLyrics(songTitle, artist);
      
      setSearchResults(results);
      
      if (results.length === 0) {
        setError('找不到歌詞，請嘗試修改搜尋條件');
      } else if (results.length === 1) {
        // 如果只有一個結果，自動選擇該結果
        setSelectedResult(results[0]);
      }
    } catch (err: any) {
      setError(err.message || '搜尋歌詞時發生錯誤');
      console.error('搜尋歌詞失敗', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectResult = (result: LyricsSearchResult) => {
    setSelectedResult(result);
  };

  const handleConfirm = () => {
    if (selectedResult) {
      onSearchComplete(selectedResult);
    }
  };

  const formatLyricsPreview = (lyrics: string) => {
    return lyrics.length > 200 ? `${lyrics.substring(0, 200)}...` : lyrics;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        歌詞搜尋
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="歌曲名稱"
          value={songTitle}
          onChange={(e) => setSongTitle(e.target.value)}
          onKeyPress={handleKeyPress}
          margin="normal"
          variant="outlined"
          required
        />
        
        <TextField
          fullWidth
          label="歌手/樂團 (選填)"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          onKeyPress={handleKeyPress}
          margin="normal"
          variant="outlined"
        />
        
        <Button
          variant="contained"
          color="primary"
          onClick={handleSearch}
          disabled={loading || !songTitle.trim()}
          sx={{ mt: 2 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : '搜尋歌詞'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {searchResults.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            搜尋結果
          </Typography>
          
          {searchResults.map((result, index) => (
            <Card 
              key={index}
              variant="outlined"
              sx={{ 
                mb: 2, 
                cursor: 'pointer',
                border: selectedResult === result ? '2px solid #3f51b5' : undefined
              }}
              onClick={() => handleSelectResult(result)}
            >
              <CardContent>
                <Typography variant="h6">{result.title}</Typography>
                {result.artist && (
                  <Typography variant="subtitle1" color="text.secondary">
                    {result.artist}
                  </Typography>
                )}
                {result.source && (
                  <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                    來源: <a href={result.source} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{result.source}</a>
                  </Typography>
                )}
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {formatLyricsPreview(result.lyrics)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {selectedResult && (
        <Box sx={{ mt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            提示：選擇歌詞後，您可以在之後的步驟中編輯歌詞內容。
          </Alert>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleConfirm}
            >
              使用此歌詞
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default LyricsSearch; 