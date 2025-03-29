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

    const query = `${songTitle} ${artist} lyrics`;
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${googleApiKey}&cx=${searchEngineId}`;

    try {
      const response = await fetch(url);
      const data = await response.json() as any;

      if (data.items && data.items.length > 0) {
        return data.items[0].link;
      }
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
      const response = await fetch(url);
      const html = await response.text();
      return this.parseAndCleanLyrics(html, url);
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
    const $ = cheerio.load(html);
    let lyrics = '';

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
    } else if (url.includes('azlyrics.com')) {
      // AZLyrics 歌詞解析
      lyrics = $('.ringtone').next().text().trim();
    } else if (url.includes('metrolyrics.com')) {
      // MetroLyrics 歌詞解析
      lyrics = $('.verse').map((_: number, elem: cheerio.Element) => $(elem).text().trim()).get().join('\n\n');
    } else if (url.includes('lyrics.com')) {
      // Lyrics.com 歌詞解析
      lyrics = $('#lyric-body-text').text().trim();
    } else {
      // 通用解析策略：尋找可能包含歌詞的最大文本區塊
      const textBlocks = $('div, p').map((_: number, el: cheerio.Element) => {
        const text = $(el).text().trim();
        return { el, text, length: text.length };
      }).get();

      textBlocks.sort((a, b) => b.length - a.length);
      
      // 嘗試找出最可能是歌詞的文本區塊
      for (const block of textBlocks) {
        const text = block.text;
        
        // 歌詞通常有多行
        if (text.includes('\n') && text.length > 100) {
          lyrics = text;
          break;
        }
      }
    }

    // 歌詞清理
    if (lyrics) {
      return this.cleanLyrics(lyrics);
    }
    
    return null;
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