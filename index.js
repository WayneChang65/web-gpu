const express = require('express');
const path = require('path');
const http = require('http');
const helmet = require('helmet');
const config = require('./src/config');
const WebSocketServer = require('./src/websocket');

const app = express();

// 安全性設定
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

// 靜態文件
app.use(express.static(path.join(__dirname, 'public')));

// 建立 HTTP 伺服器
const server = http.createServer(app);

// 初始化 WebSocket 伺服器
new WebSocketServer(server);

// 啟動伺服器
server.listen(config.port, '0.0.0.0', () => {
  const logger = require('./src/logger');
  logger.info(`伺服器正在啟動，請在同網域的電腦上存取 http://<YOUR_IP>:${config.port}`);
  logger.info(`儀表板現在位於: http://localhost:${config.port}`);
});