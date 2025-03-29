/// <reference types="node" />
/// <reference types="electron" />

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SettingsService } from './settings';

// 將 exec 轉換為 Promise 版本
const execAsync = promisify(exec);

/**
 * 投影片匯出服務
 * 實現規格書中第3.4節的功能
 */
export class SlideExportService {
  // 臨時目錄
  private static tempDir = path.join(app.getPath('temp'), 'lyrics-to-slides');
  
  /**
   * 初始化臨時目錄
   */
  private static async initTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('建立臨時目錄失敗:', error);
    }
  }
  
  /**
   * 匯出為 PDF 格式
   * @param marpContent Marp格式的投影片內容
   * @param outputPath 輸出路徑
   * @returns 完整輸出路徑
   */
  public static async exportToPDF(marpContent: string, outputPath: string): Promise<string> {
    try {
      return await this.exportToFormat(marpContent, outputPath, 'pdf');
    } catch (error) {
      console.error('匯出 PDF 失敗:', error);
      throw error;
    }
  }
  
  /**
   * 匯出為 PPTX 格式
   * @param marpContent Marp格式的投影片內容
   * @param outputPath 輸出路徑
   * @returns 完整輸出路徑
   */
  public static async exportToPPTX(marpContent: string, outputPath: string): Promise<string> {
    try {
      return await this.exportToFormat(marpContent, outputPath, 'pptx');
    } catch (error) {
      console.error('匯出 PPTX 失敗:', error);
      throw error;
    }
  }
  
  /**
   * 匯出為 HTML 格式
   * @param marpContent Marp格式的投影片內容
   * @param outputPath 輸出路徑
   * @returns 完整輸出路徑
   */
  public static async exportToHTML(marpContent: string, outputPath: string): Promise<string> {
    try {
      return await this.exportToFormat(marpContent, outputPath, 'html');
    } catch (error) {
      console.error('匯出 HTML 失敗:', error);
      throw error;
    }
  }
  
  /**
   * 批量匯出多種格式
   * @param marpContent Marp格式的投影片內容
   * @param formats 格式列表 ['pdf', 'pptx', 'html']
   * @param outputPath 輸出路徑
   * @returns 匯出結果物件
   */
  public static async batchExport(
    marpContent: string, 
    formats: string[], 
    outputPath: string
  ): Promise<Record<string, string>> {
    try {
      const results: Record<string, string> = {};
      
      for (const format of formats) {
        const result = await this.exportToFormat(marpContent, outputPath, format);
        results[format] = result;
      }
      
      return results;
    } catch (error) {
      console.error('批量匯出失敗:', error);
      throw error;
    }
  }
  
  /**
   * 匯出為指定格式
   * @param marpContent Marp格式的投影片內容
   * @param outputPath 輸出路徑
   * @param format 輸出格式 ('pdf', 'pptx', 'html')
   * @returns 完整輸出路徑
   */
  private static async exportToFormat(
    marpContent: string, 
    outputPath: string, 
    format: string
  ): Promise<string> {
    try {
      // 初始化臨時目錄
      await this.initTempDir();
      
      // 生成臨時檔案名稱和路徑
      const timestamp = Date.now();
      const tempFilePath = path.join(this.tempDir, `temp_slide_${timestamp}.md`);
      
      // 將 Marp 內容寫入臨時檔案
      await fs.writeFile(tempFilePath, marpContent, 'utf-8');
      
      // 確保輸出目錄存在
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // 根據格式決定輸出檔案名稱和命令參數
      const outputFileName = path.basename(outputPath, path.extname(outputPath));
      const finalOutputPath = path.join(outputDir, `${outputFileName}.${format}`);
      
      // 執行 Marp CLI 命令
      const { stdout, stderr } = await execAsync(
        `npx @marp-team/marp-cli ${tempFilePath} --${format} --allow-local-files --output ${finalOutputPath}`
      );
      
      if (stderr && !stderr.includes('INFO')) {
        throw new Error(`匯出過程中發生錯誤: ${stderr}`);
      }
      
      // 檢查輸出檔案是否存在
      await fs.access(finalOutputPath);
      
      // 清理臨時檔案
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        console.warn('清理臨時檔案失敗:', e);
      }
      
      return finalOutputPath;
    } catch (error) {
      console.error(`匯出為 ${format} 失敗:`, error);
      throw error;
    }
  }
} 