import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 確保文件被正確載入
console.log('渲染進程已啟動');

// 獲取應用版本
window.onload = async () => {
  try {
    // 檢查 electronAPI 是否可用
    if (window.electronAPI) {
      // 在這裡添加渲染進程初始化代碼
      console.log('electronAPI 已加載');
    } else {
      console.error('electronAPI 未正確加載');
    }
  } catch (error) {
    console.error('初始化時發生錯誤:', error);
  }
};

// 等待DOM完全加載
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app');
  if (container) {
    const root = createRoot(container);
    root.render(<App />);
  }
}); 