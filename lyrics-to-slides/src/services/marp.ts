import { Marp } from '@marp-team/marp-core';
import fs from 'fs';
import path from 'path';
import { ExportFormat } from '../types';

// 初始化Marp實例
const marp = new Marp({
  html: true,
  math: true,
  minifyCSS: false
});

// 將Markdown轉換為HTML
export const convertMarkdownToHTML = (markdown: string): string => {
  const { html } = marp.render(markdown);
  return html;
};

// 將Markdown保存為文件
export const saveMarkdownFile = async (markdown: string, filePath: string): Promise<boolean> => {
  try {
    // 確保目錄存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 寫入文件
    fs.writeFileSync(filePath, markdown, 'utf8');
    return true;
  } catch (error) {
    console.error('保存Markdown文件失敗:', error);
    return false;
  }
};

// 導出為不同格式
export const exportSlidesAs = async (
  markdown: string, 
  format: ExportFormat, 
  filePath: string
): Promise<boolean> => {
  try {
    // 根據不同格式執行不同操作
    switch (format) {
      case 'html':
        // 轉換為HTML並保存
        const html = convertMarkdownToHTML(markdown);
        fs.writeFileSync(filePath, html, 'utf8');
        return true;
        
      case 'pdf':
        // 這裡我們需要用Electron的webContents.printToPDF實現
        // 在這個函數中我們無法直接訪問Electron，需要通過主進程/渲染進程通信
        // 將在組件中實現
        return false;
        
      case 'pptx':
        // 需要額外的庫將HTML轉換為PPTX，可以使用pptxgenjs
        // 將在組件中使用額外的庫實現
        return false;
        
      default:
        throw new Error(`不支持的導出格式: ${format}`);
    }
  } catch (error) {
    console.error(`導出${format}格式失敗:`, error);
    return false;
  }
}; 