/// <reference types="node" />
/// <reference types="electron" />

import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { Song } from '../../common/types';

// 定義資源關聯記錄類型
interface SongResource {
  id: number;
  song_id: number;
  resource_type: 'image' | 'slide';
  resource_path: string;
  created_at: string;
  updated_at: string;
}

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

  // 創建 song_resources 表存儲歌曲與資源關聯
  db.exec(`
    CREATE TABLE IF NOT EXISTS song_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL,
      resource_type TEXT NOT NULL,
      resource_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    )
  `);

  // 創建 slide_sets 表存儲投影片集
  db.exec(`
    CREATE TABLE IF NOT EXISTS slide_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 創建 slide_set_songs 表存儲投影片集與歌曲的關聯
  db.exec(`
    CREATE TABLE IF NOT EXISTS slide_set_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slide_set_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      display_order INTEGER NOT NULL,
      FOREIGN KEY (slide_set_id) REFERENCES slide_sets(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    )
  `);

  // 創建索引以優化查詢效能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_images_song_id ON images(song_id);
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
    CREATE INDEX IF NOT EXISTS idx_song_resources_song_id ON song_resources(song_id);
    CREATE INDEX IF NOT EXISTS idx_song_resources_type ON song_resources(resource_type);
    CREATE INDEX IF NOT EXISTS idx_slide_set_songs_slide_set_id ON slide_set_songs(slide_set_id);
    CREATE INDEX IF NOT EXISTS idx_slide_set_songs_song_id ON slide_set_songs(song_id);
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
  },

  // 保存歌曲與資源的關聯
  saveSongResource(songId: number, resourceType: 'image' | 'slide', resourcePath: string): boolean {
    // 確保數據庫已初始化
    if (!db) {
      this.init();
    }
    
    try {
      const now = new Date().toISOString();
      
      // 檢查是否已經存在相同類型的資源關聯
      const existingStmt = db.prepare(`
        SELECT id FROM song_resources 
        WHERE song_id = ? AND resource_type = ?
      `);
      const existingResource = existingStmt.get(songId, resourceType) as { id: number } | undefined;
      
      if (existingResource && existingResource.id) {
        // 更新現有資源關聯
        const updateStmt = db.prepare(`
          UPDATE song_resources SET
            resource_path = ?,
            updated_at = ?
          WHERE id = ?
        `);
        updateStmt.run(resourcePath, now, existingResource.id);
      } else {
        // 新增資源關聯
        const insertStmt = db.prepare(`
          INSERT INTO song_resources (
            song_id,
            resource_type,
            resource_path,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?)
        `);
        insertStmt.run(songId, resourceType, resourcePath, now, now);
      }
      
      return true;
    } catch (error) {
      console.error('保存歌曲資源關聯失敗:', error);
      return false;
    }
  },
  
  // 獲取歌曲關聯的資源
  getSongResource(songId: number, resourceType: 'image' | 'slide'): string | null {
    // 確保數據庫已初始化
    if (!db) {
      this.init();
    }
    
    try {
      const stmt = db.prepare(`
        SELECT resource_path FROM song_resources 
        WHERE song_id = ? AND resource_type = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `);
      const result = stmt.get(songId, resourceType) as { resource_path: string } | undefined;
      return result && result.resource_path ? result.resource_path : null;
    } catch (error) {
      console.error('獲取歌曲資源關聯失敗:', error);
      return null;
    }
  },
  
  // 刪除歌曲資源關聯
  deleteSongResource(songId: number, resourceType: 'image' | 'slide'): boolean {
    // 確保數據庫已初始化
    if (!db) {
      this.init();
    }
    
    try {
      const stmt = db.prepare(`
        DELETE FROM song_resources 
        WHERE song_id = ? AND resource_type = ?
      `);
      const result = stmt.run(songId, resourceType);
      return result.changes > 0;
    } catch (error) {
      console.error('刪除歌曲資源關聯失敗:', error);
      return false;
    }
  },
  
  // 清除所有資源關聯記錄
  clearAllSongResources(): boolean {
    // 確保數據庫已初始化
    if (!db) {
      this.init();
    }
    
    try {
      const stmt = db.prepare(`DELETE FROM song_resources`);
      stmt.run();
      console.log('所有資源關聯記錄已清除');
      return true;
    } catch (error) {
      console.error('清除所有資源關聯記錄失敗:', error);
      return false;
    }
  },
  
  // 清除特定類型的資源關聯記錄
  clearSongResourcesByType(resourceType: 'image' | 'slide'): boolean {
    try {
      const db = this.init();
      const stmt = db.prepare('DELETE FROM song_resources WHERE resource_type = ?');
      stmt.run(resourceType);
      return true;
    } catch (error) {
      console.error(`清除資源類型 ${resourceType} 的所有關聯失敗:`, error);
      return false;
    }
  },
  
  /**
   * 創建新的投影片集
   * @param name 投影片集名稱
   * @returns 新創建的投影片集ID
   */
  createSlideSet(name: string): number {
    try {
      const db = this.init();
      const now = new Date().toISOString();
      const stmt = db.prepare('INSERT INTO slide_sets (name, created_at, updated_at) VALUES (?, ?, ?)');
      const result = stmt.run(name, now, now);
      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('創建投影片集失敗:', error);
      throw error;
    }
  },
  
  /**
   * 獲取所有投影片集
   * @returns 投影片集列表
   */
  getSlideSets(): any[] {
    try {
      const db = this.init();
      
      // 查詢投影片集基本信息
      const slideSets = db.prepare(`
        SELECT 
          id,
          name,
          created_at as createdAt,
          updated_at as updatedAt
        FROM slide_sets
        ORDER BY updated_at DESC
      `).all() as Array<{id: number, name: string, createdAt: string, updatedAt: string, songCount?: number}>;
      
      // 查詢每個投影片集包含的歌曲數量
      for (const set of slideSets) {
        const countResult = db.prepare(`
          SELECT COUNT(*) as count
          FROM slide_set_songs
          WHERE slide_set_id = ?
        `).get(set.id) as {count: number};
        
        set.songCount = countResult.count;
      }
      
      return slideSets;
    } catch (error) {
      console.error('獲取投影片集失敗:', error);
      return [];
    }
  },
  
  /**
   * 獲取投影片集中的歌曲
   * @param slideSetId 投影片集ID
   * @returns 歌曲列表
   */
  getSlideSetSongs(slideSetId: number): any[] {
    try {
      const db = this.init();
      
      // 查詢關聯表和歌曲表
      const songs = db.prepare(`
        SELECT 
          s.id,
          s.title,
          s.artist,
          s.lyrics,
          s.image_url as imageUrl,
          s.slide_content as slideContent,
          s.created_at as createdAt,
          s.updated_at as updatedAt,
          sss.display_order as displayOrder,
          sss.id as relationId
        FROM songs s
        JOIN slide_set_songs sss ON s.id = sss.song_id
        WHERE sss.slide_set_id = ?
        ORDER BY sss.display_order
      `).all(slideSetId);
      
      return songs;
    } catch (error) {
      console.error(`獲取投影片集 ${slideSetId} 的歌曲失敗:`, error);
      return [];
    }
  },
  
  /**
   * 添加歌曲到投影片集
   * @param slideSetId 投影片集ID
   * @param songId 歌曲ID
   * @param displayOrder 顯示順序
   * @returns 操作是否成功
   */
  addSongToSlideSet(slideSetId: number, songId: number, displayOrder: number): boolean {
    try {
      const db = this.init();
      
      // 檢查是否已存在此關聯
      const existing = db.prepare(`
        SELECT COUNT(*) as count FROM slide_set_songs
        WHERE slide_set_id = ? AND song_id = ?
      `).get(slideSetId, songId) as {count: number};
      
      if (existing.count > 0) {
        // 已存在則更新順序
        db.prepare(`
          UPDATE slide_set_songs
          SET display_order = ?
          WHERE slide_set_id = ? AND song_id = ?
        `).run(displayOrder, slideSetId, songId);
      } else {
        // 不存在則新增
        db.prepare(`
          INSERT INTO slide_set_songs (slide_set_id, song_id, display_order)
          VALUES (?, ?, ?)
        `).run(slideSetId, songId, displayOrder);
      }
      
      // 更新投影片集的更新時間
      const now = new Date().toISOString();
      db.prepare('UPDATE slide_sets SET updated_at = ? WHERE id = ?')
        .run(now, slideSetId);
      
      return true;
    } catch (error) {
      console.error(`將歌曲 ${songId} 添加到投影片集 ${slideSetId} 失敗:`, error);
      return false;
    }
  },
  
  /**
   * 從投影片集中移除歌曲
   * @param slideSetId 投影片集ID
   * @param songId 歌曲ID
   * @returns 操作是否成功
   */
  removeSongFromSlideSet(slideSetId: number, songId: number): boolean {
    try {
      const db = this.init();
      
      // 刪除關聯
      db.prepare(`
        DELETE FROM slide_set_songs
        WHERE slide_set_id = ? AND song_id = ?
      `).run(slideSetId, songId);
      
      // 更新投影片集的更新時間
      const now = new Date().toISOString();
      db.prepare('UPDATE slide_sets SET updated_at = ? WHERE id = ?')
        .run(now, slideSetId);
      
      return true;
    } catch (error) {
      console.error(`從投影片集 ${slideSetId} 移除歌曲 ${songId} 失敗:`, error);
      return false;
    }
  },
  
  /**
   * 更新歌曲在投影片集中的順序
   * @param slideSetId 投影片集ID
   * @param songId 歌曲ID
   * @param newOrder 新順序
   * @returns 操作是否成功
   */
  updateSongOrderInSlideSet(slideSetId: number, songId: number, newOrder: number): boolean {
    try {
      const db = this.init();
      
      // 更新順序
      db.prepare(`
        UPDATE slide_set_songs
        SET display_order = ?
        WHERE slide_set_id = ? AND song_id = ?
      `).run(newOrder, slideSetId, songId);
      
      // 更新投影片集的更新時間
      const now = new Date().toISOString();
      db.prepare('UPDATE slide_sets SET updated_at = ? WHERE id = ?')
        .run(now, slideSetId);
      
      return true;
    } catch (error) {
      console.error(`更新歌曲 ${songId} 在投影片集 ${slideSetId} 中的順序失敗:`, error);
      return false;
    }
  },
  
  /**
   * 刪除投影片集
   * @param slideSetId 投影片集ID
   * @returns 操作是否成功
   */
  deleteSlideSet(slideSetId: number): boolean {
    try {
      const db = this.init();
      
      // 刪除投影片集
      db.prepare('DELETE FROM slide_sets WHERE id = ?').run(slideSetId);
      
      // 關聯記錄會因外鍵約束自動刪除
      
      return true;
    } catch (error) {
      console.error(`刪除投影片集 ${slideSetId} 失敗:`, error);
      return false;
    }
  }
}; 