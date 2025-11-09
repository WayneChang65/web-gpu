# 使用 NVIDIA CUDA 映像檔 (基於 Ubuntu 22.04) 作為基礎
FROM nvidia/cuda:12.1.1-base-ubuntu22.04

# 設定環境變數，避免 apt-get 在安裝過程中出現互動式提問
ENV DEBIAN_FRONTEND=noninteractive

# --- 安裝 Node.js 20 ---
RUN apt-get update && apt-get install -y ca-certificates curl gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install -y nodejs

# --- 安裝 Apache 並啟用代理模組 ---
RUN apt-get install -y apache2 && \
    a2enmod proxy && \
    a2enmod proxy_http && \
    apt-get clean

# 將工作目錄設定為 /app
WORKDIR /app

# 複製後端依賴性定義檔
COPY package*.json ./

# 安裝生產環境的依賴. 
RUN npm install --production

# 複製後端應用程式碼
COPY index.js .

# 複製前端靜態檔案到 Apache 的網站根目錄 (Ubuntu)
COPY public/ /var/www/html/

# 複製我們自訂的代理設定檔到 Apache 的設定目錄中
# 複製代理設定檔到 Apache 的「可用設定」目錄
COPY proxy.conf /etc/apache2/conf-available/proxy.conf
# 啟用我們的代理設定
RUN a2enconf proxy

# 複製啟動腳本
COPY start.sh .

# 賦予啟動腳本執行權限
RUN chmod +x start.sh

# 對外開放 port 80 (httpd)
EXPOSE 80

# 執行啟動腳本
CMD ["./start.sh"]
