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
  imagePromptTemplate: 'Positive Prompt: "minimalist design, abstract shapes, monochrome illustration: slide background image inspired by the atmosphere of the song " {{songTitle}}", designed for church worship slides. Low contrast:1.2, can have normal church elements or some elements of the lyrics: " {{lyrics}}". "\nNegative Prompt: "no text:2, no letters:2, no People:2, no faces:2, no human figures:2, no silhouettes:2, no body parts:2, no hands:2, no eyes:2, no symbols, no icons, no complex patterns, no intricate details, no cluttered compositions, no surreal elements, no excessive textures, no multiple colors, no harsh gradients, low sharpness."',
  customMarpHeader: `---
marp: true

style: |
  section {
    text-align: center;
    font-size:80px;
  }
  h1 {
    position:absolute;
    top: 20px;
    right: 40px;
    font-size:20px;
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

// 儲存設定
function saveSettings(settings: Settings): void {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('儲存設定檔案失敗:', error);
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