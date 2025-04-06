/// <reference types="node" />
/// <reference types="electron" />

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DatabaseService } from './database';
import { SlideFormatter } from './slideFormatter';
import { LoggerService } from './logger';
import { SettingsService } from './settings';

/**
 * 批次投影片生成服務
 * 實現批次處理歌詞、生成投影片功能
 */
export class BatchSlideService {
  // 投影片批次快取目錄
  private static batchSlidesCacheDir = path.join(app.getPath('userData'), 'app_cache', 'batch_slides');

  /**
   * 初始化快取目錄
   */
  private static async initCacheDir(): Promise<void> {
    try {
      try {
        // 先檢查目錄是否存在
        await fs.access(this.batchSlidesCacheDir);
        // 目錄已存在，無需創建
      } catch (e) {
        // 目錄不存在，創建它
        await fs.mkdir(this.batchSlidesCacheDir, { recursive: true });
        console.log(`批次投影片快取目錄創建成功: ${this.batchSlidesCacheDir}`);
      }
    } catch (error) {
      console.error('建立批次投影片快取目錄失敗:', error);
      await LoggerService.error('建立批次投影片快取目錄失敗', error);
    }
  }

  /**
   * 生成批次投影片
   * @param slideSetId 投影片集ID
   * @returns 生成的Marp格式投影片內容
   */
  public static async generateBatchSlides(slideSetId: number): Promise<string> {
    const startTime = LoggerService.apiStart('BatchSlideService', 'generateBatchSlides', { slideSetId });

    try {
      // 確保快取目錄存在
      await this.initCacheDir();

      // 獲取投影片集中的所有歌曲
      const songs = DatabaseService.getSlideSetSongs(slideSetId);

      if (songs.length === 0) {
        throw new Error(`投影片集 ${slideSetId} 中沒有歌曲`);
      }

      // 準備合併所需信息
      const songInfoList = [];

      for (const song of songs) {
        // 獲取歌曲的背景圖片
        const imagePath = DatabaseService.getSongResource(song.id, 'image');
        if (!imagePath) {
          throw new Error(`歌曲 ${song.title} (ID: ${song.id}) 缺少背景圖片`);
        }

        songInfoList.push({
          lyrics: song.lyrics,
          imagePath,
          title: song.title,
          artist: song.artist
        });
      }

      // 獲取自定義Marp標頭
      const customHeader = SettingsService.getSetting('customMarpHeader');
      
      // 生成合併投影片
      let slidesContent = SlideFormatter.generateBatchSlides(songInfoList, customHeader as string);
      
      // 修復圖片路徑
      slidesContent = this.fixImagePathsInSlides(slidesContent);

      // 保存到快取
      const filePath = path.join(this.batchSlidesCacheDir, `set_${slideSetId}.md`);
      await fs.writeFile(filePath, slidesContent, 'utf-8');

      // 更新投影片集
      const db = DatabaseService.init();
      const now = new Date().toISOString();
      db.prepare('UPDATE slide_sets SET updated_at = ? WHERE id = ?').run(now, slideSetId);

      // 記錄成功
      await LoggerService.apiSuccess(
        'BatchSlideService', 
        'generateBatchSlides', 
        { slideSetId, songCount: songs.length }, 
        { slidesContentLength: slidesContent.length }, 
        startTime
      );

      return slidesContent;
    } catch (error) {
      console.error('生成批次投影片失敗:', error);
      await LoggerService.apiError('BatchSlideService', 'generateBatchSlides', { slideSetId }, error, startTime);
      throw error;
    }
  }

  /**
   * 處理投影片內容中的圖片路徑
   * @param slidesContent 投影片內容
   * @returns 處理後的投影片內容
   */
  private static fixImagePathsInSlides(slidesContent: string): string {
    // 修復路徑分隔符，將 \ 替換為 /
    return slidesContent.replace(/!\[bg\]\((.*?)\)/g, (match, imagePath) => {
      // 替換所有反斜線為正斜線
      let fixedPath = imagePath.replace(/\\/g, '/');
      return `![bg](${fixedPath})`;
    });
  }

