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
    // 創建對話框內容
    const dialogContent = `
      <div class="dialog-header">
        <h3>搜尋歌詞</h3>
        <button class="dialog-close" id="close-search-dialog">✕</button>
      </div>
      <div class="dialog-body">
        <div class="search-form">
          <div class="form-group">
            <label for="search-song-title">歌曲名稱</label>
            <input type="text" id="search-song-title" placeholder="輸入歌曲名稱" required>
          </div>
          <div class="form-group">
            <label for="search-artist-name">藝人名稱 (選填)</label>
            <input type="text" id="search-artist-name" placeholder="輸入藝人名稱">
          </div>
          <div class="form-group">
            <label>搜尋來源</label>
            <div class="search-sources">
              <label class="checkbox-label">
                <input type="checkbox" name="search-source" value="mojim" checked>
                <span>Mojim</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" name="search-source" value="musixmatch" checked>
                <span>Musixmatch</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" name="search-source" value="kkbox" checked>
                <span>KKBOX</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button id="cancel-search" class="action-button">取消</button>
        <button id="start-search" class="action-button primary">搜尋</button>
      </div>
    `;
    
    // 獲取對話框模組
    const dialogModule = this.dialogModule || window.dialogModule || window.modules?.dialogModule;
    if (!dialogModule) {
      console.error('無法訪問對話框模塊');
      alert('系統錯誤：無法啟動搜尋功能');
      return;
    }
    
    dialogModule.showDialog(dialogContent, 'search-lyrics-dialog');
    
    // 設置對話框按鈕事件
    const closeBtn = document.getElementById('close-search-dialog');
    const cancelBtn = document.getElementById('cancel-search');
    const searchBtn = document.getElementById('start-search');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        dialogModule.closeDialog();
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        dialogModule.closeDialog();
      });
    }
    
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.searchLyrics();
      });
    }
  }
  
  /**
   * 打開手動輸入歌詞對話框
   */
  openImportDialog() {
    const dialogContent = `
      <div class="dialog-header">
        <h3>手動輸入歌詞</h3>
        <button class="dialog-close" id="close-import-dialog">✕</button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label for="import-song-title">歌曲名稱</label>
          <input type="text" id="import-song-title" placeholder="輸入歌曲名稱" required>
        </div>
        <div class="form-group">
          <label for="import-artist-name">藝人名稱 (選填)</label>
          <input type="text" id="import-artist-name" placeholder="輸入藝人名稱">
        </div>
        <div class="form-group">
          <label for="import-lyrics-text">歌詞內容</label>
          <textarea id="import-lyrics-text" placeholder="輸入或貼上歌詞內容" rows="10"></textarea>
        </div>
      </div>
      <div class="dialog-footer">
        <button id="cancel-import" class="action-button">取消</button>
        <button id="confirm-import" class="action-button primary">確認</button>
      </div>
    `;
    
    // 獲取對話框模組
    const dialogModule = this.dialogModule || window.dialogModule || window.modules?.dialogModule;
    if (!dialogModule) {
      console.error('無法訪問對話框模塊');
      alert('系統錯誤：無法啟動匯入功能');
      return;
    }
    
    dialogModule.showDialog(dialogContent, 'import-lyrics-dialog');
    
    // 設置對話框按鈕事件
    const closeBtn = document.getElementById('close-import-dialog');
    const cancelBtn = document.getElementById('cancel-import');
    const confirmBtn = document.getElementById('confirm-import');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        dialogModule.closeDialog();
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        dialogModule.closeDialog();
      });
    }
    
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.importLyrics();
      });
    }
  }
  
  /**
   * 搜索歌詞
   */
  searchLyrics() {
    const songTitleInput = document.getElementById('search-song-title');
    const artistNameInput = document.getElementById('search-artist-name');
    
    if (!songTitleInput) {
      console.error('找不到歌曲標題輸入欄位');
      return;
    }
    
    const songTitle = songTitleInput.value.trim();
    const artistName = artistNameInput ? artistNameInput.value.trim() : '';
    
    if (!songTitle) {
      alert('請輸入歌曲標題');
      return;
    }
    
    // 獲取選中的搜索源
    const sourceOptions = document.querySelectorAll('input[name="search-source"]:checked');
    const sources = Array.from(sourceOptions).map(option => option.value);
    
    if (sources.length === 0) {
      alert('請選擇至少一個搜索源');
      return;
    }
    
    // 關閉對話框
    const dialogModule = this.dialogModule || window.dialogModule || window.modules?.dialogModule;
    if (dialogModule) {
      dialogModule.closeDialog();
    }
    
    // 顯示加載中狀態
    this.showLoading('正在搜索歌詞...');
    
    // 搜索歌詞
    console.log(`搜索歌詞: ${songTitle} - ${artistName}, 搜索源: ${sources.join(', ')}`);
    
    // 檢查electronAPI是否可用
    if (window.electronAPI && typeof window.electronAPI.send === 'function') {
      window.electronAPI.send('search-lyrics', {
        title: songTitle,
        artist: artistName,
        sources: sources
      });
    } else {
      // 模擬搜索過程
      console.log('模擬搜索過程');
      setTimeout(() => {
        this.hideLoading();
        
        // 模擬搜索結果
        this.searchResults = this.getMockSearchResults(songTitle, artistName);
        
        if (this.searchResults.length > 0) {
          this.showSearchResultsDialog(this.searchResults);
        } else {
          this.showNoResultsMessage();
        }
      }, 1500);
    }
  }
  
  /**
   * 獲取模擬搜索結果（用於沒有API連接時測試）
   */
  getMockSearchResults(title, artist) {
    const mockResults = [];
    
    if (title.toLowerCase().includes('無結果測試')) {
      return [];
    }
    
    mockResults.push({
      title: title,
      artist: artist || '未知藝人',
      source: 'MusicMatch',
      url: 'https://example.com/lyrics/1'
    });
    
    if (Math.random() > 0.3) {
      mockResults.push({
        title: `${title} (Live版)`,
        artist: artist || '未知藝人',
        source: 'KTV資料庫',
        url: 'https://example.com/lyrics/2'
      });
    }
    
    return mockResults;
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
   * 匯入文本歌詞
   */
  importLyrics() {
    const songTitleInput = document.getElementById('import-song-title');
    const artistNameInput = document.getElementById('import-artist-name');
    const lyricsTextInput = document.getElementById('import-lyrics-text');
    
    if (!songTitleInput || !lyricsTextInput) {
      console.error('找不到必要的輸入欄位');
      return;
    }
    
    const songTitle = songTitleInput.value.trim();
    const artistName = artistNameInput ? artistNameInput.value.trim() : '';
    const lyricsText = lyricsTextInput.value.trim();
    
    if (!songTitle) {
      alert('請輸入歌曲標題');
      return;
    }
    
    if (!lyricsText) {
      alert('請輸入歌詞文本');
      return;
    }
    
    // 關閉對話框
    const dialogModule = this.dialogModule || window.dialogModule || window.modules?.dialogModule;
    if (dialogModule) {
      dialogModule.closeDialog();
    }
    
    // 解析歌詞
    this.parseLyrics(lyricsText);
    
    // 更新界面
    this.renderLyrics();
    
    // 更新項目信息
    const projectModule = this.projectModule || window.projectModule || window.modules?.projectModule;
    if (projectModule && typeof projectModule.updateProjectInfo === 'function') {
      projectModule.updateProjectInfo({
        title: songTitle,
        artist: artistName || '未知藝人'
      });
    } else {
      console.error('無法更新項目信息: projectModule不可用或缺少updateProjectInfo方法');
      
      // 至少更新顯示
      const titleElement = document.getElementById('song-title');
      const artistElement = document.getElementById('artist-name');
      const projectNameElement = document.getElementById('project-name');
      
      if (titleElement) titleElement.textContent = songTitle;
      if (artistElement) artistElement.textContent = artistName || '未知藝人';
      if (projectNameElement) projectNameElement.textContent = songTitle;
    }
    
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
}

// 全局導出
window.LyricsModule = LyricsModule; 