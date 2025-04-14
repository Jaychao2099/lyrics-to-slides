/// <reference types="node" />
/// <reference types="electron" />

import { app, ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SettingsService } from './settings';
import { spawn } from 'child_process';
import { promises as fsPromises } from 'fs'; // Import fs promises

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
    return new Promise(async (resolve, reject) => {
      const marpExecutable = getMarpCliExecutablePath();
      this.log(`嘗試執行 Marp CLI: ${marpExecutable} ${args.join(' ')}`);

      try {
        // 檢查執行檔是否存在
        await fsPromises.access(marpExecutable);
      } catch (err) {
        this.log(`Marp CLI 執行檔未找到: ${marpExecutable}`, 'error');
        return reject(new Error(`Marp CLI 執行檔未找到: ${marpExecutable}`));
      }

      const childProcess = spawn(marpExecutable, args, { stdio: 'pipe' });

      let stdoutOutput = '';
      let stderrOutput = '';

      childProcess.stdout.on('data', (data) => {
        stdoutOutput += data.toString();
        this.log(`Marp stdout: ${data.toString().trim()}`);
      });

      childProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString();
        this.log(`Marp stderr: ${data.toString().trim()}`, 'warn'); // Log stderr as warning
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          this.log(`Marp CLI 執行成功 (退出碼 ${code})`);
          resolve();
        } else {
          this.log(`Marp CLI 執行失敗 (退出碼 ${code})`, 'error');
          this.log(`Marp stderr: ${stderrOutput}`, 'error');
          reject(new Error(`Marp CLI 退出碼: ${code}\n${stderrOutput}`));
        }
      });

      childProcess.on('error', (err) => {
        this.log(`執行 Marp CLI 時發生錯誤: ${err.message}`, 'error');
        reject(err);
      });
    });
  }
  
  /**
   * 嘗試使用 Node 執行 Marp CLI
   */
  /* // REMOVE THIS METHOD
  private static tryExecNodeWithMarpCli(
    args: string[], 
    resolve: () => void, 
    reject: (error: Error) => void
  ): void {
    // ... implementation ...
  }
  */

  /**
   * 按順序嘗試多個路徑
   */
  /* // REMOVE THIS METHOD
  private static async tryPathsSequentially(
    paths: string[],
    index: number,
    args: string[],
    resolve: () => void,
    reject: (error: Error) => void
  ): Promise<void> {
    // ... implementation ...
  }
  */

  /**
   * 嘗試執行全域 marp 命令
   */
  /* // REMOVE THIS METHOD
  private static tryGlobalMarpCommand(
    args: string[], 
    resolve: () => void, 
    reject: (error: Error) => void
  ): void {
    // ... implementation ...
  }
  */

  /**
   * 匯出為指定格式
   * @param marpContent Marp格式的投影片內容
   * @param outputPath 輸出路徑
   * @param format 格式 ('pdf', 'pptx', 'html')
   * @returns 完整輸出路徑
   */
  private static async exportToFormat(
    marpContent: string, 
    outputPath: string, 
    format: string
  ): Promise<string> {
    await this.initTempDir();
    const tempInputFile = path.join(this.tempDir, `export_input_${Date.now()}.md`);
    const finalOutputPath = `${outputPath}.${format}`;

    try {
      // 寫入臨時 Markdown 文件
      await fs.writeFile(tempInputFile, marpContent, 'utf-8');
      this.log(`臨時 Markdown 文件已創建: ${tempInputFile}`);

      // 準備 Marp CLI 參數
      const marpArgs = [
        tempInputFile,
        `--${format}`,
        '--allow-local-files',
        '--output',
        finalOutputPath,
        '--theme-set',
        'default', // 確保使用默認主題
        '--no-stdin'
      ];

      // 執行 Marp CLI
      await this.execMarpCli(marpArgs);

      // 檢查輸出文件是否存在
      await fs.access(finalOutputPath);
      this.log(`匯出成功: ${finalOutputPath}`);

      return finalOutputPath;
    } catch (error) {
      this.log(`匯出 ${format.toUpperCase()} 失敗: ${error}`, 'error');
      throw error;
    } finally {
      // 清理臨時文件
      try {
        await fs.unlink(tempInputFile);
        this.log(`臨時文件已刪除: ${tempInputFile}`);
      } catch (cleanupError) {
        this.log(`刪除臨時文件失敗: ${cleanupError}`, 'warn');
      }
    }
  }
}

// Helper function to get Marp CLI path (copied from main/index.ts)
function getMarpCliExecutablePath(): string {
  const platform = process.platform;
  // Standalone executable name (assuming you placed marp.exe in 'executables')
  const exeName = platform === 'win32' ? 'marp.exe'
                 : platform === 'darwin' ? 'marp-cli-macos' // Adjust if you downloaded macOS binary
                 : 'marp-cli-linux';   // Adjust if you downloaded Linux binary

  if (app.isPackaged) {
    // In packaged app, point to the path defined in extraResources (to: 'bin')
    const exeDir = path.join(process.resourcesPath, 'bin');
    return path.join(exeDir, exeName);
  } else {
    // In development, point to the executable in the 'executables' directory
    return path.join(app.getAppPath(), 'executables', exeName);
  }
} 