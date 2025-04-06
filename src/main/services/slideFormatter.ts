/// <reference types="node" />
/// <reference types="electron" />

import { LoggerService } from './logger';

/**
 * 歌曲信息接口
 */
interface SongInfo {
  lyrics: string;
  imagePath: string;
  title: string;
  artist?: string;
}

/**
 * 投影片格式化服務
 * 將歌詞轉換為 Marp 格式的投影片
 */
export class SlideFormatter {
  /**
   * 生成 Marp 標頭
   * @param customHeader 自定義標頭
   * @returns Marp 標頭內容
   */
  public static generateMarpHeader(customHeader?: string): string {
    const defaultHeader = `---
marp: true
color: "black"
style: |
  section {
    text-align: center;
    font-size:80px;
    font-weight:900;
    text-shadow: 
      -5px -5px 0 white, -5px -4px 0 white, -5px -3px 0 white, -5px -2px 0 white, -5px -1px 0 white,
      -5px 0px 0 white, -5px 1px 0 white, -5px 2px 0 white, -5px 3px 0 white, -5px 4px 0 white, -5px 5px 0 white,
      -4px -5px 0 white, -4px -4px 0 white, -4px -3px 0 white, -4px -2px 0 white, -4px -1px 0 white,
      -4px 0px 0 white, -4px 1px 0 white, -4px 2px 0 white, -4px 3px 0 white, -4px 4px 0 white, -4px 5px 0 white,
      -3px -5px 0 white, -3px -4px 0 white, -3px -3px 0 white, -3px -2px 0 white, -3px -1px 0 white,
      -3px 0px 0 white, -3px 1px 0 white, -3px 2px 0 white, -3px 3px 0 white, -3px 4px 0 white, -3px 5px 0 white,
      -2px -5px 0 white, -2px -4px 0 white, -2px -3px 0 white, -2px -2px 0 white, -2px -1px 0 white,
      -2px 0px 0 white, -2px 1px 0 white, -2px 2px 0 white, -2px 3px 0 white, -2px 4px 0 white, -2px 5px 0 white,
      -1px -5px 0 white, -1px -4px 0 white, -1px -3px 0 white, -1px -2px 0 white, -1px -1px 0 white,
      -1px 0px 0 white, -1px 1px 0 white, -1px 2px 0 white, -1px 3px 0 white, -1px 4px 0 white, -1px 5px 0 white,
      0px -5px 0 white, 0px -4px 0 white, 0px -3px 0 white, 0px -2px 0 white, 0px -1px 0 white,
      0px 0px 0 white, 0px 1px 0 white, 0px 2px 0 white, 0px 3px 0 white, 0px 4px 0 white, 0px 5px 0 white,
      1px -5px 0 white, 1px -4px 0 white, 1px -3px 0 white, 1px -2px 0 white, 1px -1px 0 white,
      1px 0px 0 white, 1px 1px 0 white, 1px 2px 0 white, 1px 3px 0 white, 1px 4px 0 white, 1px 5px 0 white,
      2px -5px 0 white, 2px -4px 0 white, 2px -3px 0 white, 2px -2px 0 white, 2px -1px 0 white,
      2px 0px 0 white, 2px 1px 0 white, 2px 2px 0 white, 2px 3px 0 white, 2px 4px 0 white, 2px 5px 0 white,
      3px -5px 0 white, 3px -4px 0 white, 3px -3px 0 white, 3px -2px 0 white, 3px -1px 0 white,
      3px 0px 0 white, 3px 1px 0 white, 3px 2px 0 white, 3px 3px 0 white, 3px 4px 0 white, 3px 5px 0 white,
      4px -5px 0 white, 4px -4px 0 white, 4px -3px 0 white, 4px -2px 0 white, 4px -1px 0 white,
      4px 0px 0 white, 4px 1px 0 white, 4px 2px 0 white, 4px 3px 0 white, 4px 4px 0 white, 4px 5px 0 white,
      5px -5px 0 white, 5px -4px 0 white, 5px -3px 0 white, 5px -2px 0 white, 5px -1px 0 white,
      5px 0px 0 white, 5px 1px 0 white, 5px 2px 0 white, 5px 3px 0 white, 5px 4px 0 white, 5px 5px 0 white;
  }
  h1 {
    position:absolute;
    top: 20px;
    right: 40px;
    font-size:20px;
  }
`;

    return customHeader || defaultHeader;
  }

  /**
   * 將一首歌的歌詞轉換為投影片 (新版本，根據指定格式)
   * @param lyrics 歌詞內容
   * @param imagePath 背景圖片路徑
   * @param title 歌曲標題 (可選)
   * @returns 格式化後的 Marp 投影片內容
   */
  public static formatSong(lyrics: string, imagePath: string, title?: string): string {
    try {
      // 初始化投影片內容（移除之前的首頁空白頁）
      let slides = "";

      // 修復圖片路徑，將反斜線替換為正斜線
      const fixedImagePath = imagePath.replace(/\\/g, '/');

      // 按照雙換行分段 (\n\n)
      const paragraphs = lyrics.split('\n\n').filter(p => p.trim());
      
      // 為每個段落創建一頁投影片
      for (const paragraph of paragraphs) {
        slides += `
---

![bg](${fixedImagePath})
# ${title}
${paragraph}
`;
      }

      // 結尾空白頁
      slides += `
---

![bg](${fixedImagePath})
# ${title}
`;

      return slides;
    } catch (error) {
      LoggerService.error('格式化歌曲投影片失敗', error);
      throw error;
    }
  }

  /**
   * 合併多首歌曲的投影片
   * @param songInfoList 歌曲信息列表
   * @param customHeader 自定義標頭
   * @returns 合併後的 Marp 投影片內容
   */
  public static mergeMultipleSongs(
    songInfoList: SongInfo[],
    customHeader?: string
  ): string {
    try {
      // 記錄處理開始
      LoggerService.info(`開始合併 ${songInfoList.length} 首歌曲的投影片`);
      
      // 生成 Marp 標頭
      let marpContent = this.generateMarpHeader(customHeader);
      
      // 為每首歌添加投影片
      for (const songInfo of songInfoList) {
        // 添加該首歌的投影片
        const songSlides = this.formatSong(songInfo.lyrics, songInfo.imagePath, songInfo.title);
        marpContent += songSlides;
      }
      
      LoggerService.info(`完成合併 ${songInfoList.length} 首歌曲的投影片`);
      
      return marpContent;
    } catch (error) {
      LoggerService.error('合併多首歌曲投影片失敗', error);
      throw error;
    }
  }

  /**
   * 批次生成多首歌的投影片內容
   * @param songs 歌曲信息列表
   * @param customMarpHeader 自定義 Marp 標頭
   * @returns 完整的投影片內容
   */
  public static generateBatchSlides(songs: SongInfo[], customMarpHeader?: string): string {
    try {
      // 記錄開始
      LoggerService.info(`開始批次生成 ${songs.length} 首歌曲的投影片`);
      
      // 直接使用合併方法生成
      const slideContent = this.mergeMultipleSongs(songs, customMarpHeader);
      
      LoggerService.info(`完成批次生成 ${songs.length} 首歌曲的投影片`);
      return slideContent;
    } catch (error) {
      LoggerService.error('批次生成投影片失敗', error);
      throw error;
    }
  }
} 