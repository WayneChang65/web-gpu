# Web GPU Monitor

一個基於 Node.js 與 WebSocket 的即時系統監控儀表板，專為監控 CPU、RAM 與 NVIDIA GPU 狀態而設計。

## 功能特色

- **即時監控**: 透過 WebSocket 即時更新系統狀態。
- **GPU 支援**: 完整支援 NVIDIA GPU 監控 (使用 `nvidia-smi`)。
- **歷史圖表**: 顯示 CPU、RAM 與 GPU 的歷史趨勢圖。
- **響應式設計**: 支援各種螢幕尺寸，並針對大螢幕進行了縮放優化。
- **容器化**: 提供 Docker 支援，輕鬆部署。

## 快速開始

### 使用 Docker Compose (推薦)

1.  確保已安裝 Docker 與 NVIDIA Docker Runtime。
2.  複製專案並進入目錄：
    ```bash
    git clone <repository-url>
    cd web-gpu
    ```
3.  啟動服務：
    ```bash
    docker compose up -d
    ```
4.  開啟瀏覽器訪問 `http://localhost:8080`。

### 本地開發

1.  安裝依賴：
    ```bash
    npm install
    ```
2.  啟動開發伺服器：
    ```bash
    npm start
    ```
    *注意：若本地無 NVIDIA GPU，系統會自動回退至 `systeminformation` 庫模擬數據。*

## 環境變數

您可以在專案根目錄建立 `.env` 檔案來調整設定：

```env
PORT=5000                 # 應用程式內部連接埠
HISTORY_LENGTH=3600       # 歷史數據保存長度 (點數)
UPDATE_INTERVAL=1000      # 數據更新頻率 (毫秒)
```

## 專案結構

- `src/`: 後端原始碼
    - `monitor.js`: 系統監控邏輯
    - `websocket.js`: WebSocket 伺服器邏輯
    - `config.js`: 設定管理
    - `logger.js`: 日誌管理
- `public/`: 前端靜態檔案
    - `index.html`: 主頁面
    - `style.css`: 樣式表
    - `app.js`: 前端邏輯
- `tests/`: 單元測試

## 測試

執行單元測試：

```bash
npm test
```

## 技術棧

- **Backend**: Node.js, Express, WebSocket (ws)
- **Frontend**: HTML5, CSS3, Chart.js
- **Monitoring**: nvidia-smi, systeminformation
- **Container**: Docker, Docker Compose
