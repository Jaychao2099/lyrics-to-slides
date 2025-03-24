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
    if (this.activeSlideIndex < 0 || this.activeSlideIndex >= this.slides.length) return;
    if (this.imageGenerationInProgress) return;
    
    const slide = this.slides[this.activeSlideIndex];
    
    // 顯示加載對話框
    this.dialogModule.showDialog(`
      <h3>正在生成圖片...</h3>
      <div class="progress-container">
        <progress id="generation-progress" value="0" max="100"></progress>
        <span id="generation-status">準備中...</span>
      </div>
    `, 'image-generation-dialog', {
      closeButton: false,
      width: '400px',
      height: 'auto'
    });
    
    this.imageGenerationInProgress = true;
    
    try {
      // 準備提示詞
      const prompt = slide.text;
      
      // 發送圖片生成請求
      window.electronAPI.generateImage({
        prompt: prompt,
        model: 'dall-e-3',
        size: '1024x1024',
        quality: 'standard',
        n: 1
      });
    } catch (error) {
      console.error('圖片生成請求失敗:', error);
      this.dialogModule.closeDialog();
      
      // 顯示錯誤訊息
      this.dialogModule.showAlertDialog(`圖片生成失敗: ${error.message || '未知錯誤'}`);
      this.imageGenerationInProgress = false;
    }
  }
  
  /**
   * 處理圖片生成進度更新
   * @param {Object} progressData - 進度數據
   */
  handleImageGenerationProgress(progressData) {
    const progressBar = document.getElementById('generation-progress');
    const statusElement = document.getElementById('generation-status');
    
    if (progressBar && statusElement) {
      progressBar.value = progressData.percentage || 0;
      statusElement.textContent = progressData.status || '處理中...';
    }
  }
  
  /**
   * 處理圖片生成完成
   * @param {Object} result - 生成結果
   */
  handleImageGenerationComplete(result) {
    this.imageGenerationInProgress = false;
    this.dialogModule.closeDialog();
    
    if (result.error) {
      this.dialogModule.showAlertDialog(`圖片生成失敗: ${result.error}`);
      return;
    }
    
    if (result.data && result.data.length > 0) {
      // 設置背景圖片
      this.setBackgroundImage(result.data[0]);
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