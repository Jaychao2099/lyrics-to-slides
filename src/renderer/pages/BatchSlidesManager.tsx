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
} from '@mui/material';
import { Add, Delete, Edit, Preview, FileDownload, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { SlideSet, Song, SlideSetSong } from '../../common/types';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

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
      const slideSetSongs = await window.electronAPI.getSlideSetSongs(setId);
      // 從SlideSetSong[]轉換為Song[]
      const songs = slideSetSongs.map(item => item.song as Song).filter(song => song !== undefined);
      setSongsInSet(songs);
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

  // 預覽投影片
  const handlePreviewSlides = async () => {
    try {
      if (!selectedSetId) return;
      
      if (songsInSet.length === 0) {
        alert('投影片集中沒有歌曲，請先添加歌曲。');
        return;
      }
      
      await window.electronAPI.previewBatchSlides(selectedSetId);
    } catch (error: any) {
      console.error('預覽批次投影片失敗', error);
      alert('預覽批次投影片失敗: ' + error.message);
    }
  };

  // 打開導出對話框
  const handleOpenExportDialog = () => {
    if (!selectedSetId) return;
    
    if (songsInSet.length === 0) {
      alert('投影片集中沒有歌曲，請先添加歌曲。');
      return;
    }
    
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
      
      const selectedSet = slideSets.find(set => set.id === selectedSetId);
      if (!selectedSet) return;
      
      // 添加文件名
      const fileName = `${selectedSet.name.replace(/[\\/:*?"<>|]/g, '_')}.${exportFormat}`;
      const fullPath = `${exportPath}/${fileName}`;
      
      await window.electronAPI.exportBatchSlides(selectedSetId, fullPath, exportFormat);
      
      setExportDialogOpen(false);
      alert(`投影片已成功導出到: ${fullPath}`);
    } catch (error: any) {
      console.error('導出批次投影片失敗', error);
      alert('導出批次投影片失敗: ' + error.message);
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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        批次投影片管理
      </Typography>
      
      <DndProvider backend={HTML5Backend}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
          {/* 左側投影片集列表 */}
          <Box sx={{ flex: '0 0 33.33%' }}>
            <Paper sx={{ p: 2, height: '70vh', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">投影片集</Typography>
                <Button 
                  startIcon={<Add />} 
                  variant="contained" 
                  size="small"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  新增
                </Button>
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              
              <List sx={{ flexGrow: 1, overflow: 'auto' }}>
                {slideSets.length === 0 ? (
                  <Typography align="center" color="text.secondary" sx={{ mt: 2 }}>
                    尚無投影片集，請點擊上方「新增」按鈕創建
                  </Typography>
                ) : (
                  slideSets.map((set) => (
                    <ListItemButton 
                      key={set.id}
                      selected={selectedSetId === set.id}
                      onClick={() => setSelectedSetId(set.id)}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemText 
                        primary={set.name} 
                        secondary={`${set.songCount || 0} 首歌曲`} 
                      />
                    </ListItemButton>
                  ))
                )}
              </List>
              
              {selectedSetId && (
                <Box sx={{ mt: 2 }}>
                  <Button 
                    startIcon={<Delete />} 
                    variant="outlined" 
                    color="error" 
                    fullWidth
                    onClick={handleDeleteSlideSet}
                  >
                    刪除此投影片集
                  </Button>
                </Box>
              )}
            </Paper>
          </Box>
          
          {/* 右側歌曲列表和操作 */}
          <Box sx={{ flex: '1 1 66.67%' }}>
            <Paper sx={{ p: 2, height: '70vh', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  {selectedSetId ? `${selectedSetName} - 歌曲列表` : '請選擇一個投影片集'}
                </Typography>
                
                {selectedSetId && (
                  <Button 
                    startIcon={<Add />} 
                    variant="contained" 
                    size="small"
                    onClick={handleOpenSelectSongDialog}
                  >
                    添加歌曲
                  </Button>
                )}
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              
              {selectedSetId ? (
                <>
                  <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2 }}>
                    {songsInSet.length === 0 ? (
                      <Typography align="center" color="text.secondary" sx={{ mt: 2 }}>
                        此投影片集中尚無歌曲，請點擊上方「添加歌曲」按鈕
                      </Typography>
                    ) : (
                      songsInSet.map((song, index) => (
                        <DraggableSongItem
                          key={`${song.id}-${index}`}
                          song={song}
                          index={index}
                          moveItem={moveSong}
                          handleRemove={handleRemoveSong}
                          slideSetId={selectedSetId}
                        />
                      ))
                    )}
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 'auto' }}>
                    <Button 
                      startIcon={<Preview />} 
                      variant="outlined"
                      onClick={handlePreviewSlides}
                      disabled={songsInSet.length === 0}
                    >
                      預覽
                    </Button>
                    
                    <Box>
                      <Button 
                        startIcon={<FileDownload />} 
                        variant="outlined"
                        onClick={handleOpenExportDialog}
                        disabled={songsInSet.length === 0}
                        sx={{ mr: 1 }}
                      >
                        導出
                      </Button>
                      
                      <Button 
                        variant="contained"
                        onClick={handleGenerateSlides}
                        disabled={songsInSet.length === 0}
                      >
                        生成投影片
                      </Button>
                    </Box>
                  </Box>
                </>
              ) : (
                <Typography align="center" color="text.secondary" sx={{ mt: 4 }}>
                  請先從左側選擇一個投影片集
                </Typography>
              )}
            </Paper>
          </Box>
        </Box>
      </DndProvider>
      
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
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={() => handleAddSongToSet(song)}
                    >
                      添加
                    </Button>
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
            disabled={!exportPath}
          >
            導出
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BatchSlidesManager; 