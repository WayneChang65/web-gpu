// --- THEME CONFIGURATION ---
const HUD_THEME = {
    cyan: 'rgba(0, 255, 255, 1)',
    cyan_light: 'rgba(0, 255, 255, 0.8)',
    cyan_fill: 'rgba(0, 255, 255, 0.15)',
    grid: 'rgba(0, 255, 255, 0.1)',
    font: '#c0caf5',
    transparent: 'rgba(0, 0, 0, 0)',
    doughnut_bg: 'rgba(255, 255, 255, 0.05)',
};

const MAX_DATA_POINTS = 3600;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

// 1. Get Canvas Contexts
const cpuCtx = document.getElementById('cpuChart').getContext('2d');
const ramCtx = document.getElementById('ramChart').getContext('2d');
const gpuCtx = document.getElementById('gpuChart').getContext('2d');
const diskCtx = document.getElementById('diskChart').getContext('2d');
const cpuTsCtx = document.getElementById('cpuTimeSeriesChart').getContext('2d');
const ramTsCtx = document.getElementById('ramTimeSeriesChart').getContext('2d');
const gpuTsCtx = document.getElementById('gpuTimeSeriesChart').getContext('2d');


// 2. Chart Factory Functions (with HUD Theming)
function createUsageChart(ctx) {
    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Used', 'Free'],
            datasets: [{
                data: [0, 100],
                backgroundColor: [HUD_THEME.cyan_light, HUD_THEME.doughnut_bg],
                borderColor: HUD_THEME.transparent,
                borderWidth: 0
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

function createTimeSeriesChart(ctx, label) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: label,
                data: [], // {x: timestamp, y: value}
                borderColor: HUD_THEME.cyan,
                backgroundColor: HUD_THEME.cyan_fill,
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
                        displayFormats: { minute: 'HH:mm' }
                    },
                    ticks: { color: HUD_THEME.font, maxRotation: 0, minRotation: 0 },
                    grid: { color: HUD_THEME.grid }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: HUD_THEME.font },
                    grid: { color: HUD_THEME.grid }
                }
            },
            plugins: {
                legend: { 
                    display: true, 
                    position: 'top', 
                    align: 'end',
                    labels: { color: HUD_THEME.font, font: { size: 14, family: "'Inter', sans-serif" } } 
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 20, 30, 0.8)',
                    titleColor: HUD_THEME.cyan,
                    bodyColor: HUD_THEME.font,
                    borderColor: HUD_THEME.grid,
                    borderWidth: 1,
                }
            }
        }
    });
}

// 3. Initialize All Charts
const cpuChart = createUsageChart(cpuCtx);
const ramChart = createUsageChart(ramCtx);
const gpuChart = createUsageChart(gpuCtx);
const diskChart = createUsageChart(diskCtx);
const cpuTimeSeriesChart = createTimeSeriesChart(cpuTsCtx, 'CPU Usage (%)');
const ramTimeSeriesChart = createTimeSeriesChart(ramTsCtx, 'RAM Usage (%)');
const gpuTimeSeriesChart = createTimeSeriesChart(gpuTsCtx, 'GPU Usage (%)');


// 4. Chart Update Functions
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
    let displayName = data.hostname;
    if (data.gpu && data.gpu.length > 0 && data.gpu[0].model) {
        displayName = data.gpu[0].model;
    }
    if (displayName) {
        document.getElementById('hostnameDisplay').innerText = displayName + ' - ';
    }

    const cpuLoadValue = parseFloat(data.cpu.load) || 0;
    updateDoughnutChart(cpuChart, cpuLoadValue, cpuLoadValue.toFixed(1) + ' %');
    updateTimeSeriesChart(cpuTimeSeriesChart, { x: data.timestamp, y: cpuLoadValue });
    document.getElementById('cpuCores').innerText = data.cpu.cores;

    const ramUsageValue = parseFloat(data.ram.usage) || 0;
    updateDoughnutChart(ramChart, ramUsageValue, ramUsageValue.toFixed(1) + ' %');
    updateTimeSeriesChart(ramTimeSeriesChart, { x: data.timestamp, y: ramUsageValue });
    document.getElementById('ramUsage').innerText = `${data.ram.used} / ${data.ram.total}`;

    if (data.gpu && data.gpu.length > 0) {
        const gpuData = data.gpu[0];
        const gpuUtilValue = parseFloat(gpuData.utilization) || 0;
        updateDoughnutChart(gpuChart, gpuUtilValue, gpuUtilValue.toFixed(1) + ' %');
        updateTimeSeriesChart(gpuTimeSeriesChart, { x: data.timestamp, y: gpuUtilValue });

        document.getElementById('gpuModel').innerText = gpuData.model;
        document.getElementById('gpuTemp').innerText = gpuData.temperature ? `${gpuData.temperature} °C` : 'N/A';
        document.getElementById('gpuPower').innerText = gpuData.powerDraw || 'N/A';
    }



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
        indicator.title = "Connected";
    } else {
        indicator.classList.remove('connected');
        indicator.title = "Disconnected";
    }
}

// 5. WebSocket Connection
function connectWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket Connected');
        updateConnectionStatus(true);
        reconnectAttempts = 0;
    };

    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.type === 'history') {
            cpuTimeSeriesChart.data.datasets[0].data = [];
            ramTimeSeriesChart.data.datasets[0].data = [];
            gpuTimeSeriesChart.data.datasets[0].data = [];

            message.data.forEach(dataPoint => {
                cpuTimeSeriesChart.data.datasets[0].data.push({ x: dataPoint.timestamp, y: parseFloat(dataPoint.cpu.load) });
                ramTimeSeriesChart.data.datasets[0].data.push({ x: dataPoint.timestamp, y: parseFloat(dataPoint.ram.usage) });
                if (dataPoint.gpu && dataPoint.gpu.length > 0) {
                    gpuTimeSeriesChart.data.datasets[0].data.push({ x: dataPoint.timestamp, y: parseFloat(dataPoint.gpu[0].utilization) });
                }
            });

            if (message.data.length > 0) {
                processData(message.data[message.data.length - 1]);
            }

            cpuTimeSeriesChart.update('none');
            ramTimeSeriesChart.update('none');
            gpuTimeSeriesChart.update('none');

        } else if (message.type === 'update') {
            processData(message);
        } else if (message.type === 'error') {
            console.error('Server Error:', message.message);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket Disconnected');
        updateConnectionStatus(false);
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        console.log(`Attempting to reconnect in ${delay / 1000}s...`);

        setTimeout(() => {
            reconnectAttempts++;
            connectWebSocket();
        }, delay);
    };

    ws.onerror = error => {
        console.error('WebSocket Error:', error);
        ws.close();
    };
}

// 6. Liftoff
document.addEventListener('DOMContentLoaded', connectWebSocket);
