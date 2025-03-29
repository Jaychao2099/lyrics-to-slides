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

  // 創建表
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
  },

  // 獲取單首歌曲
  getSongById(id: number): Song | null {
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
  },

  // 搜索歌曲
  searchSongs(query: string): Song[] {
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
  },

  // 新增歌曲
  addSong(song: Omit<Song, 'id' | 'createdAt' | 'updatedAt'>): number {
    const now = new Date().toISOString();
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
    const result = stmt.run(
      song.title,
      song.artist || '',
      song.lyrics || '',
      song.imageUrl || '',
      song.slideContent || '',
      now,
      now
    );
    return result.lastInsertRowid as number;
  },

  // 更新歌曲
  updateSong(id: number, song: Partial<Song>): boolean {
    const existingSong = this.getSongById(id);
    if (!existingSong) return false;

    const now = new Date().toISOString();
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
    
    const result = stmt.run(
      song.title || existingSong.title,
      song.artist || existingSong.artist,
      song.lyrics || existingSong.lyrics,
      song.imageUrl || existingSong.imageUrl || '',
      song.slideContent || existingSong.slideContent || '',
      now,
      id
    );
    
    return result.changes > 0;
  },

  // 刪除歌曲
  deleteSong(id: number): boolean {
    const stmt = db.prepare('DELETE FROM songs WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}; 