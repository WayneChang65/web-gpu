const monitor = require('../src/monitor');
const si = require('systeminformation');
const { exec } = require('child_process');

// Mock systeminformation and child_process
jest.mock('systeminformation');
jest.mock('child_process');

describe('System Monitor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('getSystemStats should return correct data structure', async () => {
        // Mock si.cpu
        si.cpu.mockResolvedValue({
            manufacturer: 'Intel',
            brand: 'Core i7',
            speed: '3.6',
            cores: 8
        });

        // Mock si.mem
        si.mem.mockResolvedValue({
            total: 16 * 1024 ** 3,
            used: 8 * 1024 ** 3,
            free: 8 * 1024 ** 3
        });

        // Mock si.currentLoad
        si.currentLoad.mockResolvedValue({
            currentLoad: 50.5
        });

        // Mock exec for nvidia-smi (success case)
        exec.mockImplementation((cmd, callback) => {
            callback(null, { stdout: 'NVIDIA GeForce RTX 3080, 10240, 45' });
        });

        const stats = await monitor.getSystemStats();

        expect(stats).toHaveProperty('type', 'update');
        expect(stats).toHaveProperty('timestamp');
        expect(stats).toHaveProperty('hostname');

        // Check CPU
        expect(stats.cpu).toEqual({
            manufacturer: 'Intel',
            brand: 'Core i7',
            speed: '3.6 GHz',
            cores: 8,
            load: '50.50 %'
        });

        // Check RAM
        expect(stats.ram).toEqual({
            total: '16.00 GB',
            used: '8.00 GB',
            free: '8.00 GB',
            usage: '50.00 %'
        });

        // Check GPU
        expect(stats.gpu).toHaveLength(1);
        expect(stats.gpu[0]).toEqual({
            model: 'NVIDIA GeForce RTX 3080',
            vendor: 'NVIDIA Corporation',
            vram: '10.00 GB',
            utilization: '45.00 %'
        });
    });

    test('getSystemStats should fallback to systeminformation when nvidia-smi fails', async () => {
        // Mock si.cpu, si.mem, si.currentLoad (same as above)
        si.cpu.mockResolvedValue({});
        si.mem.mockResolvedValue({ total: 0, used: 0, free: 0 });
        si.currentLoad.mockResolvedValue({});

        // Mock exec to fail
        exec.mockImplementation((cmd, callback) => {
            const error = new Error('Command failed');
            error.code = 1;
            callback(error);
        });

        // Mock si.graphics for fallback
        si.graphics.mockResolvedValue({
            controllers: [{
                model: 'Intel UHD Graphics',
                vendor: 'Intel',
                vram: 2048,
            }]
        });

        const stats = await monitor.getSystemStats();

        expect(stats.gpu).toHaveLength(1);
        expect(stats.gpu[0].model).toBe('Intel UHD Graphics');
        expect(stats.gpu[0].vram).toBe('2.00 GB');
        expect(stats.gpu[0].utilization).toBe('N/A');
    });
});
