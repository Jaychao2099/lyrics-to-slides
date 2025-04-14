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
      text_color TEXT DEFAULT '#000000',
      stroke_color TEXT DEFAULT '#ffffff',
      stroke_size INTEGER DEFAULT 5,
      font_weight TEXT DEFAULT '400',
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
      this.migrateDatabase(); // 確保數據庫結構是最新的
    }
    return db;
  },

  // 遷移數據庫結構
  migrateDatabase(): void {
    try {
      console.log('檢查數據庫結構，進行必要的遷移...');
      
      // 檢查songs表是否有text_color列
      const tableInfo = db.prepare("PRAGMA table_info(songs)").all() as {name: string, type: string}[];
      const columnNames = tableInfo.map(col => col.name);
      
      // 檢查並添加text_color列
      if (!columnNames.includes('text_color')) {
        console.log('添加text_color列到songs表...');
        db.exec('ALTER TABLE songs ADD COLUMN text_color TEXT DEFAULT "#000000"');
      }
      
      // 檢查並添加stroke_color列
      if (!columnNames.includes('stroke_color')) {
        console.log('添加stroke_color列到songs表...');
        db.exec('ALTER TABLE songs ADD COLUMN stroke_color TEXT DEFAULT "#ffffff"');
      }
      
      // 檢查並添加stroke_size列
      if (!columnNames.includes('stroke_size')) {
        console.log('添加stroke_size列到songs表...');
        db.exec('ALTER TABLE songs ADD COLUMN stroke_size INTEGER DEFAULT 5');
      }
      
      // 檢查並添加font_weight列
      if (!columnNames.includes('font_weight')) {
        console.log('添加font_weight列到songs表...');
        db.exec('ALTER TABLE songs ADD COLUMN font_weight TEXT DEFAULT "400"');
      }
      
      // 檢查font_weight列的類型，如果是INTEGER則執行遷移
      const fontWeightCol = tableInfo.find(col => col.name === 'font_weight');
      if (fontWeightCol && fontWeightCol.type === 'INTEGER') {
        console.log('遷移font_weight列從INTEGER類型到TEXT類型...');
        
        // 創建一個臨時表來保存數據
        db.exec(`
          CREATE TEMPORARY TABLE songs_backup(
            id INTEGER PRIMARY KEY,
            title TEXT,
            artist TEXT,
            lyrics TEXT,
            image_url TEXT,
            slide_content TEXT,
            text_color TEXT,
            stroke_color TEXT,
            stroke_size INTEGER,
            font_weight TEXT,
            created_at TEXT,
            updated_at TEXT
          );
          
          INSERT INTO songs_backup 
          SELECT id, title, artist, lyrics, image_url, slide_content, 
                 text_color, stroke_color, stroke_size, 
                 CAST(font_weight AS TEXT), created_at, updated_at
          FROM songs;
          
          DROP TABLE songs;
          
          CREATE TABLE songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist TEXT,
            lyrics TEXT,
            image_url TEXT,
            slide_content TEXT,
            text_color TEXT DEFAULT '#000000',
            stroke_color TEXT DEFAULT '#ffffff',
            stroke_size INTEGER DEFAULT 5,
            font_weight TEXT DEFAULT '400',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          
          INSERT INTO songs SELECT * FROM songs_backup;
          
          DROP TABLE songs_backup;
        `);
        
        console.log('font_weight列類型遷移完成');
      }
      
      console.log('數據庫結構遷移完成');
    } catch (error) {
      console.error('數據庫遷移失敗:', error);
    }
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
          text_color as textColor,
          stroke_color as strokeColor,
          stroke_size as strokeSize,
          font_weight as fontWeight,
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
          text_color as textColor,
          stroke_color as strokeColor,
          stroke_size as strokeSize,
          font_weight as fontWeight,
          created_at as createdAt, 
          updated_at as updatedAt 
        FROM songs 
        WHERE id = ?
      `);
      return stmt.get(id) as Song;
    } catch (error) {
      console.error(`獲取歌曲ID ${id} 失敗:`, error);
      return null;
    }
  },

  // 搜尋歌曲
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
      console.error('搜尋歌曲失敗:', error);
      return [];
    }
  },

  // 按確切標題搜尋歌曲 - 用於找出所有同名歌曲
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
      console.error('按確切標題搜尋歌曲失敗:', error);
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
          text_color,
          stroke_color,
          stroke_size,
          font_weight,
          created_at, 
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // 直接傳遞參數，讓 better-sqlite3 處理特殊字符和換行符
      const result = stmt.run(
        song.title,
        song.artist || '',
        lyrics,
        song.imageUrl || '',
        song.slideContent || '',
        song.textColor || '#000000',
        song.strokeColor || '#ffffff',
        song.strokeSize || 5,
        song.fontWeight || '400',
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
      console.log(`開始更新歌曲，ID: ${id}，更新資料:`, JSON.stringify(song));
      
      const existingSong = this.getSongById(id);
      if (!existingSong) {
        console.error(`找不到ID為 ${id} 的歌曲，無法更新`);
        return false;
      }
  
      const now = new Date().toISOString();
      console.log(`更新時間設置為: ${now}`);
      
      // --- 修改：更精確地處理傳入值和現有值 ---
      const finalTitle = song.title !== undefined ? song.title : existingSong.title;
      const finalArtist = song.artist !== undefined ? song.artist : existingSong.artist;
      const finalLyrics = song.lyrics !== undefined ? (song.lyrics || '') : existingSong.lyrics;
      const finalImageUrl = song.imageUrl !== undefined ? (song.imageUrl || '') : (existingSong.imageUrl || '');
      const finalSlideContent = song.slideContent !== undefined ? (song.slideContent || '') : (existingSong.slideContent || '');
      const finalTextColor = song.textColor !== undefined ? song.textColor : (existingSong.textColor || '#000000');
      const finalStrokeColor = song.strokeColor !== undefined ? song.strokeColor : (existingSong.strokeColor || '#ffffff');
      const finalStrokeSize = song.strokeSize !== undefined ? song.strokeSize : (existingSong.strokeSize || 5);
      const finalFontWeight = song.fontWeight !== undefined ? song.fontWeight : (existingSong.fontWeight || '400');
      
      console.log('最終更新的歌曲資料:');
      console.log('- 標題:', finalTitle);
      console.log('- 歌手:', finalArtist);
      console.log('- 歌詞長度:', finalLyrics ? finalLyrics.length : 0);
      console.log('- 圖片URL:', finalImageUrl);
      console.log('- 文字顏色:', finalTextColor);
      console.log('- 邊框顏色:', finalStrokeColor);
      console.log('- 邊框粗細:', finalStrokeSize);
      console.log('- 文字粗細:', finalFontWeight, typeof finalFontWeight);
      
      try {
        const result = db.prepare(`
          UPDATE songs SET
            title = ?,
            artist = ?,
            lyrics = ?,
            image_url = ?,
            slide_content = ?,
            text_color = ?,
            stroke_color = ?,
            stroke_size = ?,
            font_weight = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          finalTitle,
          finalArtist,
          finalLyrics,
          finalImageUrl,
          finalSlideContent,
          finalTextColor,
          finalStrokeColor,
          finalStrokeSize,
          finalFontWeight,
          now,
          id
        );
        
        console.log(`SQL執行結果:`, result);
        console.log(`已更新的行數: ${result.changes}`);
        return result.changes > 0;
      } catch (sqlError: any) {
        console.error('SQL執行失敗:', sqlError);
        console.error('SQL錯誤詳情:', sqlError.message);
        return false;
      }
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

  // 儲存歌曲與資源的關聯
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
      console.error('儲存歌曲資源關聯失敗:', error);
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
          s.text_color as textColor,
          s.stroke_color as strokeColor,
          s.stroke_size as strokeSize,
          s.font_weight as fontWeight,
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
      
      // 刪除對應的批次投影片快取檔案 (set_[slideSetId].md)
      try {
        const fs = require('fs/promises');
        const path = require('path');
        const { app } = require('electron');
        const batchSlideCacheDir = path.join(app.getPath('userData'), 'app_cache', 'batch_slides');
        const cacheFilePath = path.join(batchSlideCacheDir, `set_${slideSetId}.md`);
        
        // 檢查檔案是否存在
        fs.access(cacheFilePath)
          .then(() => {
            // 檔案存在，刪除它
            return fs.unlink(cacheFilePath);
          })
          .then(() => {
            console.log(`成功刪除投影片集 ${slideSetId} 的快取檔案`);
          })
          .catch((err: NodeJS.ErrnoException) => {
            // 如果是檔案不存在的錯誤，這是可接受的
            if (err.code !== 'ENOENT') {
              console.error(`刪除投影片集 ${slideSetId} 的快取檔案失敗:`, err);
            }
          });
      } catch (cacheError) {
        console.error(`刪除投影片集 ${slideSetId} 快取檔案時出錯:`, cacheError);
        // 快取檔案刪除失敗不影響整體操作結果
      }
      
      return true;
    } catch (error) {
      console.error(`刪除投影片集 ${slideSetId} 失敗:`, error);
      return false;
    }
  },

  /**
   * 更新投影片集名稱
   * @param slideSetId 投影片集ID
   * @param newName 新名稱
   * @returns 操作是否成功
   */
  updateSlideSetName(slideSetId: number, newName: string): boolean {
    try {
      const db = this.init();
      const now = new Date().toISOString();
      
      // 更新投影片集名稱
      db.prepare('UPDATE slide_sets SET name = ?, updated_at = ? WHERE id = ?')
        .run(newName, now, slideSetId);
      
      return true;
    } catch (error) {
      console.error(`更新投影片集 ${slideSetId} 名稱失敗:`, error);
      return false;
    }
  }
}; 