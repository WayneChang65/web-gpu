const MAX_DATA_POINTS = 3600; // 時序圖顯示的最大數據點數量
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 最大重連延遲 30 秒

// 1. 獲取 Canvas 上下文
const cpuCtx = document.getElementById('cpuChart').getContext('2d');
const ramCtx = document.getElementById('ramChart').getContext('2d');
const gpuCtx = document.getElementById('gpuChart').getContext('2d');
const diskCtx = document.getElementById('diskChart').getContext('2d');
const cpuTsCtx = document.getElementById('cpuTimeSeriesChart').getContext('2d');
const ramTsCtx = document.getElementById('ramTimeSeriesChart').getContext('2d');
const gpuTsCtx = document.getElementById('gpuTimeSeriesChart').getContext('2d');

// 2. 建立圖表的輔助函數
function createUsageChart(ctx) {
    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['已使用', '未使用'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['rgba(75, 192, 192, 0.7)', 'rgba(255, 255, 255, 0.1)'],
                borderColor: 'rgba(44, 48, 59, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
    });
}

function createTimeSeriesChart(ctx, label, color) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: label,
                data: [], // {x: timestamp, y: value}
                borderColor: color,
                backgroundColor: color.replace('1)', '0.2)'),
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    display: true,
                    time: {
                        unit: 'minute',
                        stepSize: 10,
                        tooltipFormat: 'HH:mm:ss',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    ticks: { color: '#c0caf5', maxRotation: 0, minRotation: 0 }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: '#c0caf5' }
                }
            },
            plugins: {
                legend: { display: true, position: 'top', labels: { color: '#c0caf5', font: { size: 14 } } }
            }
        }
    });
}

// 3. 初始化所有圖表
const cpuChart = createUsageChart(cpuCtx);
const ramChart = createUsageChart(ramCtx);
const gpuChart = createUsageChart(gpuCtx);
const diskChart = createUsageChart(diskCtx);
const cpuTimeSeriesChart = createTimeSeriesChart(cpuTsCtx, 'CPU 使用率 (%)', 'rgba(156, 204, 101, 1)');
const ramTimeSeriesChart = createTimeSeriesChart(ramTsCtx, 'RAM 使用率 (%)', 'rgba(77, 182, 172, 1)');
const gpuTimeSeriesChart = createTimeSeriesChart(gpuTsCtx, 'GPU 使用率 (%)', 'rgba(126, 87, 194, 1)');

// 4. 更新圖表的函數
function updateDoughnutChart(chart, percentValue, percentText) {
    chart.data.datasets[0].data[0] = percentValue;
    chart.data.datasets[0].data[1] = 100 - percentValue;
    chart.update('none');
    const percentElementId = chart.canvas.id.replace('Chart', 'Percent');
    document.getElementById(percentElementId).innerText = percentText;
}

function updateTimeSeriesChart(chart, point) {
    chart.data.datasets[0].data.push(point);
    if (chart.data.datasets[0].data.length > MAX_DATA_POINTS) {
        chart.data.datasets[0].data.shift();
    }
    chart.update('none');
}

function processData(data) {
    // 更新主機名稱
    let displayName = data.hostname;
    if (data.gpu && data.gpu.length > 0 && data.gpu[0].model) {
        displayName = data.gpu[0].model;
    }
    if (displayName) {
        document.getElementById('hostnameDisplay').innerText = displayName + ' - ';
    }

    // 更新 CPU
    const cpuLoadValue = parseFloat(data.cpu.load) || 0;
    updateDoughnutChart(cpuChart, cpuLoadValue, cpuLoadValue.toFixed(1) + ' %');
    updateTimeSeriesChart(cpuTimeSeriesChart, { x: data.timestamp, y: cpuLoadValue });
    document.getElementById('cpuCores').innerText = data.cpu.cores;

    // 更新 RAM
    const ramUsageValue = parseFloat(data.ram.usage) || 0;
    updateDoughnutChart(ramChart, ramUsageValue, ramUsageValue.toFixed(1) + ' %');
    updateTimeSeriesChart(ramTimeSeriesChart, { x: data.timestamp, y: ramUsageValue });
    document.getElementById('ramUsage').innerText = `${data.ram.used} / ${data.ram.total}`;

    // 更新 GPU
    if (data.gpu && data.gpu.length > 0) {
        const gpuData = data.gpu[0];
        const gpuUtilValue = parseFloat(gpuData.utilization) || 0;
        updateDoughnutChart(gpuChart, gpuUtilValue, gpuUtilValue.toFixed(1) + ' %');
        updateTimeSeriesChart(gpuTimeSeriesChart, { x: data.timestamp, y: gpuUtilValue });

        document.getElementById('gpuModel').innerText = gpuData.model;
        document.getElementById('gpuTemp').innerText = gpuData.temperature ? `${gpuData.temperature} °C` : 'N/A';
        document.getElementById('gpuPower').innerText = gpuData.powerDraw || 'N/A';
    }

    // 更新 Network
    if (data.network) {
        document.getElementById('netRx').innerText = `${data.network.rx_sec} KB/s`;
        document.getElementById('netTx').innerText = `${data.network.tx_sec} KB/s`;
    }

    // 更新 Disk
    if (data.disk) {
        const diskUsageValue = parseFloat(data.disk.usage) || 0;
        updateDoughnutChart(diskChart, diskUsageValue, diskUsageValue.toFixed(1) + ' %');
        document.getElementById('diskUsage').innerText = `${data.disk.used} / ${data.disk.total}`;
    }
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    if (connected) {
        indicator.classList.add('connected');
        indicator.title = "已連線";
    } else {
        indicator.classList.remove('connected');
        indicator.title = "已斷線";
    }
}

// 5. WebSocket 連線
function connectWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket 已連線');
        updateConnectionStatus(true);
        reconnectAttempts = 0; // 重置重連次數
    };

    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.type === 'history') {
            // 清空現有數據
            cpuTimeSeriesChart.data.datasets[0].data = [];
            ramTimeSeriesChart.data.datasets[0].data = [];
            gpuTimeSeriesChart.data.datasets[0].data = [];

            // 載入歷史數據
            message.data.forEach(dataPoint => {
                cpuTimeSeriesChart.data.datasets[0].data.push({ x: dataPoint.timestamp, y: parseFloat(dataPoint.cpu.load) });
                ramTimeSeriesChart.data.datasets[0].data.push({ x: dataPoint.timestamp, y: parseFloat(dataPoint.ram.usage) });
                if (dataPoint.gpu && dataPoint.gpu.length > 0) {
                    gpuTimeSeriesChart.data.datasets[0].data.push({ x: dataPoint.timestamp, y: parseFloat(dataPoint.gpu[0].utilization) });
                }
            });

            // 更新最後一筆數據到環圈圖和資訊欄
            if (message.data.length > 0) {
                processData(message.data[message.data.length - 1]);
            }

            // 一次性更新所有時序圖
            cpuTimeSeriesChart.update('none');
            ramTimeSeriesChart.update('none');
            gpuTimeSeriesChart.update('none');

        } else if (message.type === 'update') {
            processData(message);
        } else if (message.type === 'error') {
            console.error('伺服器錯誤:', message.message);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket 已離線');
        updateConnectionStatus(false);

        // 指數退避重連
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        console.log(`${delay / 1000} 秒後嘗試重新連線...`);

        setTimeout(() => {
            reconnectAttempts++;
            connectWebSocket();
        }, delay);
    };

    ws.onerror = error => {
        console.error('WebSocket 錯誤:', error);
        ws.close();
    };
}

// 6. 啟動
document.addEventListener('DOMContentLoaded', connectWebSocket);
