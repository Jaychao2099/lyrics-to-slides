/**
 * 投影片管理模塊
 * 負責投影片的創建、編輯和管理
 */
class SlideModule {
  constructor() {
    this.slides = [];
    this.activeSlideIndex = -1;
    this.projectModule = null;
    this.lyricsModule = null;
    this.imageGenerationInProgress = false;
    this.selectedBackground = {
      type: 'color',
      value: '#000000'
    };
    
    // 常用的DOM元素引用
    this.elements = {
      slidesList: document.getElementById('slides-list'),
      slideEditor: document.getElementById('slide-editor'),
      slidePreview: document.getElementById('slide-preview'),
      slideProperties: document.getElementById('slide-properties'),
      backgroundOptions: document.getElementById('background-options'),
      imageGenerateButton: document.getElementById('generate-image-button'),
      imageUploadButton: document.getElementById('upload-image-button'),
      textPositionButtons: document.querySelectorAll('.position-btn'),
      textAlignButtons: document.querySelectorAll('.align-btn')
    };
    
    // 初始化事件監聽器
    this.initEventListeners();
  }
  
  /**
   * 初始化模塊
   * @param {Object} dependencies - 依賴模塊
   */
  init(dependencies) {
    this.projectModule = dependencies.projectModule;
    this.lyricsModule = dependencies.lyricsModule;
    this.dialogModule = dependencies.dialogModule;
    
    // 註冊IPC事件監聽器
    window.electronAPI.on('image-generation-progress', this.handleImageGenerationProgress.bind(this));
    window.electronAPI.on('image-generation-complete', this.handleImageGenerationComplete.bind(this));
    
    console.log('投影片模塊已初始化');
  }
  
  /**
   * 初始化事件監聽器
   */
  initEventListeners() {
    // 背景選項處理
    if (this.elements.backgroundOptions) {
      const colorPicker = this.elements.backgroundOptions.querySelector('#background-color');
      if (colorPicker) {
        colorPicker.addEventListener('change', (e) => {
          this.setBackgroundColor(e.target.value);
        });
      }
    }
    
    // 圖像生成按鈕
    if (this.elements.imageGenerateButton) {
      this.elements.imageGenerateButton.addEventListener('click', () => {
        this.generateImageForSlide();
      });
    }
    
    // 圖像上傳按鈕
    if (this.elements.imageUploadButton) {
      this.elements.imageUploadButton.addEventListener('click', () => {
        this.uploadImageForSlide();
      });
    }
    
    // 文字位置按鈕
    this.elements.textPositionButtons.forEach(button => {
      button.addEventListener('click', () => {
        const position = button.getAttribute('data-position');
        this.setTextPosition(position);
      });
    });
    
    // 文字對齊按鈕
    this.elements.textAlignButtons.forEach(button => {
      button.addEventListener('click', () => {
        const align = button.getAttribute('data-align');
        this.setTextAlignment(align);
      });
    });
  }
  
  /**
   * 根據項目數據創建投影片
   * @param {Object} projectData - 項目數據
   */
  createSlidesFromProject(projectData) {
    this.slides = projectData.slides || [];
    
    // 如果沒有投影片但有歌詞，則為每個段落創建投影片
    if (this.slides.length === 0 && projectData.lyrics && projectData.lyrics.length > 0) {
      projectData.lyrics.forEach((paragraph, index) => {
        this.createSlideForParagraph(index, projectData.settings);
      });
    }
    
    // 設置活動投影片為第一張（如果有）
    if (this.slides.length > 0) {
      this.activeSlideIndex = 0;
    } else {
      this.activeSlideIndex = -1;
    }
    
    // 渲染投影片列表
    this.renderSlidesList();
    
    // 渲染活動投影片
    this.renderActiveSlide();
  }
  
