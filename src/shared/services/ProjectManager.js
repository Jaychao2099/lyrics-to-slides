const fs = require('fs-extra');
const path = require('path');
const log = require('electron-log');
const { app } = require('electron');

/**
 * 項目管理服務
 * 負責項目的創建、載入、保存和管理
 */
class ProjectManager {
  /**
   * 建立項目管理器
   * @param {Object} options - 配置選項
   */
  constructor(options = {}) {
    this.options = {
      // 預設項目存儲位置
      projectsPath: options.projectsPath || path.join(app.getPath('documents'), '歌曲投影片生成器', 'projects'),
      // 是否啟用自動保存
      autoSave: options.autoSave !== undefined ? options.autoSave : true,
      // 自動保存間隔 (ms)
      autoSaveInterval: options.autoSaveInterval || 300000, // 5分鐘
      // 最近的項目數量
      recentProjectsLimit: options.recentProjectsLimit || 10
    };
    
    // 當前項目數據
    this.currentProject = null;
    this.currentProjectPath = null;
    this.isProjectModified = false;
    
    // 最近項目列表
    this.recentProjects = [];
    
    // 確保項目目錄存在
    this._ensureProjectsDirectory();
    
    // 設置自動保存
    if (this.options.autoSave) {
      this.autoSaveTimer = setInterval(() => {
        this._autoSaveProject();
      }, this.options.autoSaveInterval);
    }
    
    log.info('項目管理器已初始化');
  }
  
  /**
   * 創建新項目
   * @param {Object} options - 項目選項
   * @returns {Object} 新創建的項目
   */
  createNewProject(options = {}) {
    // 檢查是否需要保存當前項目
    if (this.isProjectModified && this.currentProject) {
      log.info('創建新項目前檢測到未保存的更改');
    }
    
    // 生成一個唯一ID
    const projectId = this._generateId();
    
    // 創建新項目數據
    this.currentProject = {
      id: projectId,
      name: options.name || '未命名項目',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      title: options.title || '',
      artist: options.artist || '',
      source: options.source || '',
      sourceUrl: options.sourceUrl || '',
      language: options.language || 'auto',
      lyrics: options.lyrics || [],
      slides: options.slides || [],
      settings: {
        display: {
          resolution: options.resolution || '16:9',
          width: options.width || 1920,
          height: options.height || 1080,
          backgroundColor: options.backgroundColor || '#000000'
        },
        font: {
          family: options.fontFamily || 'Microsoft JhengHei, Arial, sans-serif',
          size: options.fontSize || 60,
          color: options.fontColor || '#FFFFFF',
          weight: options.fontWeight || 'bold',
          shadow: options.fontShadow !== undefined ? options.fontShadow : true,
          shadowColor: options.fontShadowColor || 'rgba(0, 0, 0, 0.7)',
          position: options.textPosition || 'center',
          lineHeight: options.lineHeight || 1.5,
          maxLines: options.maxLines || 4
        },
        transition: {
          type: options.transitionType || 'fade',
          duration: options.transitionDuration || 0.5
        },
        export: {
          format: options.exportFormat || 'pptx',
          quality: options.exportQuality || 'high'
        }
      }
    };
    
    // 重置當前項目路徑和修改狀態
    this.currentProjectPath = null;
    this.isProjectModified = false;
    
    log.info('已創建新項目, ID:', projectId);
    
    return this.currentProject;
  }
  
  /**
   * 載入項目
   * @param {string} filePath - 項目文件路徑
   * @returns {Promise<Object>} 載入的項目數據
   */
  async loadProject(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('無效的項目文件路徑');
    }
    
