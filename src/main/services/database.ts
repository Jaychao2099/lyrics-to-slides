/// <reference types="node" />
/// <reference types="electron" />

import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { Song } from '../../common/types';

// 數據庫位置
const DB_PATH = path.join(app.getPath('userData'), 'lyrics.db');

// 創建數據庫連接
let db: Database.Database;

// 初始化數據庫
function initDatabase() {
  // 確保數據庫目錄存在
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 創建數據庫連接
  db = new Database(DB_PATH);

  // 創建 songs 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT,
      lyrics TEXT,
      image_url TEXT,
      slide_content TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  
  // 創建 images 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      prompt TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    )
  `);

  // 創建索引以優化查詢效能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_images_song_id ON images(song_id);
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
  `);

  return db;
}

// 數據庫服務
export const DatabaseService = {
  // 初始化
  init(): Database.Database {
    if (!db) {
      db = initDatabase();
    }
    return db;
  },

  // 關閉數據庫
  close(): void {
    if (db) {
      db.close();
    }
  },

  // 獲取所有歌曲
  getSongs(): Song[] {
    // 確保數據庫已初始化
    if (!db) {
      this.init();
    }
    
    try {
      const stmt = db.prepare(`
        SELECT 
          id, 
          title, 
          artist, 
          lyrics, 
          image_url as imageUrl, 
          slide_content as slideContent, 
          created_at as createdAt, 
          updated_at as updatedAt 
        FROM songs 
        ORDER BY updated_at DESC
      `);
      return stmt.all() as Song[];
    } catch (error) {
      console.error('獲取所有歌曲失敗:', error);
      return [];
    }
  },

  // 獲取單首歌曲
  getSongById(id: number): Song | null {
    // 確保數據庫已初始化
    if (!db) {
      this.init();
    }
    
    try {
      const stmt = db.prepare(`
        SELECT 
          id, 
          title, 
          artist, 
          lyrics, 
          image_url as imageUrl, 
          slide_content as slideContent, 
          created_at as createdAt, 
          updated_at as updatedAt 
        FROM songs 
        WHERE id = ?
      `);
      return stmt.get(id) as Song | null;
    } catch (error) {
      console.error('獲取單首歌曲失敗:', error);
      return null;
    }
  },

  // 搜索歌曲
  searchSongs(query: string): Song[] {
    // 確保數據庫已初始化
    if (!db) {
      this.init();
    }
    
    try {
      const stmt = db.prepare(`
        SELECT 
          id, 
          title, 
          artist, 
          lyrics, 
          image_url as imageUrl, 
          slide_content as slideContent, 
          created_at as createdAt, 
          updated_at as updatedAt 
        FROM songs 
        WHERE title LIKE ? OR artist LIKE ?
        ORDER BY updated_at DESC
      `);
      return stmt.all(`%${query}%`, `%${query}%`) as Song[];
    } catch (error) {
      console.error('搜索歌曲失敗:', error);
      return [];
    }
  },

  // 按確切標題搜索歌曲 - 用於找出所有同名歌曲
  searchSongsByExactTitle(title: string): Song[] {
    // 確保數據庫已初始化
    if (!db) {
      this.init();
    }
    
    try {
      const stmt = db.prepare(`
        SELECT 
          id, 
          title, 
          artist, 
          lyrics, 
          image_url as imageUrl, 
          slide_content as slideContent, 
          created_at as createdAt, 
          updated_at as updatedAt 
        FROM songs 
        WHERE title = ?
        ORDER BY updated_at DESC
      `);
      return stmt.all(title) as Song[];
    } catch (error) {
      console.error('按確切標題搜索歌曲失敗:', error);
      return [];
    }
  },

  // 新增歌曲
  addSong(song: Omit<Song, 'id' | 'createdAt' | 'updatedAt'>): number {
    // 確保數據庫已初始化
    if (!db) {
      this.init();
    }
    
    try {
      const now = new Date().toISOString();
      
      // 歌詞內容可能包含換行符，確保正確處理
      const lyrics = song.lyrics || '';
      
      // 使用參數化查詢避免 SQL 注入
      const stmt = db.prepare(`
        INSERT INTO songs (
          title, 
          artist, 
          lyrics, 
          image_url, 
          slide_content, 
          created_at, 
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      // 直接傳遞參數，讓 better-sqlite3 處理特殊字符和換行符
      const result = stmt.run(
        song.title,
        song.artist || '',
        lyrics,
        song.imageUrl || '',
        song.slideContent || '',
        now,
        now
      );
      
      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('新增歌曲失敗:', error);
      return -1;
    }
  },

  // 更新歌曲
  updateSong(id: number, song: Partial<Song>): boolean {
    // 確保數據庫已初始化
    if (!db) {
      this.init();
    }
    
    try {
      const existingSong = this.getSongById(id);
      if (!existingSong) return false;
  
      const now = new Date().toISOString();
      
      // 歌詞內容可能包含換行符，確保正確處理
      const lyrics = song.lyrics !== undefined ? song.lyrics : existingSong.lyrics;
      
      // 使用參數化查詢避免 SQL 注入
      const stmt = db.prepare(`
        UPDATE songs SET
          title = ?,
          artist = ?,
          lyrics = ?,
          image_url = ?,
          slide_content = ?,
          updated_at = ?
        WHERE id = ?
      `);
      
      // 直接傳遞參數，讓 better-sqlite3 處理特殊字符和換行符
      const result = stmt.run(
        song.title || existingSong.title,
        song.artist || existingSong.artist,
        lyrics,
        song.imageUrl || existingSong.imageUrl || '',
        song.slideContent || existingSong.slideContent || '',
        now,
        id
      );
      
      return result.changes > 0;
    } catch (error) {
      console.error('更新歌曲失敗:', error);
      return false;
    }
  },

  // 刪除歌曲
  deleteSong(id: number): boolean {
    // 確保數據庫已初始化
    if (!db) {
      this.init();
    }
    
    try {
      const stmt = db.prepare('DELETE FROM songs WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('刪除歌曲失敗:', error);
      return false;
    }
  }
}; 