  /**
   * 為歌詞段落創建投影片
   * @param {number} paragraphIndex - 段落索引
   * @param {Object} settings - 項目設置
   * @returns {Object} 新創建的投影片對象
   */
  createSlideForParagraph(paragraphIndex, settings) {
    if (!this.projectModule) return null;
    
    const projectData = this.projectModule.getProjectData();
    if (!projectData.lyrics || paragraphIndex >= projectData.lyrics.length) return null;
    
    const slideId = this.generateId();
    const newSlide = {
      id: slideId,
      lyricsIndex: paragraphIndex,
      text: projectData.lyrics[paragraphIndex].text,
      background: {
        type: 'color',
        value: settings?.display?.backgroundColor || '#000000'
      },
      textPosition: {
        x: 0.5,
        y: 0.5,
        alignment: 'center'
      },
      transition: settings?.transition || {
        type: 'fade',
        duration: 0.5
      },
      resources: []
    };
    
    this.slides.push(newSlide);
    
    // 確保投影片按照歌詞順序排序
    this.slides.sort((a, b) => a.lyricsIndex - b.lyricsIndex);
    
    // 標記項目為已修改
    if (this.projectModule) {
      this.projectModule.markAsModified();
    }
    
    return newSlide;
  }
  
  /**
   * 更新投影片列表
   */
  renderSlidesList() {
    if (!this.elements.slidesList) return;
    
    // 清空現有內容
    this.elements.slidesList.innerHTML = '';
    
    if (this.slides.length === 0) {
      // 顯示空狀態
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <p>尚未創建投影片</p>
        <p>請先添加歌詞段落</p>
      `;
      this.elements.slidesList.appendChild(emptyState);
      return;
    }
    
    // 創建投影片縮略圖
    this.slides.forEach((slide, index) => {
      const slideItem = document.createElement('div');
      slideItem.className = `slide-item ${index === this.activeSlideIndex ? 'active' : ''}`;
      slideItem.setAttribute('data-slide-index', index);
      
      // 創建縮略圖
      const thumbnail = document.createElement('div');
      thumbnail.className = 'slide-thumbnail';
      
      // 設置縮略圖背景
      if (slide.background.type === 'color') {
        thumbnail.style.backgroundColor = slide.background.value;
      } else if (slide.background.type === 'image') {
        // 從項目資源中獲取圖片
        const projectData = this.projectModule.getProjectData();
        const resource = projectData.resources.find(r => r.id === slide.background.value);
        
        if (resource && resource.data) {
          thumbnail.style.backgroundImage = `url(${resource.data})`;
          thumbnail.style.backgroundSize = 'cover';
          thumbnail.style.backgroundPosition = 'center';
        } else {
          thumbnail.style.backgroundColor = '#333333';
        }
      }
      
      // 添加文本預覽
      const textPreview = document.createElement('div');
      textPreview.className = 'slide-text-preview';
      textPreview.textContent = slide.text.substring(0, 50) + (slide.text.length > 50 ? '...' : '');
      
      // 添加序號標籤
      const slideNumber = document.createElement('div');
      slideNumber.className = 'slide-number';
      slideNumber.textContent = (index + 1).toString();
      
      // 將元素添加到縮略圖中
      thumbnail.appendChild(textPreview);
      thumbnail.appendChild(slideNumber);
      slideItem.appendChild(thumbnail);
      
      // 添加事件監聽器
      slideItem.addEventListener('click', () => {
        this.selectSlide(index);
      });
      
      this.elements.slidesList.appendChild(slideItem);
    });
  }
  
  /**
   * 選擇投影片
   * @param {number} index - 投影片索引
   */
  selectSlide(index) {
    if (index < 0 || index >= this.slides.length) return;
    
    // 更新選中的投影片索引
    this.activeSlideIndex = index;
    
    // 更新投影片列表中的選中狀態
    const slideItems = this.elements.slidesList.querySelectorAll('.slide-item');
    slideItems.forEach((item, i) => {
      if (i === index) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    
    // 渲染選中的投影片
    this.renderActiveSlide();
    
    // 同步選中相應的歌詞段落
    if (this.lyricsModule && this.slides[index]) {
      this.lyricsModule.selectParagraph(this.slides[index].lyricsIndex);
    }
  }
  
  /**
   * 渲染當前選中的投影片
   */
  renderActiveSlide() {
    if (!this.elements.slidePreview) return;
    
    if (this.activeSlideIndex < 0 || this.activeSlideIndex >= this.slides.length) {
      // 沒有選中投影片，顯示空狀態
      this.elements.slidePreview.innerHTML = `
        <div class="empty-preview">
          <p>沒有選中投影片</p>
          <p>請從左側列表選擇投影片</p>
        </div>
      `;
      
      // 清空屬性面板
      if (this.elements.slideProperties) {
        this.elements.slideProperties.innerHTML = '';
      }
      
      return;
    }
    
    const slide = this.slides[this.activeSlideIndex];
    
    // 更新預覽
    this.elements.slidePreview.innerHTML = '';
    
    // 創建投影片預覽容器
    const previewContainer = document.createElement('div');
    previewContainer.className = 'slide-preview-container';
    
    // 設置背景
    if (slide.background.type === 'color') {
      previewContainer.style.backgroundColor = slide.background.value;
    } else if (slide.background.type === 'image') {
      // 從項目資源中獲取圖片
      const projectData = this.projectModule.getProjectData();
      const resource = projectData.resources.find(r => r.id === slide.background.value);
      
      if (resource && resource.data) {
        previewContainer.style.backgroundImage = `url(${resource.data})`;
        previewContainer.style.backgroundSize = 'cover';
        previewContainer.style.backgroundPosition = 'center';
      } else {
        previewContainer.style.backgroundColor = '#333333';
      }
    }
    
    // 創建文字容器
    const textContainer = document.createElement('div');
    textContainer.className = 'slide-text-container';
    
    // 設置文字位置和對齊方式
    textContainer.style.justifyContent = this.getJustifyContent(slide.textPosition.y);
    textContainer.style.alignItems = this.getAlignItems(slide.textPosition.x);
    textContainer.style.textAlign = slide.textPosition.alignment;
    
    // 添加文字
    const textElement = document.createElement('div');
    textElement.className = 'slide-text';
    textElement.textContent = slide.text;
    
    textContainer.appendChild(textElement);
    previewContainer.appendChild(textContainer);
    this.elements.slidePreview.appendChild(previewContainer);
    
    // 更新屬性面板
    this.renderSlideProperties(slide);
  }
  
  /**
   * 渲染投影片屬性面板
   * @param {Object} slide - 投影片對象
   */
  renderSlideProperties(slide) {
    if (!this.elements.slideProperties) return;
    
    // 更新背景顏色選擇器
    const colorPicker = this.elements.slideProperties.querySelector('#background-color');
    if (colorPicker && slide.background.type === 'color') {
      colorPicker.value = slide.background.value;
    }
    
    // 更新文字位置按鈕
    this.elements.textPositionButtons.forEach(button => {
      const position = button.getAttribute('data-position');
      if (this.getPositionKey(position) === this.getPositionKey(this.getPositionFromCoordinates(slide.textPosition.x, slide.textPosition.y))) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // 更新文字對齊按鈕
    this.elements.textAlignButtons.forEach(button => {
      const align = button.getAttribute('data-align');
      if (align === slide.textPosition.alignment) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }
  
  /**
   * 設置背景顏色
   * @param {string} color - 顏色值（十六進制）
   */
  setBackgroundColor(color) {
    if (this.activeSlideIndex < 0 || this.activeSlideIndex >= this.slides.length) return;
    
    const slide = this.slides[this.activeSlideIndex];
    slide.background = {
      type: 'color',
      value: color
    };
    
    // 更新預覽
    this.renderActiveSlide();
    
    // 標記項目為已修改
    if (this.projectModule) {
      this.projectModule.markAsModified();
    }
  }
  
  /**
   * 設置背景圖片
   * @param {string} imageData - 圖片數據（Base64或URL）
   * @param {string} resourceId - 資源ID（如果已存在）
   */
  setBackgroundImage(imageData, resourceId = null) {
    if (this.activeSlideIndex < 0 || this.activeSlideIndex >= this.slides.length) return;
    
    const slide = this.slides[this.activeSlideIndex];
    
    // 如果沒有提供資源ID，則創建新資源
    if (!resourceId) {
      const newResourceId = this.generateId();
      resourceId = newResourceId;
      
      // 將圖片添加到項目資源
      if (this.projectModule) {
        const projectData = this.projectModule.getProjectData();
        projectData.resources.push({
          id: newResourceId,
          type: 'image',
          data: imageData,
          name: `image_${Date.now()}`
        });
      }
    }
    
    // 更新投影片背景
    slide.background = {
      type: 'image',
      value: resourceId
    };
    
    // 更新預覽
    this.renderActiveSlide();
    
    // 標記項目為已修改
    if (this.projectModule) {
      this.projectModule.markAsModified();
    }
  }
  
  /**
   * 為當前投影片生成背景圖片
   */
  async generateImageForSlide() {
    // 檢查是否有活動投影片
    if (this.activeSlideIndex < 0 || this.activeSlideIndex >= this.slides.length) {
      console.warn('沒有活動投影片，無法生成圖片');
      if (this.dialogModule) {
        this.dialogModule.showAlertDialog('請先選擇一個投影片', '操作失敗', 'warning');
      }
      return;
    }
    
    // 檢查是否已經有圖像生成進行中
    if (this.imageGenerationInProgress) {
      console.warn('圖像生成正在進行中，請等待完成');
      if (this.dialogModule) {
        this.dialogModule.showAlertDialog('正在生成圖片，請等待當前操作完成', '操作進行中', 'info');
      }
      return;
    }
    
    // 獲取活動投影片
    const slide = this.slides[this.activeSlideIndex];
    
    // 準備圖像生成參數
    const promptOptions = this.getPromptOptions();
    
    // 顯示圖像生成參數設定對話框
    this.showImageGenerationDialog(slide, promptOptions);
  }

  /**
   * 獲取圖像生成提示選項
   * @returns {Object} 圖像生成提示選項
   */
  getPromptOptions() {
    // 根據當前項目設定獲取適當的選項
    return {
      styles: [
        { id: 'realistic', name: '真實風格', description: '照片般真實的圖像' },
        { id: 'abstract', name: '抽象風格', description: '現代抽象藝術風格' },
        { id: 'digital', name: '數位藝術', description: '數位插圖風格' },
        { id: 'painting', name: '繪畫風格', description: '手繪油畫效果' },
        { id: 'cinematic', name: '電影場景', description: '電影場景風格' }
      ],
      moods: [
        { id: 'calm', name: '平靜', description: '平靜、寧靜的氛圍' },
        { id: 'joyful', name: '歡快', description: '歡樂、喜悅的氛圍' },
        { id: 'dramatic', name: '戲劇性', description: '強烈、戲劇性的氛圍' },
        { id: 'melancholic', name: '憂鬱', description: '傷感、懷舊的氛圍' },
        { id: 'energetic', name: '活力', description: '充滿活力和動感的氛圍' }
      ],
      colors: [
        { id: 'vibrant', name: '鮮豔色彩', description: '鮮豔、飽和的色彩' },
        { id: 'muted', name: '柔和色彩', description: '柔和、低飽和度的色彩' },
        { id: 'dark', name: '暗色調', description: '暗沉、深色調的色彩' },
        { id: 'light', name: '亮色調', description: '明亮、淺色調的色彩' },
        { id: 'monochrome', name: '單色調', description: '黑白或單色調色彩' }
      ]
    };
  }

  /**
   * 顯示圖像生成對話框
   * @param {Object} slide - 投影片對象
   * @param {Object} options - 圖像生成選項
   */
  showImageGenerationDialog(slide, options) {
    if (!this.dialogModule) {
      console.error('缺少對話框模組，無法顯示圖像生成對話框');
      return;
    }
    
    // 構建樣式選項HTML
    let stylesHTML = '';
    options.styles.forEach(style => {
      stylesHTML += `
        <label class="option-card">
          <input type="radio" name="style" value="${style.id}">
          <div class="option-content">
            <div class="option-title">${style.name}</div>
            <div class="option-description">${style.description}</div>
          </div>
        </label>
      `;
    });
    
    // 構建情緒選項HTML
    let moodsHTML = '';
    options.moods.forEach(mood => {
      moodsHTML += `
        <label class="option-card">
          <input type="radio" name="mood" value="${mood.id}">
          <div class="option-content">
            <div class="option-title">${mood.name}</div>
            <div class="option-description">${mood.description}</div>
          </div>
        </label>
      `;
    });
    
    // 構建顏色選項HTML
    let colorsHTML = '';
    options.colors.forEach(color => {
      colorsHTML += `
        <label class="option-card">
          <input type="radio" name="color" value="${color.id}">
          <div class="option-content">
            <div class="option-title">${color.name}</div>
            <div class="option-description">${color.description}</div>
          </div>
        </label>
      `;
    });
    
    // 對話框內容
    const dialogContent = `
      <div class="dialog-header">
        <h3>生成背景圖片</h3>
        <button class="dialog-close" id="close-generate-dialog">✕</button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>從歌詞生成圖片：</label>
          <div class="lyrics-preview">${slide.text}</div>
        </div>
        
        <div class="form-group">
          <label>自訂提示詞 (選填)：</label>
          <textarea id="custom-prompt" placeholder="輸入額外的描述或關鍵詞，例如：山脈、海洋、城市..."></textarea>
        </div>
        
        <div class="form-group">
          <label>圖片風格：</label>
          <div class="options-grid styles-grid">
            ${stylesHTML}
          </div>
        </div>
        
        <div class="form-group">
          <label>圖片氛圍：</label>
          <div class="options-grid moods-grid">
            ${moodsHTML}
          </div>
        </div>
        
        <div class="form-group">
          <label>色彩風格：</label>
          <div class="options-grid colors-grid">
            ${colorsHTML}
          </div>
        </div>
        
        <div class="form-group">
          <label for="generation-quality">圖片品質：</label>
          <select id="generation-quality">
            <option value="standard">標準品質</option>
            <option value="high">高品質 (較慢)</option>
          </select>
        </div>
      </div>
      <div class="dialog-footer">
        <button id="cancel-generate-btn" class="action-button">取消</button>
        <button id="start-generate-btn" class="action-button primary">開始生成</button>
      </div>
    `;
    
    // 顯示對話框
    this.dialogModule.showDialog(dialogContent, 'generate-image-dialog');
    
    // 預設選中第一個選項
    document.querySelector('input[name="style"]').checked = true;
    document.querySelector('input[name="mood"]').checked = true;
    document.querySelector('input[name="color"]').checked = true;
    
    // 綁定按鈕事件
    const closeBtn = document.getElementById('close-generate-dialog');
    const cancelBtn = document.getElementById('cancel-generate-btn');
    const startBtn = document.getElementById('start-generate-btn');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.dialogModule.closeDialog();
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.dialogModule.closeDialog();
      });
    }
    
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        // 收集所有選項
        const style = document.querySelector('input[name="style"]:checked')?.value || 'realistic';
        const mood = document.querySelector('input[name="mood"]:checked')?.value || 'calm';
        const color = document.querySelector('input[name="color"]:checked')?.value || 'vibrant';
        const customPrompt = document.getElementById('custom-prompt')?.value || '';
        const quality = document.getElementById('generation-quality')?.value || 'standard';
        
        // 開始生成圖像
        this.startImageGeneration(slide, { 
          style, 
          mood, 
          color, 
          customPrompt,
          quality,
          lyrics: slide.text
        });
        
        // 關閉對話框
        this.dialogModule.closeDialog();
      });
    }
  }

  /**
   * 開始圖像生成過程
   * @param {Object} slide - 投影片對象
   * @param {Object} params - 圖像生成參數
   */
  startImageGeneration(slide, params) {
    // 設置生成狀態
    this.imageGenerationInProgress = true;
    
    // 顯示加載覆蓋層
    this.showGenerationOverlay();
    
    // 構建完整提示詞
    let prompt = `以下是歌詞文本：「${params.lyrics}」`;
    
    // 添加自定義提示詞
    if (params.customPrompt) {
      prompt += `\n額外描述：${params.customPrompt}`;
    }
    
    // 添加風格、氛圍和顏色描述
    const styleMap = {
      realistic: '真實風格的照片',
      abstract: '抽象藝術風格',
      digital: '數位插圖風格',
      painting: '手繪油畫效果',
      cinematic: '電影場景風格'
    };
    
    const moodMap = {
      calm: '平靜、寧靜的氛圍',
      joyful: '歡樂、喜悅的氛圍',
      dramatic: '強烈、戲劇性的氛圍',
      melancholic: '傷感、懷舊的氛圍',
      energetic: '充滿活力和動感的氛圍'
    };
    
    const colorMap = {
      vibrant: '鮮豔、飽和的色彩',
      muted: '柔和、低飽和度的色彩',
      dark: '暗沉、深色調的色彩',
      light: '明亮、淺色調的色彩',
      monochrome: '黑白或單色調色彩'
    };
    
    prompt += `\n風格：${styleMap[params.style] || params.style}`;
    prompt += `\n氛圍：${moodMap[params.mood] || params.mood}`;
    prompt += `\n色彩：${colorMap[params.color] || params.color}`;
    
    // 準備API參數
    const apiParams = {
      prompt: prompt,
      slideId: slide.id,
      quality: params.quality,
      width: 1920,
      height: 1080,
      model: 'dall-e-3' // 使用適當的模型
    };
    
    console.log('開始生成圖片，參數:', apiParams);
    
    // 發送請求到主進程
    if (window.electronAPI) {
      window.electronAPI.generateImage(apiParams);
      
      // 顯示通知
      if (window.showNotification) {
        window.showNotification('開始生成圖片，請稍候...', 'info');
      }
    } else {
      console.error('無法訪問electronAPI，無法生成圖片');
      this.hideGenerationOverlay();
      this.imageGenerationInProgress = false;
      
      if (this.dialogModule) {
        this.dialogModule.showAlertDialog('無法連接到圖像生成服務', '操作失敗', 'error');
      }
    }
  }

  /**
   * 顯示圖像生成覆蓋層
   */
  showGenerationOverlay() {
    // 創建覆蓋層
    const overlay = document.createElement('div');
    overlay.className = 'generation-overlay';
    overlay.innerHTML = `
      <div class="generation-status">
        <div class="spinner"></div>
        <h3>正在生成圖片...</h3>
        <div class="progress-container">
          <div class="progress-bar" id="generation-progress-bar"></div>
        </div>
        <div class="progress-text" id="generation-progress-text">準備中...</div>
        <button id="cancel-generation-btn" class="action-button">取消</button>
      </div>
    `;
    
    // 添加到主容器
    const slideEditor = document.getElementById('slide-editor');
    if (slideEditor) {
      slideEditor.appendChild(overlay);
      
      // 綁定取消按鈕事件
      const cancelBtn = document.getElementById('cancel-generation-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.cancelImageGeneration();
        });
      }
    }
  }

  /**
   * 隱藏圖像生成覆蓋層
   */
  hideGenerationOverlay() {
    const overlay = document.querySelector('.generation-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * 取消圖像生成
   */
  cancelImageGeneration() {
    if (this.imageGenerationInProgress) {
      // 發送取消請求
      if (window.electronAPI) {
        window.electronAPI.send('cancel-image-generation');
      }
      
      // 重置狀態
      this.imageGenerationInProgress = false;
      this.hideGenerationOverlay();
      
      // 顯示通知
      if (window.showNotification) {
        window.showNotification('已取消圖片生成', 'info');
      }
    }
  }

  /**
   * 處理圖像生成進度
   * @param {Object} progressData - 進度數據
   */
  handleImageGenerationProgress(progressData) {
    if (!this.imageGenerationInProgress) return;
    
    // 更新進度條
    const progressBar = document.getElementById('generation-progress-bar');
    const progressText = document.getElementById('generation-progress-text');
    
    if (progressBar && progressText) {
      const percent = progressData.percent || 0;
      progressBar.style.width = `${percent}%`;
      progressText.textContent = progressData.message || `進度: ${percent}%`;
    }
  }

  /**
   * 處理圖像生成完成
   * @param {Object} result - 結果數據
   */
  handleImageGenerationComplete(result) {
    // 重置狀態
    this.imageGenerationInProgress = false;
    this.hideGenerationOverlay();
    
    if (result.error) {
      console.error('圖片生成失敗:', result.error);
      
      // 顯示錯誤信息
      if (this.dialogModule) {
        this.dialogModule.showAlertDialog(
          `圖片生成失敗: ${result.error}`, 
          '操作失敗', 
          'error'
        );
      }
      return;
    }
    
    // 確保結果有效
    if (!result.data) {
      console.error('圖片生成結果無效');
      return;
    }
    
    // 尋找對應的投影片
    const slideIndex = this.slides.findIndex(slide => slide.id === result.slideId);
    if (slideIndex < 0) {
      console.error('無法找到對應的投影片:', result.slideId);
      return;
    }
    
    // 添加圖片資源
    const resourceId = this.generateId();
    
    // 更新項目資源
    if (this.projectModule) {
      this.projectModule.addResource({
        id: resourceId,
        type: 'image',
        name: `slide_bg_${slideIndex + 1}`,
        data: result.data
      });
    }
    
    // 更新投影片背景
    this.slides[slideIndex].background = {
      type: 'image',
      value: resourceId
    };
    
    // 標記項目為已修改
    if (this.projectModule) {
      this.projectModule.markAsModified();
    }
    
    // 更新UI
    this.renderSlidesList();
    
    // 如果是當前活動投影片，更新預覽
    if (slideIndex === this.activeSlideIndex) {
      this.renderActiveSlide();
    }
    
    // 顯示成功通知
    if (window.showNotification) {
      window.showNotification('背景圖片生成成功!', 'success');
    }
  }
  
  /**
   * 上傳本地圖片作為背景
   */
  async uploadImageForSlide() {
    if (this.activeSlideIndex < 0 || this.activeSlideIndex >= this.slides.length) return;
    
    try {
      // 開啟文件選擇對話框
      const result = await window.electronAPI.showOpenDialog({
        title: '選擇背景圖片',
        filters: [
          { name: '圖片檔案', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
        ],
        properties: ['openFile']
      });
      
      if (result.canceled || result.filePaths.length === 0) return;
      
      // 讀取所選圖片（由主進程處理）
      const response = await window.electronAPI.loadImageFile(result.filePaths[0]);
      
      if (response.success && response.data) {
        // 設置背景圖片
        this.setBackgroundImage(response.data);
      } else {
        throw new Error(response.error || '無法讀取圖片');
      }
    } catch (error) {
      console.error('上傳圖片失敗:', error);
      this.dialogModule.showAlertDialog(`上傳圖片失敗: ${error.message || '未知錯誤'}`);
    }
  }
  
  /**
   * 設置文字位置
   * @param {string} position - 位置標識符（如 'top-left', 'center' 等）
   */
  setTextPosition(position) {
    if (this.activeSlideIndex < 0 || this.activeSlideIndex >= this.slides.length) return;
    
    const slide = this.slides[this.activeSlideIndex];
    const coordinates = this.getCoordinatesFromPosition(position);
    
    slide.textPosition.x = coordinates.x;
    slide.textPosition.y = coordinates.y;
    
    // 更新預覽
    this.renderActiveSlide();
    
    // 標記項目為已修改
    if (this.projectModule) {
      this.projectModule.markAsModified();
    }
  }
  
  /**
   * 設置文字對齊方式
   * @param {string} alignment - 對齊方式（'left', 'center', 'right'）
   */
  setTextAlignment(alignment) {
    if (this.activeSlideIndex < 0 || this.activeSlideIndex >= this.slides.length) return;
    
    const slide = this.slides[this.activeSlideIndex];
    slide.textPosition.alignment = alignment;
    
    // 更新預覽
    this.renderActiveSlide();
    
    // 標記項目為已修改
    if (this.projectModule) {
      this.projectModule.markAsModified();
    }
  }
  
  /**
   * 根據位置標識符獲取坐標
   * @param {string} position - 位置標識符
   * @returns {Object} 座標對象 {x, y}
   */
  getCoordinatesFromPosition(position) {
    const positionMap = {
      'top-left': { x: 0, y: 0 },
      'top-center': { x: 0.5, y: 0 },
      'top-right': { x: 1, y: 0 },
      'middle-left': { x: 0, y: 0.5 },
      'center': { x: 0.5, y: 0.5 },
      'middle-right': { x: 1, y: 0.5 },
      'bottom-left': { x: 0, y: 1 },
      'bottom-center': { x: 0.5, y: 1 },
      'bottom-right': { x: 1, y: 1 }
    };
    
    return positionMap[position] || { x: 0.5, y: 0.5 };
  }
  
  /**
   * 根據坐標獲取位置標識符
   * @param {number} x - X軸坐標（0-1）
   * @param {number} y - Y軸坐標（0-1）
   * @returns {string} 位置標識符
   */
  getPositionFromCoordinates(x, y) {
    let xPos = 'center';
    let yPos = 'middle';
    
    if (x <= 0.25) xPos = 'left';
    else if (x >= 0.75) xPos = 'right';
    
    if (y <= 0.25) yPos = 'top';
    else if (y >= 0.75) yPos = 'bottom';
    
    if (yPos === 'middle' && xPos === 'center') return 'center';
    return `${yPos}-${xPos}`;
  }
  
  /**
   * 獲取位置的唯一鍵值
   * @param {string} position - 位置標識符
   * @returns {string} 標準化的位置鍵值
   */
  getPositionKey(position) {
    return position.split('-').sort().join('-');
  }
  
  /**
   * 從位置獲取 justify-content 值
   * @param {number} y - Y軸坐標（0-1）
   * @returns {string} CSS justify-content 值
   */
  getJustifyContent(y) {
    if (y <= 0.25) return 'flex-start';
    if (y >= 0.75) return 'flex-end';
    return 'center';
  }
  
  /**
   * 從位置獲取 align-items 值
   * @param {number} x - X軸坐標（0-1）
   * @returns {string} CSS align-items 值
   */
  getAlignItems(x) {
    if (x <= 0.25) return 'flex-start';
    if (x >= 0.75) return 'flex-end';
    return 'center';
  }
  
  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  /**
   * 獲取所有投影片數據
   * @returns {Array} 投影片數組
   */
  getSlidesData() {
    return this.slides;
  }
  
  /**
   * 獲取當前選中的投影片
   * @returns {Object|null} 投影片對象或null
   */
  getActiveSlide() {
    if (this.activeSlideIndex >= 0 && this.activeSlideIndex < this.slides.length) {
      return this.slides[this.activeSlideIndex];
    }
    return null;
  }
}

// 導出模塊
window.SlideModule = SlideModule; 