    try {
      log.info('嘗試載入項目:', filePath);
      
      // 檢查文件是否存在
      if (!await fs.pathExists(filePath)) {
        throw new Error(`項目文件不存在: ${filePath}`);
      }
      
      // 讀取文件內容
      const fileData = await fs.readFile(filePath, 'utf8');
      
      // 解析JSON
      let projectData;
      try {
        projectData = JSON.parse(fileData);
      } catch (parseError) {
        throw new Error(`項目文件格式無效: ${parseError.message}`);
      }
      
      // 驗證項目數據結構
      if (!projectData || !projectData.id) {
        throw new Error('項目數據結構無效');
      }
      
      // 更新當前項目
      this.currentProject = projectData;
      this.currentProjectPath = filePath;
      this.isProjectModified = false;
      
      // 添加到最近項目
      this._addToRecentProjects(filePath);
      
      log.info('項目載入成功, ID:', projectData.id);
      
      return projectData;
    } catch (error) {
      log.error('載入項目失敗:', error);
      throw error;
    }
  }
  
  /**
   * 保存當前項目
   * @param {string} [filePath] - 可選的保存路徑，如果不提供則使用當前路徑或生成新路徑
   * @returns {Promise<Object>} 保存結果
   */
  async saveProject(filePath) {
    if (!this.currentProject) {
      throw new Error('沒有可保存的項目');
    }
    
    try {
      // 決定保存路徑
      const targetPath = filePath || this.currentProjectPath;
      
      // 如果沒有路徑，則生成一個新路徑
      if (!targetPath) {
        const fileName = this._sanitizeFileName(this.currentProject.name || '未命名項目');
        this.currentProjectPath = path.join(
          this.options.projectsPath, 
          `${fileName}_${this._generateId().substring(0, 8)}.lsp`
        );
      } else {
        this.currentProjectPath = targetPath;
      }
      
      // 更新修改時間
      this.currentProject.modified = new Date().toISOString();
      
      // 準備保存數據
      const dataToSave = JSON.stringify(this.currentProject, null, 2);
      
      // 確保目錄存在
      await fs.ensureDir(path.dirname(this.currentProjectPath));
      
      // 寫入文件
      await fs.writeFile(this.currentProjectPath, dataToSave, 'utf8');
      
      // 更新狀態
      this.isProjectModified = false;
      
      // 添加到最近項目
      this._addToRecentProjects(this.currentProjectPath);
      
      log.info('項目保存成功:', this.currentProjectPath);
      
      return {
        success: true,
        path: this.currentProjectPath,
        project: this.currentProject
      };
    } catch (error) {
      log.error('保存項目失敗:', error);
      throw error;
    }
  }
  
  /**
   * 更新當前項目數據
   * @param {Object} updates - 要更新的數據
   * @returns {Object} 更新後的項目
   */
  updateProject(updates) {
    if (!this.currentProject) {
      throw new Error('沒有當前項目可更新');
    }
    
    try {
      // 深度合併更新
      this._deepMerge(this.currentProject, updates);
      
      // 更新修改時間
      this.currentProject.modified = new Date().toISOString();
      
      // 標記為已修改
      this.isProjectModified = true;
      
      log.info('項目已更新');
      
      return this.currentProject;
    } catch (error) {
      log.error('更新項目失敗:', error);
      throw error;
    }
  }
  
  /**
   * 獲取最近項目列表
   * @returns {Array<Object>} 最近項目列表
   */
  getRecentProjects() {
    return this.recentProjects;
  }
  
  /**
   * 檢查當前項目是否已修改
   * @returns {boolean} 是否已修改
   */
  hasUnsavedChanges() {
    return this.isProjectModified;
  }
  
  /**
   * 關閉當前項目
   * @returns {boolean} 關閉成功與否
   */
  closeCurrentProject() {
    this.currentProject = null;
    this.currentProjectPath = null;
    this.isProjectModified = false;
    log.info('當前項目已關閉');
    return true;
  }
  
  /**
   * 確保項目目錄存在
   * @private
   */
  _ensureProjectsDirectory() {
    try {
      if (!fs.existsSync(this.options.projectsPath)) {
        fs.mkdirSync(this.options.projectsPath, { recursive: true });
        log.info('已創建項目目錄:', this.options.projectsPath);
      }
    } catch (error) {
      log.error('創建項目目錄失敗:', error);
    }
  }
  
  /**
   * 自動保存當前項目
   * @private
   */
  async _autoSaveProject() {
    if (this.isProjectModified && this.currentProject && this.currentProjectPath) {
      try {
        log.info('執行自動保存...');
        await this.saveProject(this.currentProjectPath);
        log.info('自動保存成功');
      } catch (error) {
        log.error('自動保存失敗:', error);
      }
    }
  }
  
  /**
   * 添加項目到最近項目列表
   * @param {string} filePath - 項目文件路徑
   * @private
   */
  _addToRecentProjects(filePath) {
    // 刪除已存在的相同項目
    this.recentProjects = this.recentProjects.filter(p => p.path !== filePath);
    
    // 添加到列表開頭
    this.recentProjects.unshift({
      path: filePath,
      name: this.currentProject.name,
      time: new Date().toISOString()
    });
    
    // 限制列表長度
    if (this.recentProjects.length > this.options.recentProjectsLimit) {
      this.recentProjects = this.recentProjects.slice(0, this.options.recentProjectsLimit);
    }
  }
  
  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   * @private
   */
  _generateId() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
  }
  
  /**
   * 淨化文件名
   * @param {string} name - 原始名稱
   * @returns {string} 淨化後的文件名
   * @private
   */
  _sanitizeFileName(name) {
    return name
      .replace(/[^\w\s\u4e00-\u9fa5]/g, '_') // 替換非字母數字、空格和中文字符
      .replace(/\s+/g, '_') // 替換空格為下劃線
      .trim();
  }
  
  /**
   * 深度合併對象
   * @param {Object} target - 目標對象
   * @param {Object} source - 源對象
   * @returns {Object} 合併後的對象
   * @private
   */
  _deepMerge(target, source) {
    if (!source) return target;
    
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        this._deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    });
    
    return target;
  }
}

module.exports = ProjectManager; 