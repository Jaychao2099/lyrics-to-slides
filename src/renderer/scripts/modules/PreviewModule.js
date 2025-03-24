/**
 * 投影片預覽模塊
 * 負責投影片預覽和播放功能
 */
class PreviewModule {
  constructor() {
    this.slideModule = null;
    this.currentSlideIndex = 0;
    this.totalSlides = 0;
    this.isPlaying = false;
    this.slideInterval = null;
    this.transitionDuration = 0.5; // 默認過渡時間（秒）
    this.slideDuration = 3; // 默認每張投影片顯示時間（秒）
    
    // DOM元素引用
    this.elements = {
      previewContainer: document.getElementById('preview-container'),
      previewFrame: document.getElementById('preview-frame'),
      slideCounter: document.getElementById('slide-counter'),
      prevButton: document.getElementById('prev-slide'),
      nextButton: document.getElementById('next-slide'),
      playButton: document.getElementById('play-slideshow'),
      fullscreenButton: document.getElementById('fullscreen-preview'),
      previewOptions: document.getElementById('preview-options')
    };
    
    // 初始化事件監聽器
    this.initEventListeners();
  }
  
  /**
   * 初始化模塊
   * @param {Object} dependencies - 依賴模塊
   */
  init(dependencies) {
    this.slideModule = dependencies.slideModule;
    this.projectModule = dependencies.projectModule;
    
    console.log('預覽模塊已初始化');
  }
  
