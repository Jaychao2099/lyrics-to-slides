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

  // 提示詞模板
  imagePromptTemplate: 'Positive Prompt: A minimalist and abstract background inspired by the lyrics of {{songTitle}}, designed for church worship slides. Soft pastel tones, monochromatic color scheme, smooth gradients, high resolution, high quality. The image should be simple, elegant, and calming, with minimal details and no distractions. Ignore lyricist and composer references in lyrics. lyrics: {{lyrics}}\nNegative Prompt: people, faces, human figures, silhouettes, body parts, hands, eyes, text, symbols, complex patterns, high contrast, clutter, excessive details, surreal elements',
  slidesPromptTemplate: '請將以下歌詞轉換為符合 Marp 投影片格式的 Markdown。請遵循以下要求：\n1. 仔細判斷歌詞的段落屬性。根據段落分段後，將每個段落放在一張投影片上，並使用"---"作為投影片分隔符\n2. 在每張投影片頂部加入背景圖片：![bg]({{imageUrl}})\n3. 不要添加任何不在原歌詞中的內容\n4. 每首歌的第一張投影片顯示"# 歌曲標題"\n5. 每行歌詞開頭用"# "標註\n6. 輸出時不需要任何額外的解釋、說明、"\`\`\`markdown"等字符，僅輸出純 Markdown 內容\n範例：\n---\nmarp: true\ncolor: "black"\nstyle: |\n  section {\n    text-align: center;\n  }\n  h1 {\n    -webkit-text-stroke: 0.2px white;\n  }\n\n---\n\n![bg](./images/test-bg1.png)\n\n# 第一首歌曲名稱\n\n---\n\n![bg](./images/test-bg1.png)\n\n# 第一行歌詞\n# 第二行歌詞\n# 第三行歌詞\n# 第四行歌詞\n\n---\n\n![bg](./images/test-bg2.png)\n\n# 第二首歌曲名稱\n\n---\n\n![bg](./images/test-bg2.png)\n\n# 第一行歌詞\n# 第二行歌詞\n\n歌詞內容：\n{{lyrics}}',

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
}; 