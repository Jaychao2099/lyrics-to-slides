/// <reference types="node" />
/// <reference types="electron" />

import { app, ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SettingsService } from './settings';
import { spawn } from 'child_process';

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
   * 向渲染進程發送日誌信息
   * @param type 日誌類型
   * @param message 日誌信息
   */
  private static log(message: string, type: 'info' | 'error' | 'warn' = 'info'): void {
    console[type](message); // 仍然保留控制台輸出以便調試
    
    // 發送到所有的渲染進程窗口
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('log-message', { type, message });
      }
    });
  }
  
  /**
   * 初始化臨時目錄
   */
  private static async initTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      this.log(`建立臨時目錄失敗: ${error}`, 'error');
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
      this.log(`匯出 PDF 失敗: ${error}`, 'error');
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
      this.log(`匯出 PPTX 失敗: ${error}`, 'error');
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
      this.log(`匯出 HTML 失敗: ${error}`, 'error');
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
      this.log(`批量匯出失敗: ${error}`, 'error');
      throw error;
    }
  }
  
  /**
   * 使用子進程執行 Marp CLI
   * @param args 命令參數
   * @returns Promise<void>
   */
  private static execMarpCli(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log(`準備執行 Marp CLI: ${args.join(' ')}`);
      
      const isWin = process.platform === 'win32';
      const marpCliPath = path.join(process.cwd(), 'node_modules', '.bin', isWin ? 'marp.cmd' : 'marp');
      
      this.log(`Marp CLI 路徑: ${marpCliPath}`);
      
      // 在 Windows 上使用 cmd.exe 執行
      const childProcess = isWin
        ? spawn('cmd.exe', ['/c', marpCliPath, ...args], { stdio: 'pipe' })
        : spawn(marpCliPath, args, { stdio: 'pipe' });
      
      let stdoutData = '';
      let stderrData = '';
      
      childProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        this.log(`Marp CLI 輸出: ${data.toString()}`);
      });
      
      childProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        this.log(`Marp CLI 錯誤: ${data.toString()}`, 'error');
      });
      
      childProcess.on('close', (code) => {
        this.log(`Marp CLI 進程結束，退出碼: ${code}`);
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`匯出失敗，退出碼: ${code}, 錯誤信息: ${stderrData}`));
        }
      });
      
      childProcess.on('error', (err) => {
        this.log(`Marp CLI 執行錯誤: ${err}`, 'error');
        reject(err);
      });
    });
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
      this.log(`開始匯出為 ${format} 格式...`);
      
      // 初始化臨時目錄
      await this.initTempDir();
      
      // 生成臨時檔案名稱和路徑
      const timestamp = Date.now();
      const tempFilePath = path.join(this.tempDir, `temp_slide_${timestamp}.md`);
      
      this.log(`臨時檔案路徑: ${tempFilePath}`);
      
      // 將 Marp 內容寫入臨時檔案
      await fs.writeFile(tempFilePath, marpContent, 'utf-8');
      
      // 確保輸出目錄存在
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // 根據格式決定輸出檔案名稱和命令參數
      const outputFileName = path.basename(outputPath, path.extname(outputPath));
      const finalOutputPath = path.join(outputDir, `${outputFileName}.${format}`);
      
      this.log(`最終輸出路徑: ${finalOutputPath}`);
      
      // 準備 Marp CLI 參數
      const marpArgs = [
        tempFilePath,
        `--${format}`,
        '--allow-local-files',
        '--output',
        finalOutputPath,
        '--no-stdin'
      ];
      
      // 執行 Marp CLI
      await this.execMarpCli(marpArgs);
      
      // 檢查輸出檔案是否存在
      try {
        await fs.access(finalOutputPath);
        this.log(`成功確認輸出檔案存在: ${finalOutputPath}`);
      } catch (error) {
        this.log(`輸出檔案不存在: ${finalOutputPath}`, 'error');
        throw new Error(`匯出文件不存在: ${finalOutputPath}`);
      }
      
      // 清理臨時檔案
      try {
        await fs.unlink(tempFilePath);
        this.log(`已清理臨時檔案: ${tempFilePath}`);
      } catch (e) {
        this.log(`清理臨時檔案失敗: ${tempFilePath}`, 'warn');
      }
      
      return finalOutputPath;
    } catch (error) {
      this.log(`匯出為 ${format} 失敗: ${error}`, 'error');
      throw error;
    }
  }
} 