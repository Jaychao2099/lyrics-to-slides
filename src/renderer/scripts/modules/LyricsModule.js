/**
 * 歌詞模塊
 * 負責歌詞搜索、編輯和管理
 */
class LyricsModule {
  constructor() {
    this.lyrics = [];
    this.selectedParagraphIndex = -1;
    this.selectedLineIndex = -1;
    this.lyricsEditor = document.getElementById('lyrics-editor');
    this.searchResults = [];
    
    this.initEventListeners();
    console.log('歌詞模塊已初始化');
  }
  
  /**
   * 初始化模塊
   * @param {Object} dependencies - 依賴模塊
   */
  init(dependencies) {
    this.dialogModule = dependencies.dialogModule;
    this.projectModule = dependencies.projectModule;
    this.slideModule = dependencies.slideModule;
    
    // 檢查electronAPI是否可用
    if (window.electronAPI) {
      // 設置IPC事件監聽器
      window.electronAPI.on('lyrics-search-result', this.handleSearchResults.bind(this));
      window.electronAPI.on('lyrics-content', this.handleReceivedLyrics.bind(this));
      console.log('歌詞模塊IPC事件已設置');
    } else {
      // electronAPI不可用時，顯示警告
      console.warn('electronAPI不可用，歌詞模塊將以有限功能運行');
    }
    
    // 設置自定義事件
    this.setupCustomEvents();
    
    console.log('歌詞模塊依賴已初始化');
  }
  
  /**
   * 設置自定義事件
   */
  setupCustomEvents() {
    // 例如：接收來自其他模塊的事件
    window.addEventListener('project-loaded', (event) => {
      if (event.detail && event.detail.lyrics) {
        this.lyrics = event.detail.lyrics;
        this.renderLyrics();
      }
    });
    
    // 其他自定義事件...
  }
  
  /**
   * 初始化事件監聽器
   */
  initEventListeners() {
    // 監聽段落選擇事件
    if (this.lyricsEditor) {
      this.lyricsEditor.addEventListener('click', (e) => {
        const paragraph = e.target.closest('.lyrics-paragraph');
        if (paragraph) {
          const paragraphIndex = parseInt(paragraph.dataset.index);
          this.selectParagraph(paragraphIndex);
        }
      });
    } else {
      console.warn('歌詞編輯器元素未找到，無法綁定選擇事件');
    }
    
    // 監聽歌詞工具按鈕事件
    this.bindLyricsToolButtons();
    
    // 監聽歌詞搜索和導入按鈕事件
    this.bindLyricsActionButtons();
    
    // 監聽應用程序初始化事件
    window.addEventListener('app-ready', () => {
      this.renderEmptyState();
    });
  }
  
  /**
   * 綁定歌詞工具按鈕
   */
  bindLyricsToolButtons() {
    // 添加段落按鈕
    const addParagraphBtn = document.getElementById('add-paragraph-btn');
    if (addParagraphBtn) {
      addParagraphBtn.addEventListener('click', () => {
        this.addNewParagraph();
      });
    }
    
    // 分割段落按鈕
    const splitParagraphBtn = document.getElementById('split-paragraph-btn');
    if (splitParagraphBtn) {
      splitParagraphBtn.addEventListener('click', () => {
        this.splitParagraph();
      });
    }
    
    // 合併段落按鈕
    const mergeParagraphsBtn = document.getElementById('merge-paragraphs-btn');
    if (mergeParagraphsBtn) {
      mergeParagraphsBtn.addEventListener('click', () => {
        this.mergeParagraphs();
      });
    }
    
    // 刪除段落按鈕
    const removeParagraphBtn = document.getElementById('remove-paragraph-btn');
    if (removeParagraphBtn) {
      removeParagraphBtn.addEventListener('click', () => {
        this.removeParagraph();
      });
    }
  }
  
  /**
   * 綁定歌詞動作按鈕
   */
  bindLyricsActionButtons() {
    // 搜尋歌詞按鈕
    const searchLyricsBtn = document.getElementById('search-lyrics-btn');
    if (searchLyricsBtn) {
      searchLyricsBtn.addEventListener('click', () => {
        this.openSearchDialog();
      });
    }
    
    // 匯入文字按鈕
    const importLyricsBtn = document.getElementById('import-lyrics-btn');
    if (importLyricsBtn) {
      importLyricsBtn.addEventListener('click', () => {
        this.openImportDialog();
      });
    }
  }
  
