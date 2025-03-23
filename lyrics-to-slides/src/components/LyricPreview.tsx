import React, { useState, useEffect } from 'react';
import { Song } from '../types';

interface LyricPreviewProps {
  song: Song;
  updateSong: (updatedSong: Partial<Song>) => void;
}

const LyricPreview: React.FC<LyricPreviewProps> = ({ song, updateSong }) => {
  const [editableLyrics, setEditableLyrics] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // 當歌曲更改時，更新可編輯歌詞
  useEffect(() => {
    setEditableLyrics(song.lyrics);
    setIsEditing(false);
  }, [song]);

  const handleLyricsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableLyrics(e.target.value);
  };

  const handleLyricsEdit = () => {
    setIsEditing(true);
  };

  const handleLyricsSave = () => {
    updateSong({ lyrics: editableLyrics });
    setIsEditing(false);
  };

  const handleLyricsCancel = () => {
    setEditableLyrics(song.lyrics);
    setIsEditing(false);
  };

  return (
    <div className="preview-container lyric-preview">
      <div className="preview-header">
        <h3>歌詞預覽</h3>
        <div className="preview-actions">
          {isEditing ? (
            <>
              <button onClick={handleLyricsSave}>保存</button>
              <button onClick={handleLyricsCancel} className="secondary">取消</button>
            </>
          ) : (
            <button onClick={handleLyricsEdit} className="secondary" disabled={!song.lyrics}>
              編輯歌詞
            </button>
          )}
        </div>
      </div>

      <div className="preview-content">
        {song.isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
            <span>載入歌詞中...</span>
          </div>
        ) : song.lyrics ? (
          isEditing ? (
            <textarea
              className="form-control lyrics-editor"
              value={editableLyrics}
              onChange={handleLyricsChange}
              rows={15}
            />
          ) : (
            <div className="lyrics-display">
              {song.lyrics.split('\n').map((line, index) => (
                <p key={index}>{line || <br />}</p>
              ))}
            </div>
          )
        ) : (
          <div className="empty-state">
            <p>請使用"搜索歌詞"按鈕來取得這首歌的歌詞</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LyricPreview; 