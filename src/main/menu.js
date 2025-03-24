const { app, Menu, dialog, shell, BrowserWindow } = require('electron');
const path = require('path');
const Store = require('electron-store');
const store = new Store({ name: 'config' });

function createMenu() {
  const isMac = process.platform === 'darwin';
  
  // 根據操作系統創建適當的選單模板
  const template = [
    // 應用程序選單（僅macOS）
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: '關於 歌曲投影片生成器' },
        { type: 'separator' },
        { 
          label: '偏好設定', 
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu-preferences');
            }
          }
        },
        { type: 'separator' },
        { role: 'services', label: '服務' },
        { type: 'separator' },
        { role: 'hide', label: '隱藏 歌曲投影片生成器' },
        { role: 'hideOthers', label: '隱藏其他' },
        { role: 'unhide', label: '顯示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出 歌曲投影片生成器' }
      ]
    }] : []),
    
    // 檔案選單
    {
      label: '檔案',
      submenu: [
        {
          label: '新建項目',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu-new-project');
            }
          }
        },
        {
          label: '開啟項目',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              const { canceled, filePaths } = await dialog.showOpenDialog({
                title: '開啟項目',
                filters: [
                  { name: '歌曲投影片項目', extensions: ['lts'] },
                  { name: '所有檔案', extensions: ['*'] }
                ],
                properties: ['openFile']
              });
              
              if (!canceled && filePaths.length > 0) {
                mainWindow.webContents.send('menu-open-project', filePaths[0]);
              }
            }
          }
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu-save-project');
            }
          }
        },
        {
          label: '另存為...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              const { canceled, filePath } = await dialog.showSaveDialog({
                title: '另存為',
                filters: [
                  { name: '歌曲投影片項目', extensions: ['lts'] }
                ]
              });
              
              if (!canceled && filePath) {
                mainWindow.webContents.send('menu-save-project-as', filePath);
              }
            }
          }
        },
        { type: 'separator' },
        {
          label: '導出投影片',
          submenu: [
            {
              label: 'PowerPoint 格式',
              click: () => {
                const mainWindow = BrowserWindow.getFocusedWindow();
                if (mainWindow) {
                  mainWindow.webContents.send('menu-export', { format: 'pptx' });
                }
              }
            },
            {
              label: 'PDF 格式',
              click: () => {
                const mainWindow = BrowserWindow.getFocusedWindow();
                if (mainWindow) {
                  mainWindow.webContents.send('menu-export', { format: 'pdf' });
                }
              }
            },
            {
              label: '圖片格式',
              click: () => {
                const mainWindow = BrowserWindow.getFocusedWindow();
                if (mainWindow) {
                  mainWindow.webContents.send('menu-export', { format: 'images' });
                }
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: '偏好設定',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu-preferences');
            }
          },
          visible: !isMac
        },
        { type: 'separator', visible: !isMac },
        { role: 'quit', label: '退出', visible: !isMac }
      ]
    },
    
    // 編輯選單
    {
      label: '編輯',
      submenu: [
        { role: 'undo', label: '復原' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪下' },
        { role: 'copy', label: '複製' },
        { role: 'paste', label: '貼上' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle', label: '貼上並符合樣式' },
          { role: 'delete', label: '刪除' },
          { role: 'selectAll', label: '全選' },
          { type: 'separator' },
          {
            label: '語音',
            submenu: [
              { role: 'startSpeaking', label: '開始說話' },
              { role: 'stopSpeaking', label: '停止說話' }
            ]
          }
        ] : [
          { role: 'delete', label: '刪除' },
          { type: 'separator' },
          { role: 'selectAll', label: '全選' }
        ])
      ]
    },
    
    // 視圖選單
    {
      label: '視圖',
      submenu: [
        {
          label: '主題',
          submenu: [
            {
              label: '淺色主題',
              type: 'radio',
              checked: store.get('theme') === 'light',
              click: () => {
                store.set('theme', 'light');
                const mainWindow = BrowserWindow.getFocusedWindow();
                if (mainWindow) {
                  mainWindow.webContents.send('menu-theme-changed', 'light');
                }
              }
            },
            {
              label: '深色主題',
              type: 'radio',
              checked: store.get('theme') === 'dark',
              click: () => {
                store.set('theme', 'dark');
                const mainWindow = BrowserWindow.getFocusedWindow();
                if (mainWindow) {
                  mainWindow.webContents.send('menu-theme-changed', 'dark');
                }
              }
            },
            {
              label: '跟隨系統',
              type: 'radio',
              checked: store.get('theme') === 'system',
              click: () => {
                store.set('theme', 'system');
                const mainWindow = BrowserWindow.getFocusedWindow();
                if (mainWindow) {
                  mainWindow.webContents.send('menu-theme-changed', 'system');
                }
              }
            }
          ]
        },
        { type: 'separator' },
        { role: 'reload', label: '重新載入' },
        { role: 'forceReload', label: '強制重新載入' },
        { role: 'toggleDevTools', label: '開發者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重設縮放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '縮小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切換全螢幕' }
      ]
    },
    
    // 工具選單
    {
      label: '工具',
      submenu: [
        {
          label: '搜尋歌詞',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu-search-lyrics');
            }
          }
        },
        {
          label: '圖像生成設定',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu-image-generation-settings');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'API金鑰管理',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu-api-keys');
            }
          }
        }
      ]
    },
    
    // 視窗選單
    {
      label: '視窗',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '縮放' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front', label: '全部移至最前' },
          { type: 'separator' },
          { role: 'window', label: '視窗' }
        ] : [
          { role: 'close', label: '關閉' }
        ])
      ]
    },
    
    // 說明選單
    {
      role: 'help',
      label: '說明',
      submenu: [
        {
          label: '線上說明文件',
          click: async () => {
            await shell.openExternal('https://lyrics-to-slides-docs.example.com');
          }
        },
        {
          label: '檢查更新',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu-check-updates');
            }
          }
        },
        { type: 'separator' },
        {
          label: '報告問題',
          click: async () => {
            await shell.openExternal('https://github.com/yourusername/lyrics-to-slides/issues');
          }
        },
        {
          label: '關於',
          click: () => {
            dialog.showMessageBox({
              title: '關於 歌曲投影片生成器',
              message: '歌曲投影片生成器',
              detail: `版本: ${app.getVersion()}\n版權所有 © ${new Date().getFullYear()} 您的公司名稱`,
              buttons: ['確定'],
              icon: path.join(__dirname, '../../assets/icons/icon.png')
            });
          },
          visible: !isMac
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 初始化選單
createMenu();

// 導出菜單創建函數以允許未來更新
module.exports = createMenu; 