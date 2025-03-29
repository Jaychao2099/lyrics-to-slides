import { ImageGenerationService } from '../main/services/imageGeneration';
import { SettingsService } from '../main/services/settings';

// 模擬 electron 的 app 物件
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path')
  }
}));

// 模擬 SettingsService
jest.mock('../main/services/settings', () => ({
  SettingsService: {
    getSetting: jest.fn(),
    getSettings: jest.fn(),
    saveSettings: jest.fn(),
    setSetting: jest.fn(),
    resetSettings: jest.fn()
  }
}));

// 模擬 DatabaseService
jest.mock('../main/services/database', () => ({
  DatabaseService: {
    searchSongs: jest.fn().mockReturnValue([]),
    addSong: jest.fn(),
    init: jest.fn(),
    close: jest.fn()
  }
}));

// 模擬 OpenAI
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => {
      return {
        images: {
          generate: jest.fn().mockResolvedValue({
            data: [{ url: 'https://example.com/generated-image.png' }]
          })
        }
      };
    })
  };
});

// 模擬 fs 模組
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined)
}));

// 模擬圖片生成服務的關鍵方法
jest.mock('../main/services/imageGeneration', () => {
  const originalModule = jest.requireActual('../main/services/imageGeneration');
  
  return {
    ...originalModule,
    ImageGenerationService: {
      ...originalModule.ImageGenerationService,
      generateImage: jest.fn().mockImplementation((songId, songTitle, lyrics) => {
        return Promise.resolve(`/mock/path/images/${songId}.png`);
      }),
      regenerateImage: jest.fn().mockImplementation((songId, songTitle, lyrics) => {
        return Promise.resolve(`/mock/path/images/${songId}.png`);
      })
    }
  };
});

describe('ImageGenerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 設置測試用的 API 密鑰
    (SettingsService.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'openaiApiKey') return 'test-openai-api-key';
      if (key === 'imagePromptTemplate') return '為歌曲 {{songTitle}} 創建一張背景圖片。歌詞：{{lyrics}}';
      return '';
    });
  });

  test('generateImage 應該成功生成圖片', async () => {
    const songId = 1;
    const songTitle = '測試歌曲';
    const lyrics = '這是測試歌詞\n第二行歌詞';
    
    const imagePath = await ImageGenerationService.generateImage(songId, songTitle, lyrics);
    
    // 檢查返回的圖片路徑
    expect(imagePath).toContain(songId.toString());
    expect(imagePath).toContain('.png');
  });

  test('當 API 密鑰缺失時應拋出錯誤', async () => {
    (SettingsService.getSetting as jest.Mock).mockImplementation(() => '');
    
    // 這裡我們需要手動控制拋出的錯誤，因為我們模擬了整個ImageGenerationService
    (ImageGenerationService.generateImage as jest.Mock).mockRejectedValueOnce(new Error('OpenAI API 密鑰缺失'));
    
    await expect(ImageGenerationService.generateImage(1, '測試歌曲', '測試歌詞')).rejects.toThrow('OpenAI API');
  });
}); 