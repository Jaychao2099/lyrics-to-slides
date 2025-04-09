/// <reference types="node" />
/// <reference types="electron" />

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { SettingsService } from './settings';
import { DatabaseService } from './database';
import { LoggerService } from './logger';

/**
 * 投影片生成服務
 * 實現規格書中第3.3節的功能
 */
export class SlideGenerationService {
  // 投影片快取目錄
  private static slidesCacheDir = path.join(app.getPath('userData'), 'app_cache', 'slides');

  /**
   * 初始化快取目錄
   */
  private static async initCacheDir(): Promise<void> {
    try {
      try {
        // 先檢查目錄是否存在
        await fs.access(this.slidesCacheDir);
        // 目錄已存在，無需創建
      } catch (e) {
        // 目錄不存在，創建它
        await fs.mkdir(this.slidesCacheDir, { recursive: true });
        console.log(`投影片快取目錄創建成功: ${this.slidesCacheDir}`);
      }
    } catch (error) {
      console.error('建立投影片快取目錄失敗:', error);
      await LoggerService.error('建立投影片快取目錄失敗', error);
    }
  }

  /**
   * 生成投影片內容
   * @param songId 歌曲ID
   * @param songTitle 歌曲標題
   * @param artist 歌手名稱
   * @param lyrics 歌詞內容
   * @param imagePath 背景圖片路徑
   * @returns Marp格式的投影片內容
   */
  public static async generateSlides(
    songId: number,
    songTitle: string,
    artist: string,
    lyrics: string,
    imagePath: string
  ): Promise<string> {
    const startTime = LoggerService.apiStart('SlideGenerationService', 'generateSlides', { songId, songTitle, artist, lyricsLength: lyrics?.length });
    try {
      // 確保快取目錄存在
      await this.initCacheDir();

      // --- DEBUG: 暫時移除快取檢查，強制重新生成 ---
      // const cachedSlides = await this.getSlidesFromCache(songId);
      // if (cachedSlides) {
      //   // 記錄一下命中了快取
      //   await LoggerService.info(`Slide generation for song ${songId} hit cache.`);
      //   return cachedSlides;
      // }
      // --- END DEBUG ---

      // 記錄將要用於生成投影片的參數
      await LoggerService.info(`Generating slides for song ${songId}. Title: ${songTitle}, Artist: ${artist}, Lyrics length: ${lyrics?.length || 0}, Image path: ${imagePath}`);

      // 使用 SlideFormatter 生成投影片內容
      const customHeader = SettingsService.getSetting('customMarpHeader');
      
      // 導入 SlideFormatter 服務
      const { SlideFormatter } = require('./slideFormatter');
      
      // 獲取歌曲的文字格式設定
      const song = DatabaseService.getSongById(songId);
      if (!song) {
        throw new Error(`找不到歌曲 ${songId}`);
      }
      
      // 生成投影片內容
      const slidesContent = SlideFormatter.formatSong(
        lyrics, 
        imagePath, 
        songTitle,
        song.textColor,
        song.strokeColor,
        song.strokeSize
      );
      
      // 組合完整內容，加上自定義標頭
      const fullSlidesContent = SlideFormatter.generateMarpHeader(customHeader as string) + slidesContent;

      // 儲存投影片內容到快取
      await this.saveSlidesToCache(songId, fullSlidesContent);
      
      // 更新歌曲記錄
      const db = DatabaseService.init();
      const updateStmt = db.prepare('UPDATE songs SET slide_content = ?, updated_at = ? WHERE id = ?');
      updateStmt.run(fullSlidesContent, new Date().toISOString(), songId);
      
      // 記錄成功
      await LoggerService.apiSuccess('SlideGenerationService', 'generateSlides', 
        { songId, songTitle, artist, lyricsLength: lyrics?.length }, 
        { slidesContentLength: fullSlidesContent.length }, 
        startTime
      );

      return fullSlidesContent;
    } catch (error) {
      console.error('生成投影片失敗:', error);
      await LoggerService.apiError('SlideGenerationService', 'generateSlides', 
        { songId, songTitle, artist, lyricsLength: lyrics?.length }, 
        error, 
        startTime
      );
      throw error;
    }
  }

