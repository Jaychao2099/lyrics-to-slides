import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // 禁用使用 node 內置模塊的瀏覽器 polyfills
  // https://vitejs.dev/config/#server-fs-allow
  server: {
    fs: {
      // 允許載入項目以外的文件
      allow: ['..'],
    },
  },
  // 更多配置: https://vitejs.dev/config/
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 靜態資源處理
    assetsInlineLimit: 4096,
  },
}); 