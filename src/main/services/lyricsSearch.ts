/// <reference types="node" />
/// <reference types="electron" />

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { SettingsService } from './settings';
import { DatabaseService } from './database';
import { LyricsSearchResult } from '../../common/types';

/**
 * 歌詞搜尋服務
 * 實現規格書中第3.1節的功能
 */
export class LyricsSearchService {
  /**
   * 搜尋歌詞
   * @param songTitle 歌曲名稱
   * @param artist 歌手/樂團名稱
   * @returns 搜尋結果
   */
  public static async searchLyrics(songTitle: string, artist: string = ''): Promise<LyricsSearchResult[]> {
    try {
      // 先嘗試從數據庫獲取緩存的歌詞
      const cachedSongs = DatabaseService.searchSongs(songTitle);
      if (cachedSongs.length > 0) {
        return cachedSongs.map(song => ({
          title: song.title,
          artist: song.artist,
          lyrics: song.lyrics,
          source: ''
        }));
      }

      // 如果沒有緩存，則通過Google API搜尋
      const lyricsUrl = await this.searchLyricsUrl(songTitle, artist);
      if (!lyricsUrl) {
        throw new Error('無法找到相關歌詞');
      }

      // 獲取歌詞內容
      const lyrics = await this.fetchLyricsFromUrl(lyricsUrl);
      if (!lyrics) {
        throw new Error('無法解析歌詞內容');
      }

      // 創建結果物件
      const result: LyricsSearchResult = {
        title: songTitle,
        artist: artist,
        lyrics: lyrics,
        source: lyricsUrl
      };

      // 將結果存入數據庫
      DatabaseService.addSong({
        title: songTitle,
        artist: artist,
        lyrics: lyrics
      });

      return [result];
    } catch (error) {
      console.error('搜尋歌詞時發生錯誤:', error);
      throw error;
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
      throw new Error('Google API配置缺失，請在設定中配置');
    }

    // 構建查詢
    let query = `${songTitle}`;
    if (artist) {
      query += ` ${artist}`;
    }
    query += ` 歌詞 lyrics`;
    
    console.log(`搜尋歌詞URL，查詢: ${query}`);

    // 構建API URL
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${googleApiKey}&cx=${searchEngineId}`;

    try {
      const response = await fetch(url);
      const data = await response.json() as any;

      if (data.error) {
        console.error('Google API 返回錯誤:', data.error.message);
        throw new Error(`Google API 錯誤: ${data.error.message}`);
      }

      if (data.items && data.items.length > 0) {
        // 優先選擇特定歌詞網站的結果
        const preferredSites = [
          'mojim.com', // 魔鏡歌詞網 (中文歌詞)
          'kkbox.com', // KKBOX (中文歌詞)
          'musixmatch.com',
          'genius.com',
          'azlyrics.com',
          'lyrics.com'
        ];
        
        // 嘗試找到優先網站的結果
        for (const site of preferredSites) {
          const match = data.items.find((item: any) => item.link.includes(site));
          if (match) {
            console.log(`找到優先網站 ${site} 的歌詞頁面: ${match.link}`);
            return match.link;
          }
        }
        
        // 如果沒有優先網站，返回第一個結果
        console.log(`沒有找到優先網站，使用第一個結果: ${data.items[0].link}`);
        return data.items[0].link;
      }
      
      console.log('未找到歌詞頁面');
      return null;
    } catch (error) {
      console.error('搜尋歌詞URL時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 從URL獲取歌詞內容
   * @param url 歌詞頁面URL
   * @returns 解析後的歌詞內容
   */
  private static async fetchLyricsFromUrl(url: string): Promise<string | null> {
    try {
      console.log(`開始從 ${url} 獲取歌詞...`);
      
      // 嘗試最多3次獲取內容
      let html = '';
      let attempts = 0;
      
      while (attempts < 3) {
        try {
          const response = await fetch(url, { 
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 10000 // 10秒超時
          });
          
          if (!response.ok) {
            console.error(`獲取頁面失敗，HTTP狀態碼: ${response.status}`);
            throw new Error(`HTTP Error: ${response.status}`);
          }

          html = await response.text();
          console.log(`成功獲取頁面內容，長度: ${html.length} 字符`);
          break; // 成功獲取，跳出循環
        } catch (error) {
          attempts++;
          console.error(`第 ${attempts} 次嘗試獲取頁面失敗:`, error);
          
          if (attempts >= 3) {
            throw error; // 嘗試次數用完，重新拋出錯誤
          }
          
          // 等待一秒後再嘗試
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // 解析歌詞
      const lyrics = this.parseAndCleanLyrics(html, url);
      
      if (!lyrics) {
        console.error(`無法從 ${url} 解析出歌詞內容`);
      } else {
        console.log(`成功解析出歌詞，長度: ${lyrics.length} 字符`);
      }
      
      return lyrics;
    } catch (error) {
      console.error('獲取歌詞內容時發生錯誤:', error);
      throw error;
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

      console.log(`開始解析歌詞網頁: ${url}`);
      
      // 打印HTML內容進行調試
      console.log(`HTML 內容長度: ${html.length}`);
      console.log(`HTML 內容前100字符: ${html.substring(0, 100)}`);

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
        
        console.log(`Genius 歌詞解析結果長度: ${lyrics.length}`);
      } else if (url.includes('azlyrics.com')) {
        // AZLyrics 歌詞解析
        lyrics = $('.ringtone').next().text().trim();
        if (!lyrics) {
          // 新版 AZLyrics
          lyrics = $('.lyricsh').nextUntil('.ringtone').text().trim();
        }
        
        console.log(`AZLyrics 歌詞解析結果長度: ${lyrics.length}`);
      } else if (url.includes('metrolyrics.com')) {
        // MetroLyrics 歌詞解析
        lyrics = $('.verse').map((_: number, elem: cheerio.Element) => $(elem).text().trim()).get().join('\n\n');
        console.log(`MetroLyrics 歌詞解析結果長度: ${lyrics.length}`);
      } else if (url.includes('lyrics.com')) {
        // Lyrics.com 歌詞解析
        lyrics = $('#lyric-body-text').text().trim();
        if (!lyrics) {
          lyrics = $('.lyric-body').text().trim();
        }
        
        console.log(`Lyrics.com 歌詞解析結果長度: ${lyrics.length}`);
      } else if (url.includes('musixmatch.com')) {
        // Musixmatch 歌詞解析
        lyrics = $('.mxm-lyrics__content').map((_: number, elem: cheerio.Element) => $(elem).text().trim()).get().join('\n\n');
        console.log(`Musixmatch 歌詞解析結果長度: ${lyrics.length}`);
      } else if (url.includes('songlyrics.com')) {
        // SongLyrics 歌詞解析
        lyrics = $('#songLyricsDiv').text().trim();
        console.log(`SongLyrics 歌詞解析結果長度: ${lyrics.length}`);
      } else if (url.includes('kkbox.com')) {
        // KKBOX 歌詞解析 (適合中文歌曲)
        lyrics = $('.lyrics').text().trim();
        console.log(`KKBOX 歌詞解析結果長度: ${lyrics.length}`);
      } else if (url.includes('mojim.com')) {
        // 魔鏡歌詞網 (適合中文歌曲)
        lyrics = $('#fsZx3').text().trim();
        if (!lyrics) {
          lyrics = $('.lyric-text').text().trim();
        }
        console.log(`魔鏡歌詞網解析結果長度: ${lyrics.length}`);
      } else {
        // 通用解析策略：尋找可能包含歌詞的最大文本區塊
        const textBlocks = $('div, p').map((_: number, el: cheerio.Element) => {
          const text = $(el).text().trim();
          return { el, text, length: text.length };
        }).get();

        textBlocks.sort((a, b) => b.length - a.length);
        
        // 輸出前5個最大的文本區塊進行診斷
        console.log('前5個最大文本區塊:');
        textBlocks.slice(0, 5).forEach((block, index) => {
          console.log(`區塊 ${index + 1}: 長度=${block.length}, 前30字符="${block.text.substring(0, 30)}..."`);
        });
        
        // 嘗試找出最可能是歌詞的文本區塊
        for (const block of textBlocks.slice(0, 15)) {  // 增加檢查的區塊數量到15
          const text = block.text;
          
          // 歌詞通常有多行且包含換行符
          if (text.includes('\n') && text.length > 100) {
            lyrics = text;
            console.log(`通用策略找到可能的歌詞，長度: ${lyrics.length}`);
            break;
          }
        }
        
        // 如果沒有找到多行文本，就使用最長的文本區塊
        if (!lyrics && textBlocks.length > 0) {
          lyrics = textBlocks[0].text;
          console.log(`使用最長文本區塊作為歌詞，長度: ${lyrics.length}`);
        }
      }

      // 歌詞清理
      if (lyrics && lyrics.length > 10) {  // 確保歌詞有最小長度
        return this.cleanLyrics(lyrics);
      }
      
      // 如果所有策略都失敗了，輸出一些頁面信息以幫助調試
      console.error('無法解析歌詞，頁面的主要內容:');
      console.error($('body').text().substring(0, 500) + '...');
      
      return null;
    } catch (error) {
      console.error('解析歌詞時發生錯誤:', error);
      return null;
    }
  }

  /**
   * 清理歌詞格式
   * @param lyrics 原始歌詞
   * @returns 清理後的歌詞
   */
  private static cleanLyrics(lyrics: string): string {
    // 去除多餘空行
    let cleaned = lyrics.replace(/\n{3,}/g, '\n\n');
    
    // 去除廣告文字
    cleaned = cleaned.replace(/(\[.*?\])|(\(.*?\))/g, '');
    
    // 去除常見的不需要的內容
    const removePatterns = [
      'Lyrics',
      'lyrics',
      'Copyright',
      'copyright',
      'All Rights Reserved',
      'all rights reserved',
      'Paroles',
      'paroles'
    ];
    
    removePatterns.forEach(pattern => {
      cleaned = cleaned.replace(new RegExp(`.*${pattern}.*\n?`, 'g'), '');
    });
    
    // 修復常見格式問題
    cleaned = cleaned.replace(/\s{2,}/g, ' '); // 多個空格替換為一個
    cleaned = cleaned.trim();
    
    return cleaned;
  }
} 