  /**
   * 打開搜索歌詞對話框
   */
  openSearchDialog() {
    // 使用dialogModule創建對話框
    this.dialogModule.showDialog(`
      <div class="search-dialog">
        <div class="dialog-header">
          <h3>搜尋歌詞</h3>
        </div>
        
        <div class="dialog-body">
          <div id="song-rows-container">
            <!-- 歌曲列將在此動態添加 -->
            <div class="song-row">
              <div class="song-input-group">
                <input type="text" class="song-title" placeholder="歌曲名稱">
                <input type="text" class="artist-name" placeholder="歌手名稱">
                <button class="action-button small delete-song-row">🗑️</button>
              </div>
            </div>
          </div>
          
          <button id="add-song-row-btn" class="action-button">
            <span class="icon">➕</span>
            新增歌曲
          </button>
          
          <div class="search-options">
            <label>搜尋來源:</label>
            <select id="search-source">
              <!-- 將由JavaScript動態填充 -->
            </select>
          </div>
        </div>
        
        <div class="dialog-footer">
          <button id="cancel-search-btn" class="action-button">取消</button>
          <button id="start-search-btn" class="action-button primary">開始搜尋</button>
        </div>
      </div>
    `, 'search-lyrics-dialog', {
      width: '600px',
      height: 'auto',
      onClose: () => {
        console.log('搜尋歌詞對話框已關閉');
      }
    });
    
    // 等待對話框完全渲染
    setTimeout(() => {
      // 獲取對話框內的元素
      const dialog = document.querySelector('#search-lyrics-dialog');
      if (!dialog) {
        console.error('找不到搜尋歌詞對話框元素');
        return;
      }
      
      const songRowsContainer = dialog.querySelector('#song-rows-container');
      const addSongRowBtn = dialog.querySelector('#add-song-row-btn');
      const searchSourceSelect = dialog.querySelector('#search-source');
      const startSearchBtn = dialog.querySelector('#start-search-btn');
      const cancelSearchBtn = dialog.querySelector('#cancel-search-btn');
      
      if (!songRowsContainer || !addSongRowBtn || !searchSourceSelect || !startSearchBtn || !cancelSearchBtn) {
        console.error('找不到必要的對話框元素');
        return;
      }
      
      // 載入搜尋來源
      this.loadSearchSources(searchSourceSelect);
      
      // 事件監聽器 - 新增歌曲列
      addSongRowBtn.addEventListener('click', () => {
        this.addSearchSongRow(songRowsContainer);
      });
      
      // 事件監聽器 - 刪除歌曲列（委派事件）
      songRowsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-song-row')) {
          const songRow = e.target.closest('.song-row');
          // 確保至少保留一個歌曲列
          if (songRowsContainer.querySelectorAll('.song-row').length > 1) {
            songRow.remove();
          } else {
            window.showNotification('至少需要一個歌曲', 'warning');
          }
        }
      });
      
      // 事件監聽器 - 取消搜尋
      cancelSearchBtn.addEventListener('click', () => {
        this.dialogModule.closeDialog();
      });
      