  /**
   * 初始化事件監聽器
   */
  initEventListeners() {
    // 前一張投影片按鈕
    if (this.elements.prevButton) {
      this.elements.prevButton.addEventListener('click', () => {
        this.showPrevSlide();
      });
    }
    
    // 下一張投影片按鈕
    if (this.elements.nextButton) {
      this.elements.nextButton.addEventListener('click', () => {
        this.showNextSlide();
      });
    }
    
    // 播放按鈕
    if (this.elements.playButton) {
      this.elements.playButton.addEventListener('click', () => {
        this.togglePlayback();
      });
    }
    
    // 全螢幕按鈕
    if (this.elements.fullscreenButton) {
      this.elements.fullscreenButton.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }
    
    // 投影片時間設置
    const slideDurationInput = this.elements.previewOptions?.querySelector('#slide-duration');
    if (slideDurationInput) {
      slideDurationInput.addEventListener('change', (e) => {
        const value = parseFloat(e.target.value);
        if (!isNaN(value) && value > 0.5) {
          this.slideDuration = value;
        }
      });
    }
    
    // 過渡時間設置
    const transitionDurationInput = this.elements.previewOptions?.querySelector('#transition-duration');
    if (transitionDurationInput) {
      transitionDurationInput.addEventListener('change', (e) => {
        const value = parseFloat(e.target.value);
        if (!isNaN(value) && value >= 0 && value <= 2) {
          this.transitionDuration = value;
        }
      });
    }
    
    // 鍵盤快捷鍵
    document.addEventListener('keydown', (e) => {
      // 只在預覽區塊活躍時處理鍵盤事件
      if (document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      
      const activeSection = document.querySelector('.active-section');
      if (!activeSection || !activeSection.id || activeSection.id !== 'preview-section') {
        return;
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          this.showPrevSlide();
          break;
        case 'ArrowRight':
          this.showNextSlide();
          break;
        case ' ': // 空格鍵
          this.togglePlayback();
          e.preventDefault();
          break;
        case 'f':
        case 'F':
          this.toggleFullscreen();
          break;
        case 'Escape':
          if (this.isPlaying) {
            this.stopPlayback();
          }
          break;
      }
    });
  }
  
  /**
   * 加載投影片數據
   * @param {Object} projectData - 項目數據
   */
  loadSlides(projectData) {
    if (this.slideModule) {
      const slides = this.slideModule.getSlidesData();
      this.totalSlides = slides.length;
      this.currentSlideIndex = 0;
      
      // 更新投影片計數器
      this.updateSlideCounter();
      
      // 初始顯示第一張投影片
      this.renderCurrentSlide();
      
      // 更新預覽選項
      this.updatePreviewOptions(projectData.settings);
    }
  }
  
  /**
   * 更新預覽選項
   * @param {Object} settings - 項目設置
   */
  updatePreviewOptions(settings) {
    // 更新過渡時間
    if (settings?.transition?.duration !== undefined) {
      this.transitionDuration = settings.transition.duration;
      const transitionInput = this.elements.previewOptions?.querySelector('#transition-duration');
      if (transitionInput) {
        transitionInput.value = this.transitionDuration;
      }
    }
    
    // 更新投影片時間（如果存在於設置中）
    if (settings?.preview?.slideDuration !== undefined) {
      this.slideDuration = settings.preview.slideDuration;
      const durationInput = this.elements.previewOptions?.querySelector('#slide-duration');
      if (durationInput) {
        durationInput.value = this.slideDuration;
      }
    }
  }
  
  /**
   * 更新投影片計數器
   */
  updateSlideCounter() {
    if (this.elements.slideCounter) {
      if (this.totalSlides === 0) {
        this.elements.slideCounter.textContent = '0 / 0';
      } else {
        this.elements.slideCounter.textContent = `${this.currentSlideIndex + 1} / ${this.totalSlides}`;
      }
    }
  }
  
  /**
   * 渲染當前投影片
   */
  renderCurrentSlide() {
    if (!this.elements.previewFrame) return;
    
    // 獲取投影片數據
    const slides = this.slideModule?.getSlidesData() || [];
    
    if (slides.length === 0 || this.currentSlideIndex < 0 || this.currentSlideIndex >= slides.length) {
      // 顯示空狀態
      this.elements.previewFrame.innerHTML = `
        <div class="empty-preview">
          <p>無可預覽的投影片</p>
          <p>請先創建投影片</p>
        </div>
      `;
      return;
    }
    
    const slide = slides[this.currentSlideIndex];
    
    // 清空預覽框架
    this.elements.previewFrame.innerHTML = '';
    
    // 創建投影片預覽元素
    const slideElement = document.createElement('div');
    slideElement.className = 'preview-slide';
    
    // 設置背景
    if (slide.background.type === 'color') {
      slideElement.style.backgroundColor = slide.background.value;
    } else if (slide.background.type === 'image') {
      // 從項目資源中獲取圖片
      const projectData = this.projectModule.getProjectData();
      const resource = projectData.resources.find(r => r.id === slide.background.value);
      
      if (resource && resource.data) {
        slideElement.style.backgroundImage = `url(${resource.data})`;
        slideElement.style.backgroundSize = 'cover';
        slideElement.style.backgroundPosition = 'center';
      } else {
        slideElement.style.backgroundColor = '#333333';
      }
    }
    
    // 創建文字元素
    const textElement = document.createElement('div');
    textElement.className = 'preview-text';
    
    // 設置文字位置和對齊
    textElement.style.position = 'absolute';
    textElement.style.width = '100%';
    textElement.style.textAlign = slide.textPosition.alignment;
    
    // 垂直位置
    if (slide.textPosition.y <= 0.25) {
      textElement.style.top = '10%';
    } else if (slide.textPosition.y >= 0.75) {
      textElement.style.bottom = '10%';
    } else {
      textElement.style.top = '50%';
      textElement.style.transform = 'translateY(-50%)';
    }
    
    // 水平位置（通過text-align處理）
    
    // 設置文字內容
    textElement.innerHTML = slide.text.replace(/\n/g, '<br>');
    
    // 應用文字樣式
    const projectData = this.projectModule.getProjectData();
    const fontSettings = projectData.settings.font;
    
    textElement.style.fontFamily = fontSettings.family;
    textElement.style.fontSize = `${fontSettings.size}px`;
    textElement.style.color = fontSettings.color;
    textElement.style.fontWeight = fontSettings.weight;
    
    if (fontSettings.shadow) {
      textElement.style.textShadow = `2px 2px 4px ${fontSettings.shadowColor}`;
    }
    
    // 添加到投影片
    slideElement.appendChild(textElement);
    this.elements.previewFrame.appendChild(slideElement);
    
    // 應用過渡效果
    slideElement.style.animation = `fadeIn ${this.transitionDuration}s ease-in-out`;
  }
  
  /**
   * 顯示下一張投影片
   */
  showNextSlide() {
    if (this.totalSlides === 0) return;
    
    this.currentSlideIndex = (this.currentSlideIndex + 1) % this.totalSlides;
    this.updateSlideCounter();
    this.renderCurrentSlide();
    
    // 同步選中相應的投影片
    if (this.slideModule) {
      this.slideModule.selectSlide(this.currentSlideIndex);
    }
  }
  
  /**
   * 顯示上一張投影片
   */
  showPrevSlide() {
    if (this.totalSlides === 0) return;
    
    this.currentSlideIndex = (this.currentSlideIndex - 1 + this.totalSlides) % this.totalSlides;
    this.updateSlideCounter();
    this.renderCurrentSlide();
    
    // 同步選中相應的投影片
    if (this.slideModule) {
      this.slideModule.selectSlide(this.currentSlideIndex);
    }
  }
  
  /**
   * 切換播放狀態
   */
  togglePlayback() {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }
  
  /**
   * 開始播放投影片
   */
  startPlayback() {
    if (this.totalSlides <= 1) return;
    
    this.isPlaying = true;
    
    // 更新播放按鈕
    if (this.elements.playButton) {
      this.elements.playButton.innerHTML = '<i class="icon">pause</i>';
      this.elements.playButton.setAttribute('title', '暫停');
    }
    
    // 設置自動播放定時器
    const interval = (this.slideDuration + this.transitionDuration) * 1000;
    this.slideInterval = setInterval(() => {
      this.showNextSlide();
    }, interval);
    
    // 添加播放中狀態
    this.elements.previewContainer.classList.add('playing');
  }
  
  /**
   * 停止播放投影片
   */
  stopPlayback() {
    this.isPlaying = false;
    
    // 清除定時器
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
      this.slideInterval = null;
    }
    
    // 更新播放按鈕
    if (this.elements.playButton) {
      this.elements.playButton.innerHTML = '<i class="icon">play_arrow</i>';
      this.elements.playButton.setAttribute('title', '播放');
    }
    
    // 移除播放中狀態
    this.elements.previewContainer.classList.remove('playing');
  }
  
