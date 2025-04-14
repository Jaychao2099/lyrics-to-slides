/// <reference types="node" />
/// <reference types="electron" />

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { Settings } from '../../common/types';

// 設定檔案路徑
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

// 設定服務
export class SettingsService {
  // 更新默認設定以反映新的模型結構
  private static readonly defaultSettings: Settings = {
    // API 金鑰
    googleApiKey: '',
    openaiApiKey: '',
    geminiApiKey: '',
    grokApiKey: '',
    anthropicApiKey: '',
    
    // AI功能選擇
    lyricsSearchProvider: 'none',
    promptGenerationProvider: 'none',
    imageGenerationProvider: 'none',
    
    // 各功能對應的模型選擇
    lyricsSearchModel: {
      openai: 'gpt-4o',
      gemini: 'gemini-2.5-pro-exp-03-25',
      grok: 'grok-3-beta',
      anthropic: 'claude-3-7-sonnet-20250219'
    },
    
    promptGenerationModel: {
      openai: 'gpt-4o',
      gemini: 'gemini-2.5-pro-exp-03-25',
      grok: 'grok-3-beta',
      anthropic: 'claude-3-7-sonnet-20250219'
    },
    
    imageGenerationModel: {
      openai: 'dall-e-3',
      gemini: 'gemini-2.0-flash-exp-image-generation',
      grok: 'grok-2-image-1212'
    },
    
    // 輸出設定
    defaultOutputDirectory: '',
    defaultExportFormat: 'pdf',
    
    // 文件模板
    imagePromptTemplate: 'minimalist design, abstract shapes, monochrome illustration: slide background image inspired by the atmosphere of the song " {{songTitle}}", designed for church worship slides. Low contrast, can have normal church elements or some elements of the lyrics: " {{lyrics}} " . No text, no letters, no People, no faces, no human figures, no silhouettes, no body parts, no hands, no eyes, no symbols, no icons, no complex patterns, no intricate details, no cluttered compositions, no surreal elements, no excessive textures, no multiple colors, no harsh gradients, low sharpness.',
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
    theme: 'system'
  };

  // 讀取設定
  private static loadSettings(): Settings {
    try {
      if (fs.existsSync(SETTINGS_PATH)) {
        const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
        return { ...this.defaultSettings, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('讀取設定檔案失敗:', error);
    }
    return this.defaultSettings;
  }

  // 儲存設定
  private static saveSettingsToFile(settings: Settings): void {
    try {
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    } catch (error) {
      console.error('儲存設定檔案失敗:', error);
    }
  }

  // 獲取所有設定
  public static getSettings(): Settings {
    return this.loadSettings();
  }

  // 更新設定
  public static saveSettings(settings: Settings): void {
    this.saveSettingsToFile(settings);
  }

  // 獲取單個設定項
  public static getSetting<K extends keyof Settings>(key: K): Settings[K] {
    const settings = this.loadSettings();
    return settings[key];
  }

  // 設置單個設定項
  public static setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    const settings = this.loadSettings();
    settings[key] = value;
    this.saveSettingsToFile(settings);
  }

  // 重置為默認設定
  public static resetSettings(): void {
    this.saveSettingsToFile(this.defaultSettings);
  }
  
  // 獲取默認設定
  public static getDefaultSettings(): Settings {
    return { ...this.defaultSettings };
  }
} 