      // 事件監聽器 - 開始搜尋
      startSearchBtn.addEventListener('click', () => {
        this.startSearchFromDialog(dialog);
      });
    }, 100);
  }
  
  /**
   * 在搜尋對話框中新增歌曲列
   * @param {HTMLElement} container - 歌曲列容器
   */
  addSearchSongRow(container) {
    const songRow = document.createElement('div');
    songRow.className = 'song-row';
    songRow.innerHTML = `
      <div class="song-input-group">
        <input type="text" class="song-title" placeholder="歌曲名稱">
        <input type="text" class="artist-name" placeholder="歌手名稱">
        <button class="action-button small delete-song-row">🗑️</button>
      </div>
    `;
    container.appendChild(songRow);
  }
  
  /**
   * 從對話框開始搜尋
   * @param {HTMLElement} dialog - 對話框元素
   */
  startSearchFromDialog(dialog) {
    const songRows = dialog.querySelectorAll('.song-row');
    const searchSource = dialog.querySelector('#search-source').value;
    const searchQueries = [];
    
    // 收集所有歌曲查詢
    songRows.forEach(row => {
      const title = row.querySelector('.song-title').value.trim();
      const artist = row.querySelector('.artist-name').value.trim();
      
      if (title || artist) {
        searchQueries.push({ title, artist });
      }
    });
    
    if (searchQueries.length === 0) {
      window.showNotification('請輸入至少一首歌曲的資訊', 'warning');
      return;
    }
    
    // 關閉對話框
    this.dialogModule.closeDialog();
    
    // 顯示載入中
    this.showLoading('正在搜尋歌詞...');
    
    // 執行搜尋
    this.searchLyrics(searchQueries, searchSource);
  }
  
  /**
   * 搜尋歌詞
   * @param {Array} queries - 搜尋查詢陣列
   * @param {string} source - 搜尋來源
   */
  async searchLyrics(queries, source) {
    try {
      console.log(`開始搜尋歌詞，使用來源: ${source}`);
      console.log('搜尋查詢:', queries);
      
      const results = await window.electronAPI.searchLyrics({
        queries,
        source
      });
      
      this.hideLoading();
      
      if (results && results.length > 0) {
        this.handleSearchResults(results);
      } else {
        this.showNoResultsMessage();
      }
    } catch (error) {
      console.error('搜尋歌詞失敗:', error);
      this.hideLoading();
      
      window.showNotification(`搜尋歌詞失敗: ${error.message || '發生未知錯誤'}`, 'error');
      
      // 顯示錯誤對話框
      this.dialogModule.showConfirmDialog(
        `搜尋歌詞失敗: ${error.message || '發生未知錯誤'}`,
        () => {},
        null,
        {
          title: '搜尋失敗',
          confirmText: '確定',
          cancelText: null,
          type: 'error'
        }
      );
    }
  }
  
  /**
   * 處理搜尋結果
   * @param {Array} results - 搜尋結果
   */
  handleSearchResults(results) {
    // 隱藏加載狀態
    this.hideLoading();
    
    // 保存搜尋結果
    this.searchResults = results;
    
    // 如果沒有結果
    if (!results || results.length === 0) {
      this.showNoResultsMessage();
      return;
    }
    
    // 顯示搜尋結果對話框
    this.showSearchResultsDialog(results);
  }
  
  /**
   * 顯示搜尋結果對話框
   * @param {Array} results - 搜尋結果
   */
  showSearchResultsDialog(results) {
    let resultsHtml = '';
    
    results.forEach((result, index) => {
      resultsHtml += `
        <div class="search-result-item" data-index="${index}">
          <div class="result-info">
            <div class="result-title">${result.title}</div>
            <div class="result-artist">${result.artist || '未知藝人'}</div>
            <div class="result-source">來源: ${result.source}</div>
          </div>
          <button class="action-button small select-lyrics-btn" data-index="${index}">選擇</button>
        </div>
      `;
    });
    
    const dialogContent = `
      <div class="dialog-header">
        <h3>搜尋結果</h3>
        <button class="dialog-close" id="close-results-dialog">✕</button>
      </div>
      <div class="dialog-body">
        <div class="search-results-list">
          ${resultsHtml}
        </div>
      </div>
      <div class="dialog-footer">
        <button id="back-to-search" class="action-button">返回搜尋</button>
        <button id="cancel-results" class="action-button">取消</button>
      </div>
    `;
    
    // 獲取對話框模組
    const dialogModule = this.dialogModule || window.dialogModule || window.modules?.dialogModule;
    if (!dialogModule) {
      console.error('無法訪問對話框模塊');
      alert('系統錯誤：無法顯示搜尋結果');
      return;
    }
    
    dialogModule.showDialog(dialogContent, 'search-results-dialog');
    
    // 設置對話框按鈕事件
    const closeBtn = document.getElementById('close-results-dialog');
    const backBtn = document.getElementById('back-to-search');
    const cancelBtn = document.getElementById('cancel-results');
    const selectBtns = document.querySelectorAll('.select-lyrics-btn');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        dialogModule.closeDialog();
      });
    }
    
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        dialogModule.closeDialog();
        setTimeout(() => {
          this.searchLyrics();
        }, 300);
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        dialogModule.closeDialog();
      });
    }
    
    if (selectBtns.length > 0) {
      selectBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const index = parseInt(btn.dataset.index);
          this.selectLyricsFromResults(index);
        });
      });
    }
  }
  
  /**
   * 從搜尋結果中選擇歌詞
   * @param {number} index - 結果索引
   */
  selectLyricsFromResults(index) {
    const result = this.searchResults[index];
    
    if (!result) {
      return;
    }
    
    // 獲取對話框模組
    const dialogModule = this.dialogModule || window.dialogModule || window.modules?.dialogModule;
    if (dialogModule) {
      dialogModule.closeDialog();
    }
    
    // 顯示加載中狀態
    this.showLoading('正在獲取歌詞...');
    
    // 檢查electronAPI是否可用
    if (window.electronAPI && typeof window.electronAPI.send === 'function') {
      // 通過IPC請求獲取完整歌詞
      window.electronAPI.send('get-lyrics', { resultId: index });
    } else {
      // 如果electronAPI不可用，模擬獲取歌詞過程
      setTimeout(() => {
        this.hideLoading();
        // 創建模擬歌詞
        const mockLyrics = `這是 ${result.title} 的模擬歌詞\n由 ${result.artist || '未知藝人'} 演唱\n\n這是第一段\n模擬的歌詞內容\n用於測試功能\n\n這是第二段\n繼續測試用的歌詞\n希望一切正常運作`;
        
        // 手動處理歌詞
        this.parseLyrics(mockLyrics);
        this.renderLyrics();
        
        // 更新項目信息
        const projectModule = this.projectModule || window.projectModule || window.modules?.projectModule;
        if (projectModule && typeof projectModule.updateProjectInfo === 'function') {
          projectModule.updateProjectInfo({
            title: result.title,
            artist: result.artist || '未知藝人',
            source: result.source,
            sourceUrl: result.url || ''
          });
        }
      }, 1000);
    }
    
    // 設置項目信息
    const titleElement = document.getElementById('song-title');
    const artistElement = document.getElementById('artist-name');
    const projectNameElement = document.getElementById('project-name');
    
    if (titleElement) titleElement.textContent = result.title;
    if (artistElement) artistElement.textContent = result.artist || '未知藝人';
    if (projectNameElement) projectNameElement.textContent = result.title;
  }
  
  /**
   * 處理接收到的歌詞
   * @param {Object} data - 歌詞數據
   */
  handleReceivedLyrics(data) {
    try {
      // 隱藏加載狀態
      this.hideLoading();
      
      if (!data) {
        console.error('接收到的歌詞數據為空');
        this.showError('無法獲取歌詞數據');
        return;
      }
      
      // 標題和藝人信息
      const title = data.title || '未知歌曲';
      const artist = data.artist || '未知藝人';
      const source = data.source || '';
      const sourceUrl = data.url || '';
      
      // 更新UI信息
      const titleElement = document.getElementById('song-title');
      const artistElement = document.getElementById('artist-name');
      
      if (titleElement) {
        titleElement.textContent = title;
      }
      
      if (artistElement) {
        artistElement.textContent = artist;
      }
      
      // 確保歌詞文本存在
      if (!data.lyrics || typeof data.lyrics !== 'string' || data.lyrics.trim() === '') {
        console.error('歌詞文本為空或格式不正確');
        this.showError('歌詞內容為空');
        return;
      }
      
      // 解析歌詞文本
      this.parseLyrics(data.lyrics);
      
      // 更新項目數據
      if (window.modules && window.modules.projectModule) {
        const projectModule = window.modules.projectModule;
        projectModule.updateProjectInfo({
          title,
          artist,
          source,
          sourceUrl,
          lyrics: this.lyrics
        });
      }
      
      // 通知投影片模塊更新投影片
      if (window.modules && window.modules.slideModule) {
        window.modules.slideModule.updateSlidesFromLyrics(this.lyrics);
      }
    } catch (error) {
      console.error('處理歌詞數據時發生錯誤:', error);
      this.showError('處理歌詞時發生錯誤: ' + error.message);
    }
  }
  
  /**
   * 解析歌詞文本為段落
   * @param {string} lyricsText - 歌詞文本
   * @returns {Array} 歌詞段落數組
   */
  parseLyrics(lyricsText) {
    // 移除空白行並分割成行
    const lines = lyricsText.split('\n').map(line => line.trim()).filter(line => line);
    
    // 將行分組為段落
    const paragraphs = [];
    let currentParagraph = [];
    
    lines.forEach(line => {
      // 如果是空行且當前段落有內容，則創建新段落
      if (line === '' && currentParagraph.length > 0) {
        paragraphs.push(currentParagraph);
        currentParagraph = [];
      } 
      // 否則添加到當前段落
      else if (line !== '') {
        currentParagraph.push(line);
      }
    });
    
    // 添加最後一個段落
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph);
    }
    
    this.lyrics = paragraphs;
  }
  
  /**
   * 渲染歌詞到編輯器
   */
  renderLyrics() {
    if (!this.lyricsEditor) return;
    
    let html = '';
    
    this.lyrics.forEach((paragraph, pIndex) => {
      html += `<div class="lyrics-paragraph" data-index="${pIndex}">`;
      
      paragraph.forEach((line, lIndex) => {
        html += `<div class="lyrics-line" data-pindex="${pIndex}" data-lindex="${lIndex}">${line}</div>`;
      });
      
      html += `</div>`;
    });
    
    this.lyricsEditor.innerHTML = html;
    
    // 選擇第一個段落
    if (this.lyrics.length > 0) {
      this.selectParagraph(0);
    }
  }
  
  /**
   * 渲染空白狀態
   */
  renderEmptyState() {
    if (!this.lyricsEditor) {
      console.warn('歌詞編輯器元素未找到，無法渲染空狀態');
      return;
    }
    
    this.lyricsEditor.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎵</div>
        <h3>尚未添加歌詞</h3>
        <p>您可以搜尋歌詞或手動輸入</p>
        <div class="empty-actions">
          <button id="empty-search-btn" class="action-button primary">搜尋歌詞</button>
          <button id="empty-import-btn" class="action-button">匯入文字</button>
        </div>
      </div>
    `;
    
    // 綁定空狀態按鈕事件
    const searchBtn = document.getElementById('empty-search-btn');
    const importBtn = document.getElementById('empty-import-btn');
    
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.openSearchDialog();
      });
    }
    
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        this.openImportDialog();
      });
    }
  }
  
  /**
   * 顯示無結果消息
   */
  showNoResultsMessage() {
    const dialogContent = `
      <div class="dialog-header">
        <h3>搜尋結果</h3>
        <button class="dialog-close" id="close-no-results-dialog">✕</button>
      </div>
      <div class="dialog-body">
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>未找到歌詞</h3>
          <p>請嘗試其他關鍵詞或手動輸入歌詞</p>
        </div>
      </div>
      <div class="dialog-footer">
        <button id="back-to-search-noresult" class="action-button">返回搜尋</button>
        <button id="manual-input" class="action-button primary">手動輸入</button>
      </div>
    `;
    
    // 獲取對話框模組
    const dialogModule = this.dialogModule || window.dialogModule || window.modules?.dialogModule;
    if (!dialogModule) {
      console.error('無法訪問對話框模塊');
      alert('系統錯誤：未找到歌詞');
      return;
    }
    
    dialogModule.showDialog(dialogContent, 'no-results-dialog');
    
    // 設置對話框按鈕事件
    const closeBtn = document.getElementById('close-no-results-dialog');
    const backBtn = document.getElementById('back-to-search-noresult');
    const manualBtn = document.getElementById('manual-input');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        dialogModule.closeDialog();
      });
    }
    
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        dialogModule.closeDialog();
        setTimeout(() => {
          this.openSearchDialog();
        }, 300);
      });
    }
    
    if (manualBtn) {
      manualBtn.addEventListener('click', () => {
        dialogModule.closeDialog();
        setTimeout(() => {
          this.openImportDialog();
        }, 300);
      });
    }
  }
  
  /**
   * 打開匯入歌詞對話框
   */
  openImportDialog() {
    // 使用dialogModule創建對話框
    this.dialogModule.showDialog(`
      <div class="import-dialog">
        <div class="dialog-header">
          <h3>匯入歌詞</h3>
        </div>
        
        <div class="dialog-body">
          <div class="form-group">
            <label for="import-song-title">歌曲名稱:</label>
            <input type="text" id="import-song-title" placeholder="請輸入歌曲名稱">
          </div>
          
          <div class="form-group">
            <label for="import-artist-name">歌手名稱:</label>
            <input type="text" id="import-artist-name" placeholder="請輸入歌手名稱 (選填)">
          </div>
          
          <div class="form-group">
            <label for="import-lyrics-text">歌詞文本:</label>
            <textarea id="import-lyrics-text" rows="12" placeholder="請在此貼上或輸入歌詞文本..."></textarea>
          </div>
        </div>
        
        <div class="dialog-footer">
          <button id="cancel-import-btn" class="action-button">取消</button>
          <button id="confirm-import-btn" class="action-button primary">匯入</button>
        </div>
      </div>
    `, 'import-lyrics-dialog', {
      width: '600px',
      height: 'auto',
      onClose: () => {
        console.log('匯入歌詞對話框已關閉');
      }
    });
    
    // 等待對話框完全渲染
    setTimeout(() => {
      // 獲取對話框內的元素
      const dialog = document.querySelector('#import-lyrics-dialog');
      if (!dialog) {
        console.error('找不到匯入歌詞對話框元素');
        return;
      }
      
      const cancelBtn = dialog.querySelector('#cancel-import-btn');
      const confirmBtn = dialog.querySelector('#confirm-import-btn');
      
      if (!cancelBtn || !confirmBtn) {
        console.error('找不到必要的對話框元素');
        return;
      }
      
      // 事件監聽器 - 取消匯入
      cancelBtn.addEventListener('click', () => {
        this.dialogModule.closeDialog();
      });
      
      // 事件監聽器 - 確認匯入
      confirmBtn.addEventListener('click', () => {
        this.importLyrics();
      });
    }, 100);
  }
  
  /**
   * 匯入文本歌詞
   */
  importLyrics() {
    const songTitleInput = document.getElementById('import-song-title');
    const artistNameInput = document.getElementById('import-artist-name');
    const lyricsTextInput = document.getElementById('import-lyrics-text');
    
    if (!songTitleInput || !lyricsTextInput) {
      console.error('找不到必要的輸入欄位');
      window.showNotification('找不到必要的輸入欄位', 'error');
      return;
    }
    
    const songTitle = songTitleInput.value.trim();
    const artistName = artistNameInput ? artistNameInput.value.trim() : '';
    const lyricsText = lyricsTextInput.value.trim();
    
    if (!songTitle) {
      window.showNotification('請輸入歌曲標題', 'warning');
      return;
    }
    
    if (!lyricsText) {
      window.showNotification('請輸入歌詞文本', 'warning');
      return;
    }
    
    // 關閉對話框
    if (this.dialogModule && typeof this.dialogModule.closeDialog === 'function') {
      this.dialogModule.closeDialog();
    }
    
    // 解析歌詞
    this.parseLyrics(lyricsText);
    
    // 更新界面
    this.renderLyrics();
    
    // 更新項目信息
    if (this.projectModule && typeof this.projectModule.updateProjectInfo === 'function') {
      this.projectModule.updateProjectInfo({
        title: songTitle,
        artist: artistName || '未知藝人',
        lyrics: this.lyrics
      });
      
      // 標記項目為已修改
      this.projectModule.markAsModified();
    } else {
      console.warn('無法更新項目信息: projectModule不可用或缺少updateProjectInfo方法');
      
      // 至少更新顯示
      const titleElement = document.getElementById('song-title');
      const artistElement = document.getElementById('artist-name');
      const projectNameElement = document.getElementById('project-name');
      
      if (titleElement) titleElement.textContent = songTitle;
      if (artistElement) artistElement.textContent = artistName || '未知藝人';
      if (projectNameElement) projectNameElement.textContent = songTitle;
    }
    
    // 通知投影片模塊更新投影片
    if (this.slideModule && typeof this.slideModule.updateSlidesFromLyrics === 'function') {
      this.slideModule.updateSlidesFromLyrics(this.lyrics);
    }
    
    window.showNotification(`已成功匯入歌詞: ${songTitle}`, 'success');
    console.log('已匯入歌詞: ', songTitle, artistName);
  }
  
  /**
   * 選擇段落
   * @param {number} index - 段落索引
   */
  selectParagraph(index) {
    if (!this.lyricsEditor) return;
    
    // 取消之前的選擇
    const prevSelected = this.lyricsEditor.querySelector('.lyrics-paragraph.selected');
    if (prevSelected) {
      prevSelected.classList.remove('selected');
    }
    
    // 選擇新段落
    const paragraph = this.lyricsEditor.querySelector(`.lyrics-paragraph[data-index="${index}"]`);
    if (paragraph) {
      paragraph.classList.add('selected');
      this.selectedParagraphIndex = index;
      
      // 通知其他模塊選擇了新段落
      window.dispatchEvent(new CustomEvent('lyrics-paragraph-selected', {
        detail: {
          paragraphIndex: index,
          paragraphText: this.lyrics[index].join('\n')
        }
      }));
    }
  }
  
  /**
   * 添加新段落
   */
  addNewParagraph() {
    // 實作添加新段落邏輯
    const newParagraph = {
      id: this.generateId(),
      text: '',
      type: 'verse'
    };
    
    // 如果有選中段落，插入在其後
    if (this.selectedParagraphIndex >= 0 && this.selectedParagraphIndex < this.lyrics.length) {
      this.lyrics.splice(this.selectedParagraphIndex + 1, 0, newParagraph);
      this.selectedParagraphIndex += 1;
    } else {
      // 否則添加到末尾
      this.lyrics.push(newParagraph);
      this.selectedParagraphIndex = this.lyrics.length - 1;
    }
    
    // 重新渲染歌詞
    this.renderLyrics();
    
    // 標記項目為已修改
    if (window.modules && window.modules.projectModule) {
      window.modules.projectModule.markAsModified();
    }
  }
  
  /**
   * 分割段落
   */
  splitParagraph() {
    // 檢查是否有選中段落
    if (this.selectedParagraphIndex < 0 || this.selectedParagraphIndex >= this.lyrics.length) {
      console.warn('未選中段落，無法分割');
      return;
    }
    
    // 獲取選中段落
    const paragraph = this.lyrics[this.selectedParagraphIndex];
    
    // 實作段落分割邏輯
    const text = paragraph.text;
    const selection = window.getSelection();
    
    // 確保選中的文本在段落內
    if (!selection || selection.rangeCount === 0) {
      console.warn('未選中文本，無法分割');
      return;
    }
    
    try {
      const range = selection.getRangeAt(0);
      const paragraphElement = document.querySelector(`.lyrics-paragraph[data-index="${this.selectedParagraphIndex}"]`);
      
      if (!paragraphElement || !paragraphElement.contains(range.commonAncestorContainer)) {
        console.warn('選中的文本不在當前段落內');
        return;
      }
      
      // 計算光標位置
      const textNode = range.startContainer;
      const offset = range.startOffset;
      
      // 獲取段落內文本
      let fullText = '';
      for (const node of paragraphElement.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          fullText += node.textContent;
        }
      }
      
      // 分割文本
      let cursorPosition = 0;
      for (const node of paragraphElement.childNodes) {
        if (node === textNode) {
          cursorPosition += offset;
          break;
        } else if (node.nodeType === Node.TEXT_NODE) {
          cursorPosition += node.textContent.length;
        }
      }
      
      const firstPart = fullText.substring(0, cursorPosition);
      const secondPart = fullText.substring(cursorPosition);
      
      // 更新當前段落文本
      paragraph.text = firstPart;
      
      // 創建新段落
      const newParagraph = {
        id: this.generateId(),
        text: secondPart,
        type: paragraph.type
      };
      
      // 插入新段落
      this.lyrics.splice(this.selectedParagraphIndex + 1, 0, newParagraph);
      
      // 重新渲染歌詞
      this.renderLyrics();
      
      // 選中新段落
      this.selectParagraph(this.selectedParagraphIndex + 1);
      
      // 標記項目為已修改
      if (window.modules && window.modules.projectModule) {
        window.modules.projectModule.markAsModified();
      }
    } catch (error) {
      console.error('分割段落時發生錯誤:', error);
    }
  }
  
  /**
   * 合併段落
   */
  mergeParagraphs() {
    // 檢查是否有選中段落
    if (this.selectedParagraphIndex < 0 || this.selectedParagraphIndex >= this.lyrics.length - 1) {
      console.warn('未選中段落或已是最後一個段落，無法合併');
      return;
    }
    
    // 獲取選中段落和下一個段落
    const currentParagraph = this.lyrics[this.selectedParagraphIndex];
    const nextParagraph = this.lyrics[this.selectedParagraphIndex + 1];
    
    // 合併文本
    currentParagraph.text = currentParagraph.text + '\n' + nextParagraph.text;
    
    // 刪除下一個段落
    this.lyrics.splice(this.selectedParagraphIndex + 1, 1);
    
    // 重新渲染歌詞
    this.renderLyrics();
    
    // 標記項目為已修改
    if (window.modules && window.modules.projectModule) {
      window.modules.projectModule.markAsModified();
    }
  }
  
  /**
   * 刪除段落
   */
  removeParagraph() {
    if (this.selectedParagraphIndex < 0) return;
    
    // 確認刪除
    if (!confirm('確定要刪除此段落嗎？')) return;
    
    // 刪除段落
    this.lyrics.splice(this.selectedParagraphIndex, 1);
    
    // 重新渲染歌詞
    if (this.lyrics.length > 0) {
      this.renderLyrics();
      this.selectParagraph(Math.min(this.selectedParagraphIndex, this.lyrics.length - 1));
    } else {
      this.renderEmptyState();
      this.selectedParagraphIndex = -1;
    }
  }
  
  /**
   * 顯示加載狀態
   * @param {string} message - 加載消息
   */
  showLoading(message) {
    // 實作載入狀態顯示邏輯
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>${message || '載入中...'}</p>
      </div>
    `;
    
    document.body.appendChild(loadingOverlay);
  }
  
  /**
   * 隱藏加載狀態
   */
  hideLoading() {
    // 實作載入狀態隱藏邏輯
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.remove();
    }
  }
  
  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  /**
   * 顯示錯誤信息
   * @param {string} message - 錯誤信息
   */
  showError(message) {
    if (window.modules && window.modules.dialogModule) {
      window.modules.dialogModule.showAlertDialog(message, '錯誤', 'error');
    } else {
      alert(message);
    }
  }
  
  /**
   * 載入搜尋來源
   * @param {HTMLElement} selectElement - 搜尋來源選擇元素
   */
  loadSearchSources(selectElement) {
    if (!selectElement) {
      console.error('無法載入搜尋來源: 選擇元素不存在');
      return;
    }
    
    // 清空現有選項
    selectElement.innerHTML = '';
    
    // 默認搜尋來源
    const defaultSources = [
      { id: 'auto', name: '自動選擇最佳來源' },
      { id: 'musixmatch', name: 'Musixmatch' },
      { id: 'genius', name: 'Genius' },
      { id: 'google', name: 'Google 搜尋' }
    ];
    
    // 如果設定模塊可用，嘗試獲取已配置的 API
    let customSources = [];
    try {
      if (window.modules && window.modules.settingsModule) {
        const settingsModule = window.modules.settingsModule;
        const apiSettings = settingsModule.getSetting('api.lyrics.apis');
        
        if (Array.isArray(apiSettings) && apiSettings.length > 0) {
          customSources = apiSettings.map(api => ({
            id: api.name.toLowerCase(),
            name: api.name
          }));
        }
      }
    } catch (error) {
      console.warn('無法從設定模塊獲取搜尋來源:', error);
    }
    
    // 合併來源列表，避免重複
    const allSources = [...defaultSources];
    customSources.forEach(source => {
      if (!allSources.some(s => s.id === source.id)) {
        allSources.push(source);
      }
    });
    
    // 添加選項到選擇器
    allSources.forEach(source => {
      const option = document.createElement('option');
      option.value = source.id;
      option.textContent = source.name;
      selectElement.appendChild(option);
    });
    
    // 選擇默認來源
    if (window.modules && window.modules.settingsModule) {
      const defaultApi = window.modules.settingsModule.getSetting('api.lyrics.defaultApi');
      if (defaultApi && selectElement.querySelector(`option[value="${defaultApi}"]`)) {
        selectElement.value = defaultApi;
      } else {
        selectElement.value = 'auto';
      }
    } else {
      selectElement.value = 'auto';
    }
  }
}

// 全局導出
window.LyricsModule = LyricsModule; 