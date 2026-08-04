// ─────────────────────────────────────────────────────────────────────────────
// Global State
// ─────────────────────────────────────────────────────────────────────────────
let dataset        = [];
let filteredDataset = [];
let currentPage    = 1;
const rowsPerPage  = 20;
let telemetryChart = null;
let simulationRunning = false;

// ─────────────────────────────────────────────────────────────────────────────
// DOM References
// ─────────────────────────────────────────────────────────────────────────────
const btnRun           = document.getElementById('btn-run');
const lblStatus        = document.getElementById('lbl-topology-status');
const topologyContainer= document.querySelector('.topology-container');
const terminalOutput   = document.getElementById('terminal-output');
const btnClearConsole  = document.getElementById('btn-clear-console');
const optActuatorMode  = document.getElementById('opt-actuator-mode');
const optAnomalyChance = document.getElementById('opt-anomaly-chance');

// ── Feature: Progress bar, actuator bars, anomaly alert ──────────────────
const simProgressWrapper = document.getElementById('sim-progress-wrapper');
const simProgressFill    = document.getElementById('sim-progress-fill');
const simProgressLabel   = document.getElementById('sim-progress-label');
const barFan             = document.getElementById('bar-fan');
const barLed             = document.getElementById('bar-led');
const pctFan             = document.getElementById('pct-fan');
const pctLed             = document.getElementById('pct-led');
const anomalyAlert       = document.getElementById('anomaly-alert');
const anomalyAlertText   = document.getElementById('anomaly-alert-text');
const nodeMcu            = document.getElementById('node-mcu');
let anomalyTimer         = null;

const valExecutionTime = document.getElementById('val-execution-time');
const valTuples        = document.getElementById('val-tuples');
const valLatency       = document.getElementById('val-latency');
const valPower         = document.getElementById('val-power');

const nodeCloudEnergy  = document.getElementById('node-cloud-energy');
const nodeFogEnergy    = document.getElementById('node-fog-energy');
const nodeMcuEnergy    = document.getElementById('node-mcu-energy');

const nodeFan          = document.getElementById('node-actuator-fan');
const nodeLed          = document.getElementById('node-actuator-led');

const datasetSearch    = document.getElementById('dataset-search');
const datasetCount     = document.getElementById('dataset-count');
const datasetTbody     = document.getElementById('dataset-tbody');
const btnPrev          = document.getElementById('btn-prev');
const btnNext          = document.getElementById('btn-next');
const pageNumSpan      = document.getElementById('page-num');

// ─────────────────────────────────────────────────────────────────────────────
// Initialisation: load existing results on page load
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    initChart();
    fetchExistingResults();
});

btnClearConsole.addEventListener('click', () => {
    terminalOutput.innerHTML = '';
});