  /**
   * 從快取獲取批次投影片內容
   * @param slideSetId 投影片集ID
   * @returns 快取的Marp格式投影片內容或null
   */
  public static async getBatchSlidesFromCache(slideSetId: number): Promise<string | null> {
    try {
      // 確保快取目錄存在
      await this.initCacheDir();

      // 檢查檔案是否存在
      const filePath = path.join(this.batchSlidesCacheDir, `set_${slideSetId}.md`);
      
      try {
        await fs.access(filePath);
        // 文件存在，讀取檔案內容
        const content = await fs.readFile(filePath, 'utf-8');
        // 修復圖片路徑
        return this.fixImagePathsInSlides(content);
      } catch (e) {
        // 檔案不存在
        return null;
      }
    } catch (error) {
      console.error('從快取獲取批次投影片失敗:', error);
      return null;
    }
  }

  /**
   * 獲取批次投影片內容
   * @param slideSetId 投影片集ID
   * @returns Marp格式的投影片內容
   */
  public static async getBatchSlideContent(slideSetId: number): Promise<string> {
    try {
      // 先嘗試從快取取得
      const cachedContent = await this.getBatchSlidesFromCache(slideSetId);
      if (cachedContent) {
        return cachedContent;
      }

      // 如果沒有快取，重新生成
      return await this.generateBatchSlides(slideSetId);
    } catch (error) {
      console.error('獲取批次投影片內容失敗:', error);
      throw error;
    }
  }

  /**
   * 清除批次投影片快取
   * @returns 清除結果
   */
  public static async clearCache(): Promise<{ success: boolean; deletedCount: number }> {
    const startTime = LoggerService.apiStart('BatchSlideService', 'clearCache', {});
    
    try {
      // 確保快取目錄存在
      await this.initCacheDir();
      
      // 讀取目錄中的所有檔案
      const files = await fs.readdir(this.batchSlidesCacheDir);
      let deletedCount = 0;
      
      // 刪除所有檔案
      for (const file of files) {
        try {
          const filePath = path.join(this.batchSlidesCacheDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        } catch (e) {
          await LoggerService.error(`無法刪除批次投影片快取檔案 ${file}`, e);
        }
      }
      
      const result = {
        success: true,
        deletedCount
      };
      
      await LoggerService.apiSuccess('BatchSlideService', 'clearCache', {}, result, startTime);
      
      return result;
    } catch (error) {
      console.error('清除批次投影片快取失敗:', error);
      await LoggerService.apiError('BatchSlideService', 'clearCache', {}, error, startTime);
      
      return {
        success: false,
        deletedCount: 0
      };
    }
  }

  /**
   * 獲取快取大小
   * @returns 快取大小信息（總大小和檔案數量）
   */
  public static async getCacheSize(): Promise<{ totalSizeBytes: number; totalSizeMB: string; fileCount: number }> {
    const startTime = LoggerService.apiStart('BatchSlideService', 'getCacheSize', {});
    
    try {
      // 確保快取目錄存在
      await this.initCacheDir();
      
      // 讀取目錄中的所有檔案
      const files = await fs.readdir(this.batchSlidesCacheDir);
      let totalSize = 0;
      let fileCount = 0;
      
      // 計算總大小
      for (const file of files) {
        try {
          const filePath = path.join(this.batchSlidesCacheDir, file);
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
      
      await LoggerService.apiSuccess('BatchSlideService', 'getCacheSize', {}, result, startTime);
      
      return result;
    } catch (error) {
      console.error('獲取快取大小失敗:', error);
      await LoggerService.apiError('BatchSlideService', 'getCacheSize', {}, error, startTime);
      throw error;
    }
  }
} 