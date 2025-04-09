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
  // 快取目錄
  private static imageCacheDir = path.join(app.getPath('userData'), 'app_cache', 'images');
  // OpenAI 實例
  private static openai: OpenAI | null = null;

  /**
   * 初始化快取目錄
   */
  private static async initCacheDir(): Promise<void> {
    try {
      try {
        // 先檢查目錄是否存在
        await fs.access(this.imageCacheDir);
        // 目錄已存在，無需創建
      } catch (e) {
        // 目錄不存在，創建它
        await fs.mkdir(this.imageCacheDir, { recursive: true });
        console.log(`圖片快取目錄創建成功: ${this.imageCacheDir}`);
      }
    } catch (error) {
      console.error('建立圖片快取目錄失敗:', error);
      await LoggerService.error('建立圖片快取目錄失敗', error);
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

      // 確保快取目錄存在
      await this.initCacheDir();

      // 檢查快取中是否已有此歌曲的圖片
      // const cachedImage = await this.getImageFromCache(songId);
      // if (cachedImage) {
      //   await LoggerService.info(`使用快取的圖片: ${cachedImage}`);
      //   await LoggerService.apiSuccess('ImageGenerationService', 'generateImage', { songId, songTitle }, { imagePath: cachedImage }, startTime);
      //   return cachedImage;
      // }

      // 初始化 OpenAI API
      if (!this.openai) {
        await this.initOpenAI();
      }

      // 獲取圖片生成提示詞模板
      const promptTemplate = SettingsService.getSetting('imagePromptTemplate') || 
        'Positive Prompt: "minimalist design, abstract shapes, monochrome illustration: slide background image inspired by the atmosphere of the song " {{songTitle}}", designed for church worship slides. Low contrast:1.2, can have normal church elements or some elements of the lyrics: " {{lyrics}}". "\nNegative Prompt: "no text:2, no letters:2, no People:2, no faces:2, no human figures:2, no silhouettes:2, no body parts:2, no hands:2, no eyes:2, no symbols, no icons, no complex patterns, no intricate details, no cluttered compositions, no surreal elements, no excessive textures, no multiple colors, no harsh gradients, low sharpness."';

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
          model: "dall-e-3", // "dall-e-3", "dall-e-2", "4o"
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

      // 保存圖片到本地快取
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
   * 保存圖片到快取目錄
   * @param songId 歌曲ID
   * @param imageUrl 圖片URL
   * @param prompt 生成提示詞
   * @returns 保存後的本地圖片路徑
   */
  private static async saveImageToCache(songId: number, imageUrl: string, prompt?: string): Promise<string> {
    try {
      // 確保快取目錄存在
      await this.initCacheDir();
      
      // 使用 songId 作為文件名
      const timestamp = Date.now();
      const fileName = `${songId}_${timestamp}.png`;
      const localImagePath = path.join(this.imageCacheDir, fileName);
      
      // 下載圖片
      const imageResponse = await fetch(imageUrl);
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // 保存到本地
      await fs.writeFile(localImagePath, buffer);
      
      // 保存圖片記錄到資料庫
      const db = DatabaseService.init();
      const now = new Date().toISOString();
      
      try {
        const stmt = db.prepare(`
          INSERT INTO images (song_id, image_path, prompt, created_at)
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(songId, localImagePath, prompt || '', now);
      } catch (dbError) {
        console.error('儲存圖片記錄到資料庫失敗:', dbError);
      }
      
      // 保存圖片與歌曲的關聯
      DatabaseService.saveSongResource(songId, 'image', localImagePath);
      
      return localImagePath;
    } catch (error) {
      console.error('保存圖片到快取失敗:', error);
      throw error;
    }
  }

  /**
   * 匯入本地圖片到快取
   * @param songId 歌曲ID
   * @param localImagePath 本地圖片路徑
   * @returns 快取中的圖片路徑
   */
  public static async importLocalImage(songId: number, localImagePath: string): Promise<string> {
    const startTime = LoggerService.apiStart('ImageGenerationService', 'importLocalImage', { songId, localImagePath });
    
    try {
      // 記錄歌曲ID
      await LoggerService.info(`開始為歌曲ID ${songId} 匯入本地圖片`);
      
      // 檢查歌曲ID是否有效
      if (!songId || songId <= 0) {
        // 獲取檔案名稱作為臨時標題
        const fileName = path.basename(localImagePath, path.extname(localImagePath));
        const tempTitle = `從本地匯入的圖片 ${new Date().toISOString().split('T')[0]}`;
        
        await LoggerService.info(`無效的歌曲ID: ${songId}，將創建臨時歌曲記錄: ${tempTitle}`);
        
        // 嘗試創建歌曲記錄
        const db = DatabaseService.init();
        const insertQuery = 'INSERT INTO songs (title, lyrics, created_at, updated_at) VALUES (?, ?, ?, ?)';
        const now = new Date().toISOString();
        const params = [tempTitle, '', now, now];
        
        await LoggerService.logDatabaseOperation('插入', insertQuery, params);
        
        try {
          const result = db.prepare(insertQuery).run(...params);
          songId = result.lastInsertRowid as number;
          await LoggerService.info(`創建新歌曲記錄，ID: ${songId}`);
        } catch (dbError: any) {
          await LoggerService.error('創建歌曲記錄失敗', dbError);
          throw new Error(`無法創建歌曲記錄: ${dbError.message}`);
        }
      } else {
        // 檢查歌曲是否存在
        const db = DatabaseService.init();
        const checkSongQuery = 'SELECT id FROM songs WHERE id = ?';
        await LoggerService.logDatabaseOperation('查詢', checkSongQuery, [songId]);
        
        const songExists = db.prepare(checkSongQuery).get(songId);
        
        if (!songExists) {
          await LoggerService.error(`歌曲ID不存在: ${songId}，將創建新記錄`);
          
          // 創建新歌曲記錄
          const tempTitle = `從本地匯入的圖片 ${new Date().toISOString().split('T')[0]}`;
          const insertQuery = 'INSERT INTO songs (title, lyrics, created_at, updated_at) VALUES (?, ?, ?, ?)';
          const now = new Date().toISOString();
          const params = [tempTitle, '', now, now];
          
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

      // 確保快取目錄存在
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
      const db = DatabaseService.init();
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
      
      // 同時更新歌曲表中的圖片URL
      const updateSongQuery = 'UPDATE songs SET image_url = ?, updated_at = ? WHERE id = ?';
      const updateSongParams = [filePath, new Date().toISOString(), songId];
      
      await LoggerService.logDatabaseOperation('更新', updateSongQuery, updateSongParams);
      
      try {
        db.prepare(updateSongQuery).run(...updateSongParams);
        await LoggerService.info(`歌曲記錄已更新圖片URL`);
      } catch (dbError) {
        await LoggerService.error('更新歌曲記錄失敗', dbError);
        // 不中斷流程，繼續執行
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
   * 獲取快取大小
   * @returns 快取大小信息（總大小和檔案數量）
   */
  public static async getCacheSize(): Promise<{ totalSizeBytes: number; totalSizeMB: string; fileCount: number }> {
    const startTime = LoggerService.apiStart('ImageGenerationService', 'getCacheSize', {});
    
    try {
      // 確保快取目錄存在
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
          await LoggerService.error(`無法讀取快取檔案 ${file} 的信息`, e);
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
      console.error('獲取快取大小失敗:', error);
      await LoggerService.apiError('ImageGenerationService', 'getCacheSize', {}, error, startTime);
      throw error;
    }
  }

  /**
   * 清除圖片快取
   * @returns 清除結果
   */
  public static async clearCache(): Promise<{ success: boolean; deletedCount: number }> {
    const startTime = LoggerService.apiStart('ImageGenerationService', 'clearCache', {});
    
    try {
      // 確保快取目錄存在
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
          await LoggerService.error(`無法刪除快取檔案 ${file}`, e);
        }
      }
      
      // 清除資料庫中的圖片記錄
      const db = DatabaseService.init();
      const deleteQuery = 'DELETE FROM images';
      await LoggerService.logDatabaseOperation('刪除', deleteQuery, []);
      
      db.prepare(deleteQuery).run();
      
      // 清除圖片資源關聯記錄
      await LoggerService.info('清除圖片關聯記錄');
      DatabaseService.clearSongResourcesByType('image');
      
      const result = {
        success: true,
        deletedCount
      };
      
      await LoggerService.apiSuccess('ImageGenerationService', 'clearCache', {}, result, startTime);
      
      return result;
    } catch (error) {
      console.error('清除快取失敗:', error);
      await LoggerService.apiError('ImageGenerationService', 'clearCache', {}, error, startTime);
      
      return {
        success: false,
        deletedCount: 0
      };
    }
  }

  /**
   * 從快取獲取圖片
   * @param songId 歌曲ID
   * @returns 快取中的圖片路徑 或 null
   */
  public static async getImageFromCache(songId: number): Promise<string | null> {
    try {
      // 首先檢查關聯表中是否有存儲的圖片
      const associatedImage = DatabaseService.getSongResource(songId, 'image');
      if (associatedImage) {
        // 檢查檔案是否存在
        try {
          await fs.access(associatedImage);
          // 文件存在，返回路徑
          return associatedImage;
        } catch (e) {
          // 文件不存在，嘗試尋找其他快取圖片
          console.log(`關聯的圖片檔案不存在: ${associatedImage}，嘗試尋找其他快取圖片`);
        }
      }
      
      // 查詢資料庫中的圖片記錄
      const db = DatabaseService.init();
      try {
        const stmt = db.prepare(`
          SELECT image_path FROM images 
          WHERE song_id = ? 
          ORDER BY created_at DESC 
          LIMIT 1
        `);
        const result = stmt.get(songId) as { image_path: string } | undefined;
        
        if (result && result.image_path) {
          const imagePath = result.image_path;
          
          // 檢查檔案是否存在
          try {
            await fs.access(imagePath);
            // 文件存在，返回路徑
            // 同時更新關聯表
            DatabaseService.saveSongResource(songId, 'image', imagePath);
            return imagePath;
          } catch (e) {
            // 文件不存在
            return null;
          }
        }
      } catch (dbError) {
        console.error('查詢圖片記錄失敗:', dbError);
      }
      
      return null;
    } catch (error) {
      console.error('從快取獲取圖片失敗:', error);
      return null;
    }
  }
} 