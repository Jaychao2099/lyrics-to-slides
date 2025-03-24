/**
 * 項目數據模型
 * 代表一個歌曲投影片項目
 */
class Project {
  /**
   * 創建一個新的項目實例
   * @param {Object} options - 項目配置選項
   */
  constructor(options = {}) {
    // 項目元數據
    this.id = options.id || this._generateId();
    this.name = options.name || '未命名項目';
    this.created = options.created || new Date().toISOString();
    this.modified = options.modified || new Date().toISOString();
    this.version = options.version || '1.0.0';
    
    // 項目路徑（保存位置）
    this.filePath = options.filePath || null;
    
    // 項目設置
    this.settings = {
      // 顯示設置
      display: {
        resolution: options.settings?.display?.resolution || '16:9',
        width: options.settings?.display?.width || 1920,
        height: options.settings?.display?.height || 1080,
        backgroundColor: options.settings?.display?.backgroundColor || '#000000'
      },
      // 字體設置
      font: {
        family: options.settings?.font?.family || 'Microsoft JhengHei, Arial, sans-serif',
        size: options.settings?.font?.size || 60,
        color: options.settings?.font?.color || '#FFFFFF',
        weight: options.settings?.font?.weight || 'bold',
        shadow: options.settings?.font?.shadow || true,
        shadowColor: options.settings?.font?.shadowColor || 'rgba(0, 0, 0, 0.7)',
        position: options.settings?.font?.position || 'center', // center, top, bottom
        lineHeight: options.settings?.font?.lineHeight || 1.5,
        maxLines: options.settings?.font?.maxLines || 4
      },
      // 過渡設置
      transition: {
        type: options.settings?.transition?.type || 'fade',
        duration: options.settings?.transition?.duration || 0.5
      },
      // 導出設置
      export: {
        format: options.settings?.export?.format || 'pptx',
        quality: options.settings?.export?.quality || 'high'
      }
    };
    
    // 歌曲信息
    this.song = {
      title: options.song?.title || '',
      artist: options.song?.artist || '',
      album: options.song?.album || '',
      year: options.song?.year || '',
      language: options.song?.language || 'zh-TW'
    };
    
    // 歌詞內容
    this.lyrics = options.lyrics || [];
    
    // 投影片集合（每個投影片對應一個歌詞段落）
    this.slides = options.slides || [];
    
    // 使用的模板
    this.template = options.template || 'default';
    
    // 資源文件（如圖片）的引用集合
    this.resources = options.resources || [];
  }
  
  /**
   * 生成唯一項目ID
   * @private
   * @returns {string} UUID格式的唯一ID
   */
  _generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  /**
   * 更新項目修改時間
   */
  updateModified() {
    this.modified = new Date().toISOString();
  }
  
  /**
   * 添加或更新歌詞段落
   * @param {Object} paragraph - 歌詞段落對象
   * @param {number} index - 插入位置索引，如果不指定則添加到末尾
   */
  addOrUpdateLyricsParagraph(paragraph, index = -1) {
    if (index >= 0 && index < this.lyrics.length) {
      this.lyrics[index] = paragraph;
    } else {
      this.lyrics.push(paragraph);
    }
    this.updateModified();
  }
  
  /**
   * 移除歌詞段落
   * @param {number} index - 要移除的段落索引
   */
  removeLyricsParagraph(index) {
    if (index >= 0 && index < this.lyrics.length) {
      this.lyrics.splice(index, 1);
      this.updateModified();
      return true;
    }
    return false;
  }
  
