const fs = require('fs-extra');
const path = require('path');
const { Marp } = require('@marp-team/marp-core');
const log = require('electron-log');

/**
 * 導出服務類
 * 負責將歌詞和圖片導出為各種格式的演示文稿
 */
class ExportService {
  /**
   * 創建一個導出服務實例
   * @param {Object} options - 配置選項
   */
  constructor(options = {}) {
    this.options = {
      // 輸出目錄
      outputDir: options.outputDir || path.join(process.env.APPDATA || process.env.HOME, '.lyrics-to-slides', 'exports'),
      // 缓存目錄
      cacheDir: options.cacheDir || path.join(process.env.APPDATA || process.env.HOME, '.lyrics-to-slides', 'cache'),
      // 超時設置
      timeout: options.timeout || 60000,
      // Marp 主題
      theme: options.theme || 'default',
      // 默認輸出格式
      defaultFormat: options.defaultFormat || 'html',
      // 字體設置
      fonts: options.fonts || {
        heading: '"Microsoft JhengHei UI", "Microsoft YaHei", Arial, sans-serif',
        text: '"Microsoft JhengHei UI", "Microsoft YaHei", Arial, sans-serif'
      }
    };
    
    // 初始化 Marp 引擎
    this.marp = new Marp({
      html: true, // 允許 HTML
      math: false, // 禁用數學公式
      minifyCSS: false, // 不壓縮 CSS
      script: false, // 不允許 script 標籤
    });
    
    // 確保輸出目錄存在
    this._ensureOutputDirectory();
    
    // 當前導出任務
    this.currentExport = null;
    this.isCancelled = false;
    
    log.info('導出服務已初始化');
  }
  
  /**
   * 將投影片數據導出為演示文稿
   * @param {Object} data - 投影片數據
   * @param {string} outputPath - 輸出路徑
   * @param {Object} options - 導出選項
   * @param {Function} progressCallback - 進度回調
   * @returns {Promise<Object>} 導出結果
   */
  async exportSlideshow(data, outputPath, options = {}, progressCallback) {
    try {
      // 如果已有導出任務，則取消
      if (this.currentExport) {
        await this.cancelExport();
      }
      
      // 重置取消標誌
      this.isCancelled = false;
      
      // 設置當前導出任務
      this.currentExport = {
        id: `export_${Date.now()}`,
        startTime: new Date(),
        data,
        outputPath,
        options,
        progress: 0
      };
      
      // 報告開始進度
      this._reportProgress(0, '開始導出...', progressCallback);
      
      // 檢查數據有效性
      if (!data || !data.slides || !Array.isArray(data.slides) || data.slides.length === 0) {
        throw new Error('無效的投影片數據');
      }
      
      // 合併選項
      const exportOptions = {
        format: options.format || this.options.defaultFormat,
        title: options.title || data.title || '歌曲投影片',
        resolution: options.resolution || '16:9',
        theme: options.theme || this.options.theme,
        font: options.font || this.options.fonts.text,
        fontFamily: options.fontFamily || this.options.fonts.text,
        fontSize: options.fontSize || '60px',
        backgroundColor: options.backgroundColor || '#000000',
        textColor: options.textColor || '#FFFFFF',
        textShadow: options.textShadow !== undefined ? options.textShadow : true,
        lineHeight: options.lineHeight || 1.5,
        padding: options.padding || '50px',
        includeMetadata: options.includeMetadata !== undefined ? options.includeMetadata : true
      };
      
      // 確保輸出路徑有效
      const outputFilePath = this._ensureValidPath(outputPath, exportOptions.format);
      
      // 解析文件名和目錄
      const outputDir = path.dirname(outputFilePath);
      
      // 確保輸出目錄存在
      await fs.ensureDir(outputDir);
      
      // 報告準備階段
      this._reportProgress(0.1, '正在準備投影片數據...', progressCallback);
      
      // 生成Marp Markdown
      if (this.isCancelled) throw new Error('導出已取消');
      const markdown = await this._generateMarkdown(data, exportOptions, (progress) => {
        this._reportProgress(0.1 + progress * 0.4, '生成Markdown內容...', progressCallback);
      });
      
      // 報告轉換階段
      this._reportProgress(0.5, '正在轉換為演示文稿...', progressCallback);
      
      // 導出為對應格式
      let result;
      switch (exportOptions.format.toLowerCase()) {
        case 'html':
          result = await this._exportToHTML(markdown, outputFilePath, exportOptions, progressCallback);
          break;
        case 'pdf':
          result = await this._exportToPDF(markdown, outputFilePath, exportOptions, progressCallback);
          break;
        case 'pptx':
          result = await this._exportToPPTX(markdown, outputFilePath, exportOptions, progressCallback);
          break;
        case 'images':
          result = await this._exportToImages(markdown, outputFilePath, exportOptions, progressCallback);
          break;
        default:
          throw new Error(`不支持的導出格式: ${exportOptions.format}`);
      }
      
      // 報告完成進度
      this._reportProgress(1, '導出完成', progressCallback);
      
      // 清理當前導出任務
      this.currentExport = null;
      
      return {
        success: true,
        format: exportOptions.format,
        outputPath: outputFilePath,
        slides: data.slides.length,
        ...result
      };
    } catch (error) {
      // 記錄錯誤
      log.error('導出失敗:', error);
      
      // 報告錯誤
      this._reportProgress(0, `導出錯誤: ${error.message}`, progressCallback, true);
      
      // 清理當前導出任務
      this.currentExport = null;
      
      // 如果是取消錯誤，返回取消結果
      if (this.isCancelled) {
        return {
          success: false,
          cancelled: true,
          message: '導出已取消'
        };
      }
      
      // 返回錯誤結果
      return {
        success: false,
        error: error.message,
        message: `導出失敗: ${error.message}`
      };
    }
  }
  