  /**
   * 將投影片內容保存到快取
   * @param songId 歌曲ID
   * @param slidesContent Marp格式的投影片內容
   */
  private static async saveSlidesToCache(songId: number, slidesContent: string): Promise<void> {
    try {
      const filePath = path.join(this.slidesCacheDir, `${songId}.md`);
      await fs.writeFile(filePath, slidesContent, 'utf-8');
      
      // 保存投影片與歌曲的關聯
      DatabaseService.saveSongResource(songId, 'slide', filePath);
    } catch (error) {
      console.error('保存投影片到快取失敗:', error);
      throw error;
    }
  }

  /**
   * 處理投影片內容中的圖片路徑
   * 將 backslash (\) 轉換為 forward slash (/)，並確保 Cache 目錄名稱大小寫正確
   * @param slidesContent 投影片內容
   * @returns 處理後的投影片內容
   */
  public static fixImagePathsInSlides(slidesContent: string): string {
    // 修復路徑分隔符，將 \ 替換為 /
    let fixedContent = slidesContent.replace(/!\[bg\]\((.*?)\)/g, (match, imagePath) => {
      // 替換所有反斜線為正斜線
      let fixedPath = imagePath.replace(/\\/g, '/');
      
      // 確保 "cache" 目錄名稱為大寫 "Cache"
      // fixedPath = fixedPath.replace(/\/cache\//i, '/Cache/');
      
      return `![bg](${fixedPath})`;
    });
    
    return fixedContent;
  }

  /**
   * 從快取獲取投影片內容
   * @param songId 歌曲ID
   * @returns Marp格式的投影片內容 或 null
   */
  public static async getSlidesFromCache(songId: number): Promise<string | null> {
    try {
      // 首先檢查關聯表中是否有存儲的投影片
      const associatedSlide = DatabaseService.getSongResource(songId, 'slide');
      if (associatedSlide) {
        // 檢查檔案是否存在
        try {
          await fs.access(associatedSlide);
          // 文件存在，讀取檔案內容
          const content = await fs.readFile(associatedSlide, 'utf-8');
          // 修復圖片路徑
          return this.fixImagePathsInSlides(content);
        } catch (e) {
          // 文件不存在，嘗試尋找其他快取投影片
          console.log(`關聯的投影片檔案不存在: ${associatedSlide}，嘗試尋找其他快取投影片`);
        }
      }
      
      // 嘗試使用常規快取路徑
      const filePath = path.join(this.slidesCacheDir, `${songId}.md`);
      
      try {
        // 檢查檔案是否存在
        await fs.access(filePath);
        // 讀取檔案內容
        const content = await fs.readFile(filePath, 'utf-8');
        // 同時更新關聯表
        DatabaseService.saveSongResource(songId, 'slide', filePath);
        // 修復圖片路徑
        return this.fixImagePathsInSlides(content);
      } catch (e) {
        // 檔案不存在
        return null;
      }
    } catch (error) {
      console.error('從快取獲取投影片失敗:', error);
      return null;
    }
  }

  /**
   * 更新投影片內容
   * @param songId 歌曲ID
   * @param slidesContent 新的Marp格式投影片內容
   */
  public static async updateSlides(songId: number, slidesContent: string): Promise<void> {
    try {
      // 修復圖片路徑
      const fixedSlidesContent = this.fixImagePathsInSlides(slidesContent);
      
      // 更新快取中的投影片內容
      await this.saveSlidesToCache(songId, fixedSlidesContent);
      
      // 更新歌曲記錄
      const db = DatabaseService.init();
      const updateStmt = db.prepare('UPDATE songs SET slide_content = ?, updated_at = ? WHERE id = ?');
      updateStmt.run(fixedSlidesContent, new Date().toISOString(), songId);
    } catch (error) {
      console.error('更新投影片失敗:', error);
      throw error;
    }
  }

  /**
   * 預覽投影片(未實現，留給渲染進程)
   * @param slidesContent Marp格式的投影片內容
   */
  public static async previewSlides(slidesContent: string): Promise<void> {
    // 此功能留給渲染進程實現，因為需要在UI中顯示
    console.log('預覽投影片功能由渲染進程實現');
  }