  /**
   * 切換全螢幕模式
   */
  toggleFullscreen() {
    // 檢查是否支持全螢幕API
    if (!document.fullscreenEnabled && 
        !document.webkitFullscreenEnabled && 
        !document.mozFullScreenEnabled &&
        !document.msFullscreenEnabled) {
      console.error('瀏覽器不支持全螢幕模式');
      return;
    }
    
    // 全螢幕元素
    const element = this.elements.previewContainer;
    
    // 檢查當前是否處於全螢幕模式
    const isFullscreen = document.fullscreenElement || 
                          document.webkitFullscreenElement || 
                          document.mozFullScreenElement ||
                          document.msFullscreenElement;
    
    if (!isFullscreen) {
      // 進入全螢幕
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
      
      // 添加全螢幕狀態類
      element.classList.add('fullscreen');
      
      // 自動開始播放（可選）
      if (!this.isPlaying) {
        this.startPlayback();
      }
    } else {
      // 退出全螢幕
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      
      // 移除全螢幕狀態類
      element.classList.remove('fullscreen');
    }
  }
  
  /**
   * 處理全螢幕變化事件
   */
  handleFullscreenChange() {
    // 檢查是否退出了全螢幕
    const isFullscreen = document.fullscreenElement || 
                          document.webkitFullscreenElement || 
                          document.mozFullScreenElement ||
                          document.msFullscreenElement;
    
    if (!isFullscreen) {
      // 移除全螢幕狀態類
      this.elements.previewContainer.classList.remove('fullscreen');
      
      // 停止播放（如果開始時自動播放）
      if (this.isPlaying && this.elements.previewContainer.classList.contains('auto-play')) {
        this.stopPlayback();
      }
    }
  }
  
  /**
   * 設置當前投影片
   * @param {number} index - 投影片索引
   */
  setCurrentSlide(index) {
    if (index >= 0 && index < this.totalSlides) {
      this.currentSlideIndex = index;
      this.updateSlideCounter();
      this.renderCurrentSlide();
    }
  }
  
  /**
   * 更新播放選項
   * @param {Object} options - 播放選項
   */
  updatePlaybackOptions(options) {
    if (options.slideDuration !== undefined) {
      this.slideDuration = options.slideDuration;
    }
    
    if (options.transitionDuration !== undefined) {
      this.transitionDuration = options.transitionDuration;
    }
    
    // 如果正在播放，重新啟動以應用新設置
    if (this.isPlaying) {
      this.stopPlayback();
      this.startPlayback();
    }
  }
}

// 導出模塊
window.PreviewModule = PreviewModule; 