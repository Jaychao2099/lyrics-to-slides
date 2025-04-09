import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Divider,
  Stack,
  Tooltip,
  Alert,
} from '@mui/material';
import { Add, Delete, Edit, Refresh, Preview, FileDownload, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { SlideSet, Song, SlideSetSong } from '../../common/types';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import SlideEditor from '../components/SlideEditor';

// 定義拖放項目類型
const ItemTypes = {
  SONG: 'song',
};

interface DraggableSongItemProps {
  song: Song;
  index: number;
  moveItem: (fromIndex: number, toIndex: number) => void;
  handleRemove: (songId: number) => void;
  slideSetId: number;
}

// 拖放歌曲項目組件
const DraggableSongItem: React.FC<DraggableSongItemProps> = ({ song, index, moveItem, handleRemove, slideSetId }) => {
  const navigate = useNavigate();
  const ref = React.useRef<HTMLDivElement>(null);
  
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.SONG,
    item: { index, id: song.id },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  
  const [, drop] = useDrop({
    accept: ItemTypes.SONG,
    hover(item: { index: number; id: number }, monitor: any) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;
      
      // 不替換自己
      if (dragIndex === hoverIndex) {
        return;
      }
      
      moveItem(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });
  
  drag(drop(ref));
  
  return (
    <Paper 
      ref={ref} 
      elevation={2} 
      sx={{ 
        mb: 1, 
        p: 1, 
        display: 'flex', 
        alignItems: 'center', 
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move' 
      }}
    >
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          {song.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {song.artist}
        </Typography>
      </Box>
      <Box>
        <Tooltip title="編輯歌曲">
          <IconButton 
            size="small" 
            onClick={() => navigate(`/edit/${song.id}`)}
            sx={{ mr: 1 }}
          >
            <Edit />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={() => handleRemove(song.id)}>
          <Delete />
        </IconButton>
      </Box>
    </Paper>
  );
};

const BatchSlidesManager: React.FC = () => {
  const navigate = useNavigate();
  const [slideSets, setSlideSets] = useState<SlideSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [songsInSet, setSongsInSet] = useState<Song[]>([]);
  const [newSetName, setNewSetName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectSongDialogOpen, setSelectSongDialogOpen] = useState(false);
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportPath, setExportPath] = useState('');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [exportFileName, setExportFileName] = useState('');
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const [showSlideEditor, setShowSlideEditor] = useState(false);
  const [currentLyrics, setCurrentLyrics] = useState('');
  const [currentImageUrl, setCurrentImageUrl] = useState('');

  // 載入投影片集
  useEffect(() => {
    loadSlideSets();
  }, []);

  // 當選擇投影片集時載入其中的歌曲
  useEffect(() => {
    if (selectedSetId) {
      loadSongsInSet(selectedSetId);
    } else {
      setSongsInSet([]);
    }
  }, [selectedSetId]);

  // 載入投影片集列表
  const loadSlideSets = async () => {
    try {
      const sets = await window.electronAPI.getSlideSets();
      setSlideSets(sets);
      
      // 如果有集合且未選擇，則選第一個
      if (sets.length > 0 && !selectedSetId) {
        setSelectedSetId(sets[0].id);
      }
    } catch (error) {
      console.error('載入投影片集失敗', error);
    }
  };

  // 載入投影片集中的歌曲
  const loadSongsInSet = async (setId: number) => {
    try {
      // 獲取所有歌曲信息
      const songs = await window.electronAPI.getSlideSetSongs(setId);
      
      // 數據庫返回的就是歌曲信息，直接設置
      // 由於 TS 類型聲明與實際實現不匹配，這裡使用類型斷言
      setSongsInSet(songs as unknown as Song[]);
      console.log('載入歌曲列表成功:', songs);
    } catch (error) {
      console.error('載入投影片集歌曲失敗', error);
    }
  };

  // 創建新投影片集
  const handleCreateSlideSet = async () => {
    try {
      if (!newSetName.trim()) return;
      
      const setId = await window.electronAPI.createSlideSet(newSetName);
      setCreateDialogOpen(false);
      setNewSetName('');
      
      // 重新載入投影片集
      await loadSlideSets();
      
      // 選擇新創建的投影片集
      setSelectedSetId(setId);
    } catch (error: any) {
      console.error('創建投影片集失敗', error);
    }
  };

  // 刪除投影片集
  const handleDeleteSlideSet = async () => {
    try {
      if (!selectedSetId) return;
      
      const confirmed = window.confirm('確定要刪除這個投影片集嗎？');
      if (!confirmed) return;
      
      await window.electronAPI.deleteSlideSet(selectedSetId);
      
      // 重新載入投影片集
      await loadSlideSets();
      
      // 清除選擇
      setSelectedSetId(null);
    } catch (error: any) {
      console.error('刪除投影片集失敗', error);
    }
  };

  // 移除歌曲
  const handleRemoveSong = async (songId: number) => {
    try {
      if (!selectedSetId) return;
      
      await window.electronAPI.removeSongFromSlideSet(selectedSetId, songId);
      
      // 重新載入投影片集中的歌曲
      await loadSongsInSet(selectedSetId);
    } catch (error: any) {
      console.error('從投影片集移除歌曲失敗', error);
    }
  };

  // 移動歌曲順序
  const moveSong = async (fromIndex: number, toIndex: number) => {
    try {
      const newSongs = [...songsInSet];
      const [movedItem] = newSongs.splice(fromIndex, 1);
      newSongs.splice(toIndex, 0, movedItem);
      
      // 臨時更新 UI
      setSongsInSet(newSongs);
      
      // 更新數據庫
      if (selectedSetId) {
        await window.electronAPI.updateSongOrderInSlideSet(
          selectedSetId, 
          movedItem.id, 
          toIndex + 1 // 數據庫中順序從1開始
        );
        
        // 重新載入以確保數據一致
        await loadSongsInSet(selectedSetId);
      }
    } catch (error: any) {
      console.error('更新歌曲順序失敗', error);
    }
  };

  // 打開選歌對話框
  const handleOpenSelectSongDialog = async () => {
    try {
      // 加載所有歌曲
      const allSongs = await window.electronAPI.getSongs();
      setAvailableSongs(allSongs);
      setSelectSongDialogOpen(true);
    } catch (error: any) {
      console.error('獲取可用歌曲失敗', error);
    }
  };

  // 添加歌曲到投影片集
  const handleAddSongToSet = async (song: Song) => {
    try {
      if (!selectedSetId) return;
      
      // 檢查歌曲是否有關聯圖片
      const imageCheck = await window.electronAPI.checkRelatedImage(song.id);
      if (!imageCheck.hasRelatedImage) {
        alert(`歌曲 "${song.title}" 沒有關聯的背景圖片，請先添加圖片。`);
        return;
      }
      
      // 添加到投影片集，順序為最後一個
      const newOrder = songsInSet.length + 1;
      await window.electronAPI.addSongToSlideSet(selectedSetId, song.id, newOrder);
      
      // 重新載入投影片集中的歌曲
      await loadSongsInSet(selectedSetId);
      
      // 關閉對話框
      setSelectSongDialogOpen(false);
    } catch (error: any) {
      console.error('添加歌曲到投影片集失敗', error);
    }
  };

  // 生成投影片
  const handleGenerateSlides = async () => {
    try {
      if (!selectedSetId) return;
      
      if (songsInSet.length === 0) {
        alert('投影片集中沒有歌曲，請先添加歌曲。');
        return;
      }
      
      await window.electronAPI.generateBatchSlides(selectedSetId);
      alert('投影片生成成功！');
    } catch (error: any) {
      console.error('生成批次投影片失敗', error);
      alert('生成批次投影片失敗: ' + error.message);
    }
  };

  // 預覽投影片集
  const handlePreviewSlides = async () => {
    try {
      if (!selectedSetId || songsInSet.length === 0) {
        alert('投影片集中沒有歌曲，請先添加歌曲。');
        return;
      }
      
      // 顯示投影片集的編輯器，而不是單首歌曲的
      await handleEditSlideSet();
    } catch (error: any) {
      console.error('預覽投影片失敗', error);
      alert('預覽投影片失敗: ' + (error.message || '未知錯誤'));
    }
  };

  // 編輯整個投影片集
  const handleEditSlideSet = async () => {
    try {
      setShowSlideEditor(false); // 先隱藏，避免顯示舊數據
      
      if (!selectedSetId) return;
      
      // 嘗試從快取獲取投影片集內容
      let slideContent;
      try {
        slideContent = await window.electronAPI.getBatchSlideContent(selectedSetId);
      } catch (error) {
        console.warn('獲取已存在的投影片集內容失敗，將重新生成', error);
        // 如果獲取失敗，則重新生成
        slideContent = await window.electronAPI.generateBatchSlides(selectedSetId);
      }
      
      // 設置編輯內容
      setCurrentLyrics(slideContent || ''); // 存儲 md 內容用於編輯
      setSelectedSongId(null); // 不是編輯單首歌曲
      
      // 獲取第一首歌的圖片作為投影片集的背景圖片
      if (songsInSet.length > 0 && songsInSet[0].imageUrl) {
        setCurrentImageUrl(songsInSet[0].imageUrl);
      } else {
        // 如果第一首歌沒有圖片，嘗試獲取任何有圖片的歌曲
        const songWithImage = songsInSet.find(song => song.imageUrl);
        if (songWithImage && songWithImage.imageUrl) {
          setCurrentImageUrl(songWithImage.imageUrl);
        } else {
          alert('投影片集中沒有任何歌曲有背景圖片，請先為歌曲添加圖片。');
          return;
        }
      }
      
      setShowSlideEditor(true);
    } catch (error: any) {
      console.error('獲取投影片集內容失敗', error);
      alert('獲取投影片集內容失敗: ' + (error.message || '未知錯誤'));
    }
  };

  // 處理投影片編輯完成
  const handleSlidesCreated = async (slideContent: string) => {
    console.log('投影片已更新', slideContent);
    
    // 保存整個投影片集的內容
    if (selectedSetId) {
      try {
        // 使用新的 API 直接更新批量投影片的內容
        const updated = await window.electronAPI.updateBatchSlideContent(selectedSetId, slideContent);
        
        if (updated) {
          // 不再自動預覽，只顯示成功消息
          alert('投影片集已更新成功！');
        } else {
          throw new Error('更新投影片集失敗');
        }
      } catch (err: any) {
        console.error('更新投影片集失敗', err);
        alert('更新投影片集失敗: ' + (err.message || '未知錯誤'));
      }
    }
  };

  // 打開編輯名稱對話框
  const handleOpenEditNameDialog = () => {
    if (!selectedSetId) return;
    
    const selectedSet = slideSets.find(set => set.id === selectedSetId);
    if (selectedSet) {
      setEditName(selectedSet.name);
      setEditNameDialogOpen(true);
    }
  };

  // 更新投影片集名稱
  const handleUpdateSlideName = async () => {
    try {
      if (!selectedSetId || !editName.trim()) return;
      
      // 添加 updateSlideSetName API 調用
      await window.electronAPI.updateSlideSetName(selectedSetId, editName);
      
      // 重新載入投影片集
      await loadSlideSets();
      
      // 關閉對話框
      setEditNameDialogOpen(false);
    } catch (error: any) {
      console.error('更新投影片集名稱失敗', error);
    }
  };

  // 打開導出對話框
  const handleOpenExportDialog = () => {
    if (songsInSet.length === 0) {
      alert('投影片集中沒有歌曲，請先添加歌曲。');
      return;
    }
    
    // 設置預設檔名為投影片集名稱
    const selectedSet = slideSets.find(set => set.id === selectedSetId);
    if (selectedSet) {
      setExportFileName(selectedSet.name.replace(/[\\/:*?"<>|]/g, '_'));
    }
    
    // 獲取預設輸出路徑和預設匯出格式
    window.electronAPI.getSettings().then(settings => {
      if (settings.defaultOutputDirectory) {
        setExportPath(settings.defaultOutputDirectory);
      }
      if (settings.defaultExportFormat) {
        setExportFormat(settings.defaultExportFormat);
      }
    }).catch(error => {
      console.error('獲取預設設定失敗', error);
    });
    
    setExportDialogOpen(true);
  };

  // 選擇導出路徑
  const handleSelectExportPath = async () => {
    try {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        setExportPath(path);
      }
    } catch (error: any) {
      console.error('選擇導出路徑失敗', error);
    }
  };

  // 導出投影片
  const handleExportSlides = async () => {
    try {
      if (!selectedSetId || !exportPath) return;
      
      // 添加檔案名稱
      const fileName = `${exportFileName || 'slides'}.${exportFormat}`;
      const fullPath = `${exportPath}/${fileName}`;
      
      await window.electronAPI.exportBatchSlides(selectedSetId, fullPath, exportFormat);
      
      setExportDialogOpen(false);
      alert(`投影片已成功導出到: ${fullPath}`);
    } catch (error: any) {
      console.error('導出批次投影片失敗', error);
      alert('導出批次投影片失敗: ' + error.message);
    }
  };

  // 切換投影片集編輯器顯示狀態
  const handleToggleSlideEditor = async () => {
    try {
      if (!selectedSetId || songsInSet.length === 0) {
        alert('投影片集中沒有歌曲，請先添加歌曲。');
        return;
      }
      
      if (showSlideEditor) {
        // 如果編輯器已顯示，則隱藏它
        setShowSlideEditor(false);
      } else {
        // 否則，顯示編輯器
        await handleEditSlideSet();
      }
    } catch (error: any) {
      console.error('切換投影片編輯器失敗', error);
      alert('切換投影片編輯器失敗: ' + (error.message || '未知錯誤'));
    }
  };

  // 過濾搜索結果
  const filteredSongs = availableSongs.filter(song => 
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (song.artist && song.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 獲取當前選中的投影片集名稱
  const selectedSetName = selectedSetId 
    ? slideSets.find(set => set.id === selectedSetId)?.name || '未命名投影片集'
    : '';

  return (
    <DndProvider backend={HTML5Backend}>
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            投影片集管理
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
            <Box sx={{ flex: 1, minWidth: '250px' }}>
              <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">投影片集</Typography>
                  <Button 
                    startIcon={<Add />} 
                    size="small" 
                    variant="outlined"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    新增
                  </Button>
                </Box>
                
                {slideSets.length > 0 ? (
                  <List component="nav" sx={{ maxHeight: '300px', overflow: 'auto' }}>
                    {slideSets.map((set) => (
                      <ListItemButton
                        key={set.id}
                        selected={selectedSetId === set.id}
                        onClick={() => setSelectedSetId(set.id)}
                      >
                        <ListItemText primary={set.name} />
                      </ListItemButton>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    目前沒有投影片集，請建立新的投影片集
                  </Typography>
                )}
              </Paper>
              
              {selectedSetId && (
                <>
                  <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        歌曲列表
                      </Typography>
                      <Box>
                        <Button
                          startIcon={<Add />}
                          size="small"
                          variant="outlined"
                          onClick={handleOpenSelectSongDialog}
                          sx={{ mr: 1 }}
                        >
                          添加歌曲
                        </Button>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEditNameDialog()}
                          title="編輯名稱"
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                    
                    {songsInSet.length > 0 ? (
                      <Box sx={{ maxHeight: '300px', overflow: 'auto' }}>
                        {songsInSet.map((song, index) => (
                          <DraggableSongItem
                            key={song.id}
                            song={song}
                            index={index}
                            moveItem={moveSong}
                            handleRemove={handleRemoveSong}
                            slideSetId={selectedSetId}
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        目前沒有歌曲，請添加歌曲到投影片集
                      </Typography>
                    )}
                  </Paper>
                  
                  <Paper elevation={3} sx={{ p: 2 }}>
                    <Stack direction="column" spacing={2}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleGenerateSlides}
                        startIcon={<Refresh />}
                        disabled={songsInSet.length === 0}
                      >
                        生成批次投影片
                      </Button>
                      
                      <Button
                        variant="outlined"
                        onClick={handleToggleSlideEditor}
                        disabled={songsInSet.length === 0}
                        startIcon={<Edit />}
                      >
                        編輯投影片集
                      </Button>
                      
                      <Button
                        variant="outlined"
                        onClick={handleOpenExportDialog}
                        disabled={songsInSet.length === 0}
                        startIcon={<FileDownload />}
                      >
                        匯出投影片集
                      </Button>
                      
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={handleDeleteSlideSet}
                        startIcon={<Delete />}
                      >
                        刪除投影片集
                      </Button>
                    </Stack>
                  </Paper>
                </>
              )}
            </Box>

            <Box sx={{ flex: 2 }}>
              {/* 投影片編輯器 */}
              {showSlideEditor && currentImageUrl && (
                <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5">
                      投影片集整體編輯 - {selectedSetName}
                    </Typography>
                    <Button 
                      variant="outlined" 
                      color="secondary"
                      onClick={() => setShowSlideEditor(false)}
                    >
                      關閉編輯器
                    </Button>
                  </Box>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    您正在編輯整個投影片集的文本。這裡的變更將套用到整個投影片集的顯示和輸出。
                  </Alert>
                  <SlideEditor 
                    lyrics={currentLyrics} 
                    imageUrl={currentImageUrl} 
                    songId={selectedSetId || 0}
                    onSlidesCreated={handleSlidesCreated} 
                    isBatchMode={true}
                  />
                </Paper>
              )}
              {!showSlideEditor && (
                <Paper elevation={3} sx={{ p: 3, mb: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="textSecondary" gutterBottom>
                      點擊「編輯投影片集」按鈕
                    </Typography>
                    <Typography variant="body1" color="textSecondary">
                      可以編輯整個投影片集的文本內容
                    </Typography>
                  </Box>
                </Paper>
              )}
            </Box>
          </Box>
        </Box>

        {/* Dialog components... */}
        {/* 創建投影片集對話框 */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
          <DialogTitle>創建新投影片集</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="投影片集名稱"
              fullWidth
              variant="outlined"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button 
              onClick={handleCreateSlideSet}
              variant="contained"
              disabled={!newSetName.trim()}
            >
              創建
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* 選擇歌曲對話框 */}
        <Dialog 
          open={selectSongDialogOpen} 
          onClose={() => setSelectSongDialogOpen(false)}
          fullWidth
          maxWidth="md"
          keepMounted
        >
          <DialogTitle>選擇要添加的歌曲</DialogTitle>
          <DialogContent>
            <TextField
              margin="dense"
              label="搜索歌曲"
              fullWidth
              variant="outlined"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 2 }}
            />
            
            <List sx={{ maxHeight: '50vh', overflow: 'auto' }}>
              {filteredSongs.length === 0 ? (
                <Typography align="center" color="text.secondary" sx={{ mt: 2 }}>
                  未找到符合條件的歌曲
                </Typography>
              ) : (
                filteredSongs.map((song) => (
                  <Paper key={song.id} sx={{ mb: 1, p: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="subtitle1">{song.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {song.artist}
                        </Typography>
                      </Box>
                      <Box>
                        {songsInSet.some(s => s.id === song.id) ? (
                          <Button 
                            variant="outlined" 
                            size="small"
                            disabled
                            color="success"
                          >
                            已添加
                          </Button>
                        ) : (
                          <Button 
                            variant="outlined" 
                            size="small"
                            onClick={() => handleAddSongToSet(song)}
                          >
                            添加
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                ))
              )}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectSongDialogOpen(false)}>關閉</Button>
          </DialogActions>
        </Dialog>
        
        {/* 導出對話框 */}
        <Dialog 
          open={exportDialogOpen} 
          onClose={() => setExportDialogOpen(false)}
        >
          <DialogTitle>導出投影片</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, mt: 1 }}>
              <TextField
                margin="dense"
                label="導出路徑"
                fullWidth
                variant="outlined"
                value={exportPath}
                InputProps={{ readOnly: true }}
                sx={{ mr: 1 }}
              />
              <Button 
                variant="outlined" 
                onClick={handleSelectExportPath}
              >
                選擇
              </Button>
            </Box>

            <TextField
              margin="dense"
              label="檔案名稱"
              fullWidth
              variant="outlined"
              value={exportFileName}
              onChange={(e) => setExportFileName(e.target.value)}
              sx={{ mb: 2 }}
            />
            
            <TextField
              select
              label="格式"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              fullWidth
              variant="outlined"
              SelectProps={{
                native: true,
              }}
            >
              <option value="pdf">PDF</option>
              <option value="pptx">PowerPoint (PPTX)</option>
              <option value="html">HTML</option>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportDialogOpen(false)}>取消</Button>
            <Button 
              onClick={handleExportSlides}
              variant="contained"
              disabled={!exportPath || !exportFileName.trim()}
            >
              導出
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* 編輯名稱對話框 */}
        <Dialog open={editNameDialogOpen} onClose={() => setEditNameDialogOpen(false)}>
          <DialogTitle>編輯投影片集名稱</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="投影片集名稱"
              fullWidth
              variant="outlined"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditNameDialogOpen(false)}>取消</Button>
            <Button 
              onClick={handleUpdateSlideName}
              variant="contained"
              disabled={!editName.trim()}
            >
              更新
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </DndProvider>
  );
};

export default BatchSlidesManager; 