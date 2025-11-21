const si = require('systeminformation');
const { exec } = require('child_process');
const util = require('util');
const os = require('os');
const logger = require('./logger');

const execPromise = util.promisify(exec);

// Helper function to convert bytes to GB and format it
function bytesToGB(bytes, decimals = 2) {
    if (bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(decimals)} GB`;
}

async function getGpuInfo() {
    try {
        // Use a more robust query with specific units and no headers
        const command = 'timeout 2s nvidia-smi --query-gpu=name,memory.total,utilization.gpu,temperature.gpu,power.draw --format=csv,noheader,nounits';
        const { stdout } = await execPromise(command);
        
        const lines = stdout.trim().split('\n');
        return lines.map(line => {
            const [model, vramMiB, utilization, temperature, powerDraw] = line.split(', ');
            
            return {
                model: model,
                vendor: 'NVIDIA Corporation',
                vram: bytesToGB(parseFloat(vramMiB) * 1024 * 1024), // Convert MiB to Bytes first
                utilization: parseFloat(utilization).toFixed(1), // Keep as number for frontend
                temperature: temperature,
                powerDraw: `${parseFloat(powerDraw).toFixed(1)} W`,
            };
        });
    } catch (execError) {
        // Fallback to systeminformation if nvidia-smi fails
        if (execError.code !== 124) { // 124 is the exit code for timeout
            // logger.warn('nvidia-smi command failed, falling back to systeminformation: %s', execError.message);
        }

        try {
            const graphics = await si.graphics();
            return graphics.controllers.map(gpu => ({
                model: gpu.model,
                vendor: gpu.vendor,
                vram: gpu.vram ? bytesToGB(gpu.vram * 1024 * 1024) : 'N/A',
                utilization: 'N/A',
                temperature: 'N/A',
                powerDraw: 'N/A'
            }));
        } catch (siError) {
            logger.error('Failed to get GPU info via systeminformation: %o', siError);
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
            si.networkStats(),
            si.fsSize()
        ]);

        const defaultNet = networkStats.length > 0 ? networkStats[0] : { rx_sec: 0, tx_sec: 0 };
        const rootFs = fsSize.find(fs => fs.mount === '/') || (fsSize.length > 0 ? fsSize[0] : { use: 0, size: 0, used: 0 });

        return {
            type: 'update',
            timestamp: new Date(),
            hostname: os.hostname(),
            cpu: {
                load: currentLoad.currentLoad.toFixed(1),
                cores: os.cpus().length
            },
            ram: {
                total: bytesToGB(mem.total),
                used: bytesToGB(mem.active),
                usage: (mem.active / mem.total * 100).toFixed(1)
            },
            gpu: gpuInfo,
            network: {
                rx_sec: (defaultNet.rx_sec / 1024).toFixed(1), // KB/s
                tx_sec: (defaultNet.tx_sec / 1024).toFixed(1)  // KB/s
            },
            disk: {
                usage: rootFs.use.toFixed(1),
                total: bytesToGB(rootFs.size, 0),
                used: bytesToGB(rootFs.used, 0)
            }
        };
    } catch (error) {
        logger.error('Error reading system stats: %o', error);
        throw error;
    }
}

module.exports = {
    getSystemStats
};
