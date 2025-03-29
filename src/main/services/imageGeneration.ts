/// <reference types="node" />
/// <reference types="electron" />

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { SettingsService } from './settings';
import { DatabaseService } from './database';

/**
 * 圖片生成服務
 * 實現規格書中第3.2節的功能
 */
export class ImageGenerationService {
  // 緩存目錄
  private static imageCacheDir = path.join(app.getPath('userData'), 'cache', 'images');
  // OpenAI 實例
  private static openai: OpenAI | null = null;

  /**
   * 初始化緩存目錄
   */
  private static async initCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.imageCacheDir, { recursive: true });
    } catch (error) {
      console.error('建立圖片緩存目錄失敗:', error);
    }
  }

  /**
   * 初始化 OpenAI API
   */
  private static async initOpenAI(): Promise<void> {
    try {
      const apiKey = SettingsService.getSetting('openaiApiKey');
      if (!apiKey) {
        throw new Error('未設定OpenAI API金鑰');
      }
      this.openai = new OpenAI({
        apiKey: apiKey as string,
      });
    } catch (error) {
      console.error('初始化OpenAI API失敗:', error);
      throw error;
    }
  }

  /**
   * 生成背景圖片
   * @param songId 歌曲ID
   * @param songTitle 歌曲標題
   * @param lyrics 歌詞內容
   * @returns 本地圖片路徑
   */
  public static async generateImage(songId: number, songTitle: string, lyrics: string): Promise<string> {
    try {
      // 確保緩存目錄存在
      await this.initCacheDir();

      // 檢查緩存中是否已有此歌曲的圖片
      const cachedImage = await this.getImageFromCache(songId);
      if (cachedImage) {
        return cachedImage;
      }

      // 初始化 OpenAI API
      if (!this.openai) {
        await this.initOpenAI();
      }

      // 獲取圖片生成提示詞模板
      const promptTemplate = SettingsService.getSetting('imagePromptTemplate') || 
        '為以下歌詞創建背景圖片：「{{lyrics}}」，風格：簡約現代，適合教會或歌唱聚會使用的投影片背景，不要包含任何文字或人物，只需要創作和諧、簡約的抽象背景。';

      // 替換提示詞中的變數
      // 取歌詞的前300個字符，避免提示詞過長
      const lyricsExcerpt = lyrics.substring(0, 300);
      const finalPrompt = promptTemplate
        .replace('{{lyrics}}', lyricsExcerpt)
        .replace('{{songTitle}}', songTitle);

      // 生成圖片
      if (!this.openai) {
        throw new Error('OpenAI API未初始化');
      }
      
      const imageResponse = await this.openai.images.generate({
        prompt: finalPrompt,
        n: 1,
        size: "1024x1024",
      });

      const imageUrl = imageResponse.data[0].url;
      
      if (!imageUrl) {
        throw new Error('圖片生成失敗');
      }

      // 保存圖片到本地緩存
      const localImagePath = await this.saveImageToCache(songId, imageUrl, finalPrompt);
      return localImagePath;
    } catch (error) {
      console.error('生成圖片失敗:', error);
      throw error;
    }
  }

  /**
   * 保存圖片到本地緩存
   * @param songId 歌曲ID
   * @param imageUrl 圖片URL
   * @param prompt 使用的提示詞
   * @returns 本地圖片路徑
   */
  private static async saveImageToCache(songId: number, imageUrl: string, prompt: string): Promise<string> {
    try {
      // 下載圖片
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();

      // 建立檔案名稱和路徑
      const fileName = `${songId}_${Date.now()}.png`;
      const filePath = path.join(this.imageCacheDir, fileName);

      // 寫入檔案
      await fs.writeFile(filePath, Buffer.from(buffer));

      // 將圖片URL更新到歌曲記錄中
      const db = DatabaseService.init();
      const stmt = db.prepare('INSERT INTO images (song_id, image_path, prompt, created_at) VALUES (?, ?, ?, ?)');
      stmt.run(songId, filePath, prompt, new Date().toISOString());

      // 同時更新歌曲表中的圖片URL
      const updateStmt = db.prepare('UPDATE songs SET image_url = ?, updated_at = ? WHERE id = ?');
      updateStmt.run(filePath, new Date().toISOString(), songId);

      return filePath;
    } catch (error) {
      console.error('保存圖片到緩存失敗:', error);
      throw error;
    }
  }

  /**
   * 從緩存獲取圖片
   * @param songId 歌曲ID
   * @returns 本地圖片路徑 或 null
   */
  public static async getImageFromCache(songId: number): Promise<string | null> {
    try {
      const db = DatabaseService.init();
      const stmt = db.prepare('SELECT image_path FROM images WHERE song_id = ? ORDER BY created_at DESC LIMIT 1');
      const image = stmt.get(songId) as { image_path: string } | undefined;

      if (image && image.image_path) {
        // 確認檔案存在
        try {
          await fs.access(image.image_path);
          return image.image_path;
        } catch (e) {
          // 檔案不存在，從資料庫中刪除記錄
          const deleteStmt = db.prepare('DELETE FROM images WHERE song_id = ? AND image_path = ?');
          deleteStmt.run(songId, image.image_path);
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error('從緩存獲取圖片失敗:', error);
      return null;
    }
  }

  /**
   * 重新生成圖片
   * @param songId 歌曲ID
   * @param songTitle 歌曲標題
   * @param lyrics 歌詞內容
   * @returns 新的圖片路徑
   */
  public static async regenerateImage(songId: number, songTitle: string, lyrics: string): Promise<string> {
    try {
      // 刪除現有的圖片記錄
      const db = DatabaseService.init();
      const deleteStmt = db.prepare('DELETE FROM images WHERE song_id = ?');
      deleteStmt.run(songId);
      
      // 重新生成圖片
      return await this.generateImage(songId, songTitle, lyrics);
    } catch (error) {
      console.error('重新生成圖片失敗:', error);
      throw error;
    }
  }
} 