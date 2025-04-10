# 歌曲投影片生成器

一款專為敬拜團隊設計的桌面應用程式，能夠輕鬆將歌曲轉換為簡易的投影片。

## 主要功能

- **歌詞自動搜尋**：輸入歌曲名稱，自動從網路搜尋歌詞 (目前主要透過網頁爬蟲)，並支援手動編輯。
- **AI背景生成**：根據歌詞內容和氛圍，使用 OpenAI DALL-E 3 模型生成適合的投影片背景圖片（也可選擇本地圖片）。
- **Marp 投影片生成**：將歌詞和圖片自動排版成 Marp Markdown 格式，方便預覽和匯出。
- **投影片即時預覽**：編輯歌詞或調整設定時即時預覽最終效果。
- **多格式匯出**：支援 PDF、PPTX、HTML 等多種格式匯出。
- **批次管理功能**：創建歌曲集合，批次生成和匯出多首歌曲的投影片。
- **設定管理**：管理 OpenAI API 金鑰、圖片生成提示詞模板、自定義 Marp 標頭等。
- **本地快取**：歌詞、圖片、生成的投影片內容會儲存在本地快取中，加速載入。
- **多語言支援**：目前僅支援**繁體中文**介面，預計未來支援英文與簡體中文。

## 安裝方式

### Windows 系統

1. 從[發布頁面](https://github.com/Jaychao2099/lyrics-to-slides/releases)下載最新的 `lyrics-to-slides-setup-1.0.4.exe` 安裝檔 或 `Lyrics to Slides-1.0.4.exe` 免安裝執行檔（可跳過2. 3.）。
2. 執行安裝檔，依照指示完成安裝。
3. 從開始選單或桌面快捷方式啟動應用程式。

### macOS 系統 (尚未支援)

*(注意：macOS 版本理論上可透過 `electron-builder` 建置，但可能未經完整測試)*
1. 從[發布頁面](https://github.com/Jaychao2099/lyrics-to-slides/releases)下載最新的 `lyrics-to-slides-1.0.4.dmg` 鏡像檔。
2. 開啟下載的鏡像檔。
3. 將應用程式拖曳至應用程式資料夾。
4. 在應用程式資料夾中啟動軟體。

## 快速開始

### 第一步：設定 API 金鑰

1. 開啟應用程式，點擊側邊欄的「設定」。
2. 前往「API 金鑰設定」分頁。
3. 輸入您的 **API 金鑰**。
4. 點擊「儲存設定」。

### 第二步：搜尋歌詞

1. 點擊側邊欄的「搜尋歌詞」或「編輯歌詞」。
2. 輸入歌曲名稱和歌手/樂團（可選）。
3. 點擊「搜尋歌詞」，應用程式將嘗試從網路上爬取歌詞。
4. 確認搜尋結果，必要時可手動編輯歌詞。

    或

1. 從「已儲存歌曲」列表中選擇歌曲。

### 第三步：選擇背景圖片
* 點擊「生成背景圖片」（目前僅支援 OpenAI DALL-E 3 模型）。

    或

* 點擊「匯入本地圖片」。

### 第四步：生成與編輯投影片

1. 確認歌詞和圖片後，系統會自動生成 Marp Markdown 格式的投影片內容。
2. 您可以在「源代碼與設置」分頁直接編輯 Markdown 內容進行微調，調整文字顏色、描邊等樣式。
3. 在「預覽投影片」分頁檢視效果。
4. 滿意後點擊「匯出投影片」，選擇您需要的格式（PDF, PPTX, HTML）。

### 第五步：批次處理（可選）

1. 點擊側邊欄的「批次投影片」。
2. 創建新的歌曲集合。
3. 從**已搜尋或儲存**的歌曲中添加多首歌曲至集合。
4. 拖曳歌曲調整順序後，點擊「生成批次投影片」。
5. 在「預覽」分頁檢視合併後的效果。
6. 點擊「匯出批次投影片」，選擇輸出格式和路徑進行匯出。

## 常見問題

### 無法搜尋到歌詞
- 檢查您的網路連接是否正常。
- 嘗試使用更精確的歌曲名稱和歌手名稱。
- 確認目標歌詞是否存在於公開的歌詞網站上，並且網站結構未發生重大變化。
- 若持續失敗，可嘗試手動複製貼上歌詞。

### 圖片生成失敗
- 確認您的 OpenAI API 金鑰設定正確且 API 金鑰有效、有足夠的額度。
- 檢查網路連接。
- 嘗試修改「設定」中的「提示詞模板」，確保其符合 OpenAI 的內容政策。
- 檢查歌詞內容是否觸發了內容審核。

### 如何自訂投影片風格
- 在「設定」頁面的「提示詞模板」分頁可自訂 AI 生成圖片的風格。
- 在編輯頁面的「源代碼與設置」分頁可直接修改 Markdown 內容調整排版，並設定文字顏色、描邊大小與顏色。
- 支援上傳自定義背景圖片替代 AI 生成圖片。
- 在「設定」頁面的「通用設定」分頁可以自定義 Marp 標頭內容，進一步控制樣式。

## 資料與隱私

- 所有設定、搜尋到的歌詞、生成的圖片和投影片內容都儲存在您的**本地電腦** (`%APPDATA%/lyrics-to-slides` 或 macOS 對應的應用程式支援目錄下)，不會上傳至任何伺服器。
- API 金鑰使用 `electron-store` 儲存在本地設定檔中，建議確保您的電腦安全。
- 您可以在「設定」的「資料管理」分頁中清除所有快取資料（歌詞、圖片、投影片）。

## 未來規劃
- 支援更多 AI 進行圖片生成（如 GPT-4o, Gemini, Grok, 本地模型等）。
- 串接 AI 進行搜尋。
- 支援多語言。
- 支援一鍵全 AI 生成自動化（多模態AI模型串接）。

## 系統需求

- **Windows**: Windows 10 或更高版本。
- **macOS**: macOS 10.15（Catalina） 或更高版本 (待完整測試)。
- **硬碟空間**: 最少 500MB (取決於快取大小)。
- **記憶體**: 建議 4GB 以上。
- **網路連接**: 需要網路連接以搜尋歌詞和生成圖片。

## 授權與免責聲明

- 本應用程式僅供非商業用途使用。
- 歌詞內容來自公開網站爬取，本應用程式不擁有歌詞版權，請尊重原作者權利。
- AI 生成圖片受 OpenAI 使用條款約束。
- 使用本應用程式生成的投影片時，請確保符合當地版權法規。

## 開發心得（不重要）

第一次製作軟體專案，若有 bug 滿天飛或功能不全，還請見諒。本次專案使用 Cursor 和 Windsurf 進行 vibe-coding 製作，大部分使用 Claude sonnet 3.7 模型，歷時約 2 週。本以為能在一週內完成，但實際上卻常常因為 vibe-debugging 耗費巨量心神而不得不休息一下，都快沒 vibe 了。中間也經歷幾次大改版，深感專案製作不易，感謝 AI。

感謝神讓專案有個階段性的成果。途中幾次讓 AI 進行大篇幅的修改，深怕又被改到進入死胡同（對，已經歷幾次），但禱告後都順利修改完畢。Pray-coding 能成為新潮流嗎？！

另外感謝 Alex Lin 傳道提供靈感。實際上並沒有實現你當初提到的一鍵全自動生成，變成就是個普通的投影片製作模組，整體功能稍嫌雞肋。但就當作練習吧。

2025/04/07