import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 查找根元素
const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('找不到#app元素');
}

// 創建根
const root = createRoot(rootElement);

// 渲染應用
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('渲染進程已啟動');

// 確保electronAPI已加載
if (window.electronAPI) {
  console.log('electronAPI 已加載');
} else {
  console.error('electronAPI 未加載');
}

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