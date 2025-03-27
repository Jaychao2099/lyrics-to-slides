/**
 * SQLite數據庫實現
 * 
 * 提供基於better-sqlite3的數據庫功能，
 * 用於儲存歌詞、投影片項目和應用設置。
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const log = require('electron-log');

// 嘗試載入better-sqlite3模組
let Database;
try {
  Database = require('better-sqlite3');
} catch (error) {
  log.warn('無法載入better-sqlite3模組:', error.message);
  log.warn('將使用記憶體暫存資料庫代替');
}

// 內存數據庫備份，用於在缺少better-sqlite3時作為備選方案
const memoryDB = {
  lyrics: new Map(),
  projects: new Map(),
  settings: new Map(),
  images: new Map()
};

/**
 * 初始化SQLite數據庫
 * @param {string} dbPath - 數據庫文件路徑
 * @returns {Object} 數據庫實例
 */
function initSQLiteDatabase(dbPath) {
  // 確保目錄存在
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    try {
      fs.mkdirSync(dbDir, { recursive: true });
      log.info(`創建數據庫目錄: ${dbDir}`);
    } catch (error) {
      log.error(`創建數據庫目錄失敗: ${error.message}`);
      return createMemoryDB();
    }
  }

  // 如果better-sqlite3未能加載，返回內存數據庫
  if (!Database) {
    log.warn('使用內存數據庫代替SQLite');
    return createMemoryDB();
  }

  try {
    // 初始化數據庫連接
    const db = new Database(dbPath, { verbose: (message) => log.debug(`[SQLite] ${message}`) });
    
    // 啟用外鍵約束
    db.pragma('foreign_keys = ON');
    
    // 創建必要的表
    createTables(db);
    
    // 創建數據庫方法
    const dbMethods = {
      // 歌詞相關方法
      lyrics: {
        /**
         * 保存歌詞
         * @param {Object} lyric - 歌詞對象
         * @returns {string} 歌詞ID
         */
        save: (lyric) => {
          if (!lyric.id) {
            throw new Error('歌詞ID不能為空');
          }
          
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO lyrics (
              id, title, artist, content, source, language, source_url, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          const timestamp = Date.now();
          
          stmt.run(
            lyric.id,
            lyric.title,
            lyric.artist || null,
            lyric.text || lyric.content,
            lyric.source,
            lyric.language || null,
            lyric.sourceUrl || null,
            timestamp
          );
          
          return lyric.id;
        },
        
        /**
         * 根據ID獲取歌詞
         * @param {string} id - 歌詞ID
         * @returns {Object|null} 歌詞對象
         */
        getById: (id) => {
          const stmt = db.prepare('SELECT * FROM lyrics WHERE id = ?');
          const result = stmt.get(id);
          
          if (!result) return null;
          
          return {
            id: result.id,
            title: result.title,
            artist: result.artist,
            text: result.content,
            content: result.content,
            source: result.source,
            language: result.language,
            sourceUrl: result.source_url,
            timestamp: result.timestamp
          };
        },
        
        /**
         * 搜索歌詞
         * @param {Object} query - 搜索條件
         * @returns {Array<Object>} 歌詞列表
         */
        search: (query) => {
          let sql = 'SELECT * FROM lyrics WHERE 1=1';
          const params = [];
          
          if (query.title) {
            sql += ' AND title LIKE ?';
            params.push(`%${query.title}%`);
          }
          
          if (query.artist) {
            sql += ' AND artist LIKE ?';
            params.push(`%${query.artist}%`);
          }
          
          if (query.content) {
            sql += ' AND content LIKE ?';
            params.push(`%${query.content}%`);
          }
          
          sql += ' ORDER BY timestamp DESC LIMIT 50';
          
          const stmt = db.prepare(sql);
          const results = stmt.all(...params);
          
          return results.map(result => ({
            id: result.id,
            title: result.title,
            artist: result.artist,
            text: result.content,
            content: result.content,
            source: result.source,
            language: result.language,
            sourceUrl: result.source_url,
            timestamp: result.timestamp
          }));
        },
        
        /**
         * 刪除歌詞
         * @param {string} id - 歌詞ID
         * @returns {boolean} 是否成功
         */
        delete: (id) => {
          const stmt = db.prepare('DELETE FROM lyrics WHERE id = ?');
          const result = stmt.run(id);
          return result.changes > 0;
        },
        
        /**
         * 清空歌詞表
         * @returns {number} 清空的記錄數
         */
        clear: () => {
          const stmt = db.prepare('DELETE FROM lyrics');
          const result = stmt.run();
          return result.changes;
        }
      },
      
      // 項目相關方法
      projects: {
        /**
         * 保存項目
         * @param {Object} project - 項目對象
         * @returns {string} 項目ID
         */
        save: (project) => {
          if (!project.id) {
            throw new Error('項目ID不能為空');
          }
          
          // 更新項目主表
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO projects (
              id, name, description, song_id, template, settings, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          const now = Date.now();
          const createdAt = project.createdAt || now;
          
          stmt.run(
            project.id,
            project.name,
            project.description || '',
            project.songId || null,
            project.template || 'default',
            JSON.stringify(project.settings || {}),
            createdAt,
            now
          );
          
          // 更新投影片
          if (project.slides && Array.isArray(project.slides)) {
            // 先刪除舊的投影片
            const deleteStmt = db.prepare('DELETE FROM project_slides WHERE project_id = ?');
            deleteStmt.run(project.id);
            
            // 插入新的投影片
            const insertStmt = db.prepare(`
              INSERT INTO project_slides (
                id, project_id, slide_index, content, background_image, transition, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            // 開始事務
            const insertMany = db.transaction((slides) => {
              for (let i = 0; i < slides.length; i++) {
                const slide = slides[i];
                insertStmt.run(
                  slide.id || `${project.id}_slide_${i}`,
                  project.id,
                  i,
                  slide.content || '',
                  slide.backgroundImage || null,
                  JSON.stringify(slide.transition || {}),
                  now
                );
              }
            });
            
            insertMany(project.slides);
          }
          
          return project.id;
        },
        
        /**
         * 根據ID獲取項目
         * @param {string} id - 項目ID
         * @returns {Object|null} 項目對象
         */
        getById: (id) => {
          // 獲取項目基本信息
          const projectStmt = db.prepare('SELECT * FROM projects WHERE id = ?');
          const project = projectStmt.get(id);
          
          if (!project) return null;
          
          // 獲取項目投影片
          const slidesStmt = db.prepare('SELECT * FROM project_slides WHERE project_id = ? ORDER BY slide_index');
          const slides = slidesStmt.all(id);
          
          return {
            id: project.id,
            name: project.name,
            description: project.description,
            songId: project.song_id,
            template: project.template,
            settings: JSON.parse(project.settings),
            createdAt: project.created_at,
            updatedAt: project.updated_at,
            slides: slides.map(slide => ({
              id: slide.id,
              content: slide.content,
              backgroundImage: slide.background_image,
              transition: JSON.parse(slide.transition)
            }))
          };
        },
        
        /**
         * 獲取全部項目
         * @returns {Array<Object>} 項目列表
         */
        getAll: () => {
          const stmt = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
          const projects = stmt.all();
          
          return projects.map(project => ({
            id: project.id,
            name: project.name,
            description: project.description,
            songId: project.song_id,
            template: project.template,
            settings: JSON.parse(project.settings),
            createdAt: project.created_at,
            updatedAt: project.updated_at
          }));
        },
        
        /**
         * 刪除項目
         * @param {string} id - 項目ID
         * @returns {boolean} 是否成功
         */
        delete: (id) => {
          // 開始事務
          const deleteProject = db.transaction(() => {
            // 刪除投影片
            const deleteSlides = db.prepare('DELETE FROM project_slides WHERE project_id = ?');
            deleteSlides.run(id);
            
            // 刪除項目
            const deleteProject = db.prepare('DELETE FROM projects WHERE id = ?');
            deleteProject.run(id);
          });
          
          try {
            deleteProject();
            return true;
          } catch (error) {
            log.error(`刪除項目 ${id} 失敗:`, error);
            return false;
          }
        }
      },
      
      // 設置相關方法
      settings: {
        /**
         * 保存設置
         * @param {string} key - 設置鍵
         * @param {*} value - 設置值
         */
        set: (key, value) => {
          const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          
          const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
          stmt.run(key, valueStr);
        },
        
        /**
         * 獲取設置
         * @param {string} key - 設置鍵
         * @param {*} defaultValue - 默認值
         * @returns {*} 設置值
         */
        get: (key, defaultValue = null) => {
          const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
          const result = stmt.get(key);
          
          if (!result) return defaultValue;
          
          try {
            // 嘗試解析為JSON
            return JSON.parse(result.value);
          } catch (e) {
            // 如果不是JSON，則返回原始值
            return result.value;
          }
        },
        
        /**
         * 獲取全部設置
         * @returns {Object} 設置對象
         */
        getAll: () => {
          const stmt = db.prepare('SELECT key, value FROM settings');
          const results = stmt.all();
          
          const settings = {};
          
          for (const result of results) {
            try {
              settings[result.key] = JSON.parse(result.value);
            } catch (e) {
              settings[result.key] = result.value;
            }
          }
          
          return settings;
        },
        
        /**
         * 刪除設置
         * @param {string} key - 設置鍵
         * @returns {boolean} 是否成功
         */
        delete: (key) => {
          const stmt = db.prepare('DELETE FROM settings WHERE key = ?');
          const result = stmt.run(key);
          return result.changes > 0;
        }
      },
      
      // 圖片相關方法
      images: {
        /**
         * 保存圖片記錄
         * @param {Object} image - 圖片對象
         * @returns {string} 圖片ID
         */
        save: (image) => {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO images (
              id, song_title, artist, file_path, provider, model, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          
          const now = Date.now();
          
          stmt.run(
            image.id,
            image.songTitle,
            image.artist || '',
            image.filePath,
            image.provider || 'unknown',
            image.model || 'unknown',
            now
          );
          
          return image.id;
        },
        
        /**
         * 根據歌曲信息查找圖片
         * @param {string} songTitle - 歌曲標題
         * @param {string} artist - 歌手名稱
         * @returns {Object|null} 圖片對象
         */
        findBySong: (songTitle, artist = '') => {
          let sql = 'SELECT * FROM images WHERE song_title = ?';
          const params = [songTitle];
          
          if (artist) {
            sql += ' AND artist = ?';
            params.push(artist);
          }
          
          sql += ' ORDER BY created_at DESC LIMIT 1';
          
          const stmt = db.prepare(sql);
          const result = stmt.get(...params);
          
          if (!result) return null;
          
          return {
            id: result.id,
            songTitle: result.song_title,
            artist: result.artist,
            filePath: result.file_path,
            provider: result.provider,
            model: result.model,
            createdAt: result.created_at
          };
        }
      },
      
      /**
       * 執行數據庫備份
       * @param {string} backupPath - 備份文件路徑
       * @returns {boolean} 是否成功
       */
      backup: (backupPath) => {
        try {
          db.backup(backupPath)
            .then(() => {
              log.info(`數據庫成功備份到: ${backupPath}`);
            })
            .catch(err => {
              log.error(`數據庫備份失敗: ${err.message}`);
            });
          return true;
        } catch (error) {
          log.error(`執行數據庫備份失敗: ${error.message}`);
          return false;
        }
      },
      
      /**
       * 關閉數據庫連接
       */
      close: () => {
        try {
          db.close();
          log.info('數據庫連接已關閉');
        } catch (error) {
          log.error(`關閉數據庫連接失敗: ${error.message}`);
        }
      }
    };
    
    return dbMethods;
  } catch (error) {
    log.error(`初始化SQLite數據庫失敗: ${error.message}`);
    return createMemoryDB();
  }
}

/**
 * 創建數據表
 * @param {Object} db - 數據庫實例
 */
function createTables(db) {
  db.exec(`
    -- 歌詞表
    CREATE TABLE IF NOT EXISTS lyrics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT,
      content TEXT NOT NULL,
      source TEXT,
      language TEXT,
      source_url TEXT,
      timestamp INTEGER NOT NULL
    );

    -- 項目表
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      song_id TEXT,
      template TEXT,
      settings TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- 項目投影片表
    CREATE TABLE IF NOT EXISTS project_slides (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      slide_index INTEGER NOT NULL,
      content TEXT,
      background_image TEXT,
      transition TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 設置表
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    
    -- 圖片記錄表
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      song_title TEXT NOT NULL,
      artist TEXT,
      file_path TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      created_at INTEGER NOT NULL
    );
    
    -- 索引
    CREATE INDEX IF NOT EXISTS idx_lyrics_title ON lyrics(title);
    CREATE INDEX IF NOT EXISTS idx_lyrics_artist ON lyrics(artist);
    CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);
    CREATE INDEX IF NOT EXISTS idx_slides_project ON project_slides(project_id);
    CREATE INDEX IF NOT EXISTS idx_images_song ON images(song_title, artist);
  `);
}

/**
 * 創建內存數據庫
 * @returns {Object} 內存數據庫方法
 */
function createMemoryDB() {
  log.info('創建內存數據庫');
  
  return {
    lyrics: {
      save: (lyric) => {
        if (!lyric.id) {
          throw new Error('歌詞ID不能為空');
        }
        
        memoryDB.lyrics.set(lyric.id, {
          ...lyric,
          timestamp: Date.now()
        });
        
        return lyric.id;
      },
      
      getById: (id) => {
        const lyric = memoryDB.lyrics.get(id);
        return lyric ? { ...lyric } : null;
      },
      
      search: (query) => {
        const results = [];
        
        for (const lyric of memoryDB.lyrics.values()) {
          let match = true;
          
          if (query.title && !lyric.title.includes(query.title)) {
            match = false;
          }
          
          if (match && query.artist && lyric.artist && !lyric.artist.includes(query.artist)) {
            match = false;
          }
          
          if (match && query.content && lyric.text && !lyric.text.includes(query.content)) {
            match = false;
          }
          
          if (match) {
            results.push({ ...lyric });
          }
        }
        
        return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
      },
      
      delete: (id) => {
        return memoryDB.lyrics.delete(id);
      },
      
      clear: () => {
        const count = memoryDB.lyrics.size;
        memoryDB.lyrics.clear();
        return count;
      }
    },
    
    projects: {
      save: (project) => {
        if (!project.id) {
          throw new Error('項目ID不能為空');
        }
        
        const now = Date.now();
        
        memoryDB.projects.set(project.id, {
          ...project,
          createdAt: project.createdAt || now,
          updatedAt: now
        });
        
        return project.id;
      },
      
      getById: (id) => {
        const project = memoryDB.projects.get(id);
        return project ? { ...project } : null;
      },
      
      getAll: () => {
        return Array.from(memoryDB.projects.values())
          .map(project => ({ ...project }))
          .sort((a, b) => b.updatedAt - a.updatedAt);
      },
      
      delete: (id) => {
        return memoryDB.projects.delete(id);
      }
    },
    
    settings: {
      set: (key, value) => {
        memoryDB.settings.set(key, value);
      },
      
      get: (key, defaultValue = null) => {
        return memoryDB.settings.has(key) ? memoryDB.settings.get(key) : defaultValue;
      },
      
      getAll: () => {
        const settings = {};
        
        for (const [key, value] of memoryDB.settings.entries()) {
          settings[key] = value;
        }
        
        return settings;
      },
      
      delete: (key) => {
        return memoryDB.settings.delete(key);
      }
    },
    
    images: {
      save: (image) => {
        if (!image.id) {
          image.id = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        }
        
        memoryDB.images.set(image.id, {
          ...image,
          createdAt: Date.now()
        });
        
        return image.id;
      },
      
      findBySong: (songTitle, artist = '') => {
        for (const image of memoryDB.images.values()) {
          if (image.songTitle === songTitle && (!artist || image.artist === artist)) {
            return { ...image };
          }
        }
        
        return null;
      }
    },
    
    backup: (backupPath) => {
      try {
        const data = {
          lyrics: Array.from(memoryDB.lyrics.values()),
          projects: Array.from(memoryDB.projects.values()),
          settings: Array.from(memoryDB.settings.entries()),
          images: Array.from(memoryDB.images.values())
        };
        
        fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
        log.info(`內存數據庫已備份到: ${backupPath}`);
        return true;
      } catch (error) {
        log.error(`內存數據庫備份失敗: ${error.message}`);
        return false;
      }
    },
    
    close: () => {
      log.info('關閉內存數據庫（無操作）');
    }
  };
}

// 數據庫文件路徑
const dbPath = app ? path.join(app.getPath('userData'), 'lyrics-to-slides.db') : 
                     path.join(__dirname, '../../data/lyrics-to-slides.db');

// 初始化數據庫
let db;

try {
  db = initSQLiteDatabase(dbPath);
  log.info(`數據庫初始化完成: ${dbPath}`);
} catch (error) {
  log.error(`數據庫初始化失敗: ${error.message}`);
  db = createMemoryDB();
}

module.exports = {
  db,
  initSQLiteDatabase
}; 