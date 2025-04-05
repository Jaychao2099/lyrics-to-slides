import React, { useState, useRef, useEffect } from 'react';
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
  Divider,
  Chip,
  Snackbar
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
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
  const [editMode, setEditMode] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedArtist, setEditedArtist] = useState('');
  const [editSuccessOpen, setEditSuccessOpen] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  const selectedResultRef = useRef<HTMLDivElement>(null);

  // 儲存編輯後滾動到選中的結果
  useEffect(() => {
    if (!editMode && isEdited && selectedResultRef.current) {
      selectedResultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [editMode, isEdited]);

  const handleSearch = async () => {
    // 驗證輸入
    if (!songTitle.trim()) {
      setError('請輸入歌曲名稱');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setIsEdited(false);
      
      // 調用歌詞搜尋 API
      const results = await window.electronAPI.searchLyrics(songTitle, artist);
      
      setSearchResults(results);
      
      if (results.length === 0) {
        setError('找不到歌詞，請嘗試修改搜尋條件或手動輸入歌詞');
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

  const handleEdit = () => {
    if (selectedResult) {
      setEditedLyrics(selectedResult.lyrics);
      setEditedTitle(selectedResult.title);
      setEditedArtist(selectedResult.artist);
      setEditMode(true);
    }
  };

  const handleSaveEdit = async () => {
    if (selectedResult && editedLyrics.trim()) {
      // 更新選中的結果
      const updatedResult: LyricsSearchResult = {
        ...selectedResult,
        title: editedTitle.trim() || selectedResult.title,
        artist: editedArtist,
        lyrics: editedLyrics,
        isEdited: true  // 添加標記表示此歌詞已被編輯
      };
      
      try {
        // 更新快取中的歌詞，確保原始換行符被保留
        console.log(`歌詞保存前內容預覽: ${editedLyrics.substring(0, 100)}...`);
        console.log(`歌詞中連續換行符數量: ${(editedLyrics.match(/\n\n/g) || []).length}`);
        
        const result = await window.electronAPI.updateLyricsCache(
          updatedResult.title,
          updatedResult.artist,
          editedLyrics, // 直接傳遞未做任何處理的歌詞內容
          updatedResult.source
        );
        
        // 更新歌曲ID
        if (result && typeof result === 'object') {
          updatedResult.songId = result.songId;
          console.log(`歌詞已更新，songId: ${result.songId}`);
        }
        
        // 更新界面狀態
        setSelectedResult(updatedResult);
        
        // 更新搜索結果列表中的對應項
        setSearchResults(prevResults => {
          return prevResults.map(result => 
            result === selectedResult ? updatedResult : result
          );
        });
        
        setEditMode(false);
        setIsEdited(true);
        setEditSuccessOpen(true);
        
        // 在控制台打印日誌，幫助確認編輯內容已更新
        console.log('歌詞已編輯並更新到快取：', {
          title: updatedResult.title,
          artist: updatedResult.artist,
          lyrics: updatedResult.lyrics.substring(0, 100) + '...', // 只記錄前100個字符以避免日誌過長
          lyricsLineCount: updatedResult.lyrics.split('\n').length,
          hasDoubleNewlines: updatedResult.lyrics.includes('\n\n'),
          songId: updatedResult.songId
        });
      } catch (error) {
        console.error('更新歌詞快取失敗:', error);
        setError('更新歌詞快取失敗，但界面已更新。');
        
        // 即使快取更新失敗，也更新界面
        setSelectedResult(updatedResult);
        setSearchResults(prevResults => {
          return prevResults.map(result => 
            result === selectedResult ? updatedResult : result
          );
        });
        setEditMode(false);
        setIsEdited(true);
      }
    }
  };

  // 將編輯後的歌詞另存為新歌曲
  const handleSaveAsNew = async () => {
    try {
      if (!editedTitle.trim() || !editedLyrics.trim()) {
        setError('歌曲名稱和歌詞內容不能為空');
        return;
      }

      setLoading(true);
      setError(null);

      // 將歌詞添加為新歌曲
      const newSongId = await window.electronAPI.addNewSong(
        editedTitle,
        editedArtist,
        editedLyrics,
        selectedResult?.source || ''
      );

      // 創建新的搜尋結果對象
      const newResult: LyricsSearchResult = {
        title: editedTitle,
        artist: editedArtist,
        lyrics: editedLyrics,
        source: selectedResult?.source || '',
        isEdited: true,
        isNew: true,
        fromCache: true,
        songId: typeof newSongId === 'number' ? newSongId : -1
      };

      console.log('添加新歌曲完成，songId:', newResult.songId);

      // 更新搜尋結果，將新歌曲添加到搜尋結果中
      if (searchResults.length > 0) {
        setSearchResults([newResult, ...searchResults]);
      } else {
        setSearchResults([newResult]);
      }

      // 選擇新添加的歌曲
      setSelectedResult(newResult);
      setEditMode(false);
      setEditSuccessOpen(true);
    } catch (err: any) {
      setError(err.message || '保存新歌曲時發生錯誤');
      console.error('保存新歌曲失敗', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
  };

  const handleConfirm = async () => {
    if (selectedResult) {
      // 在控制台打印完整日誌，確認送出的內容
      console.log('確認使用歌詞：', {
        title: selectedResult.title,
        artist: selectedResult.artist,
        lyrics: selectedResult.lyrics.substring(0, 100) + '...',
        isEdited: selectedResult.isEdited || false,
        songId: selectedResult.songId || -1 // 添加songId到日誌
      });
      
      // 確保歌詞已經被儲存到快取中，並且有有效的songId
      if (!selectedResult.songId || selectedResult.songId === -1) {
        try {
          console.log('歌詞尚未儲存，自動儲存中...');
          // 更新快取中的歌詞
          const result = await window.electronAPI.updateLyricsCache(
            selectedResult.title,
            selectedResult.artist,
            selectedResult.lyrics,
            selectedResult.source || '直接使用'
          );
          
          // 更新歌曲ID
          if (result && typeof result === 'object' && result.songId > 0) {
            console.log(`歌詞已自動更新，songId: ${result.songId}`);
            selectedResult.songId = result.songId;
          } else {
            console.error('自動儲存歌詞失敗:', result);
          }
        } catch (error) {
          console.error('自動儲存歌詞到快取失敗:', error);
        }
      }
      
      // 確保songId有值，即使是-1
      const resultWithId = {
        ...selectedResult,
        songId: selectedResult.songId || -1
      };
      
      onSearchComplete(resultWithId);
    }
  };

  const formatLyricsPreview = (lyrics: string) => {
    return lyrics.length > 200 ? `${lyrics.substring(0, 200)}...` : lyrics;
  };

  const handleCloseSnackbar = () => {
    setEditSuccessOpen(false);
  };

  // 處理手動輸入歌詞
  const handleManualEntry = () => {
    setEditedTitle(songTitle);
    setEditedArtist(artist);
    setEditedLyrics('');
    setEditMode(true);
    setSelectedResult(null);
  };

  // 編輯模式界面 - 同時處理編輯現有歌詞和手動輸入新歌詞
  if (editMode) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom>
          {selectedResult ? '編輯歌詞' : '手動輸入歌詞'}
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="歌曲名稱"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            margin="normal"
            variant="outlined"
            required
          />
          
          <TextField
            fullWidth
            label="歌手/樂團"
            value={editedArtist}
            onChange={(e) => setEditedArtist(e.target.value)}
            margin="normal"
            variant="outlined"
          />
          
          <TextField
            fullWidth
            label="歌詞內容"
            value={editedLyrics}
            onChange={(e) => setEditedLyrics(e.target.value)}
            margin="normal"
            variant="outlined"
            multiline
            rows={12}
            required
            placeholder={selectedResult ? '' : '請在此輸入完整歌詞'}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleCancelEdit}
              sx={{ mr: 1 }}
            >
              取消
            </Button>
            {selectedResult ? (
              // 編輯現有歌詞的按鈕
              <>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleSaveAsNew}
                  disabled={!editedLyrics.trim()}
                  sx={{ mr: 1 }}
                >
                  另存為新歌曲
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveEdit}
                  disabled={!editedLyrics.trim()}
                >
                  保存編輯
                </Button>
              </>
            ) : (
              // 手動輸入新歌詞的按鈕
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveAsNew}
                disabled={!editedLyrics.trim() || !editedTitle.trim()}
              >
                保存新歌詞
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              搜尋結果 ({searchResults.length})
            </Typography>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleManualEntry}
              size="small"
            >
              都不是我要找的歌曲
            </Button>
          </Box>
          
          {searchResults.map((result, index) => (
            <Card 
              key={index}
              variant="outlined"
              ref={selectedResult === result ? selectedResultRef : null}
              sx={{ 
                mb: 2, 
                cursor: 'pointer',
                border: selectedResult === result ? '2px solid #3f51b5' : undefined,
                boxShadow: result.isEdited ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none'
              }}
              onClick={() => handleSelectResult(result)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>{result.title}</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {result.isEdited && (
                      <Chip 
                        icon={<EditIcon />} 
                        label="已編輯" 
                        size="small" 
                        color="success"
                      />
                    )}
                    {result.fromCache && (
                      <Chip 
                        label="快取" 
                        size="small" 
                        color="info"
                      />
                    )}
                    {result.fromApi && (
                      <Chip 
                        label="搜尋結果" 
                        size="small" 
                        color="primary"
                      />
                    )}
                  </Box>
                </Box>
                
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

      {searchResults.length === 0 && !loading && !error && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleManualEntry}
          >
            手動輸入歌詞
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            找不到歌詞？您可以選擇手動輸入歌詞內容
          </Typography>
        </Box>
      )}

      {selectedResult && (
        <Box sx={{ mt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {selectedResult.isEdited 
              ? '您已編輯過此歌詞。您可以繼續編輯或直接使用。請確保「換行」正確。' 
              : '您可以直接使用此歌詞，或點擊「編輯歌詞」進行修改。請確保「換行」正確。'}
          </Alert>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleEdit}
              sx={{ mr: 1 }}
            >
              {selectedResult.isEdited ? '再次編輯' : '編輯歌詞'}
            </Button>
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
      
      <Snackbar
        open={editSuccessOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        message="歌詞編輯已保存成功！"
      />
    </Box>
  );
};

export default LyricsSearch; 