  /**
   * 取消當前導出任務
   * @returns {Promise<boolean>} 取消是否成功
   */
  async cancelExport() {
    if (!this.currentExport) {
      return false;
    }
    
    this.isCancelled = true;
    log.info('導出任務已取消');
    
    // 等待一小段時間，確保其他操作能夠檢查取消標誌
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return true;
  }
  
  /**
   * 生成Marp Markdown
   * @param {Object} data - 投影片數據
   * @param {Object} options - 導出選項
   * @param {Function} progressCallback - 進度回調
   * @returns {Promise<string>} 生成的Markdown
   * @private
   */
  async _generateMarkdown(data, options, progressCallback) {
    try {
      let markdown = '';
      
      // 添加全局樣式
      markdown += `---\nmarp: true\ntheme: ${options.theme}\nsize: ${options.resolution}\nbackgroundSize: cover\npaginate: false\nheader: ''\nfooter: ''\n---\n\n`;
      
      // 添加自定義樣式
      markdown += `<style>\n`;
      markdown += `section { font-family: ${options.fontFamily}; color: ${options.textColor}; padding: ${options.padding}; line-height: ${options.lineHeight}; }\n`;
      if (options.textShadow) {
        markdown += `section p { text-shadow: 0 0 10px rgba(0, 0, 0, 0.7); }\n`;
      }
      markdown += `</style>\n\n`;
      
      // 處理每個投影片
      for (let i = 0; i < data.slides.length; i++) {
        // 檢查取消標誌
        if (this.isCancelled) throw new Error('導出已取消');
        
        const slide = data.slides[i];
        
        // 報告進度
        if (typeof progressCallback === 'function') {
          progressCallback(i / data.slides.length);
        }
        
        // 添加投影片分隔符
        if (i > 0) {
          markdown += '\n---\n\n';
        }
        
        // 添加背景圖片（如果有）
        if (slide.backgroundImage) {
          markdown += `![bg](${this._getImagePath(slide.backgroundImage)})\n\n`;
        } else if (slide.backgroundColor) {
          markdown += `<!-- _backgroundColor: ${slide.backgroundColor} -->\n\n`;
        } else {
          markdown += `<!-- _backgroundColor: ${options.backgroundColor} -->\n\n`;
        }
        
        // 根據文字位置添加樣式
        let textPosition = '';
        switch (slide.textPosition || 'center') {
          case 'top':
            textPosition = `\n<div style="position: absolute; top: 10%; left: 50%; transform: translateX(-50%); width: 90%; text-align: center;">\n\n`;
            break;
          case 'bottom':
            textPosition = `\n<div style="position: absolute; bottom: 10%; left: 50%; transform: translateX(-50%); width: 90%; text-align: center;">\n\n`;
            break;
          case 'center':
          default:
            textPosition = `\n<div style="display: flex; justify-content: center; align-items: center; height: 100%; text-align: center;">\n<div>\n\n`;
            break;
        }
        
        markdown += textPosition;
        
        // 添加歌詞文本
        if (slide.text) {
          markdown += `${slide.text.trim().replace(/\n/g, '\n\n')}\n\n`;
        }
        
        // 關閉div標籤
        if (slide.textPosition === 'center') {
          markdown += `\n</div>\n</div>\n`;
        } else {
          markdown += `\n</div>\n`;
        }
      }
      
      return markdown;
    } catch (error) {
      log.error('生成Markdown時出錯:', error);
      throw error;
    }
  }
  