  /**
   * 獲取快取大小
   * @returns 快取大小信息（總大小和檔案數量）
   */
  public static async getCacheSize(): Promise<{ totalSizeBytes: number; totalSizeMB: string; fileCount: number }> {
    const startTime = LoggerService.apiStart('SlideGenerationService', 'getCacheSize', {});
    
    try {
      // 確保快取目錄存在
      await this.initCacheDir();
      
      // 讀取目錄中的所有檔案
      const files = await fs.readdir(this.slidesCacheDir);
      let totalSize = 0;
      let fileCount = 0;
      
      // 計算總大小
      for (const file of files) {
        try {
          const filePath = path.join(this.slidesCacheDir, file);
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
      
      await LoggerService.apiSuccess('SlideGenerationService', 'getCacheSize', {}, result, startTime);
      
      return result;
    } catch (error) {
      console.error('獲取快取大小失敗:', error);
      await LoggerService.apiError('SlideGenerationService', 'getCacheSize', {}, error, startTime);
      throw error;
    }
  }

  /**
   * 清除投影片快取
   * @returns 清除結果
   */
  public static async clearCache(): Promise<{ success: boolean; deletedCount: number }> {
    const startTime = LoggerService.apiStart('SlideGenerationService', 'clearCache', {});
    
    try {
      // 確保快取目錄存在
      await this.initCacheDir();
      
      // 讀取目錄中的所有檔案
      const files = await fs.readdir(this.slidesCacheDir);
      let deletedCount = 0;
      
      // 刪除所有檔案
      for (const file of files) {
        try {
          const filePath = path.join(this.slidesCacheDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        } catch (e) {
          await LoggerService.error(`無法刪除快取檔案 ${file}`, e);
        }
      }
      
      // 清除資料庫中的投影片記錄
      try {
        const db = DatabaseService.init();
        
        // 先檢查表是否存在
        const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='slides'").get();
        
        if (tableExists) {
          const deleteQuery = 'DELETE FROM slides';
          await LoggerService.logDatabaseOperation('刪除', deleteQuery, []);
          db.prepare(deleteQuery).run();
          await LoggerService.info('清除資料庫中的投影片記錄成功');
        } else {
          await LoggerService.info('slides 表不存在，跳過資料庫清理');
        }
        
        // 清除投影片資源關聯記錄
        await LoggerService.info('清除投影片關聯記錄');
        DatabaseService.clearSongResourcesByType('slide');
      } catch (dbError) {
        await LoggerService.error('清除資料庫中的投影片記錄失敗', dbError);
      }
      
      const result = {
        success: true,
        deletedCount
      };
      
      await LoggerService.apiSuccess('SlideGenerationService', 'clearCache', {}, result, startTime);
      
      return result;
    } catch (error) {
      console.error('清除快取失敗:', error);
      await LoggerService.apiError('SlideGenerationService', 'clearCache', {}, error, startTime);
      
      return {
        success: false,
        deletedCount: 0
      };
    }
  }

  /**
   * 批次生成投影片內容
   * @param slideSetId 投影片集ID
   * @returns 生成的Marp格式投影片內容
   */
  public static async generateBatchSlides(slideSetId: number): Promise<string> {
    const startTime = LoggerService.apiStart('SlideGenerationService', 'generateBatchSlides', { slideSetId });
    try {
      // 確保快取目錄存在
      await this.initCacheDir();
      
      // 定義查詢結果的類型
      interface SongQueryResult {
        song_id: number;
        display_order: number;
        title: string;
        artist: string;
        lyrics: string;
      }
      
      // 獲取投影片集中的所有歌曲
      const db = DatabaseService.init();
      const slideSetSongs = db.prepare(`
        SELECT ss.song_id, ss.display_order, s.title, s.artist, s.lyrics 
        FROM slide_set_songs ss
        JOIN songs s ON ss.song_id = s.id
        WHERE ss.slide_set_id = ?
        ORDER BY ss.display_order
      `).all(slideSetId) as SongQueryResult[];
      
      if (!slideSetSongs || slideSetSongs.length === 0) {
        throw new Error(`投影片集 ${slideSetId} 中沒有歌曲`);
      }
      
      // 準備歌曲信息列表
      const songInfoList = [];
      
      for (const songItem of slideSetSongs) {
        const songId = songItem.song_id;
        
        // 檢查是否有關聯的圖片
        const imagePath = DatabaseService.getSongResource(songId, 'image');
        if (!imagePath) {
          throw new Error(`歌曲 ${songItem.title} (ID: ${songId}) 沒有關聯的圖片`);
        }
        
        // 添加到歌曲信息列表
        songInfoList.push({
          title: songItem.title,
          artist: songItem.artist,
          lyrics: songItem.lyrics,
          imagePath
        });
      }
      
      // 使用 SlideFormatter 批次生成投影片內容
      const { SlideFormatter } = require('./slideFormatter');
      
      // 獲取自定義 Marp 標頭
      const customHeader = SettingsService.getSetting('customMarpHeader');
      
      // 生成完整的投影片內容
      let slideContent = SlideFormatter.generateBatchSlides(songInfoList, customHeader as string);
      
      // 修復圖片路徑
      slideContent = this.fixImagePathsInSlides(slideContent);
      
      // 將生成的投影片內容儲存到批次快取中
      const batchSlideCachePath = path.join(this.slidesCacheDir, `batch_${slideSetId}.md`);
      await fs.writeFile(batchSlideCachePath, slideContent, 'utf-8');
      
      // 記錄成功信息
      await LoggerService.apiSuccess('SlideGenerationService', 'generateBatchSlides', 
        { slideSetId, songCount: songInfoList.length }, 
        { slidesContentLength: slideContent.length },
        startTime
      );
      
      return slideContent;
    } catch (error) {
      console.error('批次生成投影片失敗:', error);
      await LoggerService.apiError('SlideGenerationService', 'generateBatchSlides', 
        { slideSetId }, 
        error, 
        startTime
      );
      throw error;
    }
  }
  
  /**
   * 獲取批次投影片內容
   * @param slideSetId 投影片集ID
   * @returns 批次生成的Marp格式投影片內容
   */
  public static async getBatchSlideContent(slideSetId: number): Promise<string> {
    try {
      // 嘗試從快取中獲取批次生成的投影片
      const batchSlideCachePath = path.join(this.slidesCacheDir, `batch_${slideSetId}.md`);
      
      try {
        // 檢查檔案是否存在
        await fs.access(batchSlideCachePath);
        // 檔案存在，讀取內容
        const content = await fs.readFile(batchSlideCachePath, 'utf-8');
        // 修復圖片路徑
        return this.fixImagePathsInSlides(content);
      } catch (e) {
        // 快取不存在，重新生成
        return await this.generateBatchSlides(slideSetId);
      }
    } catch (error) {
      console.error('獲取批次投影片內容失敗:', error);
      throw error;
    }
  }
  
  /**
   * 預覽批次投影片
   * @param slideSetId 投影片集ID
   */
  public static async previewBatchSlides(slideSetId: number): Promise<void> {
    try {
      // 獲取批次投影片內容
      const slideContent = await this.getBatchSlideContent(slideSetId);
      // 此功能留給渲染進程實現
      console.log('預覽批次投影片功能由渲染進程實現');
    } catch (error) {
      console.error('預覽批次投影片失敗:', error);
      throw error;
    }
  }
  
  /**
   * 匯出批次投影片
   * @param slideSetId 投影片集ID
   * @param outputPath 輸出路徑
   * @param format 輸出格式
   * @returns 匯出的檔案路徑
   */
  public static async exportBatchSlides(slideSetId: number, outputPath: string, format: string): Promise<string> {
    try {
      // 獲取批次投影片內容
      const slideContent = await this.getBatchSlideContent(slideSetId);
      
      // 根據格式匯出
      let exportPath = '';
      switch (format.toLowerCase()) {
        case 'pdf':
          // 使用 PDF 匯出服務匯出 - 實際實現可能需要另外的服務
          const { ExportService } = require('./export');
          exportPath = await ExportService.exportToPDF(slideContent, outputPath);
          break;
        case 'pptx':
          // 使用 PPTX 匯出服務匯出
          const { ExportService: ExportServicePPTX } = require('./export');
          exportPath = await ExportServicePPTX.exportToPPTX(slideContent, outputPath);
          break;
        case 'html':
          // 使用 HTML 匯出服務匯出
          const { ExportService: ExportServiceHTML } = require('./export');
          exportPath = await ExportServiceHTML.exportToHTML(slideContent, outputPath);
          break;
        default:
          throw new Error(`不支持的匯出格式: ${format}`);
      }
      
      return exportPath;
    } catch (error) {
      console.error('匯出批次投影片失敗:', error);
      throw error;
    }
  }
}