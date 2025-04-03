/// <reference types="node" />
/// <reference types="electron" />

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { SettingsService } from './settings';
import { DatabaseService } from './database';
import { LyricsSearchResult } from '../../common/types';
import { app, BrowserWindow } from 'electron';
import { LoggerService } from './logger';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as iconv from 'iconv-lite';

/**
 * 歌詞搜尋服務
 * 實現規格書中第3.1節的功能
 */
export class LyricsSearchService {
  // 緩存目錄
  private static lyricsCacheDir = path.join(app.getPath('userData'), 'cache', 'lyrics');

  /**
   * 初始化緩存目錄
   */
  private static async initCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.lyricsCacheDir, { recursive: true });
    } catch (error) {
      console.error('建立歌詞緩存目錄失敗:', error);
      await LoggerService.error('建立歌詞緩存目錄失敗', error);
    }
  }

  /**
   * 獲取緩存大小
   * @returns 緩存大小信息（總大小和檔案數量）
   */
  public static async getCacheSize(): Promise<{ totalSizeBytes: number; totalSizeMB: string; fileCount: number }> {
    const startTime = LoggerService.apiStart('LyricsSearchService', 'getCacheSize', {});
    
    try {
      // 確保緩存目錄存在
      await this.initCacheDir();
      
      // 讀取目錄中的所有檔案
      const files = await fs.readdir(this.lyricsCacheDir);
      let totalSize = 0;
      let fileCount = 0;
      
      // 計算總大小
      for (const file of files) {
        try {
          const filePath = path.join(this.lyricsCacheDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            totalSize += stats.size;
            fileCount++;
          }
        } catch (e) {
          await LoggerService.error(`無法讀取緩存檔案 ${file} 的信息`, e);
        }
      }
      
      // 獲取數據庫中的歌詞數據大小
      const db = DatabaseService.init();
      const songCount = db.prepare('SELECT COUNT(*) as count FROM songs').get() as { count: number };
      
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      
      const result = {
        totalSizeBytes: totalSize,
        totalSizeMB: `${totalSizeMB} MB`,
        fileCount: fileCount,
        songCount: songCount.count
      };
      
      await LoggerService.apiSuccess('LyricsSearchService', 'getCacheSize', {}, result, startTime);
      
      return result;
    } catch (error) {
      console.error('獲取緩存大小失敗:', error);
      await LoggerService.apiError('LyricsSearchService', 'getCacheSize', {}, error, startTime);
      throw error;
    }
  }

  /**
   * 清除歌詞緩存
   * @returns 清除結果
   */
  public static async clearCache(): Promise<{ success: boolean; deletedCount: number }> {
    const startTime = LoggerService.apiStart('LyricsSearchService', 'clearCache', {});
    
    try {
      // 確保緩存目錄存在
      await this.initCacheDir();
      
      // 讀取目錄中的所有檔案
      const files = await fs.readdir(this.lyricsCacheDir);
      let deletedCount = 0;
      
      // 刪除所有檔案
      for (const file of files) {
        try {
          const filePath = path.join(this.lyricsCacheDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        } catch (e) {
          await LoggerService.error(`無法刪除緩存檔案 ${file}`, e);
        }
      }
      
      // 完全刪除資料庫中的歌曲記錄
      try {
        const db = DatabaseService.init();
        
        // 先檢查表是否存在
        const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='songs'").get();
        
        if (tableExists) {
          const deleteQuery = "DELETE FROM songs";
          await LoggerService.logDatabaseOperation('刪除', deleteQuery, []);
          db.prepare(deleteQuery).run();
          await LoggerService.info('刪除資料庫中的歌曲記錄成功');
        } else {
          await LoggerService.info('songs 表不存在，跳過資料庫清理');
        }
      } catch (dbError) {
        await LoggerService.error('刪除資料庫中的歌曲記錄失敗', dbError);
      }
      
      const result = {
        success: true,
        deletedCount
      };
      
      await LoggerService.apiSuccess('LyricsSearchService', 'clearCache', {}, result, startTime);
      
      return result;
    } catch (error) {
      console.error('清除緩存失敗:', error);
      await LoggerService.apiError('LyricsSearchService', 'clearCache', {}, error, startTime);
      
      return {
        success: false,
        deletedCount: 0
      };
    }
  }

  /**
   * 主進程日誌輸出
   * @param message 日誌訊息
   * @param level 日誌級別
   */
  private static log(message: string, level: 'info' | 'error' | 'warn' = 'info'): void {
    // 使用 LoggerService 記錄日誌
    const logMessage = `[LyricsSearchService] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage);
        // 非同步記錄到文件
        LoggerService.error(message).catch(err => 
          console.error(`記錄錯誤日誌失敗: ${err}`)
        );
        break;
      case 'warn':
        console.warn(logMessage);
        // 非同步記錄到文件
        LoggerService.warn(message).catch(err => 
          console.error(`記錄警告日誌失敗: ${err}`)
        );
        break;
      default:
        console.log(logMessage);
        // 非同步記錄到文件
        LoggerService.info(message).catch(err => 
          console.error(`記錄信息日誌失敗: ${err}`)
        );
    }
    
    // 同時發送到渲染進程以便在開發者工具中查看
    try {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('main-process-log', {
          source: 'LyricsSearchService',
          message: message,
          level: level
        });
      }
    } catch (err) {
      // 忽略傳送失敗
    }
  }

  /**
   * 搜尋歌詞
   * @param songTitle 歌曲名稱
   * @param artist 歌手/樂團名稱
   * @returns 搜尋結果
   */
  public static async searchLyrics(
    songTitle: string,
    artist?: string
  ): Promise<LyricsSearchResult[]> {
    console.log(`[LyricsSearch] 搜尋歌詞: ${songTitle}, 歌手: ${artist || 'N/A'}`);
    
    // 初始化結果陣列
    const results: LyricsSearchResult[] = [];
    
    try {
      // 檢查緩存
      if (!artist) {
        // 搜尋確切標題匹配的所有歌曲
        const cachedSongs = await DatabaseService.searchSongsByExactTitle(songTitle);
        
        if (cachedSongs.length > 0) {
          console.log(`[LyricsSearch] 找到緩存歌曲: ${cachedSongs.length}首`);
          
          // 將所有緩存歌曲添加到結果中
          cachedSongs.forEach(song => {
            results.push({
              title: song.title,
              artist: song.artist,
              lyrics: song.lyrics,
              source: '', // 緩存歌曲沒有來源URL
              fromCache: true,
              songId: song.id
            });
          });
        }
      }
      
      // 如果沒有找到緩存結果，或者指定了歌手，則嘗試API搜尋
      if (results.length === 0 || artist) {
        console.log(`[LyricsSearch] 沒有緩存結果，嘗試API搜尋`);
        
        try {
          // 使用 searchLyricsUrl 方法獲取歌詞頁面 URL
          const lyricsUrl = await this.searchLyricsUrl(songTitle, artist || '');

          if (lyricsUrl) {
            console.log(`[LyricsSearch] 找到歌詞URL: ${lyricsUrl}`);
            
            // 獲取歌詞
            const lyrics = await this.scrapeLyrics(lyricsUrl);
            
            if (lyrics) {
              // 創建搜尋結果
              const apiResult: LyricsSearchResult = {
                title: songTitle,
                artist: artist || '',
                lyrics,
                source: lyricsUrl,
                fromApi: true
              };
              
              // 將 API 搜尋結果添加到結果陣列的最前面
              results.unshift(apiResult);
            } else {
              console.log('[LyricsSearch] 無法解析歌詞內容');
            }
          } else {
            console.log('[LyricsSearch] 找不到歌詞URL');
          }
        } catch (err) {
          console.error('[LyricsSearch] API搜尋失敗:', err);
          // 如果API搜尋失敗但有緩存結果，仍然返回緩存結果
          if (results.length > 0) {
            console.log('[LyricsSearch] API搜尋失敗，但返回緩存結果');
          } else {
            throw new Error('歌詞搜尋失敗');
          }
        }
      }
      
      // 確保所有歌詞都經過清理處理後再返回
      results.forEach(result => {
        if (result.lyrics) {
          result.lyrics = this.cleanLyrics(result.lyrics);
        }
      });
      
      return results;
    } catch (err) {
      console.error('[LyricsSearch] 搜尋歌詞失敗:', err);
      throw err;
    }
  }

  /**
   * 搜尋歌詞URL
   * @param songTitle 歌曲名稱
   * @param artist 歌手/樂團名稱
   * @returns 歌詞頁面URL
   */
  private static async searchLyricsUrl(songTitle: string, artist: string): Promise<string | null> {
    const googleApiKey = SettingsService.getSetting('googleApiKey');
    const searchEngineId = SettingsService.getSetting('googleSearchEngineId');

    if (!googleApiKey || !searchEngineId) {
      this.log('Google API配置缺失，請在設定中配置', 'error');
      throw new Error('Google API配置缺失，請在設定中配置');
    }

    // 構建查詢
    let query = `${songTitle}`;
    if (artist) {
      query += ` ${artist}`;
    }
    query += ` 歌詞 繁體中文`;
    
    this.log(`搜尋歌詞URL，查詢: ${query}`);

    // 構建API URL
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${googleApiKey}&cx=${searchEngineId}`;

    try {
      this.log(`發送 Google API 請求`);
      const response = await fetch(url);
      const data = await response.json() as any;

      if (data.error) {
        this.log(`Google API 返回錯誤: ${data.error.message}`, 'error');
        throw new Error(`Google API 錯誤: ${data.error.message}`);
      }

      if (data.items && data.items.length > 0) {
        // 優先選擇特定歌詞網站的結果
        const preferredSites = [
          // 'mojim.com', // 魔鏡歌詞網 (中文歌詞) // 關站了...
          'kkbox.com', // KKBOX (中文歌詞)
          'musixmatch.com',
          'genius.com',
          'christianstudy.com', // 基督教研經網(讚美詩歌)
          // 'azlyrics.com', // 沒啥用
          // 'lyrics.com'    // 沒啥用
        ];
        
        // 嘗試找到優先網站的結果
        for (const site of preferredSites) {
          const match = data.items.find((item: any) => item.link.includes(site));
          if (match) {
            this.log(`找到優先網站 ${site} 的歌詞頁面: ${match.link}`);
            return match.link;
          }
        }
        
        // 如果沒有優先網站，返回第一個結果
        this.log(`沒有找到優先網站，使用第一個結果: ${data.items[0].link}`);
        return data.items[0].link;
      }
      
      this.log('未找到歌詞頁面', 'warn');
      return null;
    } catch (error) {
      this.log(`搜尋歌詞URL時發生錯誤: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * 從URL獲取頁面內容
   * @param url 頁面URL
   * @returns 頁面HTML內容
   */
  private static async fetchPage(url: string): Promise<string> {
    try {
      // 判斷是否為christianstudy網站，需要處理big5編碼
      const isChristianStudy = url.includes('christianstudy.com');
      
      const response = await fetch(url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 10000 // 10秒超時
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      // 如果是christianstudy網站，使用big5解碼
      if (isChristianStudy) {
        this.log('偵測到christianstudy網站，使用big5解碼');
        const buffer = await response.buffer();
        return iconv.decode(buffer, 'big5');
      } else {
        // 其他網站使用UTF-8
        return await response.text();
      }
    } catch (error) {
      console.error(`獲取頁面失敗: ${error}`);
      throw error;
    }
  }

  /**
   * 從歌詞頁面獲取歌詞內容
   * @param url 歌詞頁面URL
   * @returns 歌詞內容或null
   */
  private static async scrapeLyrics(url: string): Promise<string | null> {
    try {
      const html = await this.fetchPage(url);
      const parsedLyrics = this.parseAndCleanLyrics(html, url);
      
      // 確保在這裡返回的是已經經過cleanLyrics處理的歌詞
      return parsedLyrics;
    } catch (error) {
      console.error(`抓取歌詞失敗: ${error}`);
      return null;
    }
  }

  /**
   * 解析並清理歌詞內容
   * @param html 網頁HTML內容
   * @param url 頁面URL
   * @returns 清理後的歌詞內容
   */
  private static parseAndCleanLyrics(html: string, url: string): string | null {
    try {
      const $ = cheerio.load(html);
      let lyrics = '';

      this.log(`開始解析歌詞網頁: ${url}`);
      
      // 打印HTML內容進行調試
      this.log(`HTML 內容長度: ${html.length}`);
      this.log(`HTML 內容前100字符: ${html.substring(0, 100)}`);

      // 根據不同的歌詞網站使用不同的解析策略
      if (url.includes('genius.com')) {
        // Genius 歌詞解析
        lyrics = $('.lyrics').text().trim();
        if (!lyrics) {
          // 新的Genius頁面結構
          $('.Lyrics__Container').each((_: number, elem: cheerio.Element) => {
            lyrics += $(elem).text().trim() + '\n';
          });
        }
        
        // 2023年後的 Genius 新結構
        if (!lyrics) {
          $('[data-lyrics-container="true"]').each((_: number, elem: cheerio.Element) => {
            lyrics += $(elem).text().trim() + '\n';
          });
        }
        
        this.log(`Genius 歌詞解析結果長度: ${lyrics.length}`);
      } else if (url.includes('musixmatch.com')) {
        // Musixmatch 歌詞解析
        lyrics = $('.mxm-lyrics__content').map((_: number, elem: cheerio.Element) => $(elem).text().trim()).get().join('\n\n');
        this.log(`Musixmatch 歌詞解析結果長度: ${lyrics.length}`);
      } else if (url.includes('songlyrics.com')) {
        // SongLyrics 歌詞解析
        lyrics = $('#songLyricsDiv').text().trim();
        this.log(`SongLyrics 歌詞解析結果長度: ${lyrics.length}`);
      } else if (url.includes('kkbox.com')) {
        // KKBOX 歌詞解析 (適合中文歌曲)
        lyrics = $('.lyrics').text().trim();
        this.log(`KKBOX 歌詞解析結果長度: ${lyrics.length}`);
      } else if (url.includes('christianstudy.com')) {
        // ChristianStudy 歌詞解析 (適合讚美詩歌)
        this.log('解析 ChristianStudy 網站歌詞');
        
        // 檢查並嘗試多種選擇器來找到歌詞
        const fontElements = $('font[size="+2"]');
        if (fontElements.length > 0) {
          lyrics = fontElements.text().trim();
          this.log(`找到字體大小為+2的元素，內容長度: ${lyrics.length}`);
        } 
        
        // 如果上面的選擇器沒有找到內容，嘗試其他可能的選擇器
        if (!lyrics || lyrics.length < 10) {
          const pElements = $('p').filter(function(this: cheerio.Element) {
            return $(this).find('font[size="+2"]').length > 0;
          });
          
          if (pElements.length > 0) {
            lyrics = pElements.text().trim();
            this.log(`找到p元素中的font元素，內容長度: ${lyrics.length}`);
          }
        }
        
        // 如果仍然沒有找到，嘗試獲取center元素內的所有文本
        if (!lyrics || lyrics.length < 10) {
          lyrics = $('center').text().trim();
          this.log(`使用center元素內容，長度: ${lyrics.length}`);
        }
        
        this.log(`ChristianStudy 原始歌詞解析結果長度: ${lyrics.length}`);
        this.log(`歌詞前100字符: ${lyrics.substring(0, 100)}`);
      } else {
        // 通用解析策略：尋找可能包含歌詞的最大文本區塊
        const textBlocks = $('div, p').map((_: number, el: cheerio.Element) => {
          const text = $(el).text().trim();
          return { el, text, length: text.length };
        }).get();

        textBlocks.sort((a, b) => b.length - a.length);
        
        // 輸出前5個最大的文本區塊進行診斷
        this.log('前5個最大文本區塊:');
        textBlocks.slice(0, 5).forEach((block, index) => {
          this.log(`區塊 ${index + 1}: 長度=${block.length}, 前30字符="${block.text.substring(0, 30)}..."`);
        });
        
        // 嘗試找出最可能是歌詞的文本區塊
        for (const block of textBlocks.slice(0, 15)) {  // 增加檢查的區塊數量到15
          const text = block.text;
          
          // 歌詞通常有多行且包含換行符
          if (text.includes('\n') && text.length > 100) {
            lyrics = text;
            this.log(`通用策略找到可能的歌詞，長度: ${lyrics.length}`);
            break;
          }
        }
        
        // 如果沒有找到多行文本，就使用最長的文本區塊
        if (!lyrics && textBlocks.length > 0) {
          lyrics = textBlocks[0].text;
          this.log(`使用最長文本區塊作為歌詞，長度: ${lyrics.length}`);
        }
      }

      // 歌詞清理
      if (lyrics && lyrics.length > 10) {  // 確保歌詞有最小長度
        return this.cleanLyrics(lyrics);
      }
      
      // 如果所有策略都失敗了，輸出一些頁面信息以幫助調試
      this.log('無法解析歌詞，頁面的主要內容:', 'error');
      this.log($('body').text().substring(0, 500) + '...', 'error');
      
      return null;
    } catch (error) {
      this.log(`解析歌詞時發生錯誤: ${error}`, 'error');
      return null;
    }
  }

  /**
   * 清理歌詞格式
   * @param lyrics 原始歌詞
   * @returns 清理後的歌詞
   */
  public static cleanLyrics(lyrics: string): string {
    // 確保入參是字符串且非空
    if (!lyrics || typeof lyrics !== 'string') {
      return '';
    }
    
    // 去除多餘空行
    let cleaned = lyrics.replace(/\n{3,}/g, '\n\n');
    
    // 清除所有方括號包圍的內容
    cleaned = cleaned.replace(/\[.*?\]/g, '');
    
    // 清除常見的Markdown格式標記
    cleaned = cleaned.replace(/(\*\*|\*|__).*?(\*\*|\*|__)/g, '');
    
    // 處理版權信息
    cleaned = cleaned.replace(/版權屬.*所有/g, '');
    cleaned = cleaned.replace(/詩集：.*?\n/g, '');
    
    // 去除常見的不需要的內容
    const removePatterns = [
      'Lyrics',
      'lyrics',
      'Copyright',
      'copyright',
      'All Rights Reserved',
      'all rights reserved',
      'Paroles',
      'paroles',
      '版權屬',
      '所有',
      '版權所有',
      '主歌',
      '副歌',
      '橋段',
      '間奏',
      '間奏曲'
    ];
    
    removePatterns.forEach(pattern => {
      cleaned = cleaned.replace(new RegExp(`.*${pattern}.*\n?`, 'g'), '');
    });
    
    // 修復常見格式問題
    cleaned = cleaned.replace(/\s{2,}/g, ' '); // 多個空格替換為一個
    cleaned = cleaned.trim();
    
    // 處理中文標點符號
    cleaned = cleaned.replace(/，\n/g, '\n');
    cleaned = cleaned.replace(/。/g, '\n');
    cleaned = cleaned.replace(/，/g, ' ');
    cleaned = cleaned.replace(/：/g, '');
    cleaned = cleaned.replace(/；/g, ' ');
    cleaned = cleaned.replace(/、/g, ' ');
    
    // 處理分節：確保段落之間有適當的空行
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');  // 再次確保不會有過多連續空行
    
    // 輸出處理後的歌詞內容前100字符做調試
    this.log(`清理後歌詞前100字符: ${cleaned.substring(0, 100)}`);
    
    return cleaned;
  }

  /**
   * 更新歌詞緩存
   * @param title 歌曲名稱
   * @param artist 歌手名稱
   * @param lyrics 歌詞內容
   * @param source 歌詞來源
   * @returns 是否成功更新
   */
  public static async updateLyricsCache(
    title: string, 
    artist: string, 
    lyrics: string, 
    source: string
  ): Promise<boolean> {
    try {
      this.log(`開始更新歌詞緩存: ${title} - ${artist}`);
      
      // 確保保存前對歌詞進行清理
      const cleanedLyrics = this.cleanLyrics(lyrics);
      
      // 先查詢是否有匹配的歌曲
      const matchedSongs = DatabaseService.searchSongs(title);
      let updated = false;
      
      if (matchedSongs.length > 0) {
        // 查找最匹配的歌曲
        const exactMatch = matchedSongs.find(song => 
          song.title.toLowerCase() === title.toLowerCase() && 
          ((!artist && !song.artist) || song.artist.toLowerCase() === artist.toLowerCase())
        );
        
        // 如果找到精確匹配，則更新歌詞
        if (exactMatch) {
          this.log(`找到匹配的歌曲記錄 (ID: ${exactMatch.id})，更新歌詞內容`);
          updated = DatabaseService.updateSong(exactMatch.id, {
            lyrics: cleanedLyrics
          });
          
          if (updated) {
            this.log(`成功更新歌曲 "${title}" 的歌詞緩存`);
          } else {
            this.log(`更新歌曲 "${title}" 的歌詞緩存失敗`, 'error');
          }
          return updated;
        }
      }
      
      // 如果沒有找到匹配的記錄，創建新記錄
      this.log(`沒有找到匹配的歌曲記錄，添加新記錄: ${title}`);
      const newSongId = DatabaseService.addSong({
        title: title,
        artist: artist,
        lyrics: cleanedLyrics
      });
      
      return newSongId > 0;
    } catch (error) {
      this.log(`更新歌詞緩存時發生錯誤: ${error}`, 'error');
      return false;
    }
  }
}