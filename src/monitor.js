const si = require('systeminformation');
const { exec } = require('child_process');
const util = require('util');
const os = require('os');
const logger = require('./logger');

const execPromise = util.promisify(exec);

async function getGpuInfo() {
    try {
        // 設定 2 秒超時，避免卡住
        // 新增 temperature.gpu, fan.speed, power.draw
        const command = 'timeout 2s nvidia-smi --query-gpu=name,memory.total,utilization.gpu,temperature.gpu,fan.speed,power.draw --format=csv,noheader';
        const { stdout } = await execPromise(command);
        const lines = stdout.trim().split('\n');
        return lines.map(line => {
            const parts = line.split(', ');
            const model = parts[0];
            const vramStr = parts[1];
            const utilStr = parts[2];
            const tempStr = parts[3];
            const fanStr = parts[4];
            const powerStr = parts[5];

            const vramMiB = parseFloat(vramStr);
            const vramGB = (vramMiB / 1024).toFixed(2);
            const utilValue = parseFloat(utilStr);

            return {
                model: model,
                vendor: 'NVIDIA Corporation',
                vram: vramGB + ' GB',
                utilization: utilValue.toFixed(2) + ' %',
                temperature: tempStr, // e.g., "45" (C is implicit usually, or we add it)
                fanSpeed: fanStr,     // e.g., "30 %" or "[Not Supported]"
                powerDraw: powerStr   // e.g., "100.00 W" or "[Not Supported]"
            };
        });
    } catch (execError) {
        // 如果不是因為 timeout 導致的錯誤，才印出警告，避免 log 刷屏
        if (execError.code !== 124) {
            // 124 is timeout exit code
            // logger.warn('手動執行 nvidia-smi 失敗, 回退到 systeminformation: %s', execError.message);
        }

        try {
            const graphics = await si.graphics();
            return graphics.controllers.map(gpu => ({
                model: gpu.model,
                vendor: gpu.vendor,
                vram: gpu.vram ? (gpu.vram / 1024).toFixed(2) + ' GB' : 'N/A',
                utilization: 'N/A',
                temperature: 'N/A',
                fanSpeed: 'N/A',
                powerDraw: 'N/A'
            }));
        } catch (siError) {
            logger.error('無法獲取 GPU 資訊: %o', siError);
            return [];
        }
    }
}

async function getSystemStats() {
    try {
        const [cpu, mem, currentLoad, gpuInfo, networkStats, fsSize] = await Promise.all([
            si.cpu(),
            si.mem(),
            si.currentLoad(),
            getGpuInfo(),
            si.networkStats(), // 獲取網路狀態
            si.fsSize()        // 獲取磁碟狀態
        ]);

        // 獲取網路狀態 (預設取第一個非內部介面)
        const defaultNet = networkStats.length > 0 ? networkStats[0] : { rx_sec: 0, tx_sec: 0 };

        // 獲取磁碟狀態 (預設取根目錄 /)
        const rootFs = fsSize.find(fs => fs.mount === '/') || (fsSize.length > 0 ? fsSize[0] : { use: 0, size: 0, used: 0 });

        return {
            type: 'update',
            timestamp: new Date(),
            hostname: os.hostname(),
            cpu: {
                load: currentLoad.currentLoad,
                cores: os.cpus().length
            },
            ram: {
                total: (mem.total / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                used: (mem.active / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                usage: (mem.active / mem.total * 100).toFixed(1)
            },
            gpu: gpuInfo,
            network: {
                rx_sec: (defaultNet.rx_sec / 1024).toFixed(1), // KB/s
                tx_sec: (defaultNet.tx_sec / 1024).toFixed(1)  // KB/s
            },
            disk: {
                usage: rootFs.use.toFixed(1),
                total: (rootFs.size / 1024 / 1024 / 1024).toFixed(0) + ' GB',
                used: (rootFs.used / 1024 / 1024 / 1024).toFixed(0) + ' GB'
            }
        };
    } catch (error) {
        logger.error('讀取系統資訊時發生錯誤: %o', error);
        throw error;
    }
}

module.exports = {
    getSystemStats
};
