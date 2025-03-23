import React, { useState } from 'react';
import { Song, ExportFormat } from '../types';
import { formatSlideMarkdown } from '../services/api';
import { saveMarkdownFile, exportSlidesAs } from '../services/marp';

// 這個電子應用中的全局對象
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke(channel: string, args: any): Promise<any>;
      };
    };
  }
}

interface ExportOptionsProps {
  songs: Song[];
  isLoading: boolean;
}

const ExportOptions: React.FC<ExportOptionsProps> = ({ songs, isLoading }) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  
  const handleExportFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setExportFormat(e.target.value as ExportFormat);
  };
  
  const handleExport = async () => {
    // 檢查是否有歌曲可以導出
    if (songs.length === 0) {
      alert('沒有歌曲可以導出。請先添加歌曲並生成內容。');
      return;
    }
    
    // 檢查所有歌曲是否都有歌詞和圖片
    const incompleteSongs = songs.filter(song => !song.lyrics || !song.imageUrl);
    if (incompleteSongs.length > 0) {
      const confirmExport = window.confirm(
        `有 ${incompleteSongs.length} 首歌曲還沒有完整的歌詞或圖片。是否仍要繼續導出？`
      );
      if (!confirmExport) return;
    }
    
    try {
      // 生成所有歌曲的Markdown內容
      let allMarkdown = '';
      for (const song of songs) {
        if (song.lyrics && song.imageUrl) {
          const songMarkdown = formatSlideMarkdown(song);
          allMarkdown += songMarkdown;
        }
      }
      
      if (!allMarkdown) {
        alert('沒有有效的內容可以導出。請確保至少有一首歌曲有歌詞和圖片。');
        return;
      }
      
      // 獲取保存路徑
      let defaultFileName;
      switch (exportFormat) {
        case 'pdf':
          defaultFileName = 'lyrics_slides.pdf';
          break;
        case 'pptx':
          defaultFileName = 'lyrics_slides.pptx';
          break;
        case 'html':
          defaultFileName = 'lyrics_slides.html';
          break;
        default:
          defaultFileName = 'lyrics_slides.md';
      }
      
      // 使用Electron的對話框API請求保存位置
      const filePath = await window.electron.ipcRenderer.invoke('save-file', {
        defaultPath: defaultFileName,
        filters: [
          { name: '所有文件', extensions: ['*'] },
          { name: 'Markdown', extensions: ['md'] },
          { name: 'HTML', extensions: ['html'] },
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'PowerPoint', extensions: ['pptx'] }
        ]
      });
      
      if (!filePath) return; // 用戶取消了保存
      
      // 根據選擇的格式導出
      let success = false;
      
      // 首先保存Markdown文件作為基礎
      const mdFilePath = filePath.replace(/\.\w+$/, '.md');
      await saveMarkdownFile(allMarkdown, mdFilePath);
      
      // 根據所選格式導出
      success = await exportSlidesAs(allMarkdown, exportFormat, filePath);
      
      if (success) {
        alert(`成功導出到 ${filePath}`);
      } else {
        alert('導出失敗，請檢查控制台獲取更多信息。');
      }
    } catch (error) {
      console.error('導出錯誤:', error);
      alert(`導出過程中發生錯誤: ${error.message}`);
    }
  };
  
  return (
    <div className="export-options">
      <h2>導出選項</h2>
      
      <div className="export-form">
        <div className="form-group">
          <label htmlFor="export-format">導出格式:</label>
          <select 
            id="export-format" 
            className="form-control"
            value={exportFormat}
            onChange={handleExportFormatChange}
          >
            <option value="pdf">PDF</option>
            <option value="pptx">PowerPoint (PPTX)</option>
            <option value="html">HTML</option>
          </select>
        </div>
        
        <button 
          onClick={handleExport}
          disabled={isLoading || songs.length === 0}
          className="export-button"
        >
          導出投影片
        </button>
      </div>
      
      <div className="export-info">
        <p>
          <strong>提示:</strong> 導出為PDF格式最適合直接打印或共享。
          PowerPoint格式允許您進一步編輯投影片。
        </p>
      </div>
    </div>
  );
};

export default ExportOptions; 