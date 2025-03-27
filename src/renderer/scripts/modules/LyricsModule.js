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
      
      // 顯示載入中狀態
      this.showLoading('正在搜尋歌詞...');
      
      // 檢查 electronAPI 是否可用
      if (window.electronAPI && typeof window.electronAPI.searchLyrics === 'function') {
        // 使用 electronAPI 進行搜尋
        try {
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
          this.hideLoading();
          console.error('ElectronAPI 搜尋失敗:', error);
          
          window.showNotification(`搜尋歌詞失敗: ${error.message || '發生未知錯誤'}`, 'error');
          
          // 顯示錯誤對話框
          const dialogModule = this.dialogModule || 
                              (window.modules && window.modules.dialogModule) || 
                              window.dialogModule;
          
          if (dialogModule && typeof dialogModule.showConfirmDialog === 'function') {
            dialogModule.showConfirmDialog(
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
      } else {
        // ElectronAPI 不可用，模擬搜尋過程
        console.warn('ElectronAPI 不可用，使用模擬搜尋');
        
        // 模擬搜尋延遲
        setTimeout(() => {
          this.hideLoading();
          
          // 根據搜尋來源判斷是否使用 AI
          if (source === 'combined_no_ai') {
            // 無 AI 的搜尋結果
            const mockResults = [];
            
            // 為每個查詢創建模擬結果
            queries.forEach((query, index) => {
              if (query.title || query.artist) {
                mockResults.push({
                  id: 'mock-' + index,
                  title: query.title || '未知歌曲',
                  artist: query.artist || '未知藝人',
                  source: 'genius',
                  url: '#'
                });
              }
            });
            
            if (mockResults.length > 0) {
              this.handleSearchResults(mockResults);
            } else {
              this.showNoResultsMessage();
            }
          } else {
            // 一般搜尋結果
            const mockResults = [];
            
            // 為每個查詢創建模擬結果
            queries.forEach((query, index) => {
              if (query.title || query.artist) {
                mockResults.push({
                  id: 'mock-' + index,
                  title: query.title || '未知歌曲',
                  artist: query.artist || '未知藝人',
                  source: source === 'genius' ? 'genius' : 
                          source === 'musixmatch' ? 'musixmatch' : 'combined',
                  url: '#'
                });
              }
            });
            
            if (mockResults.length > 0) {
              this.handleSearchResults(mockResults);
            } else {
              this.showNoResultsMessage();
            }
          }
        }, 1500);
      }
    } catch (error) {
      console.error('搜尋歌詞失敗:', error);
      this.hideLoading();
      
      window.showNotification(`搜尋歌詞失敗: ${error.message || '發生未知錯誤'}`, 'error');
      
      // 顯示錯誤對話框
      const dialogModule = this.dialogModule || 
                          (window.modules && window.modules.dialogModule) || 
                          window.dialogModule;
      
      if (dialogModule && typeof dialogModule.showConfirmDialog === 'function') {
        dialogModule.showConfirmDialog(
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
   * 渲染歌詞到畫面
   * @param {Array} lyrics - 歌詞段落數組
   */
  renderLyrics(lyrics) {
    try {
      // 確保歌詞容器存在
      const lyricsContainer = document.getElementById('lyrics-container');
      if (!lyricsContainer) {
        console.error('找不到歌詞容器元素');
        return;
      }
      
      // 使用傳入的歌詞或當前歌詞
      const lyricsToRender = lyrics || this.lyrics || this.currentLyrics || [];
      
      // 如果沒有歌詞，顯示空狀態
      if (!lyricsToRender || lyricsToRender.length === 0) {
        this.renderEmptyState();
        return;
      }
      
      // 清空現有內容
      lyricsContainer.innerHTML = '';
      
      // 渲染每個段落
      if (Array.isArray(lyricsToRender)) {
        lyricsToRender.forEach((paragraph, pIndex) => {
          // 創建段落容器
          const paragraphEl = document.createElement('div');
          paragraphEl.className = 'lyrics-paragraph';
          paragraphEl.dataset.index = pIndex;
          
          // 檢查段落格式
          let paragraphLines = [];
          
          // 如果段落是字符串，將其轉換為單行數組
          if (typeof paragraph === 'string') {
            paragraphLines = [paragraph];
          }
          // 如果段落是對象，嘗試提取文本
          else if (typeof paragraph === 'object' && paragraph !== null) {
            // 如果是包含 text 屬性的對象
            if ('text' in paragraph) {
              const lines = paragraph.text.split('\n').filter(line => line.trim() !== '');
              paragraphLines = lines;
            }
            // 如果是數組
            else if (Array.isArray(paragraph)) {
              paragraphLines = paragraph;
            }
            // 其他未知格式，嘗試轉換為字符串
            else {
              paragraphLines = [String(paragraph)];
            }
          }
          // 如果不是數組也不是字符串，則轉換為字符串
          else {
            paragraphLines = [String(paragraph)];
          }
          
          // 遍歷段落中的每一行
          paragraphLines.forEach((line, lIndex) => {
            const lineEl = document.createElement('div');
            lineEl.className = 'lyrics-line';
            lineEl.dataset.index = `${pIndex}-${lIndex}`;
            
            // 如果是對象，提取文本
            if (typeof line === 'object' && line !== null) {
              line = line.text || '';
            }
            
            // 確保行是字符串
            if (typeof line !== 'string') {
              line = String(line || '');
            }
            
            lineEl.textContent = line;
            lineEl.contentEditable = 'true';
            
            // 監聽編輯事件
            lineEl.addEventListener('blur', (e) => this.handleLineEdit(e, pIndex, lIndex));
            
            paragraphEl.appendChild(lineEl);
          });
          
          // 添加段落控制按鈕
          const paragraphControls = document.createElement('div');
          paragraphControls.className = 'paragraph-controls';
          
          // 添加按鈕
          const addLineBtn = document.createElement('button');
          addLineBtn.className = 'control-button add-line';
          addLineBtn.innerHTML = '<span class="icon">+</span>';
          addLineBtn.title = '添加行';
          addLineBtn.addEventListener('click', () => this.addNewLine(pIndex));
          
          const removeParagraphBtn = document.createElement('button');
          removeParagraphBtn.className = 'control-button remove-paragraph';
          removeParagraphBtn.innerHTML = '<span class="icon">🗑️</span>';
          removeParagraphBtn.title = '刪除段落';
          removeParagraphBtn.addEventListener('click', () => this.removeParagraph(pIndex));
          
          const moveParagraphUpBtn = document.createElement('button');
          moveParagraphUpBtn.className = 'control-button move-up';
          moveParagraphUpBtn.innerHTML = '<span class="icon">↑</span>';
          moveParagraphUpBtn.title = '上移段落';
          moveParagraphUpBtn.addEventListener('click', () => this.moveParagraph(pIndex, 'up'));
          
          const moveParagraphDownBtn = document.createElement('button');
          moveParagraphDownBtn.className = 'control-button move-down';
          moveParagraphDownBtn.innerHTML = '<span class="icon">↓</span>';
          moveParagraphDownBtn.title = '下移段落';
          moveParagraphDownBtn.addEventListener('click', () => this.moveParagraph(pIndex, 'down'));
          
          paragraphControls.appendChild(addLineBtn);
          paragraphControls.appendChild(removeParagraphBtn);
          paragraphControls.appendChild(moveParagraphUpBtn);
          paragraphControls.appendChild(moveParagraphDownBtn);
          
          paragraphEl.appendChild(paragraphControls);
          lyricsContainer.appendChild(paragraphEl);
        });
      } else {
        console.error('歌詞不是數組:', lyricsToRender);
        // 如果歌詞不是數組，顯示空狀態
        this.renderEmptyState();
        return;
      }
      
      // 添加"添加段落"按鈕
      const addParagraphBtn = document.createElement('button');
      addParagraphBtn.id = 'add-paragraph-btn';
      addParagraphBtn.className = 'action-button';
      addParagraphBtn.innerHTML = '<span class="icon">+</span><span class="label">添加段落</span>';
      addParagraphBtn.addEventListener('click', () => this.addNewParagraph());
      
      lyricsContainer.appendChild(addParagraphBtn);
    } catch (error) {
      console.error('渲染歌詞時出錯:', error);
      window.showNotification('渲染歌詞失敗', 'error');
    }
  }
  
  /**
   * 添加新段落
   */
  addNewParagraph() {
    try {
      // 獲取當前歌詞
      let lyrics = this.getCurrentLyrics();
      
      // 如果還沒有歌詞，初始化為空數組
      if (!lyrics) {
        lyrics = [];
      }
      
      // 添加新段落
      lyrics.push(['']);
      
      // 更新當前歌詞
      this.setCurrentLyrics(lyrics);
      
      // 重新渲染
      this.renderLyrics(lyrics);
      
      // 如果啟用了實時預覽，更新預覽
      if (this.settings.livePreview) {
        this.updatePreview();
      }
    } catch (error) {
      console.error('添加新段落時出錯:', error);
      window.showNotification('添加段落失敗', 'error');
    }
  }
  
  /**
   * 獲取當前歌詞
   * @returns {Array} 歌詞段落數組
   */
  getCurrentLyrics() {
    // 從歌詞容器中讀取當前歌詞
    try {
      const lyricsContainer = document.getElementById('lyrics-container');
      if (!lyricsContainer) return [];
      
      const lyrics = [];
      const paragraphs = lyricsContainer.querySelectorAll('.lyrics-paragraph');
      
      paragraphs.forEach(paragraph => {
        const lines = paragraph.querySelectorAll('.lyrics-line');
        const paragraphLines = [];
        
        lines.forEach(line => {
          paragraphLines.push(line.textContent);
        });
        
        if (paragraphLines.length > 0) {
          lyrics.push(paragraphLines);
        }
      });
      
      return lyrics;
    } catch (error) {
      console.error('獲取當前歌詞時出錯:', error);
      return [];
    }
  }
  
  /**
   * 設置當前歌詞
   * @param {Array} lyrics - 歌詞段落數組
   */
  setCurrentLyrics(lyrics) {
    try {
      // 保存為當前工作中的歌詞
      this.currentLyrics = lyrics;
      this.lyrics = lyrics;
      
      // 更新當前項目的歌詞
      if (window.modules && window.modules.projectModule) {
        // 檢查 updateLyrics 方法是否存在
        if (typeof window.modules.projectModule.updateLyrics === 'function') {
          window.modules.projectModule.updateLyrics(lyrics);
        } 
        // 如果不存在，嘗試使用 updateProjectInfo 方法
        else if (typeof window.modules.projectModule.updateProjectInfo === 'function') {
          window.modules.projectModule.updateProjectInfo({ lyrics });
        } 
        // 如果都不存在，輸出警告
        else {
          console.warn('projectModule 缺少 updateLyrics 和 updateProjectInfo 方法');
        }
      } else if (window.projectModule) {
        // 嘗試使用全局變量
        if (typeof window.projectModule.updateLyrics === 'function') {
          window.projectModule.updateLyrics(lyrics);
        } else if (typeof window.projectModule.updateProjectInfo === 'function') {
          window.projectModule.updateProjectInfo({ lyrics });
        }
      } else {
        console.warn('projectModule 未找到，歌詞只會暫時保存在內存中');
      }
    } catch (error) {
      console.error('設置當前歌詞時出錯:', error);
    }
  }
  
  /**
   * 打開匯入歌詞對話框
   */
  openImportDialog() {
    try {
      // 創建匯入對話框內容
      const dialogContent = `
        <div class="import-dialog">
          <div class="dialog-header">
            <h3>匯入歌詞</h3>
            <button class="dialog-close" id="close-import-dialog">✕</button>
          </div>
          
          <div class="dialog-body">
            <div class="form-group">
              <label for="lyrics-text-input">歌詞文本:</label>
              <textarea id="lyrics-text-input" rows="12" placeholder="請在此貼上或輸入歌詞文本..."></textarea>
            </div>
          </div>
          
          <div class="dialog-footer">
            <button id="cancel-import-btn" class="action-button">取消</button>
            <button id="confirm-import-btn" class="action-button primary">匯入</button>
          </div>
        </div>
      `;
      
      // 使用對話框模組顯示對話框
      const dialogModule = this.dialogModule || 
                          (window.modules && window.modules.dialogModule) || 
                          window.dialogModule;
      
      if (!dialogModule) {
        console.error('無法顯示匯入對話框：缺少對話框模組');
        return;
      }
      
      const dialogId = 'import-lyrics-dialog';
      dialogModule.showDialog(dialogContent, dialogId, {
        width: '600px',
        height: 'auto',
        onClose: () => {
          console.log('匯入歌詞對話框已關閉');
        }
      });
      
      // 等待對話框完全渲染
      setTimeout(() => {
        // 獲取對話框內的元素
        const dialog = document.getElementById(dialogId);
        if (!dialog) {
          console.error('找不到匯入歌詞對話框');
          return;
        }
        
        const closeBtn = dialog.querySelector('#close-import-dialog');
        const cancelBtn = dialog.querySelector('#cancel-import-btn');
        const confirmBtn = dialog.querySelector('#confirm-import-btn');
        
        // 確保所有按鈕都存在
        if (!closeBtn || !cancelBtn || !confirmBtn) {
          console.error('匯入對話框缺少必要按鈕');
          return;
        }
        
        // 關閉按鈕事件
        closeBtn.addEventListener('click', () => {
          dialogModule.closeDialog();
        });
        
        // 取消按鈕事件
        cancelBtn.addEventListener('click', () => {
          dialogModule.closeDialog();
        });
        
        // 確認按鈕事件
        confirmBtn.addEventListener('click', () => {
          this.importLyrics(dialog);
        });
      }, 100);
    } catch (error) {
      console.error('打開匯入對話框時出錯:', error);
      window.showNotification('無法開啟匯入對話框', 'error');
    }
  }
  
  /**
   * 導入歌詞文本
   * @param {HTMLElement} dialog - 對話框元素
   */
  importLyrics(dialog) {
    try {
      // 確保傳入了對話框元素
      const dialogElement = dialog || document.getElementById('import-lyrics-dialog');
      if (!dialogElement) {
        console.error('找不到匯入對話框元素');
        window.showNotification('無法找到匯入對話框', 'error');
        return;
      }
      
      // 獲取輸入欄位
      const lyricsInput = dialogElement.querySelector('#lyrics-text-input');
      
      if (!lyricsInput) {
        console.error('找不到必要的輸入欄位');
        window.showNotification('找不到歌詞輸入欄位', 'error');
        return;
      }
      
      // 獲取歌詞文本
      const lyricsText = lyricsInput.value.trim();
      
      if (!lyricsText) {
        window.showNotification('請輸入歌詞文本', 'warning');
        return;
      }
      
      // 將文本分割為段落
      const paragraphs = lyricsText.split(/\n\s*\n/);
      
      // 將每個段落分割為行
      const lyrics = paragraphs.map(paragraph => {
        return paragraph.split('\n').map(line => line.trim()).filter(line => line);
      }).filter(paragraph => paragraph.length > 0);
      
      // 設置歌詞
      this.setCurrentLyrics(lyrics);
      
      // 關閉導入對話框
      this.closeImportDialog();
      
      // 等待對話框完全關閉後再渲染歌詞
      setTimeout(() => {
        // 檢查歌詞容器是否存在
        const lyricsContainer = document.getElementById('lyrics-container');
        if (!lyricsContainer) {
          // 嘗試創建容器
          this.createLyricsContainer();
          
          // 再次檢查
          const newContainer = document.getElementById('lyrics-container');
          if (!newContainer) {
            console.error('找不到歌詞容器，無法渲染歌詞');
            window.showNotification('找不到歌詞容器', 'error');
            return;
          }
        }
        
        // 渲染歌詞
        this.renderLyrics(lyrics);
        
        // 如果啟用了實時預覽，更新預覽
        if (this.settings && this.settings.livePreview) {
          if (typeof this.updatePreview === 'function') {
            this.updatePreview();
          }
        }
        
        window.showNotification('歌詞已導入', 'success');
      }, 200);
    } catch (error) {
      console.error('導入歌詞時出錯:', error);
      window.showNotification('導入歌詞失敗: ' + error.message, 'error');
      
      // 即使發生錯誤，仍然關閉對話框
      this.closeImportDialog();
    }
  }
  
  /**
   * 創建歌詞容器
   * 如果歌詞容器不存在，則創建一個
   */
  createLyricsContainer() {
    try {
      const lyricsEditor = document.getElementById('lyrics-editor');
      if (!lyricsEditor) {
        console.error('找不到歌詞編輯器元素，無法創建容器');
        return false;
      }
      
      // 檢查是否已存在容器
      let lyricsContainer = document.getElementById('lyrics-container');
      if (lyricsContainer) return true;
      
      // 創建新容器
      lyricsContainer = document.createElement('div');
      lyricsContainer.id = 'lyrics-container';
      lyricsContainer.className = 'lyrics-container';
      
      // 添加到編輯器中
      lyricsEditor.appendChild(lyricsContainer);
      
      console.log('已創建歌詞容器元素');
      return true;
    } catch (error) {
      console.error('創建歌詞容器時出錯:', error);
      return false;
    }
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
   * @param {HTMLSelectElement} selectElement - 下拉選擇框元素
   */
  loadSearchSources(selectElement) {
    try {
      if (!selectElement) {
        console.error('選擇元素不存在');
        return;
      }
      
      // 清空現有選項
      selectElement.innerHTML = '';
      
      // 默認搜尋來源
      const defaultSources = [
        { id: 'combined', name: '全部來源' },
        { id: 'combined_no_ai', name: '全部來源 (無AI)' },
        { id: 'genius', name: 'Genius' },
        { id: 'musixmatch', name: 'Musixmatch' },
        { id: 'local', name: '本地搜尋' }
      ];
      
      // 嘗試從設置獲取自定義搜尋來源
      let customSources = [];
      
      try {
        // 嘗試從設置模組獲取
        if (window.modules && window.modules.settingsModule) {
          // 使用 getSetting 方法
          if (typeof window.modules.settingsModule.getSetting === 'function') {
            customSources = window.modules.settingsModule.getSetting('lyricsSources', []);
          } 
          // 如果沒有 getSetting 方法，直接訪問 settings 對象
          else if (window.modules.settingsModule.settings) {
            customSources = window.modules.settingsModule.settings.lyricsSources || [];
          }
        } 
        // 如果模組不可用，嘗試其他方式獲取
        else if (window.settingsModule) {
          if (typeof window.settingsModule.getSetting === 'function') {
            customSources = window.settingsModule.getSetting('lyricsSources', []);
          } else if (window.settingsModule.settings) {
            customSources = window.settingsModule.settings.lyricsSources || [];
          }
        }
      } catch (error) {
        console.error('無法從設定模塊獲取搜尋來源:', error);
        customSources = [];
      }
      
      // 合併默認和自定義來源
      const sources = [...defaultSources];
      
      // 添加自定義來源（如果有）
      if (Array.isArray(customSources) && customSources.length > 0) {
        sources.push({ id: 'divider', name: '---', disabled: true });
        sources.push(...customSources);
      }
      
      // 創建選項
      sources.forEach(source => {
        const option = document.createElement('option');
        option.value = source.id;
        option.textContent = source.name;
        
        if (source.disabled) {
          option.disabled = true;
        }
        
        selectElement.appendChild(option);
      });
      
      // 如果有默認值，設置它
      if (this.settings && this.settings.defaultLyricsSource) {
        selectElement.value = this.settings.defaultLyricsSource;
      } else {
        selectElement.value = 'combined';
      }
    } catch (error) {
      console.error('載入搜尋來源時出錯:', error);
      
      // 如果出錯，添加基本選項
      if (selectElement) {
        selectElement.innerHTML = `
          <option value="combined">全部來源</option>
          <option value="combined_no_ai">全部來源 (無AI)</option>
          <option value="genius">Genius</option>
          <option value="musixmatch">Musixmatch</option>
          <option value="local">本地搜尋</option>
        `;
      }
    }
  }
  
  /**
   * 渲染空白狀態
   * 當沒有歌詞時顯示的界面
   */
  renderEmptyState() {
    try {
      // 獲取歌詞容器
      const lyricsContainer = document.getElementById('lyrics-container');
      if (!lyricsContainer) {
        console.warn('歌詞容器元素未找到，無法渲染空狀態');
        return;
      }
      
      // 創建空狀態元素
      lyricsContainer.innerHTML = `
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
    } catch (error) {
      console.error('渲染空白狀態時出錯:', error);
    }
  }
  
  /**
   * 關閉匯入對話框
   */
  closeImportDialog() {
    try {
      // 嘗試各種可能的方式關閉對話框
      if (this.dialogModule && typeof this.dialogModule.closeDialog === 'function') {
        this.dialogModule.closeDialog();
      } else if (window.modules && window.modules.dialogModule && typeof window.modules.dialogModule.closeDialog === 'function') {
        window.modules.dialogModule.closeDialog();
      } else if (window.dialogModule && typeof window.dialogModule.closeDialog === 'function') {
        window.dialogModule.closeDialog();
      } else {
        console.warn('無法找到對話框模塊來關閉匯入對話框');
      }
    } catch (error) {
      console.error('關閉匯入對話框時出錯:', error);
    }
  }
  
  /**
   * 添加新行到指定段落
   * @param {number} paragraphIndex - 段落索引
   */
  addNewLine(paragraphIndex) {
    try {
      // 確保歌詞數組存在
      if (!Array.isArray(this.lyrics) || !this.lyrics[paragraphIndex]) {
        console.error('無法添加行：歌詞或段落不存在');
        return;
      }
      
      // 獲取段落
      const paragraph = this.lyrics[paragraphIndex];
      
      // 處理不同的段落格式
      if (Array.isArray(paragraph)) {
        // 如果段落是數組，直接添加空行
        paragraph.push('');
      } else if (typeof paragraph === 'object' && paragraph !== null && 'text' in paragraph) {
        // 如果段落是帶有 text 屬性的對象，將文本拆分為行，添加空行，再合併
        const lines = paragraph.text.split('\n');
        lines.push('');
        paragraph.text = lines.join('\n');
      } else if (typeof paragraph === 'string') {
        // 如果段落是字符串，轉換為數組格式
        this.lyrics[paragraphIndex] = [paragraph, ''];
      } else {
        // 其他情況，替換為包含一個空行的數組
        this.lyrics[paragraphIndex] = [''];
      }
      
      // 重新渲染歌詞
      this.renderLyrics();
      
      // 標記項目為已修改
      if (window.modules && window.modules.projectModule) {
        if (typeof window.modules.projectModule.markAsModified === 'function') {
          window.modules.projectModule.markAsModified();
        }
      }
    } catch (error) {
      console.error('添加新行時出錯:', error);
      window.showNotification('添加新行失敗', 'error');
    }
  }
  
  /**
   * 處理行編輯
   * @param {Event} event - 事件對象
   * @param {number} paragraphIndex - 段落索引
   * @param {number} lineIndex - 行索引
   */
  handleLineEdit(event, paragraphIndex, lineIndex) {
    try {
      // 獲取新的行文本
      const newText = event.target.textContent;
      
      // 確保歌詞數組存在
      if (!Array.isArray(this.lyrics) || !this.lyrics[paragraphIndex]) {
        console.error('無法更新行：歌詞或段落不存在');
        return;
      }
      
      // 獲取段落
      const paragraph = this.lyrics[paragraphIndex];
      
      // 處理不同的段落格式
      if (Array.isArray(paragraph)) {
        // 如果段落是數組，直接更新行
        if (lineIndex < paragraph.length) {
          paragraph[lineIndex] = newText;
        }
      } else if (typeof paragraph === 'object' && paragraph !== null && 'text' in paragraph) {
        // 如果段落是帶有 text 屬性的對象
        const lines = paragraph.text.split('\n');
        if (lineIndex < lines.length) {
          lines[lineIndex] = newText;
          paragraph.text = lines.join('\n');
        }
      } else if (typeof paragraph === 'string' && lineIndex === 0) {
        // 如果段落是字符串且這是第一行
        this.lyrics[paragraphIndex] = newText;
      }
      
      // 標記項目為已修改
      if (window.modules && window.modules.projectModule) {
        if (typeof window.modules.projectModule.markAsModified === 'function') {
          window.modules.projectModule.markAsModified();
        }
      }
    } catch (error) {
      console.error('更新行文本時出錯:', error);
    }
  }
  
  /**
   * 移動段落
   * @param {number} paragraphIndex - 段落索引
   * @param {string} direction - 移動方向 ('up' 或 'down')
   */
  moveParagraph(paragraphIndex, direction) {
    try {
      // 確保歌詞數組存在
      if (!Array.isArray(this.lyrics) || this.lyrics.length < 2) {
        console.warn('無法移動段落：歌詞不存在或只有一個段落');
        return;
      }
      
      // 檢查索引是否有效
      if (paragraphIndex < 0 || paragraphIndex >= this.lyrics.length) {
        console.error('段落索引無效');
        return;
      }
      
      // 根據方向移動段落
      if (direction === 'up') {
        // 檢查是否已經是第一個段落
        if (paragraphIndex === 0) {
          console.warn('已經是第一個段落，無法上移');
          return;
        }
        
        // 交換當前段落與上一個段落
        const temp = this.lyrics[paragraphIndex];
        this.lyrics[paragraphIndex] = this.lyrics[paragraphIndex - 1];
        this.lyrics[paragraphIndex - 1] = temp;
        
        // 更新選中段落的索引
        this.selectedParagraphIndex = paragraphIndex - 1;
      } else if (direction === 'down') {
        // 檢查是否已經是最後一個段落
        if (paragraphIndex === this.lyrics.length - 1) {
          console.warn('已經是最後一個段落，無法下移');
          return;
        }
        
        // 交換當前段落與下一個段落
        const temp = this.lyrics[paragraphIndex];
        this.lyrics[paragraphIndex] = this.lyrics[paragraphIndex + 1];
        this.lyrics[paragraphIndex + 1] = temp;
        
        // 更新選中段落的索引
        this.selectedParagraphIndex = paragraphIndex + 1;
      } else {
        console.error('無效的移動方向:', direction);
        return;
      }
      
      // 重新渲染歌詞
      this.renderLyrics();
      
      // 重新選中段落
      this.selectParagraph(this.selectedParagraphIndex);
      
      // 標記項目為已修改
      if (window.modules && window.modules.projectModule) {
        if (typeof window.modules.projectModule.markAsModified === 'function') {
          window.modules.projectModule.markAsModified();
        }
      }
    } catch (error) {
      console.error('移動段落時出錯:', error);
      window.showNotification('移動段落失敗', 'error');
    }
  }
  
  /**
   * 顯示無搜尋結果訊息
   */
  showNoResultsMessage() {
    try {
      console.log('無搜尋結果');
      
      // 使用通知或對話框顯示訊息
      window.showNotification('未找到符合的歌詞', 'info');
      
      // 如果有對話框模組，顯示更詳細的訊息
      const dialogModule = this.dialogModule || 
                          (window.modules && window.modules.dialogModule) || 
                          window.dialogModule;
      
      if (dialogModule && typeof dialogModule.showAlertDialog === 'function') {
        dialogModule.showAlertDialog(
          '未找到符合您搜尋條件的歌詞。<br><br>您可以：<br>- 檢查歌曲名稱和歌手名稱的拼寫<br>- 嘗試使用不同的搜尋來源<br>- 嘗試直接匯入歌詞文本',
          '無搜尋結果',
          'info'
        );
      }
    } catch (error) {
      console.error('顯示無結果訊息時出錯:', error);
    }
  }
}

// 全局導出
window.LyricsModule = LyricsModule; 