  /**
   * 為一個歌詞段落創建投影片
   * @param {number} paragraphIndex - 歌詞段落索引
   * @param {Object} slideData - 投影片數據
   */
  createSlide(paragraphIndex, slideData = {}) {
    if (paragraphIndex < 0 || paragraphIndex >= this.lyrics.length) {
      return false;
    }
    
    const newSlide = {
      id: slideData.id || this._generateId(),
      lyricsIndex: paragraphIndex,
      text: this.lyrics[paragraphIndex].text,
      background: slideData.background || {
        type: 'color',
        value: '#000000'
      },
      textPosition: slideData.textPosition || {
        x: 0.5, // 相對位置，0-1範圍
        y: 0.5,
        alignment: 'center'
      },
      transition: slideData.transition || this.settings.transition,
      resources: slideData.resources || []
    };
    
    // 查找是否已存在該段落的投影片
    const existingIndex = this.slides.findIndex(slide => slide.lyricsIndex === paragraphIndex);
    
    if (existingIndex >= 0) {
      // 更新現有投影片
      this.slides[existingIndex] = newSlide;
    } else {
      // 添加新投影片
      this.slides.push(newSlide);
      // 確保投影片順序與歌詞段落順序一致
      this.slides.sort((a, b) => a.lyricsIndex - b.lyricsIndex);
    }
    
    this.updateModified();
    return newSlide;
  }
  
  /**
   * 更新投影片背景
   * @param {string} slideId - 投影片ID
   * @param {Object} background - 背景設置
   */
  updateSlideBackground(slideId, background) {
    const slide = this.slides.find(s => s.id === slideId);
    if (slide) {
      slide.background = background;
      
      // 如果背景是圖片，確保資源列表中有該圖片
      if (background.type === 'image' && background.value) {
        // 檢查資源是否已存在
        const resourceExists = this.resources.some(res => res.id === background.value);
        
        if (!resourceExists && background.resourceData) {
          // 添加新資源
          this.resources.push({
            id: background.value,
            type: 'image',
            data: background.resourceData,
            name: background.name || `image_${Date.now()}`
          });
          
          // 刪除臨時數據以節省空間
          delete background.resourceData;
        }
      }
      
      this.updateModified();
      return true;
    }
    return false;
  }
  
  /**
   * 獲取指定投影片
   * @param {string} slideId - 投影片ID
   * @returns {Object|null} 投影片對象或null
   */
  getSlide(slideId) {
    return this.slides.find(s => s.id === slideId) || null;
  }
  
  /**
   * 獲取指定資源
   * @param {string} resourceId - 資源ID
   * @returns {Object|null} 資源對象或null
   */
  getResource(resourceId) {
    return this.resources.find(r => r.id === resourceId) || null;
  }
  
  /**
   * 添加資源
   * @param {Object} resource - 資源對象
   * @returns {string} 資源ID
   */
  addResource(resource) {
    if (!resource.id) {
      resource.id = this._generateId();
    }
    
    this.resources.push(resource);
    this.updateModified();
    return resource.id;
  }
  
  /**
   * 移除資源
   * @param {string} resourceId - 資源ID
   * @returns {boolean} 是否成功移除
   */
  removeResource(resourceId) {
    const index = this.resources.findIndex(r => r.id === resourceId);
    if (index >= 0) {
      this.resources.splice(index, 1);
      
      // 同時更新使用此資源的投影片
      this.slides.forEach(slide => {
        if (slide.background.type === 'image' && slide.background.value === resourceId) {
          // 將背景重置為默認顏色
          slide.background = {
            type: 'color',
            value: '#000000'
          };
        }
        
        // 同時更新投影片資源列表
        if (slide.resources.includes(resourceId)) {
          slide.resources = slide.resources.filter(id => id !== resourceId);
        }
      });
      
      this.updateModified();
      return true;
    }
    return false;
  }
  
  /**
   * 將項目轉換為純JSON對象
   * @returns {Object} 純JSON對象
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      created: this.created,
      modified: this.modified,
      version: this.version,
      filePath: this.filePath,
      settings: this.settings,
      song: this.song,
      lyrics: this.lyrics,
      slides: this.slides,
      template: this.template,
      resources: this.resources
    };
  }
  
  /**
   * 從JSON對象創建項目實例
   * @param {Object|string} json - JSON對象或JSON字符串
   * @returns {Project} 項目實例
   */
  static fromJSON(json) {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }
    return new Project(json);
  }
}

module.exports = Project; 