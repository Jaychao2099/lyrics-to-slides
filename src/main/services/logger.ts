/// <reference types="node" />
/// <reference types="electron" />

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { Stats } from 'fs';
import * as os from 'os';

/**
 * 日誌級別
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * 日誌輪替配置
 */
interface LogRotationConfig {
  maxFileSize: number; // 單一檔案最大大小 (bytes)
  maxFiles: number;    // 保留的日誌檔案數量
  maxDays: number;     // 保留的最大天數
}

/**
 * API 日誌記錄
 */
interface ApiLog {
  timestamp: string;
  service: string;
  method: string;
  request: any;
  response?: any;
  error?: any;
  duration?: number;
}

/**
 * 日誌服務
 * 用於記錄應用各模組的操作與API通訊，支援日誌輪替
 */
export class LoggerService {
  // 日誌目錄
  private static logDir = path.join(app.getPath('userData'), 'logs');
  
  // 日誌輪替配置
  private static rotationConfig: LogRotationConfig = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,                  // 保留10個檔案
    maxDays: 30                    // 保留30天
  };
  
  // 一般日誌檔案路徑
  private static getLogFilePath(): string {
    return path.join(this.logDir, `app_${new Date().toISOString().split('T')[0]}.log`);
  }
  
  // API通訊日誌檔案路徑
  private static getApiLogFilePath(): string {
    return path.join(this.logDir, `api_${new Date().toISOString().split('T')[0]}.log`);
  }

  /**
   * 初始化日誌目錄
   */
  private static async initLogDir(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('建立日誌目錄失敗:', error);
    }
  }
  
  /**
   * 檢查檔案大小，如果超過限制則進行輪替
   * @param filePath 檔案路徑
   * @param isApiLog 是否為API日誌
   */
  private static async checkFileSize(filePath: string, isApiLog: boolean): Promise<string> {
    try {
      // 如果檔案不存在，直接返回原路徑
      if (!fsSync.existsSync(filePath)) {
        return filePath;
      }
      
      const stats = await fs.stat(filePath);
      
      // 檢查檔案大小是否超過限制
      if (stats.size >= this.rotationConfig.maxFileSize) {
        // 建立新的輪替檔案名稱 (加上時間戳)
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const fileExt = path.extname(filePath);
        const fileBase = path.basename(filePath, fileExt);
        const newFilePath = path.join(path.dirname(filePath), `${fileBase}.${timestamp}${fileExt}`);
        
        // 生成新的日誌檔案路徑
        return newFilePath;
      }
      
      return filePath;
    } catch (error) {
      console.error('檢查檔案大小失敗:', error);
      return filePath;
    }
  }
  
  /**
   * 清理舊的日誌檔案
   */
  private static async cleanOldLogs(): Promise<void> {
    try {
      // 讀取日誌目錄下所有檔案
      const files = await fs.readdir(this.logDir);
      
      // 應用日誌和API日誌的檔案資訊
      const appLogs: { path: string, stats: Stats }[] = [];
      const apiLogs: { path: string, stats: Stats }[] = [];
      
      // 獲取每個檔案的資訊
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        
        if (file.startsWith('app_')) {
          appLogs.push({ path: filePath, stats });
        } else if (file.startsWith('api_')) {
          apiLogs.push({ path: filePath, stats });
        }
      }
      
      // 清理舊的應用日誌
      await this.cleanLogsByType(appLogs);
      
      // 清理舊的API日誌
      await this.cleanLogsByType(apiLogs);
    } catch (error) {
      console.error('清理舊日誌失敗:', error);
    }
  }
  
  /**
   * 按照類型清理日誌檔案
   * @param logs 日誌檔案和狀態資訊
   */
  private static async cleanLogsByType(logs: { path: string, stats: Stats }[]): Promise<void> {
    try {
      // 按修改時間排序（最新的在前）
      logs.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
      
      // 當前時間
      const now = new Date().getTime();
      
      // 遍歷日誌檔案
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        
        // 條件1: 檔案數量超過限制
        const exceedsMaxFiles = i >= this.rotationConfig.maxFiles;
        
        // 條件2: 檔案建立時間超過保留天數
        const fileAge = (now - log.stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        const exceedsMaxDays = fileAge > this.rotationConfig.maxDays;
        
        // 如果符合任一條件，則刪除檔案
        if (exceedsMaxFiles || exceedsMaxDays) {
          await fs.unlink(log.path);
        }
      }
    } catch (error) {
      console.error('清理特定類型日誌失敗:', error);
    }
  }

  /**
   * 寫入日誌到檔案，支援檔案輪替
   * @param message 日誌訊息
   * @param level 日誌級別
   */
  private static async writeToFile(message: string, level: LogLevel): Promise<void> {
    try {
      await this.initLogDir();
      
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level}] ${message}${os.EOL}`;
      
      // 取得日誌檔案路徑
      let filePath = this.getLogFilePath();
      
      // 檢查檔案大小，若超過限制則輪替
      filePath = await this.checkFileSize(filePath, false);
      
      // 寫入日誌
      await fs.appendFile(filePath, logEntry, { encoding: 'utf8' });
      
      // 每天至少執行一次清理作業
      await this.cleanOldLogs();
    } catch (error) {
      console.error('寫入日誌失敗:', error);
    }
  }

  /**
   * 記錄API通訊
   * @param apiLog API日誌物件
   */
  private static async writeApiLog(apiLog: ApiLog): Promise<void> {
    try {
      await this.initLogDir();
      
      const logEntry = JSON.stringify(apiLog, null, 2) + os.EOL + '---' + os.EOL;
      
      // 取得API日誌檔案路徑
      let filePath = this.getApiLogFilePath();
      
      // 檢查檔案大小，若超過限制則輪替
      filePath = await this.checkFileSize(filePath, true);
      
      // 寫入日誌
      await fs.appendFile(filePath, logEntry, { encoding: 'utf8' });
      
      // 每天至少執行一次清理作業
      await this.cleanOldLogs();
    } catch (error) {
      console.error('寫入API日誌失敗:', error);
    }
  }

  /**
   * 設定日誌輪替配置
   * @param config 輪替配置
   */
  public static setRotationConfig(config: Partial<LogRotationConfig>): void {
    this.rotationConfig = {
      ...this.rotationConfig,
      ...config
    };
  }

  /**
   * 手動執行日誌清理
   */
  public static async manualCleanup(): Promise<void> {
    await this.cleanOldLogs();
  }

  /**
   * 記錄調試訊息
   * @param message 日誌訊息
   */
  public static async debug(message: string): Promise<void> {
    console.debug(message);
    await this.writeToFile(message, LogLevel.DEBUG);
  }

  /**
   * 記錄資訊訊息
   * @param message 日誌訊息
   */
  public static async info(message: string): Promise<void> {
    console.info(message);
    await this.writeToFile(message, LogLevel.INFO);
  }

  /**
   * 記錄警告訊息
   * @param message 日誌訊息
   */
  public static async warn(message: string): Promise<void> {
    console.warn(message);
    await this.writeToFile(message, LogLevel.WARN);
  }

  /**
   * 記錄錯誤訊息
   * @param message 日誌訊息
   * @param error 錯誤物件
   */
  public static async error(message: string, error?: any): Promise<void> {
    console.error(message, error);
    const errorMessage = error ? `${message}: ${JSON.stringify(error)}` : message;
    await this.writeToFile(errorMessage, LogLevel.ERROR);
  }

  /**
   * 記錄API請求開始
   * @param service 服務名稱
   * @param method 方法名稱
   * @param request 請求參數
   * @returns 開始時間戳記，用於計算耗時
   */
  public static apiStart(service: string, method: string, request: any): number {
    console.log(`API請求 [${service}.${method}] 開始`);
    return Date.now();
  }

  /**
   * 記錄API請求成功完成
   * @param service 服務名稱
   * @param method 方法名稱
   * @param request 請求參數
   * @param response 響應結果
   * @param startTime 開始時間戳記
   */
  public static async apiSuccess(service: string, method: string, request: any, response: any, startTime: number): Promise<void> {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`API請求 [${service}.${method}] 成功完成，耗時 ${duration}ms`);
    
    const apiLog: ApiLog = {
      timestamp: new Date().toISOString(),
      service,
      method,
      request,
      response,
      duration
    };
    
    await this.writeApiLog(apiLog);
  }

  /**
   * 記錄API請求失敗
   * @param service 服務名稱
   * @param method 方法名稱
   * @param request 請求參數
   * @param error 錯誤物件
   * @param startTime 開始時間戳記
   */
  public static async apiError(service: string, method: string, request: any, error: any, startTime: number): Promise<void> {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error(`API請求 [${service}.${method}] 失敗，耗時 ${duration}ms`, error);
    
    const apiLog: ApiLog = {
      timestamp: new Date().toISOString(),
      service,
      method,
      request,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      duration
    };
    
    await this.writeApiLog(apiLog);
  }

  /**
   * 深度記錄數據庫操作
   * @param operation 操作類型（例如：查詢、插入、更新）
   * @param query SQL查詢語句
   * @param params 查詢參數
   * @param result 操作結果
   * @param error 錯誤（如有）
   */
  public static async logDatabaseOperation(operation: string, query: string, params: any, result?: any, error?: any): Promise<void> {
    const apiLog: ApiLog = {
      timestamp: new Date().toISOString(),
      service: 'Database',
      method: operation,
      request: {
        query,
        params
      }
    };
    
    if (result) {
      apiLog.response = result;
    }
    
    if (error) {
      apiLog.error = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error;
    }
    
    await this.writeApiLog(apiLog);
  }
} 