// ─────────────────────────────────────────────────────────────────────────────
// Run Simulation
// ─────────────────────────────────────────────────────────────────────────────
btnRun.addEventListener('click', () => {
    if (simulationRunning) return;
    simulationRunning = true;

    // Reset UI
    btnRun.disabled = true;
    setTopologyStatus('Running', 'status-running');
    topologyContainer.classList.add('running');
    nodeFan.classList.remove('actuator-active-fan');
    nodeLed.classList.remove('actuator-active-led');
    terminalOutput.innerHTML = '';
    dataset = [];
    filteredDataset = [];
    renderTable();
    resetMetricCards();

    logToTerminal('System', 'Launching iFogSim2 Simulation…', 'system');
    setPacketSpeed('fast'); // speed up link particles

    // Show progress bar
    if (simProgressWrapper) simProgressWrapper.style.display = 'flex';
    updateProgress(0);

    const mode = optActuatorMode ? optActuatorMode.value : 'auto';
    const anomalyChance = optAnomalyChance ? optAnomalyChance.value : '0.02';
    const eventSource = new EventSource(`/api/run?mode=${mode}&anomalyChance=${anomalyChance}`);

    // ── Live partial CSV updates (every ~2 sec) ────────────────────────────
    eventSource.addEventListener('live-update', (e) => {
        const payload = JSON.parse(e.data);

        // Update metric cards with running averages from CSV rows
        applyLiveMetrics(payload.metrics);

        // Update chart with latest downsampled data
        applyChartData(payload.chartData);

        // Live row counter in dataset header
        datasetCount.textContent = `${payload.totalRows.toLocaleString()} rows (live)`;

        // ── Progress bar (10,001 rows = 100%) ────────────────────────────
        const pct = Math.min(100, ((payload.totalRows / 10001) * 100)).toFixed(1);
        updateProgress(pct);

        // ── Actuator percentage bars ──────────────────────────────────────
        if (payload.metrics) {
            const fp = parseFloat(payload.metrics.fanOnPct) || 0;
            const lp = parseFloat(payload.metrics.ledOnPct) || 0;
            barFan.style.width = fp + '%';
            barLed.style.width = lp + '%';
            pctFan.textContent = fp.toFixed(1) + '%';
            pctLed.textContent = lp.toFixed(1) + '%';
        }

        // ── Anomaly highlight on NodeMCU ──────────────────────────────────
        const lastRow = payload.metrics && payload.metrics.lastRow;
        if (lastRow && lastRow.IsAnomaly === true) {
            triggerAnomalyAlert(lastRow);
        }
    });

    // ── Final full dataset once simulation finishes ────────────────────────
    eventSource.addEventListener('final-update', (e) => {
        const payload = JSON.parse(e.data);

        // Use accurate PerformanceReport metrics
        if (payload.metrics) applyFinalMetrics(payload.metrics);
        if (payload.liveMetrics) applyLiveMetrics(payload.liveMetrics);

        // Full chart update
        applyChartData(payload.chartData);

        // Load all rows into table
        if (payload.allRows && payload.allRows.length > 0) {
            dataset = payload.allRows;
            filteredDataset = [...dataset];
            currentPage = 1;
            renderTable();
        }

        // Toggle actuator states from last CSV row
        const last = payload.allRows && payload.allRows[payload.allRows.length - 1];
        if (last) {
            if (last.FanStatus && last.FanStatus.includes('ON')) nodeFan.classList.add('actuator-active-fan');
            if (last.LEDStatus && last.LEDStatus.includes('ON')) nodeLed.classList.add('actuator-active-led');
        }
    });

    // ── Console log lines ──────────────────────────────────────────────────
    eventSource.addEventListener('stdout', (e) => {
        logToTerminal('Console', JSON.parse(e.data), 'stdout');
    });

    eventSource.addEventListener('stderr', (e) => {
        logToTerminal('Compiler', JSON.parse(e.data), 'stderr');
    });

    // ── Status updates ─────────────────────────────────────────────────────
    eventSource.addEventListener('status', (e) => {
        const status = JSON.parse(e.data);
        if (status === 'finished') {
            logToTerminal('System', '✓ Simulation completed successfully!', 'success');
            setTopologyStatus('Finished', 'status-finished');
        } else if (status !== 'started') {
            logToTerminal('System', `Simulation ended: ${status}`, 'stderr');
            setTopologyStatus('Error', '');
        }
    });

    // ── Stream end: close EventSource cleanly ─────────────────────────────
    eventSource.addEventListener('done', () => {
        eventSource.close();
        btnRun.disabled = false;
        simulationRunning = false;
        topologyContainer.classList.remove('running');
        setPacketSpeed('idle'); // return to idle speed
        // Finish progress bar
        updateProgress(100);
        setTimeout(() => {
            if (simProgressWrapper) simProgressWrapper.style.display = 'none';
        }, 2000);
        // Clear anomaly state
        clearAnomalyAlert();
    });

    // ── Network error ──────────────────────────────────────────────────────
    eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) return; // already closed by 'done'
        logToTerminal('System', 'Connection to server lost.', 'stderr');
        eventSource.close();
        btnRun.disabled = false;
        simulationRunning = false;
        topologyContainer.classList.remove('running');
    };
});

