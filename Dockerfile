# 使用 NVIDIA CUDA 映像檔 (基於 Ubuntu 22.04) 作為基礎
FROM nvidia/cuda:12.1.1-base-ubuntu22.04

# 設定環境變數，避免 apt-get 在安裝過程中出現互動式提問
ENV DEBIAN_FRONTEND=noninteractive

# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# 安裝建置依賴 (如果有的話)
# RUN apt-get update && apt-get install -y python3 make g++

COPY package*.json ./
RUN npm ci

# Production stage
FROM node:20-slim

WORKDIR /app

# 安裝生產環境需要的系統套件
# procps 提供 ps, top 等指令
RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY . .

# 確保腳本可執行
RUN chmod +x start.sh

EXPOSE 5000

CMD ["./start.sh"]