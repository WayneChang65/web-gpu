# 使用 NVIDIA CUDA 映像檔 (基於 Ubuntu 22.04) 作為基礎
FROM nvidia/cuda:12.1.1-base-ubuntu22.04

# 設定環境變數
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=20.11.0

# 安裝 Node.js 和其他必要的工具
RUN apt-get update && \
    apt-get install -y curl procps && \
    curl -sL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝 Node.js 依賴
RUN npm ci

# 複製所有專案檔案
COPY . .

# 確保啟動腳本可執行
RUN chmod +x start.sh

# 開放容器的 5000 port
EXPOSE 5000

# 設定容器啟動時執行的指令
CMD ["./start.sh"]