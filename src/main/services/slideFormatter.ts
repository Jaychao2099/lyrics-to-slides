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
  textColor?: string;
  strokeColor?: string;
  strokeSize?: number;
  fontWeight?: number;
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
`;

    return customHeader || defaultHeader;
  }

  /**
   * 生成文字邊框樣式
   * @param textColor 文字顏色
   * @param strokeColor 邊框顏色
   * @param strokeSize 邊框粗細
   * @returns 文字邊框樣式
   */
  private static generateTextStrokeStyle(textColor: string, strokeColor: string, strokeSize: number): string {
    let shadowStyle = '';
    for (let x = -strokeSize; x <= strokeSize; x++) {
      for (let y = -strokeSize; y <= strokeSize; y++) {
        shadowStyle += `${x}px ${y}px 0 ${strokeColor}, `;
      }
    }
    // 移除最後的逗號和空格
    shadowStyle = shadowStyle.slice(0, -2);
    
    return `color: ${textColor}; text-shadow: ${shadowStyle};`;
  }

  /**
   * 將一首歌的歌詞轉換為投影片 (新版本，根據指定格式)
   * @param lyrics 歌詞內容
   * @param imagePath 背景圖片路徑
   * @param title 歌曲標題 (可選)
   * @param textColor 文字顏色 (可選)
   * @param strokeColor 邊框顏色 (可選)
   * @param strokeSize 邊框粗細 (可選)
   * @param fontWeight 文字粗細 (可選)
   * @param skipStyleGeneration 是否跳過樣式生成 (用於批量處理)
   * @returns 格式化後的 Marp 投影片內容
   */
  public static formatSong(
    lyrics: string, 
    imagePath: string, 
    title?: string,
    textColor: string = 'black',
    strokeColor: string = 'white',
    strokeSize: number = 5,
    fontWeight: number = 400,
    skipStyleGeneration: boolean = false
  ): string {
    try {      
      // 初始化投影片內容
      let slides = "";

      // 修復圖片路徑，將反斜線替換為正斜線
      const fixedImagePath = imagePath.replace(/\\/g, '/');

      // 生成文字樣式，只有在不跳過樣式生成時才添加
      const songId = title?.replace(/\s+/g, '_');
      if (!skipStyleGeneration) {
        slides += `
  section.song${songId} p {
    font-weight: ${fontWeight};
    ${this.generateTextStrokeStyle(textColor, strokeColor, strokeSize)}
  }
  section.song${songId} h1 {
    color: ${textColor};
  }

`;
      }

      // 按照雙換行分段 (\n\n)
      const paragraphs = lyrics.split('\n\n').filter(p => p.trim());
      
      // 為每個段落創建一頁投影片
      for (const paragraph of paragraphs) {
        slides += `
---

<!-- _class: song${songId} -->
![bg](${fixedImagePath})
# ${title}
${paragraph}
`;
      }

      // 結尾空白頁
      slides += `
---

<!-- _class: song${songId} -->
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
      
      // === 重要：集中處理所有歌曲的樣式，避免重複 ===
      LoggerService.info('集中生成所有歌曲的樣式');
      
      // 為每首歌添加樣式，這些樣式會統一放在標頭部分
      for (const songInfo of songInfoList) {
        const songId = songInfo.title?.replace(/\s+/g, '_');
        const textColor = songInfo.textColor || 'black';
        const strokeColor = songInfo.strokeColor || 'white';
        const strokeSize = songInfo.strokeSize || 5;
        
        LoggerService.info(`為歌曲 "${songInfo.title}" 添加樣式 (ID: song${songId})`);
        
        marpContent += `
  section.song${songId} p {
    font-weight: ${songInfo.fontWeight || 400};
    ${this.generateTextStrokeStyle(textColor, strokeColor, strokeSize)}
  }
  section.song${songId} h1 {
    color: ${textColor};
  }
`;
      }
      
      // 為每首歌添加投影片
      for (const songInfo of songInfoList) {
        // 添加該首歌的投影片
        const songSlides = this.formatSong(
          songInfo.lyrics, 
          songInfo.imagePath, 
          songInfo.title,
          songInfo.textColor,
          songInfo.strokeColor,
          songInfo.strokeSize,
          songInfo.fontWeight,
          true // 跳過樣式生成，因為已經在合併標頭中添加了
        );
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