# 使用 NVIDIA CUDA 映像檔 (基於 Ubuntu 22.04) 作為基礎
FROM nvidia/cuda:12.1.1-base-ubuntu22.04

# 設定環境變數，避免 apt-get 在安裝過程中出現互動式提問
ENV DEBIAN_FRONTEND=noninteractive

# --- 安裝 Node.js 20 ---
RUN apt-get update && apt-get install -y ca-certificates curl gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install -y nodejs && \
    apt-get clean

# 將工作目錄設定為 /app
WORKDIR /app

# 複製依賴性定義檔
COPY package*.json ./

# 安裝生產環境的依賴
RUN npm install --production

# 複製所有應用程式碼
COPY . .

# 賦予啟動腳本執行權限
RUN chmod +x start.sh

# 對外開放 port 5000
EXPOSE 5000

# 執行啟動腳本
CMD ["./start.sh"]