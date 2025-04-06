/// <reference types="node" />
/// <reference types="electron" />

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { Settings } from '../../common/types';

// 默認設定
const defaultSettings: Settings = {
  // API 密鑰
  googleApiKey: '',
  googleSearchEngineId: '',
  openaiApiKey: '',

  // 輸出設定
  defaultOutputDirectory: '',
  defaultExportFormat: 'pdf',

  // 文件模板
  imagePromptTemplate: 'Positive Prompt: A minimalist and abstract background inspired by the atmosphere of the song {{songTitle}}, designed for church worship slides. The image should fully capture the essence of the lyrics: {{lyrics}}, with a soft, monochromatic color palette, gentle gradients, and a serene, worshipful ambiance. Ensuring smooth transitions between colors, high resolution, and premium quality. The design should be extremely simple, avoiding any distractions while maintaining a reverent and uplifting aesthetic. The details should be kept to an absolute minimum, ensuring a clean and uncluttered visual.\nNegative Prompt: People, faces, human figures, silhouettes, body parts, hands, eyes, text, letters, symbols, icons, high contrast, complex patterns, intricate details, cluttered compositions, surreal elements, excessive textures, multiple colors, harsh gradients, sharp.',
  customMarpHeader: `---
marp: true
color: "black"
style: |
  section {
    text-align: center;
    font-size:80px;
    font-weight:900;
    -webkit-text-stroke: 2px white;
  }
`,

  // 界面設定
  language: 'zh-TW',
  theme: 'system',
};

// 設定檔案路徑
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

// 讀取設定
function loadSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('讀取設定檔案失敗:', error);
  }
  return defaultSettings;
}

// 保存設定
function saveSettings(settings: Settings): void {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('保存設定檔案失敗:', error);
  }
}

// 設定服務
export const SettingsService = {
  // 獲取所有設定
  getSettings(): Settings {
    return loadSettings();
  },

  // 更新設定
  saveSettings(settings: Settings): void {
    saveSettings(settings);
  },

  // 獲取單個設定項
  getSetting<K extends keyof Settings>(key: K): Settings[K] {
    const settings = loadSettings();
    return settings[key];
  },

  // 設置單個設定項
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    const settings = loadSettings();
    settings[key] = value;
    saveSettings(settings);
  },

  // 重置為默認設定
  resetSettings(): void {
    saveSettings(defaultSettings);
  },
  
  // 獲取默認設定
  getDefaultSettings(): Settings {
    return { ...defaultSettings };
  },
}; 