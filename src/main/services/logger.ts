/// <reference types="node" />
/// <reference types="electron" />

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
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
 * 用於記錄應用各模組的操作與API通訊
 */
export class LoggerService {
  // 日誌目錄
  private static logDir = path.join(app.getPath('userData'), 'logs');
  
  // 一般日誌檔案路徑
  private static logFilePath = path.join(LoggerService.logDir, `app_${new Date().toISOString().split('T')[0]}.log`);
  
  // API通訊日誌檔案路徑
  private static apiLogFilePath = path.join(LoggerService.logDir, `api_${new Date().toISOString().split('T')[0]}.log`);

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
   * 寫入日誌到檔案
   * @param message 日誌訊息
   * @param level 日誌級別
   */
  private static async writeToFile(message: string, level: LogLevel): Promise<void> {
    try {
      await this.initLogDir();
      
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level}] ${message}${os.EOL}`;
      
      await fs.appendFile(this.logFilePath, logEntry, { encoding: 'utf8' });
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
      
      await fs.appendFile(this.apiLogFilePath, logEntry, { encoding: 'utf8' });
    } catch (error) {
      console.error('寫入API日誌失敗:', error);
    }
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