const WebSocket = require('ws');
const config = require('./config');
const monitor = require('./monitor');
const logger = require('./logger');

class WebSocketServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.dataHistory = [];
        this.historyLength = config.historyLength;

        this.init();
        this.startBroadcasting();
    }

    init() {
        this.wss.on('connection', ws => {
            logger.info('客戶端已連線');

            // 發送完整的歷史數據
            if (this.dataHistory.length > 0) {
                ws.send(JSON.stringify({ type: 'history', data: this.dataHistory }));
            }

            ws.on('close', () => {
                logger.info('客戶端已離線');
            });
        });
    }

    broadcast(data) {
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }

    startBroadcasting() {
        setInterval(async () => {
            try {
                const stats = await monitor.getSystemStats();

                // 儲存歷史數據
                this.dataHistory.push(stats);
                if (this.dataHistory.length > this.historyLength) {
                    this.dataHistory.shift();
                }

                // 廣播新數據
                this.broadcast(stats);

            } catch (error) {
                logger.error('廣播數據時發生錯誤: %o', error);
                const errorData = { type: 'error', message: '無法讀取系統資訊' };
                this.broadcast(errorData);
            }
        }, config.updateInterval);
    }
}

module.exports = WebSocketServer;
