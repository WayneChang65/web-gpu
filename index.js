const express = require('express');
const si = require('systeminformation');
const path = require('path');
const os = require('os'); // 引入 Node.js 內建的 os 模組
const app = express();
const port = 5000;

// 【新】 1. 引入 Node.js 內建的 exec (執行 shell 指令)
const { exec } = require('child_process');
// 【新】 2. 引入 util.promisify，讓 exec 支援 async/await
const util = require('util');
const execPromise = util.promisify(exec);

app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------------------------------
// 【新】 獨立的 GPU 獲取函數 (使用 exec)
// -----------------------------------------------------
async function getGpuInfo() {
  try {
    // 3. 我們請求 CSV 格式、不帶標題，只要 3 個欄位
    const command = 'nvidia-smi --query-gpu=name,memory.total,utilization.gpu --format=csv,noheader';
    
    // 4. 執行指令
    const { stdout } = await execPromise(command);
    
    // stdout 看起來會像這樣 (多卡的話會有多行):
    // "GeForce RTX 2080, 8192 MiB, 5 %"
    
    const lines = stdout.trim().split('\n');
    
    return lines.map(line => {
      // 5. 解析 CSV
      const [model, vramStr, utilStr] = line.split(', ');
      
      // 解析 VRAM ("8192 MiB" -> "8.00 GB")
      const vramMiB = parseFloat(vramStr);
      const vramGB = (vramMiB / 1024).toFixed(2);
      
      // 解析使用率 ("5 %" -> "5.00 %")
      const utilValue = parseFloat(utilStr);
      
      return {
        model: model,
        vendor: 'NVIDIA Corporation',
        vram: vramGB + ' GB',
        utilization: utilValue.toFixed(2) + ' %'
      };
    });

  } catch (execError) {
    // 如果 nvidia-smi 執行失敗 (例如驅動問題)
    console.warn('手動執行 nvidia-smi 失敗, 回退到 systeminformation:', execError.message);
    
    // 回退到 systeminformation (它會顯示 N/A)
    const graphics = await si.graphics();
    return graphics.controllers.map(gpu => ({
      model: gpu.model,
      vendor: gpu.vendor,
      vram: gpu.vram ? (gpu.vram / 1024).toFixed(2) + ' GB' : 'N/A',
      utilization: 'N/A'
    }));
  }
}

// -----------------------------------------------------
// 您的 API 端點
// -----------------------------------------------------
app.get('/api/stats', async (req, res) => {
  try {
    // 1. 我們現在可以「同時」獲取所有資訊
    const [cpu, mem, currentLoad, gpuInfo] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.currentLoad(),
      getGpuInfo() // 【修改】 使用我們新的函數
    ]);

    // --- RAM 和 CPU 的部分 (保持不變) ---
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
    
    // Get hostname
    const hostname = os.hostname(); // 獲取主機名稱

    // 5. 回傳
    res.json({
      hostname: hostname, // 將主機名稱加入回應
      cpu: cpuInfo,
      ram: ram,
      gpu: gpuInfo // 【修改】 這裡現在是來自 getGpuInfo() 的結果
    });

  } catch (error) {
    // 捕捉 si.cpu() 等的錯誤
    console.error('讀取系統資訊時發生錯誤:', error);
    res.status(500).json({ error: '無法讀取系統資訊' });
  }
});

// 啟動伺服器 (保持不變)
app.listen(port, '0.0.0.0', () => {
  console.log(`伺服器正在啟動，請在同網域的電腦上存取 http://<YOUR_IP>:8080`);
  console.log(`儀表板現在位於: http://localhost:8080`);
});