  /**
   * 導出為HTML
   * @param {string} markdown - Markdown內容
   * @param {string} outputPath - 輸出路徑
   * @param {Object} options - 導出選項
   * @param {Function} progressCallback - 進度回調
   * @returns {Promise<Object>} 導出結果
   * @private
   */
  async _exportToHTML(markdown, outputPath, options, progressCallback) {
    try {
      // 報告進度
      this._reportProgress(0.6, '轉換為HTML...', progressCallback);
      
      // 使用Marp轉換為HTML
      const { html, css } = this.marp.render(markdown);
      
      // 創建完整的HTML文件
      const fullHtml = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <style>${css}</style>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; }
    .marp-slides { width: 100vw; height: 100vh; }
    .marp-slide { display: none; }
    .marp-slide.active { display: block; }
    
    /* 控制按鈕 */
    .controls {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      background-color: rgba(0, 0, 0, 0.5);
      padding: 10px;
      border-radius: 5px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .controls:hover { opacity: 1; }
    .controls button {
      background: none;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
      padding: 5px 10px;
    }
    .controls span {
      color: white;
      margin: 0 10px;
    }
  </style>
</head>
<body>
  <div class="marp-slides">
    ${html}
  </div>
  
  <div class="controls">
    <button id="prev">◀ 上一張</button>
    <span id="slide-counter">1 / 1</span>
    <button id="next">下一張 ▶</button>
    <button id="fullscreen">全螢幕</button>
  </div>
  
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const slides = document.querySelectorAll('.marp-slide');
      const prevBtn = document.getElementById('prev');
      const nextBtn = document.getElementById('next');
      const counter = document.getElementById('slide-counter');
      const fullscreenBtn = document.getElementById('fullscreen');
      
      let currentIndex = 0;
      const totalSlides = slides.length;
      
      // 初始化
      updateSlides();
      
      // 上一張按鈕
      prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
          currentIndex--;
          updateSlides();
        }
      });
      
      // 下一張按鈕
      nextBtn.addEventListener('click', () => {
        if (currentIndex < totalSlides - 1) {
          currentIndex++;
          updateSlides();
        }
      });
      
      // 全螢幕按鈕
      fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      });
      
      // 鍵盤控制
      document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
          if (currentIndex < totalSlides - 1) {
            currentIndex++;
            updateSlides();
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          if (currentIndex > 0) {
            currentIndex--;
            updateSlides();
          }
        } else if (e.key === 'Home') {
          currentIndex = 0;
          updateSlides();
        } else if (e.key === 'End') {
          currentIndex = totalSlides - 1;
          updateSlides();
        } else if (e.key === 'f' || e.key === 'F') {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
        }
      });
      
      // 更新投影片顯示
      function updateSlides() {
        slides.forEach((slide, index) => {
          if (index === currentIndex) {
            slide.classList.add('active');
          } else {
            slide.classList.remove('active');
          }
        });
        
        counter.textContent = \`\${currentIndex + 1} / \${totalSlides}\`;
      }
    });
  </script>
</body>
</html>
      `;
      
      // 報告進度
      this._reportProgress(0.8, '保存HTML文件...', progressCallback);
      
      // 檢查取消標誌
      if (this.isCancelled) throw new Error('導出已取消');
      
      // 寫入文件
      await fs.writeFile(outputPath, fullHtml, 'utf8');
      
      // 報告進度
      this._reportProgress(0.9, '完成HTML導出', progressCallback);
      
      return {
        format: 'html',
        filePath: outputPath,
        size: fullHtml.length
      };
    } catch (error) {
      log.error('導出為HTML時出錯:', error);
      throw error;
    }
  }
  
  /**
   * 導出為PDF（僅占位符，實際實現需要使用無頭瀏覽器或PDF庫）
   * @param {string} markdown - Markdown內容
   * @param {string} outputPath - 輸出路徑
   * @param {Object} options - 導出選項
   * @param {Function} progressCallback - 進度回調
   * @returns {Promise<Object>} 導出結果
   * @private
   */
  async _exportToPDF(markdown, outputPath, options, progressCallback) {
    // 這裡應該使用puppeteer或類似庫實現PDF導出
    // 為簡化實現，我們先導出為HTML，並提示使用者手動打開並另存為PDF
    
    // 修改輸出路徑為HTML
    const htmlPath = outputPath.replace(/\.pdf$/i, '.html');
    
    // 導出為HTML
    await this._exportToHTML(markdown, htmlPath, options, progressCallback);
    
    return {
      format: 'html_for_pdf',
      message: '已生成HTML文件，請手動打開並另存為PDF',
      filePath: htmlPath
    };
  }
  
  /**
   * 導出為PPTX（僅占位符，實際實現需要使用PPTX生成庫）
   * @param {string} markdown - Markdown內容
   * @param {string} outputPath - 輸出路徑
   * @param {Object} options - 導出選項
   * @param {Function} progressCallback - 進度回調
   * @returns {Promise<Object>} 導出結果
   * @private
   */
  async _exportToPPTX(markdown, outputPath, options, progressCallback) {
    // 這裡應該使用pptxgenjs或類似庫實現PPTX導出
    // 為簡化實現，我們先導出為HTML，並提示使用者手動打開並另存為PPTX
    
    // 修改輸出路徑為HTML
    const htmlPath = outputPath.replace(/\.pptx$/i, '.html');
    
    // 導出為HTML
    await this._exportToHTML(markdown, htmlPath, options, progressCallback);
    
    return {
      format: 'html_for_pptx',
      message: '已生成HTML文件，請手動打開並另存為PPTX',
      filePath: htmlPath
    };
  }
  
  /**
   * 導出為圖片（僅占位符，實際實現需要使用無頭瀏覽器或圖像庫）
   * @param {string} markdown - Markdown內容
   * @param {string} outputPath - 輸出路徑
   * @param {Object} options - 導出選項
   * @param {Function} progressCallback - 進度回調
   * @returns {Promise<Object>} 導出結果
   * @private
   */
  async _exportToImages(markdown, outputPath, options, progressCallback) {
    // 這裡應該使用puppeteer或類似庫實現圖片導出
    // 為簡化實現，我們先導出為HTML，並提示使用者手動打開並截圖
    
    // 創建輸出目錄
    const outputDir = outputPath.endsWith('.zip')
      ? outputPath.slice(0, -4)
      : outputPath;
    
    // 確保目錄存在
    await fs.ensureDir(outputDir);
    
    // 導出HTML到該目錄
    const htmlPath = path.join(outputDir, 'slides.html');
    await this._exportToHTML(markdown, htmlPath, options, progressCallback);
    
    return {
      format: 'html_for_images',
      message: '已生成HTML文件，請手動打開並截圖',
      filePath: htmlPath,
      outputDir
    };
  }
  
  /**
   * 確保輸出目錄存在
   * @private
   */
  _ensureOutputDirectory() {
    try {
      if (!fs.existsSync(this.options.outputDir)) {
        fs.mkdirSync(this.options.outputDir, { recursive: true });
        log.info(`創建輸出目錄: ${this.options.outputDir}`);
      }
    } catch (error) {
      log.error(`創建輸出目錄失敗:`, error);
    }
  }
  
  /**
   * 確保輸出路徑有效
   * @param {string} outputPath - 原始輸出路徑
   * @param {string} format - 導出格式
   * @returns {string} 有效的輸出路徑
   * @private
   */
  _ensureValidPath(outputPath, format) {
    // 如果沒有提供路徑，使用默認路徑
    if (!outputPath) {
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14);
      return path.join(this.options.outputDir, `slideshow_${timestamp}.${format}`);
    }
    
    // 檢查文件擴展名
    const extension = `.${format.toLowerCase()}`;
    if (!outputPath.toLowerCase().endsWith(extension)) {
      return `${outputPath}${extension}`;
    }
    
    return outputPath;
  }
  
  /**
   * 獲取圖片路徑
   * @param {string} imageFile - 圖片文件或URL
   * @returns {string} 處理後的圖片路徑
   * @private
   */
  _getImagePath(imageFile) {
    if (!imageFile) return '';
    
    // 如果是URL，直接返回
    if (imageFile.startsWith('http://') || imageFile.startsWith('https://')) {
      return imageFile;
    }
    
    // 如果是Base64數據，直接返回
    if (imageFile.startsWith('data:image/')) {
      return imageFile;
    }
    
    // 否則，嘗試作為本地文件路徑處理
    try {
      // 確保文件存在
      if (fs.existsSync(imageFile)) {
        return imageFile;
      } else {
        // 嘗試在緩存目錄中查找
        const cachedPath = path.join(this.options.cacheDir, path.basename(imageFile));
        if (fs.existsSync(cachedPath)) {
          return cachedPath;
        }
      }
    } catch (error) {
      log.error(`處理圖片路徑時出錯:`, error);
    }
    
    // 返回空字符串，表示找不到圖片
    return '';
  }
  
  /**
   * 報告進度
   * @param {number} progress - 進度(0-1)
   * @param {string} message - 進度消息
   * @param {Function} callback - 回調函數
   * @param {boolean} isError - 是否為錯誤
   * @private
   */
  _reportProgress(progress, message, callback, isError = false) {
    // 更新當前任務進度
    if (this.currentExport) {
      this.currentExport.progress = progress;
    }
    
    // 如果有回調函數，則調用
    if (typeof callback === 'function') {
      callback({
        progress,
        message,
        isError,
        timestamp: Date.now(),
        taskId: this.currentExport?.id || null
      });
    }
  }
}

module.exports = ExportService; 