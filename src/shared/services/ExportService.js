const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const PptxGenJS = require('pptxgenjs');
const jimp = require('jimp');
const log = require('electron-log');

/**
 * 投影片導出服務
 * 支持將項目導出為不同格式的投影片
 */
class ExportService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // 輸出路徑
      outputPath: options.outputPath || '',
      // 臨時文件路徑
      tempPath: options.tempPath || path.join(process.env.APPDATA || process.env.HOME, '.lyrics-to-slides', 'temp'),
      // 導出質量
      quality: options.quality || 'high',
      // 圖像格式
      imageFormat: options.imageFormat || 'png',
      // 字體設置
      fonts: options.fonts || []
    };
    
    // 確保臨時目錄存在
    if (!fs.existsSync(this.options.tempPath)) {
      fs.mkdirSync(this.options.tempPath, { recursive: true });
    }
    
    // 當前導出的任務ID
    this.currentTaskId = null;
    
    // 是否正在導出
    this.isExporting = false;
  }
  
  /**
   * 更新配置選項
   * @param {Object} options - 新的配置選項
   */
  updateOptions(options) {
    // 合併選項
    this.options = {
      ...this.options,
      ...options
    };
    
    // 確保輸出目錄存在
    if (this.options.outputPath && !fs.existsSync(this.options.outputPath)) {
      fs.mkdirSync(this.options.outputPath, { recursive: true });
    }
  }
  
  /**
   * 導出投影片
   * @param {Object} project - 項目數據
   * @param {string} format - 導出格式 (pptx, pdf, images)
   * @param {Object} options - 導出選項
   * @returns {Promise<Object>} 導出結果
   */
  async exportSlideshow(project, format, options = {}) {
    if (this.isExporting) {
      throw new Error('另一個導出任務正在進行中');
    }
    
    this.isExporting = true;
    const taskId = Date.now().toString();
    this.currentTaskId = taskId;
    
    // 設置默認輸出路徑
    const outputPath = options.outputPath || this.options.outputPath || process.cwd();
    
    // 設置默認輸出文件名
    const defaultFilename = this._sanitizeFilename(project.name || 'slideshow');
    const filename = options.filename || defaultFilename;
    
    try {
      // 根據格式導出
      let result;
      
      switch (format.toLowerCase()) {
        case 'pptx':
          result = await this._exportToPptx(project, outputPath, filename, options);
          break;
        case 'pdf':
          result = await this._exportToPdf(project, outputPath, filename, options);
          break;
        case 'images':
          result = await this._exportToImages(project, outputPath, filename, options);
          break;
        default:
          throw new Error(`不支持的導出格式: ${format}`);
      }
      
      this.isExporting = false;
      this.currentTaskId = null;
      
      // 觸發完成事件
      this.emit('export-complete', {
        taskId,
        format,
        result
      });
      
      return result;
    } catch (error) {
      this.isExporting = false;
      this.currentTaskId = null;
      
      // 觸發錯誤事件
      this.emit('export-error', {
        taskId,
        error: error.message
      });
      
      log.error('導出錯誤:', error);
      throw error;
    }
  }
  
  /**
   * 取消當前導出任務
   */
  cancelExport() {
    if (this.isExporting && this.currentTaskId) {
      this.isExporting = false;
      const canceledTaskId = this.currentTaskId;
      this.currentTaskId = null;
      
      // 觸發取消事件
      this.emit('export-canceled', {
        taskId: canceledTaskId
      });
      
      return true;
    }
    
    return false;
  }
  
  /**
   * 導出為PowerPoint格式
   * @param {Object} project - 項目數據
   * @param {string} outputPath - 輸出路徑
   * @param {string} filename - 文件名
   * @param {Object} options - 導出選項
   * @returns {Promise<Object>} 導出結果
   * @private
   */
  async _exportToPptx(project, outputPath, filename, options) {
    // 創建新的PowerPoint文檔
    const pptx = new PptxGenJS();
    
    // 設置演示文稿屬性
    pptx.author = project.song.artist || 'Lyrics to Slides Generator';
    pptx.title = project.song.title || project.name;
    pptx.subject = project.song.album || '';
    
    // 設置幻燈片大小
    const { width, height } = project.settings.display;
    pptx.defineLayout({
      name: 'CUSTOM',
      width: width / 72,
      height: height / 72
    });
    pptx.layout = 'CUSTOM';
    
    // 當前導出任務ID
    const taskId = this.currentTaskId;
    const totalSlides = project.slides.length;
    
    // 處理每張幻燈片
    for (let i = 0; i < project.slides.length; i++) {
      // 檢查是否已取消
      if (this.currentTaskId !== taskId) {
        throw new Error('導出已取消');
      }
      
      const slide = project.slides[i];
      const slideObj = pptx.addSlide();
      
      // 設置背景
      if (slide.background) {
        if (slide.background.type === 'color') {
          // 顏色背景
          slideObj.background = { color: slide.background.value };
        } else if (slide.background.type === 'image') {
          // 圖片背景
          const resource = project.resources.find(r => r.id === slide.background.value);
          if (resource && resource.data) {
            const imgData = typeof resource.data === 'string' ? 
                            Buffer.from(resource.data, 'base64') : 
                            resource.data;
            
            // 根據模板可能需要調整圖片
            slideObj.background = { data: imgData };
          } else {
            // 默認黑色背景
            slideObj.background = { color: '#000000' };
          }
        }
      }
      
      // 添加文本
      if (slide.text) {
        const textOptions = {
          x: slide.textPosition?.x || 0.5,
          y: slide.textPosition?.y || 0.5,
          w: '90%',
          h: '80%',
          align: (slide.textPosition?.alignment || 'center').toUpperCase(),
          valign: 'middle',
          color: project.settings.font.color,
          fontSize: project.settings.font.size,
          fontFace: project.settings.font.family,
          bold: project.settings.font.weight === 'bold',
          shadow: project.settings.font.shadow ? {
            type: 'outer',
            color: project.settings.font.shadowColor,
            blur: 10,
            offset: 3,
            angle: 45
          } : undefined
        };
        
        slideObj.addText(slide.text, textOptions);
      }
      
      // 進度更新
      this.emit('export-progress', {
        taskId,
        current: i + 1,
        total: totalSlides,
        percentage: Math.round(((i + 1) / totalSlides) * 100)
      });
    }
    
    // 處理輸出路徑
    const fullPath = path.join(outputPath, `${filename}.pptx`);
    
    // 導出文件
    await pptx.writeFile({ fileName: fullPath });
    
    return {
      format: 'pptx',
      path: fullPath,
      filename: `${filename}.pptx`,
      slideCount: project.slides.length
    };
  }
  
  /**
   * 導出為PDF格式
   * @param {Object} project - 項目數據
   * @param {string} outputPath - 輸出路徑
   * @param {string} filename - 文件名
   * @param {Object} options - 導出選項
   * @returns {Promise<Object>} 導出結果
   * @private
   */
  async _exportToPdf(project, outputPath, filename, options) {
    // 首先導出為PPTX，然後轉換為PDF
    // 由於PptxGenJS不直接支持PDF導出，我們首先生成PPTX，然後使用其他工具轉換
    // 此處我們使用臨時文件
    const tmpFilename = `tmp_${Date.now()}`;
    const pptxResult = await this._exportToPptx(project, this.options.tempPath, tmpFilename, options);
    
    // 處理輸出路徑
    const fullPath = path.join(outputPath, `${filename}.pdf`);
    
    // 這裡我們假設使用了外部工具進行轉換
    // 在實際應用中，可能需要整合 LibreOffice, unoconv, pdf-puppeteer 等第三方工具
    // 目前僅返回PPTX路徑，實際實現需要根據環境補充
    
    return {
      format: 'pdf',
      path: fullPath,
      pptxPath: pptxResult.path,
      filename: `${filename}.pdf`,
      slideCount: project.slides.length,
      note: '注意：PDF轉換需要外部工具支持，請查看文檔了解如何配置'
    };
  }
  
  /**
   * 導出為圖片格式
   * @param {Object} project - 項目數據
   * @param {string} outputPath - 輸出路徑
   * @param {string} filename - 文件名
   * @param {Object} options - 導出選項
   * @returns {Promise<Object>} 導出結果
   * @private
   */
  async _exportToImages(project, outputPath, filename, options) {
    // 創建輸出目錄
    const dirPath = path.join(outputPath, filename);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // 當前導出任務ID
    const taskId = this.currentTaskId;
    const totalSlides = project.slides.length;
    const imageFormat = options.imageFormat || this.options.imageFormat;
    const imageQuality = options.quality || this.options.quality;
    
    // 設置質量參數
    let quality = 80;
    if (imageQuality === 'low') quality = 60;
    if (imageQuality === 'high') quality = 90;
    
    // 處理每張幻燈片
    const imagePaths = [];
    
    for (let i = 0; i < project.slides.length; i++) {
      // 檢查是否已取消
      if (this.currentTaskId !== taskId) {
        throw new Error('導出已取消');
      }
      
      const slide = project.slides[i];
      const slideNumber = String(i + 1).padStart(3, '0');
      const imagePath = path.join(dirPath, `slide_${slideNumber}.${imageFormat}`);
      
      // 創建圖像
      try {
        // 創建空白圖像
        const { width, height } = project.settings.display;
        const image = new jimp(width, height);
        
        // 設置背景
        if (slide.background) {
          if (slide.background.type === 'color') {
            // 顏色背景
            const color = slide.background.value || '#000000';
            // 將十六進制顏色轉換為Jimp顏色格式
            const hexColor = color.replace('#', '');
            const r = parseInt(hexColor.substr(0, 2), 16);
            const g = parseInt(hexColor.substr(2, 2), 16);
            const b = parseInt(hexColor.substr(4, 2), 16);
            const jimpColor = jimp.rgbaToInt(r, g, b, 255);
            image.background(jimpColor);
          } else if (slide.background.type === 'image') {
            // 圖片背景
            const resource = project.resources.find(r => r.id === slide.background.value);
            if (resource && resource.data) {
              // 讀取圖像數據
              const backgroundImage = await jimp.read(
                Buffer.from(typeof resource.data === 'string' ? resource.data : resource.data.toString(), 'base64')
              );
              
              // 調整大小以適應幻燈片
              backgroundImage.cover(width, height);
              
              // 合併到主圖像
              image.composite(backgroundImage, 0, 0);
            }
          }
        }
        
        // 添加文本
        // 注意：Jimp的文本功能有限，若需要高級文本渲染，可能需要結合其他庫
        // 這裡僅做簡單示例
        if (slide.text) {
          // 在實際應用中，可能需要結合canvas或其他庫來處理複雜文本渲染
          // 此處僅為示例，實際實現可能需要更複雜的文本處理
          // 需要加載字體...
          
          /* 
          // 以下是示例代碼，實際需要根據所使用字體進行調整
          const font = await jimp.loadFont(jimp.FONT_SANS_32_WHITE);
          image.print(
            font,
            0,
            0,
            {
              text: slide.text,
              alignmentX: jimp.HORIZONTAL_ALIGN_CENTER,
              alignmentY: jimp.VERTICAL_ALIGN_MIDDLE
            },
            width,
            height
          );
          */
        }
        
        // 保存圖像
        await image.quality(quality).writeAsync(imagePath);
        imagePaths.push(imagePath);
      } catch (error) {
        log.error(`導出幻燈片 ${i+1} 時發生錯誤:`, error);
        throw new Error(`處理幻燈片 ${i+1} 時發生錯誤: ${error.message}`);
      }
      
      // 進度更新
      this.emit('export-progress', {
        taskId,
        current: i + 1,
        total: totalSlides,
        percentage: Math.round(((i + 1) / totalSlides) * 100),
        currentPath: imagePath
      });
    }
    
    return {
      format: 'images',
      directory: dirPath,
      files: imagePaths,
      count: imagePaths.length,
      imageFormat
    };
  }
  
  /**
   * 清理文件名，移除非法字符
   * @param {string} filename - 原始文件名
   * @returns {string} 處理後的文件名
   * @private
   */
  _sanitizeFilename(filename) {
    // 移除非法字符
    return filename.replace(/[\\/:*?"<>|]/g, '_');
  }
}

module.exports = ExportService; 