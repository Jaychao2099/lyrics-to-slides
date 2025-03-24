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
    }
    
    // 監聽應用程序初始化事件
    window.addEventListener('app-ready', () => {
      this.renderEmptyState();
    });
  }
  
  /**
   * 打開歌詞搜索對話框
   */
  openSearchDialog() {
    // 創建並顯示搜索對話框
    const dialogContent = `
      <div class="dialog-header">
        <h3>搜尋歌詞</h3>
        <button class="dialog-close" id="close-search-dialog">✕</button>
      </div>
      <div class="dialog-body">
        <div class="search-form">
          <div class="form-group">
            <label for="song-title">歌曲名稱</label>
            <input type="text" id="song-title" placeholder="輸入歌曲名稱" required>
          </div>
          <div class="form-group">
            <label for="artist-name">藝人名稱 (選填)</label>
            <input type="text" id="artist-name" placeholder="輸入藝人名稱">
          </div>
          <div class="form-group">
            <label>搜尋來源</label>
            <div class="search-sources">
              <label class="checkbox-label">
                <input type="checkbox" id="source-mojim" checked>
                <span>Mojim</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="source-musixmatch" checked>
                <span>Musixmatch</span>
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
    
    window.dialogModule.showDialog(dialogContent, 'search-lyrics-dialog');
    
    // 設置對話框按鈕事件
    const closeBtn = document.getElementById('close-search-dialog');
    const cancelBtn = document.getElementById('cancel-search');
    const searchBtn = document.getElementById('start-search');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
      });
    }
    
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const title = document.getElementById('song-title').value.trim();
        const artist = document.getElementById('artist-name').value.trim();
        const useMojim = document.getElementById('source-mojim').checked;
        const useMusixmatch = document.getElementById('source-musixmatch').checked;
        
        if (!title) {
          alert('請輸入歌曲名稱');
          return;
        }
        
        // 開始搜尋
        this.searchLyrics(title, artist, { useMojim, useMusixmatch });
      });
    }
  }
  
  /**
   * 搜尋歌詞
   * @param {string} title - 歌曲標題
   * @param {string} artist - 藝人名稱
   * @param {Object} options - 搜尋選項
   */
  searchLyrics(title, artist, options) {
    window.dialogModule.closeDialog();
    
    // 顯示加載中狀態
    this.showLoading('正在搜尋歌詞...');
    
    // 通過IPC發送搜尋請求到主程序
    window.electronAPI.send('search-lyrics', { title, artist, options });
    
    // 注意：搜尋結果將通過IPC回調處理
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
    
    window.dialogModule.showDialog(dialogContent, 'search-results-dialog');
    
    // 設置對話框按鈕事件
    const closeBtn = document.getElementById('close-results-dialog');
    const backBtn = document.getElementById('back-to-search');
    const cancelBtn = document.getElementById('cancel-results');
    const selectBtns = document.querySelectorAll('.select-lyrics-btn');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
      });
    }
    
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
        setTimeout(() => {
          this.openSearchDialog();
        }, 300);
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
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
    
    window.dialogModule.closeDialog();
    
    // 顯示加載中狀態
    this.showLoading('正在獲取歌詞...');
    
    // 通過IPC請求獲取完整歌詞
    window.electronAPI.send('get-lyrics', { resultId: index });
    
    // 設置項目信息
    document.getElementById('song-title').textContent = result.title;
    document.getElementById('artist-name').textContent = result.artist || '未知藝人';
    document.getElementById('project-name').textContent = result.title;
    
    // 更新項目數據
    window.projectModule.updateProjectInfo({
      title: result.title,
      artist: result.artist,
      source: result.source,
      sourceUrl: result.url
    });
  }
  
  /**
   * 處理接收到的歌詞
   * @param {string} lyricsText - 歌詞文本
   * @param {string} language - 歌詞語言
   */
  handleReceivedLyrics(lyricsText, language) {
    // 隱藏加載狀態
    this.hideLoading();
    
    // 解析歌詞
    this.lyrics = this.parseLyrics(lyricsText);
    
    // 設置歌詞語言
    window.projectModule.updateProjectInfo({ language });
    
    // 渲染歌詞
    this.renderLyrics();
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
    
    return paragraphs;
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
    if (!this.lyricsEditor) return;
    
    this.lyricsEditor.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎵</div>
        <h3>尚無歌詞</h3>
        <p>點擊「搜尋歌詞」按鈕開始，或手動匯入歌詞文本</p>
      </div>
    `;
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
    
    window.dialogModule.showDialog(dialogContent, 'no-results-dialog');
    
    // 設置對話框按鈕事件
    const closeBtn = document.getElementById('close-no-results-dialog');
    const backBtn = document.getElementById('back-to-search-noresult');
    const manualBtn = document.getElementById('manual-input');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
      });
    }
    
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
        setTimeout(() => {
          this.openSearchDialog();
        }, 300);
      });
    }
    
    if (manualBtn) {
      manualBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
        setTimeout(() => {
          this.openImportDialog();
        }, 300);
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
          <label for="manual-song-title">歌曲名稱</label>
          <input type="text" id="manual-song-title" placeholder="輸入歌曲名稱" required>
        </div>
        <div class="form-group">
          <label for="manual-artist-name">藝人名稱 (選填)</label>
          <input type="text" id="manual-artist-name" placeholder="輸入藝人名稱">
        </div>
        <div class="form-group">
          <label for="manual-lyrics">歌詞內容</label>
          <textarea id="manual-lyrics" placeholder="輸入或貼上歌詞內容" rows="10"></textarea>
        </div>
      </div>
      <div class="dialog-footer">
        <button id="cancel-import" class="action-button">取消</button>
        <button id="confirm-import" class="action-button primary">確認</button>
      </div>
    `;
    
    window.dialogModule.showDialog(dialogContent, 'import-lyrics-dialog');
    
    // 設置對話框按鈕事件
    const closeBtn = document.getElementById('close-import-dialog');
    const cancelBtn = document.getElementById('cancel-import');
    const confirmBtn = document.getElementById('confirm-import');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.dialogModule.closeDialog();
      });
    }
    
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const title = document.getElementById('manual-song-title').value.trim();
        const artist = document.getElementById('manual-artist-name').value.trim();
        const lyricsText = document.getElementById('manual-lyrics').value.trim();
        
        if (!title) {
          alert('請輸入歌曲名稱');
          return;
        }
        
        if (!lyricsText) {
          alert('請輸入歌詞內容');
          return;
        }
        
        // 設置項目信息
        document.getElementById('song-title').textContent = title;
        document.getElementById('artist-name').textContent = artist || '未知藝人';
        document.getElementById('project-name').textContent = title;
        
        // 更新項目數據
        window.projectModule.updateProjectInfo({
          title: title,
          artist: artist,
          source: '手動輸入',
          sourceUrl: ''
        });
        
        // 解析並設置歌詞
        this.lyrics = this.parseLyrics(lyricsText);
        
        // 渲染歌詞
        this.renderLyrics();
        
        window.dialogModule.closeDialog();
      });
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
  addParagraph() {
    let position = this.selectedParagraphIndex;
    if (position < 0) {
      position = this.lyrics.length;
    } else {
      position += 1; // 在當前選擇的段落後添加
    }
    
    // 插入新段落
    this.lyrics.splice(position, 0, ['新段落']);
    
    // 重新渲染歌詞
    this.renderLyrics();
    
    // 選擇新段落
    this.selectParagraph(position);
  }
  
  /**
   * 分割段落
   */
  splitParagraph() {
    if (this.selectedParagraphIndex < 0 || this.selectedLineIndex < 0) return;
    
    const paragraph = this.lyrics[this.selectedParagraphIndex];
    if (!paragraph || paragraph.length <= 1) return;
    
    const line = this.selectedLineIndex;
    
    // 分割段落
    const newParagraph = paragraph.slice(line);
    paragraph.splice(line);
    
    // 插入新段落
    this.lyrics.splice(this.selectedParagraphIndex + 1, 0, newParagraph);
    
    // 重新渲染歌詞
    this.renderLyrics();
  }
  
  /**
   * 合併段落
   */
  mergeParagraphs() {
    if (this.selectedParagraphIndex < 0 || this.selectedParagraphIndex >= this.lyrics.length - 1) return;
    
    const current = this.lyrics[this.selectedParagraphIndex];
    const next = this.lyrics[this.selectedParagraphIndex + 1];
    
    // 合併段落
    current.push(...next);
    
    // 移除下一個段落
    this.lyrics.splice(this.selectedParagraphIndex + 1, 1);
    
    // 重新渲染歌詞
    this.renderLyrics();
    
    // 選擇合併後的段落
    this.selectParagraph(this.selectedParagraphIndex);
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
    if (!this.lyricsEditor) return;
    
    this.lyricsEditor.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
  }
  
  /**
   * 隱藏加載狀態
   */
  hideLoading() {
    // 此方法不需要做什麼，因為renderLyrics或renderEmptyState會替換內容
  }
  
  /**
   * 獲取所有歌詞數據
   * @returns {Array} 歌詞數據
   */
  getLyricsData() {
    return this.lyrics;
  }
}

// 全局導出
window.LyricsModule = LyricsModule; 