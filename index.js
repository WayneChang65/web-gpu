const express = require('express');
const si = require('systeminformation');
const path = require('path');
const os = require('os');
const http = require('http');
const WebSocket = require('ws');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const app = express();
const port = 5000;

// 伺服器設定
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 靜態文件
app.use(express.static(path.join(__dirname, 'public')));

// 資料儲存
const HISTORY_LENGTH = 3600;
const dataHistory = [];

// GPU 資訊獲取
async function getGpuInfo() {
  try {
    const command = 'nvidia-smi --query-gpu=name,memory.total,utilization.gpu --format=csv,noheader';
    const { stdout } = await execPromise(command);
    const lines = stdout.trim().split('\n');
    return lines.map(line => {
      const [model, vramStr, utilStr] = line.split(', ');
      const vramMiB = parseFloat(vramStr);
      const vramGB = (vramMiB / 1024).toFixed(2);
      const utilValue = parseFloat(utilStr);
      return {
        model: model,
        vendor: 'NVIDIA Corporation',
        vram: vramGB + ' GB',
        utilization: utilValue.toFixed(2) + ' %'
      };
    });
  } catch (execError) {
    console.warn('手動執行 nvidia-smi 失敗, 回退到 systeminformation:', execError.message);
    const graphics = await si.graphics();
    return graphics.controllers.map(gpu => ({
      model: gpu.model,
      vendor: gpu.vendor,
      vram: gpu.vram ? (gpu.vram / 1024).toFixed(2) + ' GB' : 'N/A',
      utilization: 'N/A'
    }));
  }
}

// 廣播給所有客戶端
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// 定期獲取並廣播數據
setInterval(async () => {
  try {
    const [cpu, mem, currentLoad, gpuInfo] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.currentLoad(),
      getGpuInfo()
    ]);

    const ram = {
      total: (mem.total / 1024**3).toFixed(2) + ' GB',
      used: (mem.used / 1024**3).toFixed(2) + ' GB',
      free: (mem.free / 1024**3).toFixed(2) + ' GB',
      usage: ((mem.used / mem.total) * 100).toFixed(2) + ' %'
    };

    const cpuInfo = {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      speed: cpu.speed + ' GHz',
      cores: cpu.cores,
      load: typeof currentLoad.currentLoad === 'number' 
            ? currentLoad.currentLoad.toFixed(2) + ' %' 
            : 'N/A'
    };
    
    const hostname = os.hostname();

    const stats = {
      type: 'update',
      timestamp: Date.now(),
      hostname: hostname,
      cpu: cpuInfo,
      ram: ram,
      gpu: gpuInfo
    };

    // 儲存歷史數據
    dataHistory.push(stats);
    if (dataHistory.length > HISTORY_LENGTH) {
      dataHistory.shift();
    }

    // 廣播新數據
    broadcast(stats);

  } catch (error) {
    console.error('讀取系統資訊時發生錯誤:', error);
    const errorData = { type: 'error', message: '無法讀取系統資訊' };
    broadcast(errorData);
  }
}, 1000);

// WebSocket 連線處理
wss.on('connection', ws => {
  console.log('客戶端已連線');
  
  // 發送完整的歷史數據
  if (dataHistory.length > 0) {
    ws.send(JSON.stringify({ type: 'history', data: dataHistory }));
  }

  ws.on('close', () => {
    console.log('客戶端已離線');
  });
});

// 啟動伺服器
server.listen(port, '0.0.0.0', () => {
  console.log('伺服器正在啟動，請在同網域的電腦上存取 http://<YOUR_IP>:8080');
  console.log('儀表板現在位於: http://localhost:8080');
});