/// <reference types="node" />
/// <reference types="electron" />

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { SettingsService } from './settings';
import { DatabaseService } from './database';
import { LoggerService } from './logger';

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
      await LoggerService.error('建立圖片緩存目錄失敗', error);
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
      await LoggerService.error('初始化OpenAI API失敗', error);
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
    const startTime = LoggerService.apiStart('ImageGenerationService', 'generateImage', { songId, songTitle, lyricsLength: lyrics?.length });
    
    try {
      // 記錄歌曲ID
      await LoggerService.info(`開始為歌曲ID ${songId} 生成圖片`);
      
      // 檢查歌曲ID是否有效
      if (!songId || songId <= 0) {
        // 嘗試查詢或創建歌曲記錄
        const db = DatabaseService.init();
        
        // 先查詢歌曲是否存在
        const songQuery = 'SELECT id FROM songs WHERE title = ?';
        await LoggerService.logDatabaseOperation('查詢', songQuery, [songTitle]);
        
        const existingSong = db.prepare(songQuery).get(songTitle) as { id: number } | undefined;
        
        if (existingSong) {
          songId = existingSong.id;
          await LoggerService.info(`找到現有歌曲記錄，ID: ${songId}`);
        } else {
          // 創建新歌曲記錄
          const insertQuery = 'INSERT INTO songs (title, lyrics, created_at, updated_at) VALUES (?, ?, ?, ?)';
          const now = new Date().toISOString();
          const params = [songTitle, lyrics || '', now, now];
          
          await LoggerService.logDatabaseOperation('插入', insertQuery, params);
          
          try {
            const result = db.prepare(insertQuery).run(...params);
            songId = result.lastInsertRowid as number;
            await LoggerService.info(`創建新歌曲記錄，ID: ${songId}`);
          } catch (dbError: any) {
            await LoggerService.error('創建歌曲記錄失敗', dbError);
            throw new Error(`無法創建歌曲記錄: ${dbError.message}`);
          }
        }
      }

      // 確保緩存目錄存在
      await this.initCacheDir();

      // 檢查緩存中是否已有此歌曲的圖片
      const cachedImage = await this.getImageFromCache(songId);
      if (cachedImage) {
        await LoggerService.info(`使用緩存的圖片: ${cachedImage}`);
        await LoggerService.apiSuccess('ImageGenerationService', 'generateImage', { songId, songTitle }, { imagePath: cachedImage }, startTime);
        return cachedImage;
      }

      // 初始化 OpenAI API
      if (!this.openai) {
        await this.initOpenAI();
      }

      // 獲取圖片生成提示詞模板
      const promptTemplate = SettingsService.getSetting('imagePromptTemplate') || 
        'Positive Prompt: A minimalist and abstract background inspired by the atmosphere of the song {{songTitle}}, designed for church worship slides. The image should fully capture the essence of the lyrics: {{lyrics}}, with a soft, monochromatic color palette, gentle gradients, and a serene, worshipful ambiance. Use light pastel tones, ensuring smooth transitions between colors, high resolution, and premium quality. The design should be extremely simple, avoiding any distractions while maintaining a reverent and uplifting aesthetic. Absolutely no text, no human figures, no silhouettes, and no symbols should be included. The details should be kept to an absolute minimum, ensuring a clean and uncluttered visual.\nNegative Prompt: People, faces, human figures, silhouettes, body parts, hands, eyes, text, letters, symbols, icons, high contrast, complex patterns, intricate details, cluttered compositions, surreal elements, excessive textures, multiple colors, harsh gradients, dark tones.';

      // 替換提示詞中的變數
      // 取歌詞的前300個字符，避免提示詞過長
      const lyricsExcerpt = lyrics?.substring(0, 300) || '';
      const finalPrompt = promptTemplate
        .replace('{{lyrics}}', lyricsExcerpt)
        .replace('{{songTitle}}', songTitle);
      
      await LoggerService.info(`生成圖片的提示詞: ${finalPrompt.substring(0, 100)}...`);

      // 生成圖片
      if (!this.openai) {
        throw new Error('OpenAI API未初始化');
      }
      
      // 記錄 OpenAI API 請求
      const openaiStartTime = LoggerService.apiStart('OpenAI', 'images.generate', { prompt: finalPrompt.substring(0, 100) + '...' });
      
      let imageResponse;
      try {
        imageResponse = await this.openai.images.generate({
          model: "dall-e-3", // 或 "dall-e-2"
          prompt: finalPrompt,
          n: 1,
          size: "1024x1024",
        });
        
        await LoggerService.apiSuccess('OpenAI', 'images.generate', 
          { promptLength: finalPrompt.length }, 
          { url: imageResponse?.data?.[0]?.url ? '有URL' : '無URL' }, 
          openaiStartTime
        );
      } catch (apiError) {
        await LoggerService.apiError('OpenAI', 'images.generate', 
          { promptLength: finalPrompt.length }, 
          apiError, 
          openaiStartTime
        );
        throw apiError;
      }

      const imageUrl = imageResponse.data[0].url;
      
      if (!imageUrl) {
        throw new Error('圖片生成失敗');
      }

      // 保存圖片到本地緩存
      const localImagePath = await this.saveImageToCache(songId, imageUrl, finalPrompt);
      
      // 記錄成功
      await LoggerService.apiSuccess('ImageGenerationService', 'generateImage', 
        { songId, songTitle, lyricsLength: lyrics?.length }, 
        { imagePath: localImagePath }, 
        startTime
      );
      
      return localImagePath;
    } catch (error) {
      console.error('生成圖片失敗:', error);
      await LoggerService.apiError('ImageGenerationService', 'generateImage', 
        { songId, songTitle, lyricsLength: lyrics?.length }, 
        error, 
        startTime
      );
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
    const startTime = LoggerService.apiStart('ImageGenerationService', 'saveImageToCache', { songId, hasImageUrl: !!imageUrl });
    
    try {
      // 記錄歌曲ID
      await LoggerService.info(`開始為歌曲ID ${songId} 保存圖片`);
      
      // 檢查歌曲是否存在
      const db = DatabaseService.init();
      const checkSongQuery = 'SELECT id FROM songs WHERE id = ?';
      await LoggerService.logDatabaseOperation('查詢', checkSongQuery, [songId]);
      
      const songExists = db.prepare(checkSongQuery).get(songId);
      
      if (!songExists) {
        await LoggerService.error(`歌曲ID不存在: ${songId}，無法保存圖片`);
        throw new Error(`歌曲ID不存在: ${songId}，無法保存圖片`);
      }

      // 下載圖片
      await LoggerService.info(`開始下載圖片: ${imageUrl.substring(0, 50)}...`);
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      await LoggerService.info(`圖片下載完成，大小: ${buffer.byteLength} 字節`);

      // 建立檔案名稱和路徑
      const fileName = `${songId}_${Date.now()}.png`;
      const filePath = path.join(this.imageCacheDir, fileName);
      await LoggerService.info(`圖片將保存到: ${filePath}`);

      // 寫入檔案
      await fs.writeFile(filePath, Buffer.from(buffer));
      await LoggerService.info(`圖片檔案已寫入`);

      // 將圖片記錄插入到資料庫
      const insertImgQuery = 'INSERT INTO images (song_id, image_path, prompt, created_at) VALUES (?, ?, ?, ?)';
      const insertImgParams = [songId, filePath, prompt, new Date().toISOString()];
      
      await LoggerService.logDatabaseOperation('插入', insertImgQuery, insertImgParams);
      
      try {
        db.prepare(insertImgQuery).run(...insertImgParams);
        await LoggerService.info(`圖片記錄已插入到資料庫`);
      } catch (dbError) {
        await LoggerService.error('插入圖片記錄失敗', dbError);
        throw dbError;
      }

      // 同時更新歌曲表中的圖片URL
      const updateSongQuery = 'UPDATE songs SET image_url = ?, updated_at = ? WHERE id = ?';
      const updateSongParams = [filePath, new Date().toISOString(), songId];
      
      await LoggerService.logDatabaseOperation('更新', updateSongQuery, updateSongParams);
      
      try {
        const updateResult = db.prepare(updateSongQuery).run(...updateSongParams);
        await LoggerService.info(`歌曲記錄更新結果: 影響 ${updateResult.changes} 行`);
      } catch (dbError) {
        await LoggerService.error('更新歌曲記錄失敗', dbError);
        // 不拋出錯誤，因為圖片已經保存成功
      }

      // 記錄成功
      await LoggerService.apiSuccess('ImageGenerationService', 'saveImageToCache', 
        { songId }, 
        { filePath }, 
        startTime
      );
      
      return filePath;
    } catch (error) {
      console.error('保存圖片到緩存失敗:', error);
      await LoggerService.apiError('ImageGenerationService', 'saveImageToCache', 
        { songId }, 
        error, 
        startTime
      );
      throw error;
    }
  }

  /**
   * 匯入本地圖片到緩存
   * @param songId 歌曲ID
   * @param localImagePath 本地圖片路徑
   * @returns 緩存中的圖片路徑
   */
  public static async importLocalImage(songId: number, localImagePath: string): Promise<string> {
    const startTime = LoggerService.apiStart('ImageGenerationService', 'importLocalImage', { songId, localImagePath });
    
    try {
      // 記錄歌曲ID
      await LoggerService.info(`開始為歌曲ID ${songId} 匯入本地圖片`);
      
      // 檢查歌曲是否存在
      const db = DatabaseService.init();
      const checkSongQuery = 'SELECT id FROM songs WHERE id = ?';
      await LoggerService.logDatabaseOperation('查詢', checkSongQuery, [songId]);
      
      const songExists = db.prepare(checkSongQuery).get(songId);
      
      if (!songExists) {
        await LoggerService.error(`歌曲ID不存在: ${songId}，無法匯入圖片`);
        throw new Error(`歌曲ID不存在: ${songId}，無法匯入圖片`);
      }

      // 確保緩存目錄存在
      await this.initCacheDir();

      // 讀取本地圖片
      const buffer = await fs.readFile(localImagePath);
      
      // 建立檔案名稱和路徑
      const fileName = `${songId}_${Date.now()}.png`;
      const filePath = path.join(this.imageCacheDir, fileName);
      await LoggerService.info(`圖片將保存到: ${filePath}`);

      // 寫入檔案
      await fs.writeFile(filePath, buffer);
      await LoggerService.info(`圖片檔案已寫入`);

      // 將圖片記錄插入到資料庫
      const insertImgQuery = 'INSERT INTO images (song_id, image_path, prompt, created_at) VALUES (?, ?, ?, ?)';
      const insertImgParams = [songId, filePath, '從本地匯入的圖片', new Date().toISOString()];
      
      await LoggerService.logDatabaseOperation('插入', insertImgQuery, insertImgParams);
      
      try {
        db.prepare(insertImgQuery).run(...insertImgParams);
        await LoggerService.info(`圖片記錄已插入資料庫`);
      } catch (dbError: any) {
        await LoggerService.error('插入圖片記錄失敗', dbError);
        throw new Error(`無法插入圖片記錄: ${dbError.message}`);
      }
      
      await LoggerService.apiSuccess('ImageGenerationService', 'importLocalImage', 
        { songId, localImagePath }, 
        { imagePath: filePath }, 
        startTime
      );
      
      return filePath;
    } catch (error) {
      console.error('匯入本地圖片失敗:', error);
      await LoggerService.apiError('ImageGenerationService', 'importLocalImage', 
        { songId, localImagePath }, 
        error, 
        startTime
      );
      throw error;
    }
  }

  /**
   * 獲取緩存大小
   * @returns 緩存大小信息（總大小和檔案數量）
   */
  public static async getCacheSize(): Promise<{ totalSizeBytes: number; totalSizeMB: string; fileCount: number }> {
    const startTime = LoggerService.apiStart('ImageGenerationService', 'getCacheSize', {});
    
    try {
      // 確保緩存目錄存在
      await this.initCacheDir();
      
      // 讀取目錄中的所有檔案
      const files = await fs.readdir(this.imageCacheDir);
      let totalSize = 0;
      let fileCount = 0;
      
      // 計算總大小
      for (const file of files) {
        try {
          const filePath = path.join(this.imageCacheDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            totalSize += stats.size;
            fileCount++;
          }
        } catch (e) {
          await LoggerService.error(`無法讀取緩存檔案 ${file} 的信息`, e);
        }
      }
      
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      
      const result = {
        totalSizeBytes: totalSize,
        totalSizeMB: `${totalSizeMB} MB`,
        fileCount
      };
      
      await LoggerService.apiSuccess('ImageGenerationService', 'getCacheSize', {}, result, startTime);
      
      return result;
    } catch (error) {
      console.error('獲取緩存大小失敗:', error);
      await LoggerService.apiError('ImageGenerationService', 'getCacheSize', {}, error, startTime);
      throw error;
    }
  }

  /**
   * 清除圖片緩存
   * @returns 清除結果
   */
  public static async clearCache(): Promise<{ success: boolean; deletedCount: number }> {
    const startTime = LoggerService.apiStart('ImageGenerationService', 'clearCache', {});
    
    try {
      // 確保緩存目錄存在
      await this.initCacheDir();
      
      // 讀取目錄中的所有檔案
      const files = await fs.readdir(this.imageCacheDir);
      let deletedCount = 0;
      
      // 刪除所有檔案
      for (const file of files) {
        try {
          const filePath = path.join(this.imageCacheDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        } catch (e) {
          await LoggerService.error(`無法刪除緩存檔案 ${file}`, e);
        }
      }
      
      // 清除資料庫中的圖片記錄
      const db = DatabaseService.init();
      const deleteQuery = 'DELETE FROM images';
      await LoggerService.logDatabaseOperation('刪除', deleteQuery, []);
      
      db.prepare(deleteQuery).run();
      
      const result = {
        success: true,
        deletedCount
      };
      
      await LoggerService.apiSuccess('ImageGenerationService', 'clearCache', {}, result, startTime);
      
      return result;
    } catch (error) {
      console.error('清除緩存失敗:', error);
      await LoggerService.apiError('ImageGenerationService', 'clearCache', {}, error, startTime);
      
      return {
        success: false,
        deletedCount: 0
      };
    }
  }

  /**
   * 從緩存獲取圖片
   * @param songId 歌曲ID
   * @returns 本地圖片路徑 或 null
   */
  public static async getImageFromCache(songId: number): Promise<string | null> {
    const startTime = LoggerService.apiStart('ImageGenerationService', 'getImageFromCache', { songId });
    
    try {
      const db = DatabaseService.init();
      const query = 'SELECT image_path FROM images WHERE song_id = ? ORDER BY created_at DESC LIMIT 1';
      
      await LoggerService.logDatabaseOperation('查詢', query, [songId]);
      
      const image = db.prepare(query).get(songId) as { image_path: string } | undefined;

      if (image && image.image_path) {
        // 確認檔案存在
        try {
          await fs.access(image.image_path);
          await LoggerService.apiSuccess('ImageGenerationService', 'getImageFromCache', 
            { songId }, 
            { imagePath: image.image_path }, 
            startTime
          );
          return image.image_path;
        } catch (e) {
          // 檔案不存在，從資料庫中刪除記錄
          const deleteQuery = 'DELETE FROM images WHERE song_id = ? AND image_path = ?';
          await LoggerService.logDatabaseOperation('刪除', deleteQuery, [songId, image.image_path]);
          
          db.prepare(deleteQuery).run(songId, image.image_path);
          await LoggerService.info(`圖片檔案不存在，已從資料庫中刪除記錄: ${image.image_path}`);
          
          await LoggerService.apiSuccess('ImageGenerationService', 'getImageFromCache', 
            { songId }, 
            { result: null, reason: '檔案不存在' }, 
            startTime
          );
          return null;
        }
      }
      
      await LoggerService.apiSuccess('ImageGenerationService', 'getImageFromCache', 
        { songId }, 
        { result: null, reason: '資料庫中無記錄' }, 
        startTime
      );
      return null;
    } catch (error) {
      console.error('從緩存獲取圖片失敗:', error);
      await LoggerService.apiError('ImageGenerationService', 'getImageFromCache', 
        { songId }, 
        error, 
        startTime
      );
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
    const startTime = LoggerService.apiStart('ImageGenerationService', 'regenerateImage', { songId, songTitle });
    
    try {
      // 刪除現有的圖片記錄
      const db = DatabaseService.init();
      const deleteQuery = 'DELETE FROM images WHERE song_id = ?';
      
      await LoggerService.logDatabaseOperation('刪除', deleteQuery, [songId]);
      
      db.prepare(deleteQuery).run(songId);
      await LoggerService.info(`已刪除歌曲ID ${songId} 的所有圖片記錄`);
      
      // 重新生成圖片
      const imagePath = await this.generateImage(songId, songTitle, lyrics);
      
      await LoggerService.apiSuccess('ImageGenerationService', 'regenerateImage', 
        { songId, songTitle }, 
        { imagePath }, 
        startTime
      );
      
      return imagePath;
    } catch (error) {
      console.error('重新生成圖片失敗:', error);
      await LoggerService.apiError('ImageGenerationService', 'regenerateImage', 
        { songId, songTitle }, 
        error, 
        startTime
      );
      throw error;
    }
  }
} 