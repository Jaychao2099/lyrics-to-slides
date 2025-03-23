import React, { useState, useEffect } from 'react';
import { Song } from '../types';
import { formatSlideMarkdown } from '../services/api';
import { convertMarkdownToHTML } from '../services/marp';

interface SlidePreviewProps {
  song: Song;
}

const SlidePreview: React.FC<SlidePreviewProps> = ({ song }) => {
  const [markdown, setMarkdown] = useState<string>('');
  const [html, setHtml] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<'markdown' | 'slides'>('slides');

  useEffect(() => {
    if (song.lyrics && song.imageUrl) {
      const formattedMarkdown = formatSlideMarkdown(song);
      setMarkdown(formattedMarkdown);
      
      try {
        const convertedHtml = convertMarkdownToHTML(formattedMarkdown);
        setHtml(convertedHtml);
      } catch (error) {
        console.error('轉換Markdown為HTML失敗:', error);
      }
    } else {
      setMarkdown('');
      setHtml('');
    }
  }, [song]);

  const togglePreviewMode = () => {
    setPreviewMode(prevMode => prevMode === 'markdown' ? 'slides' : 'markdown');
  };

  const slidesStyle = {
    backgroundImage: song.imageUrl ? `url(${song.imageUrl})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    color: 'white',
    textShadow: '1px 1px 3px rgba(0,0,0,0.8)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    minHeight: '300px',
    filter: 'brightness(1.2)'
  } as React.CSSProperties;

  const renderSlidePreview = () => {
    if (!song.lyrics || !song.imageUrl) {
      return (
        <div className="empty-state">
          <p>需要歌詞和圖片才能生成投影片預覽</p>
        </div>
      );
    }

    const lyrics = song.lyrics.split('\n').filter(line => line.trim());
    
    return (
      <div className="slide-preview-container">
        <div className="slide" style={slidesStyle}>
          <h1>{song.title}</h1>
        </div>
        <div className="slide" style={slidesStyle}>
          {lyrics.slice(0, 5).map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>
        {lyrics.length > 5 && (
          <div className="more-slides-hint">
            <p>還有更多幻燈片...</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="preview-container slide-preview">
      <div className="preview-header">
        <h3>投影片預覽</h3>
        <div className="preview-actions">
          <button 
            onClick={togglePreviewMode} 
            className="secondary"
            disabled={!song.lyrics || !song.imageUrl}
          >
            {previewMode === 'markdown' ? '顯示投影片' : '顯示Markdown'}
          </button>
        </div>
      </div>

      <div className="preview-content">
        {song.isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
            <span>生成預覽中...</span>
          </div>
        ) : previewMode === 'markdown' ? (
          <div className="markdown-preview">
            <pre>{markdown}</pre>
          </div>
        ) : (
          renderSlidePreview()
        )}
      </div>
    </div>
  );
};

export default SlidePreview; 