// ─────────────────────────────────────────────────────────────────────────────
// Fetch existing results when page first loads (so prior runs populate UI)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchExistingResults() {
    try {
        const res  = await fetch('/api/results');
        const data = await res.json();
        if (data.metrics)     applyFinalMetrics(data.metrics);
        if (data.liveMetrics) applyLiveMetrics(data.liveMetrics);
        if (data.dataset && data.dataset.length > 0) {
            dataset = data.dataset;
            filteredDataset = [...dataset];
            currentPage = 1;
            renderTable();

            // Build chart data from full dataset
            const step   = Math.max(1, Math.floor(dataset.length / 120));
            const sample = dataset.filter((_, i) => i % step === 0);
            applyChartData(sample.map(r => ({
                temp:  parseFloat(r.Temperature)    || 0,
                light: parseFloat(r.LightIntensity) || 0,
            })));
        }
    } catch (err) {
        console.error('fetchExistingResults failed:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Topology packet animation speed control
// ─────────────────────────────────────────────────────────────────────────────
const PACKET_SPEEDS = {
    idle: { cloud: ['1.4s', '1.4s', '1.4s'], fog: ['1.6s', '1.6s', '1.6s'] },
    fast: { cloud: ['0.55s', '0.55s', '0.55s'], fog: ['0.65s', '0.65s', '0.65s'] }
};

function setPacketSpeed(mode) {
    const speeds = PACKET_SPEEDS[mode];

    // Cloud-to-fog packets
    const cloudPackets = document.querySelectorAll('#link-cloud-fog .packet');
    cloudPackets.forEach((circle, i) => {
        circle.querySelectorAll('animate').forEach(anim => {
            anim.setAttribute('dur', speeds.cloud[i] || speeds.cloud[0]);
            try { anim.beginElement(); } catch(e) {}
        });
    });

    // Fog-to-MCU packets
    const fogPackets = document.querySelectorAll('#link-fog-mcu .packet-fog');
    fogPackets.forEach((circle, i) => {
        circle.querySelectorAll('animate').forEach(anim => {
            anim.setAttribute('dur', speeds.fog[i] || speeds.fog[0]);
            try { anim.beginElement(); } catch(e) {}
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────
function setTopologyStatus(text, className) {
    lblStatus.textContent = text;
    lblStatus.className   = 'badge' + (className ? ' ' + className : '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar helper
// ─────────────────────────────────────────────────────────────────────────────
function updateProgress(pct) {
    if (!simProgressFill || !simProgressLabel) return;
    simProgressFill.style.width = pct + '%';
    simProgressLabel.textContent = Math.round(pct) + '%';
}

// ─────────────────────────────────────────────────────────────────────────────
// Anomaly alert: flash NodeMCU node and show banner for 4 seconds
// ─────────────────────────────────────────────────────────────────────────────
function triggerAnomalyAlert(row) {
    if (!anomalyAlert || !nodeMcu) return;

    const temp = row.Temperature ? `${parseFloat(row.Temperature).toFixed(1)}°C` : '?';
    const light = row.LightIntensity !== undefined ? `${row.LightIntensity} LDR` : '?';
    anomalyAlertText.textContent = `Anomaly at T=${temp}, Light=${light} — sensor outside safe bounds`;

    anomalyAlert.style.display = 'flex';
    nodeMcu.classList.add('node-anomaly');

    // Auto-clear after 4s
    clearTimeout(anomalyTimer);
    anomalyTimer = setTimeout(clearAnomalyAlert, 4000);
}

function clearAnomalyAlert() {
    if (anomalyAlert) anomalyAlert.style.display = 'none';
    if (nodeMcu) nodeMcu.classList.remove('node-anomaly');
}


function resetMetricCards() {
    valExecutionTime.textContent = '--';
    valTuples.textContent        = '--';
    valLatency.textContent       = '--';
    valPower.textContent         = '--';
    nodeCloudEnergy.textContent  = '--';
    nodeFogEnergy.textContent    = '--';
    nodeMcuEnergy.textContent    = '--';
}

function logToTerminal(source, message, type) {
    const div = document.createElement('div');
    div.className   = `terminal-line ${type}-line`;
    div.textContent = `[${source}] ${message}`;
    terminalOutput.appendChild(div);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply live (CSV-derived) metrics to metric cards
// ─────────────────────────────────────────────────────────────────────────────
function applyLiveMetrics(m) {
    if (!m) return;
    valTuples.textContent  = m.totalRows ? Number(m.totalRows).toLocaleString() : '--';
    valLatency.textContent = m.avgFogLatencyMs || '--';
    valPower.textContent   = m.avgPowerW       || '--';
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply final (PerformanceReport.txt-derived) metrics to metric cards
// ─────────────────────────────────────────────────────────────────────────────
function applyFinalMetrics(m) {
    if (!m) return;
    if (m.realExecutionTimeMs != null)
        valExecutionTime.textContent = m.realExecutionTimeMs.toLocaleString();
    if (m.totalTuples != null)
        valTuples.textContent = m.totalTuples.toLocaleString();
    if (m.avgFogLatencyMs != null)
        valLatency.textContent = m.avgFogLatencyMs.toFixed(3);
    if (m.avgPowerW != null)
        valPower.textContent = m.avgPowerW.toFixed(2);

    if (m.deviceEnergy) {
        if (m.deviceEnergy['cloud'])               nodeCloudEnergy.textContent = formatEnergy(m.deviceEnergy['cloud']);
        if (m.deviceEnergy['fog-node'])            nodeFogEnergy.textContent   = formatEnergy(m.deviceEnergy['fog-node']);
        if (m.deviceEnergy['nodemcu-controller'])  nodeMcuEnergy.textContent   = formatEnergy(m.deviceEnergy['nodemcu-controller']);
    }
}

function formatEnergy(value) {
    if (value >= 1e6)  return (value / 1e6).toFixed(2) + ' MJ';
    if (value >= 1000) return (value / 1000).toFixed(2) + ' kJ';
    return value.toFixed(1) + ' J';
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart.js
// ─────────────────────────────────────────────────────────────────────────────
function initChart() {
    const ctx = document.getElementById('telemetryChart').getContext('2d');

    // Kill ALL points globally
    Chart.defaults.elements.point.radius      = 0;
    Chart.defaults.elements.point.hoverRadius = 0;
    Chart.defaults.elements.point.hitRadius   = 0;

    telemetryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: '#22d3ee',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    yAxisID: 'y-temp',
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointHitRadius: 0
                },
                {
                    label: 'Light Level (LDR)',
                    data: [],
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    yAxisID: 'y-light',
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointHitRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeInOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: '#9ca3af',
                        font: { size: 11, family: 'Manrope, sans-serif' },
                        usePointStyle: true,
                        pointStyle: 'line',
                        boxWidth: 24,
                        padding: 18
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.92)',
                    borderColor: 'rgba(99,102,241,0.35)',
                    borderWidth: 1,
                    titleColor: '#e2e8f0',
                    bodyColor: '#94a3b8',
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: true,
                    callbacks: {
                        title: (items) => `Sample #${items[0].label}`,
                        label: (item) => {
                            const unit = item.datasetIndex === 0 ? ' °C' : ' LDR';
                            return `  ${item.dataset.label}: ${Number(item.raw).toFixed(1)}${unit}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
                    border: { display: false },
                    ticks: {
                        color: '#4b5563',
                        font: { size: 10 },
                        maxTicksLimit: 8,
                        maxRotation: 0
                    }
                },
                'y-temp': {
                    type: 'linear',
                    position: 'left',
                    grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
                    border: { display: false },
                    ticks: {
                        color: '#22d3ee',
                        font: { size: 10 },
                        maxTicksLimit: 6,
                        callback: (v) => v + '°'
                    },
                    title: {
                        display: true,
                        text: 'Temp (°C)',
                        color: 'rgba(34,211,238,0.5)',
                        font: { size: 10 }
                    }
                },
                'y-light': {
                    type: 'linear',
                    position: 'right',
                    grid: { drawOnChartArea: false, drawTicks: false },
                    border: { display: false },
                    ticks: {
                        color: '#f59e0b',
                        font: { size: 10 },
                        maxTicksLimit: 6
                    },
                    title: {
                        display: true,
                        text: 'Light (LDR)',
                        color: 'rgba(245,158,11,0.5)',
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

// Accepts array of {temp, light} objects (downsampled server-side)
function applyChartData(points) {
    if (!telemetryChart || !points || points.length === 0) return;
    telemetryChart.data.labels              = points.map((_, i) => i);
    telemetryChart.data.datasets[0].data   = points.map(p => p.temp);
    telemetryChart.data.datasets[1].data   = points.map(p => p.light);
    telemetryChart.update('active');
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset Table + Pagination
// ─────────────────────────────────────────────────────────────────────────────
function renderTable() {
    datasetTbody.innerHTML = '';

    if (filteredDataset.length === 0) {
        datasetTbody.innerHTML = '<tr><td colspan="8" class="empty-table">No data available. Run the simulation to populate dataset.</td></tr>';
        btnPrev.disabled = btnNext.disabled = true;
        pageNumSpan.textContent = 'Page 1 of 1';
        datasetCount.textContent = '0 rows';
        return;
    }

    datasetCount.textContent = `${filteredDataset.length.toLocaleString()} rows`;

    const totalPages = Math.ceil(filteredDataset.length / rowsPerPage);
    currentPage = Math.min(Math.max(currentPage, 1), totalPages);
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages;
    pageNumSpan.textContent = `Page ${currentPage} of ${totalPages}`;

    const start = (currentPage - 1) * rowsPerPage;
    const end   = Math.min(start + rowsPerPage, filteredDataset.length);

    for (let i = start; i < end; i++) {
        const row = filteredDataset[i];
        const tr  = document.createElement('tr');
        if (row.IsAnomaly === true || row.IsAnomaly === 'true') tr.className = 'anomaly-row';

        const isFanOn = row.FanStatus && row.FanStatus.includes('ON');
        const isLedOn = row.LEDStatus && row.LEDStatus.includes('ON');

        tr.innerHTML = `
            <td>${row.Timestamp || '--'}</td>
            <td>${row.Temperature != null ? parseFloat(row.Temperature).toFixed(2) : '--'}</td>
            <td>${row.Humidity    != null ? parseFloat(row.Humidity).toFixed(2)    : '--'}</td>
            <td>${row.LightIntensity != null ? row.LightIntensity : '--'}</td>
            <td><span class="${isFanOn ? 'status-on':'status-off'}">${isFanOn ? 'ON':'OFF'}</span></td>
            <td><span class="${isLedOn ? 'status-on':'status-off'}">${isLedOn ? 'ON':'OFF'}</span></td>
            <td>${row.Occupancy != null ? row.Occupancy : '--'}</td>
            <td>${row.Decision || '--'}</td>
        `;
        datasetTbody.appendChild(tr);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search / Filter
// ─────────────────────────────────────────────────────────────────────────────
datasetSearch.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    filteredDataset = !q ? [...dataset] : dataset.filter(r =>
        (r.Decision    && r.Decision.toLowerCase().includes(q)) ||
        (r.FanStatus   && r.FanStatus.toLowerCase().includes(q)) ||
        (r.LEDStatus   && r.LEDStatus.toLowerCase().includes(q)) ||
        (r.Timestamp   && String(r.Timestamp).includes(q)) ||
        (r.Temperature && String(r.Temperature).includes(q)) ||
        (String(r.IsAnomaly).toLowerCase() === q)
    );
    currentPage = 1;
    renderTable();
});

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────
btnPrev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
btnNext.addEventListener('click', () => {
    const total = Math.ceil(filteredDataset.length / rowsPerPage);
    if (currentPage < total) { currentPage++; renderTable(); }
});
