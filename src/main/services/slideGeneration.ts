/// <reference types="node" />
/// <reference types="electron" />

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import OpenAI from 'openai';
import { SettingsService } from './settings';
import { DatabaseService } from './database';

/**
 * 投影片生成服務
 * 實現規格書中第3.3節的功能
 */
export class SlideGenerationService {
  // OpenAI 實例
  private static openai: OpenAI | null = null;
  // 投影片緩存目錄
  private static slidesCacheDir = path.join(app.getPath('userData'), 'cache', 'slides');

  /**
   * 初始化緩存目錄
   */
  private static async initCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.slidesCacheDir, { recursive: true });
    } catch (error) {
      console.error('建立投影片緩存目錄失敗:', error);
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
    try {
      // 確保緩存目錄存在
      await this.initCacheDir();

      // 檢查緩存中是否已有此歌曲的投影片內容
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
        `你是一個專業的文件轉換助手，專精於將歌詞轉換成符合Marp投影片格式的Markdown文件。請遵循以下要求：
        
        1. 將每個段落或每2-3行歌詞放在一張投影片上
        2. 使用"---"作為投影片分隔符
        3. 在每張投影片頂部加入背景圖片：![bg]({{imageUrl}})
        4. 文字應置中顯示，使用大字體
        5. 文字顏色應確保在背景上清晰可見，請使用白色並添加陰影
        6. 不要添加任何不在原歌詞中的內容
        7. 第一張投影片顯示歌曲標題和歌手名稱(如有提供)
        
        歌詞內容：
        {{lyrics}}`;

      // 替換提示詞中的變數
      const relativePath = path.relative(this.slidesCacheDir, imagePath)
        .replace(/\\/g, '/'); // 轉換路徑分隔符為正斜線
      
      const finalPrompt = promptTemplate
        .replace('{{lyrics}}', lyrics)
        .replace('{{imageUrl}}', relativePath)
        .replace('{{songTitle}}', songTitle)
        .replace('{{artist}}', artist);

      // 生成投影片內容
      const response = await this.openai.chat.completions.create({
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

      const slidesContent = response.choices[0].message.content;
      
      if (!slidesContent) {
        throw new Error('投影片生成失敗');
      }

      // 儲存投影片內容到緩存
      await this.saveSlidesToCache(songId, slidesContent);
      
      // 更新歌曲記錄
      const db = DatabaseService.init();
      const updateStmt = db.prepare('UPDATE songs SET slide_content = ?, updated_at = ? WHERE id = ?');
      updateStmt.run(slidesContent, new Date().toISOString(), songId);

      return slidesContent;
    } catch (error) {
      console.error('生成投影片失敗:', error);
      throw error;
    }
  }

  /**
   * 將投影片內容保存到緩存
   * @param songId 歌曲ID
   * @param slidesContent Marp格式的投影片內容
   */
  private static async saveSlidesToCache(songId: number, slidesContent: string): Promise<void> {
    try {
      const filePath = path.join(this.slidesCacheDir, `${songId}.md`);
      await fs.writeFile(filePath, slidesContent, 'utf-8');
    } catch (error) {
      console.error('保存投影片到緩存失敗:', error);
      throw error;
    }
  }

  /**
   * 從緩存獲取投影片內容
   * @param songId 歌曲ID
   * @returns Marp格式的投影片內容 或 null
   */
  public static async getSlidesFromCache(songId: number): Promise<string | null> {
    try {
      const filePath = path.join(this.slidesCacheDir, `${songId}.md`);
      
      try {
        // 檢查檔案是否存在
        await fs.access(filePath);
        // 讀取檔案內容
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
      } catch (e) {
        // 檔案不存在
        return null;
      }
    } catch (error) {
      console.error('從緩存獲取投影片失敗:', error);
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
      // 更新緩存中的投影片內容
      await this.saveSlidesToCache(songId, slidesContent);
      
      // 更新歌曲記錄
      const db = DatabaseService.init();
      const updateStmt = db.prepare('UPDATE songs SET slide_content = ?, updated_at = ? WHERE id = ?');
      updateStmt.run(slidesContent, new Date().toISOString(), songId);
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
} 