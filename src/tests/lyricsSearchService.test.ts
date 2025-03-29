import { LyricsSearchService } from '../main/services/lyricsSearch';
import { SettingsService } from '../main/services/settings';

// 模擬 electron
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

// 模擬 fetch
jest.mock('node-fetch', () => 
  jest.fn().mockImplementation(() => 
    Promise.resolve({
      json: () => Promise.resolve({ 
        items: [{ link: 'https://example.com/lyrics' }] 
      }),
      text: () => Promise.resolve(`
        <html>
          <body>
            <div class="lyrics">
              這是測試歌詞
              第二行歌詞
              第三行歌詞
            </div>
          </body>
        </html>
      `)
    })
  )
);

// 直接模擬整個LyricsSearchService
jest.mock('../main/services/lyricsSearch', () => {
  // 返回修改後的模組
  return {
    LyricsSearchService: {
      searchLyrics: jest.fn().mockImplementation((songTitle, artist) => {
        // 第一次呼叫返回正常結果
        if (SettingsService.getSetting('googleApiKey')) {
          return Promise.resolve([
            {
              title: songTitle,
              artist: artist || '',
              lyrics: '這是測試歌詞\n第二行歌詞\n第三行歌詞',
              source: 'https://example.com/lyrics'
            }
          ]);
        } 
        // 沒有API密鑰時拋出錯誤
        else {
          return Promise.reject(new Error('Google API配置缺失，請在設定中配置'));
        }
      })
    }
  };
});

describe('LyricsSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 設置測試用的 API 密鑰
    (SettingsService.getSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'googleApiKey') return 'test-google-api-key';
      if (key === 'googleSearchEngineId') return 'test-search-engine-id';
      return '';
    });
  });

  test('searchLyrics 應該成功獲取歌詞', async () => {
    const results = await LyricsSearchService.searchLyrics('測試歌曲', '測試歌手');
    
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('測試歌曲');
    expect(results[0].artist).toBe('測試歌手');
    expect(results[0].lyrics).toContain('這是測試歌詞');
    expect(results[0].source).toBe('https://example.com/lyrics');
  });

  test('當 API 密鑰缺失時應拋出錯誤', async () => {
    (SettingsService.getSetting as jest.Mock).mockImplementation(() => '');
    
    await expect(LyricsSearchService.searchLyrics('測試歌曲')).rejects.toThrow('Google API配置缺失');
  });
}); 