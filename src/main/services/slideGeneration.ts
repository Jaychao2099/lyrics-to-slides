/// <reference types="node" />
/// <reference types="electron" />

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import OpenAI from 'openai';
import { SettingsService } from './settings';
import { DatabaseService } from './database';
import { LoggerService } from './logger';

/**
 * 投影片生成服務
 * 實現規格書中第3.3節的功能
 */
export class SlideGenerationService {
  // OpenAI 實例
  private static openai: OpenAI | null = null;
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

      // 檢查快取中是否已有此歌曲的投影片內容
      const cachedSlides = await this.getSlidesFromCache(songId);
      if (cachedSlides) {
        return cachedSlides;
      }

      // 初始化 OpenAI API
      if (!this.openai) {
        await this.initOpenAI();
      }
      
      if (!this.openai) {
        throw new Error('無法初始化 OpenAI API');
      }

      // 獲取投影片生成提示詞模板
      const promptTemplate = SettingsService.getSetting('slidesPromptTemplate') || 
        `請將以下歌詞轉換為符合 Marp 投影片格式的 Markdown。請遵循以下要求：
1. 仔細判斷歌詞的段落屬性(如主歌、副歌...)，注意：用"空格"分開的句子算同一行。根據段落分段後(每段最多四行)，將每個段落放在一張投影片上，並使用"---"作為投影片分隔符
2. 在每張投影片頂部加入背景圖片：![bg]({{imageUrl}})
3. 不要添加任何不在原歌詞中的內容
4. 每首歌的第一張投影片顯示"# 歌曲標題"
5. 每行歌詞開頭用"# "標註
6. 輸出時不需要任何額外的解釋、說明、"\`\`\`markdown"等字符，僅輸出純 Markdown 內容
範例：
---
marp: true
color: "black"
style: |
  section {
    text-align: center;
  }
  h1 {
    -webkit-text-stroke: 0.2px white;
  }

---

![bg](./images/test-bg1.png)

# 第一首歌曲名稱

---

![bg](./images/test-bg1.png)

# 第一行歌詞
# 第二行歌詞
# 第三行歌詞
# 第四行歌詞

---

![bg](./images/test-bg2.png)

# 第二首歌曲名稱

---

![bg](./images/test-bg2.png)

# 第一行歌詞
# 第二行歌詞

歌詞內容：
{{lyrics}}`;

      // 替換提示詞中的變數
      const relativePath = path.relative(this.slidesCacheDir, imagePath)
        .replace(/\\/g, '/'); // 轉換路徑分隔符為正斜線
      
      const finalPrompt = promptTemplate
        .replace('{{lyrics}}', lyrics)
        .replace('{{imageUrl}}', imagePath) // 使用絕對路徑
        .replace('{{songTitle}}', songTitle)
        .replace('{{artist}}', artist);
      
      // 記錄生成投影片的提示詞
      await LoggerService.info(`生成投影片的提示詞: ${finalPrompt.substring(0, 100)}...`);

      // 生成投影片內容
      if (!this.openai) {
        throw new Error('OpenAI API未初始化');
      }
      
      // 記錄 OpenAI API 請求
      const openaiStartTime = LoggerService.apiStart('OpenAI', 'chat.completions.create', { 
        model: "gpt-4o-mini",
        prompt: finalPrompt.substring(0, 100) + '...',
        promptLength: finalPrompt.length
      });
      
      let response;
      try {
        response = await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "你是一個專業的文件轉換助手，專精於將歌詞轉換成符合Marp投影片格式的Markdown文件。"
            },
            { role: "user", content: finalPrompt }
          ],
          temperature: 0.7,
        });
        
        await LoggerService.apiSuccess('OpenAI', 'chat.completions.create', 
          { 
            model: "gpt-4o-mini", 
            prompt: finalPrompt,
            promptLength: finalPrompt.length
          }, 
          { 
            content: response?.choices?.[0]?.message?.content ? '有內容' : '無內容',
            contentLength: response?.choices?.[0]?.message?.content?.length || 0
          }, 
          openaiStartTime
        );
      } catch (apiError) {
        await LoggerService.apiError('OpenAI', 'chat.completions.create', 
          { 
            model: "gpt-4o-mini", 
            prompt: finalPrompt,
            promptLength: finalPrompt.length
          }, 
          apiError, 
          openaiStartTime
        );
        throw apiError;
      }

      const slidesContent = response.choices[0].message.content;
      
      if (!slidesContent) {
        throw new Error('投影片生成失敗');
      }

      // 修復圖片路徑
      const fixedSlidesContent = this.fixImagePathsInSlides(slidesContent);

      // 儲存投影片內容到快取
      await this.saveSlidesToCache(songId, fixedSlidesContent);
      
      // 更新歌曲記錄
      const db = DatabaseService.init();
      const updateStmt = db.prepare('UPDATE songs SET slide_content = ?, updated_at = ? WHERE id = ?');
      updateStmt.run(fixedSlidesContent, new Date().toISOString(), songId);
      
      // 記錄成功
      await LoggerService.apiSuccess('SlideGenerationService', 'generateSlides', 
        { songId, songTitle, artist, lyricsLength: lyrics?.length }, 
        { slidesContentLength: fixedSlidesContent.length }, 
        startTime
      );

      return fixedSlidesContent;
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
      fixedPath = fixedPath.replace(/\/cache\//i, '/Cache/');
      
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
} 