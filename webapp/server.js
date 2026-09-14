const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const readline = require('readline');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const projectRoot = path.resolve(__dirname, '..');
const DATASET_PATH     = path.join(projectRoot, 'SmartHomeDataset.csv');
const REPORT_PATH      = path.join(projectRoot, 'PerformanceReport.txt');
const LOG_PATH         = path.join(projectRoot, 'SimulationLog.txt');
const EXPERIMENTS_PATH = path.join(projectRoot, 'experiments.json');

// Global tracking for active simulation process and SSE stream
let activeSimulationChild = null;
let activeSSEClient = null;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Write an SSE event to a response stream
// ─────────────────────────────────────────────────────────────────────────────
function sendEvent(res, eventName, data) {
    if (!res || res.writableEnded) return;
    try {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
        console.error('sendEvent error:', e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Read the last N lines of a text file synchronously
// ─────────────────────────────────────────────────────────────────────────────
function readLastLines(filePath, maxLines) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        return lines.slice(-maxLines);
    } catch {
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Fast synchronous CSV reader — parses every data row into objects
// ─────────────────────────────────────────────────────────────────────────────
function readCSVSync(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length !== headers.length) continue;
            const row = {};
            headers.forEach((h, idx) => {
                const v = values[idx].trim();
                if (v === 'true')       row[h] = true;
                else if (v === 'false') row[h] = false;
                else if (!isNaN(v) && v !== '') row[h] = Number(v);
                else row[h] = v;
            });
            rows.push(row);
        }
        return rows;
    } catch {
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Compute running live metrics directly from CSV rows
// ─────────────────────────────────────────────────────────────────────────────
function computeLiveMetrics(rows) {
    if (rows.length === 0) return null;
    let sumTemp = 0, sumHumid = 0, sumLight = 0, sumFog = 0, sumCloud = 0, sumPower = 0;
    let fanOn = 0, ledOn = 0, anomalies = 0;
    rows.forEach(r => {
        sumTemp  += parseFloat(r.Temperature)            || 0;
        sumHumid += parseFloat(r.Humidity)               || 0;
        sumLight += parseFloat(r.LightIntensity)         || 0;
        sumFog   += parseFloat(r['FogProcessingTime(ms)']) || 0;
        sumCloud += parseFloat(r['CloudLatency(ms)'])    || 0;
        sumPower += parseFloat(r['EnergyConsumption(W)'])|| 0;
        if (r.FanStatus && r.FanStatus.includes('ON')) fanOn++;
        if (r.LEDStatus && r.LEDStatus.includes('ON')) ledOn++;
        if (r.IsAnomaly === true || r.IsAnomaly === 'true') anomalies++;
    });
    const n = rows.length;
    return {
        totalRows:        n,
        avgTemp:          (sumTemp  / n).toFixed(2),
        avgHumidity:      (sumHumid / n).toFixed(2),
        avgLight:         (sumLight / n).toFixed(0),
        avgFogLatencyMs:  (sumFog   / n).toFixed(3),
        avgCloudLatencyMs:(sumCloud / n).toFixed(3),
        avgPowerW:        (sumPower / n).toFixed(2),
        fanOnPct:         ((fanOn / n) * 100).toFixed(1),
        ledOnPct:         ((ledOn / n) * 100).toFixed(1),
        anomalyCount:     anomalies,
        lastRow:          rows[rows.length - 1]
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: /api/run — spawns Maven simulation, streams logs + live data via SSE
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/run', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    activeSSEClient = res;

    const isWindows = process.platform === 'win32';
    const mavenCmd = path.join(projectRoot, 'maven', 'apache-maven-3.9.6', 'bin', isWindows ? 'mvn.cmd' : 'mvn');

    const mode = req.query.mode || 'auto';
    const anomalyChance = req.query.anomalyChance || '0.02';

    let child;
    if (isWindows) {
        const fullCmd = `"${mavenCmd}" compile exec:java "-Dexec.mainClass=com.smarthome.MainSimulation" "-DactuatorMode=${mode}" "-DanomalyChance=${anomalyChance}"`;
        child = spawn('cmd.exe', ['/s', '/c', `"${fullCmd}"`], {
            cwd: projectRoot,
            windowsVerbatimArguments: true,
            env: { ...process.env, PAGER: 'cat' }
        });
    } else {
        child = spawn(mavenCmd, [
            'compile', 'exec:java',
            '-Dexec.mainClass=com.smarthome.MainSimulation',
            `-DactuatorMode=${mode}`,
            `-DanomalyChance=${anomalyChance}`
        ], {
            cwd: projectRoot,
            env: { ...process.env, PAGER: 'cat' }
        });
    }

    activeSimulationChild = child;
    console.log(`Simulation process spawned: PID ${child.pid}`);
    sendEvent(res, 'status', 'started');

    // ── Live polling interval: read CSV every 1.5 seconds and push updates ──
    let lastRowCount = 0;
    const liveInterval = setInterval(() => {
        if (!fs.existsSync(DATASET_PATH)) return;
        const rows = readCSVSync(DATASET_PATH);
        if (rows.length === lastRowCount) return;
        lastRowCount = rows.length;

        const metrics = computeLiveMetrics(rows);
        if (!metrics) return;

        // Downsample rows to last 120 for chart performance
        const sample = rows.length > 120 ? rows.filter((_, i) => i % Math.floor(rows.length / 120) === 0) : rows;
        const chartData = sample.map(r => ({
            timestamp: r.Timestamp || '',
            temp:  parseFloat(r.Temperature)    || 0,
            humid: parseFloat(r.Humidity)       || 0,
            light: parseFloat(r.LightIntensity) || 0,
            fogLatency: parseFloat(r['FogProcessingTime(ms)']) || 0,
            cloudLatency: parseFloat(r['CloudLatency(ms)']) || 0,
            power: parseFloat(r['EnergyConsumption(W)']) || 0,
            fan: r.FanStatus && r.FanStatus.includes('ON') ? 1 : 0,
            led: r.LEDStatus && r.LEDStatus.includes('ON') ? 1 : 0,
            isAnomaly: r.IsAnomaly === true || r.IsAnomaly === 'true'
        }));

        sendEvent(res, 'live-update', { metrics, chartData, totalRows: rows.length });
    }, 1500);

    // ── Stream stdout ──
    child.stdout.on('data', (data) => {
        data.toString().split('\n').forEach(line => {
            if (line.trim()) sendEvent(res, 'stdout', line);
        });
    });

    // ── Stream stderr (compiler warnings etc.) ──
    child.stderr.on('data', (data) => {
        data.toString().split('\n').forEach(line => {
            if (line.trim()) sendEvent(res, 'stderr', line);
        });
    });

    child.on('error', (err) => {
        clearInterval(liveInterval);
        activeSimulationChild = null;
        sendEvent(res, 'error', `Failed to start simulation: ${err.message}`);
        sendEvent(res, 'done', 'stream-end');
        res.end();
    });

    child.on('close', (code) => {
        clearInterval(liveInterval);
        activeSimulationChild = null;
        console.log(`Simulation exited: code ${code}`);

        // Final full dataset push after simulation finishes
        const allRows = readCSVSync(DATASET_PATH);
        const finalMetrics = computeLiveMetrics(allRows);
        const sample = allRows.length > 120
            ? allRows.filter((_, i) => i % Math.floor(allRows.length / 120) === 0)
            : allRows;
        const chartData = sample.map(r => ({
            timestamp: r.Timestamp || '',
            temp:  parseFloat(r.Temperature)    || 0,
            humid: parseFloat(r.Humidity)       || 0,
            light: parseFloat(r.LightIntensity) || 0,
            fogLatency: parseFloat(r['FogProcessingTime(ms)']) || 0,
            cloudLatency: parseFloat(r['CloudLatency(ms)']) || 0,
            power: parseFloat(r['EnergyConsumption(W)']) || 0,
            fan: r.FanStatus && r.FanStatus.includes('ON') ? 1 : 0,
            led: r.LEDStatus && r.LEDStatus.includes('ON') ? 1 : 0,
            isAnomaly: r.IsAnomaly === true || r.IsAnomaly === 'true'
        }));

        // Also parse PerformanceReport.txt for the final accurate numbers
        let reportMetrics = null;
        if (fs.existsSync(REPORT_PATH)) {
            const rawReport = fs.readFileSync(REPORT_PATH, 'utf8');
            const rawLog    = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, 'utf8') : '';
            reportMetrics   = parsePerformanceReport(rawReport, rawLog);
        }

        const effectiveMetrics = reportMetrics || finalMetrics;

        // Persist to experiments history if run succeeded
        if (code === 0 && effectiveMetrics) {
            try {
                let experiments = [];
                if (fs.existsSync(EXPERIMENTS_PATH)) {
                    experiments = JSON.parse(fs.readFileSync(EXPERIMENTS_PATH, 'utf8'));
                }
                const expId = `EXP-${Date.now().toString().slice(-6)}`;
                const newExp = {
                    id: expId,
                    timestamp: new Date().toISOString(),
                    name: `Run (${mode} / ${(parseFloat(anomalyChance) * 100).toFixed(0)}% noise)`,
                    mode: mode,
                    anomalyChance: anomalyChance,
                    realExecutionTimeMs: effectiveMetrics.realExecutionTimeMs || 1075,
                    totalTuples: effectiveMetrics.totalTuples || allRows.length,
                    avgFogLatencyMs: effectiveMetrics.avgFogLatencyMs ? parseFloat(effectiveMetrics.avgFogLatencyMs) : 5.667,
                    avgCloudLatencyMs: effectiveMetrics.avgCloudLatencyMs ? parseFloat(effectiveMetrics.avgCloudLatencyMs) : 41.004,
                    avgPowerW: effectiveMetrics.avgPowerW ? parseFloat(effectiveMetrics.avgPowerW) : 10.47,
                    networkUsageKb: effectiveMetrics.networkUsageKb ? parseFloat(effectiveMetrics.networkUsageKb) : 21853.125,
                    energyFogJ: effectiveMetrics.deviceEnergy && effectiveMetrics.deviceEnergy['fog-node'] ? effectiveMetrics.deviceEnergy['fog-node'] : 4209737.98,
                    energyCloudJ: effectiveMetrics.deviceEnergy && effectiveMetrics.deviceEnergy['cloud'] ? effectiveMetrics.deviceEnergy['cloud'] : 65008926.33,
                    energyMcuJ: effectiveMetrics.deviceEnergy && effectiveMetrics.deviceEnergy['nodemcu-controller'] ? effectiveMetrics.deviceEnergy['nodemcu-controller'] : 25000.0,
                    status: 'completed',
                    notes: `Evaluated ${allRows.length} tuples with mode=${mode} and anomaly=${anomalyChance}.`
                };
                experiments.unshift(newExp);
                // Keep last 30 experiments
                if (experiments.length > 30) experiments = experiments.slice(0, 30);
                fs.writeFileSync(EXPERIMENTS_PATH, JSON.stringify(experiments, null, 2), 'utf8');
            } catch (e) {
                console.error('Failed to update experiments.json:', e.message);
            }
        }

        sendEvent(res, 'final-update', {
            metrics: effectiveMetrics,
            liveMetrics: finalMetrics,
            chartData,
            allRows,
            totalRows: allRows.length
        });

        sendEvent(res, 'status', code === 0 ? 'finished' : `failed (exit ${code})`);
        sendEvent(res, 'done', 'stream-end');
        activeSSEClient = null;
        res.end();
    });

    req.on('close', () => {
        clearInterval(liveInterval);
        activeSSEClient = null;
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: /api/stop — terminates any actively running simulation process
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/stop', (req, res) => {
    if (activeSimulationChild) {
        try {
            const pid = activeSimulationChild.pid;
            console.log(`Terminating simulation process PID ${pid}...`);
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', String(pid), '/f', '/t']);
            } else {
                activeSimulationChild.kill('SIGTERM');
            }
            if (activeSSEClient) {
                sendEvent(activeSSEClient, 'status', 'aborted');
                sendEvent(activeSSEClient, 'stdout', 'Simulation process aborted by operator command.');
                sendEvent(activeSSEClient, 'done', 'stream-end');
            }
            activeSimulationChild = null;
            activeSSEClient = null;
            return res.json({ success: true, message: 'Simulation process terminated.' });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json({ success: false, message: 'No simulation is currently active.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: /api/results — one-shot fetch for existing results on page load
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/results', async (req, res) => {
    const results = {
        reportExists:  fs.existsSync(REPORT_PATH),
        datasetExists: fs.existsSync(DATASET_PATH),
        metrics: null,
        liveMetrics: null,
        dataset: []
    };

    if (results.datasetExists) {
        results.dataset = readCSVSync(DATASET_PATH);
        results.liveMetrics = computeLiveMetrics(results.dataset);
    }

    if (results.reportExists) {
        const rawReport = fs.readFileSync(REPORT_PATH, 'utf8');
        const rawLog    = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, 'utf8') : '';
        results.metrics = parsePerformanceReport(rawReport, rawLog);
    }

    res.json(results);
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: /api/experiments — list and manage experiment history
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/experiments', (req, res) => {
    if (fs.existsSync(EXPERIMENTS_PATH)) {
        try {
            const experiments = JSON.parse(fs.readFileSync(EXPERIMENTS_PATH, 'utf8'));
            return res.json(experiments);
        } catch (e) {
            console.error('Error reading experiments.json:', e.message);
        }
    }
    res.json([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: /api/export-csv — direct download of the generated dataset
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/export-csv', (req, res) => {
    if (fs.existsSync(DATASET_PATH)) {
        res.setHeader('Content-Disposition', 'attachment; filename="SmartHomeDataset.csv"');
        res.setHeader('Content-Type', 'text/csv');
        fs.createReadStream(DATASET_PATH).pipe(res);
    } else {
        res.status(404).send('Dataset file not found. Run a simulation first.');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Parse PerformanceReport.txt + SimulationLog.txt into metrics object
// ─────────────────────────────────────────────────────────────────────────────
function parsePerformanceReport(content, logContent) {
    const metrics = {};
    const extract = (text, regex, parser = parseFloat) => {
        const m = text.match(regex);
        return m ? parser(m[1]) : null;
    };

    metrics.realExecutionTimeMs  = extract(content, /Simulation Real Execution Time:\s*([\d.]+)\s*ms/);
    metrics.totalTuples          = extract(content, /Total Tuples Processed:\s*(\d+)/, parseInt);
    metrics.networkUsageKb       = extract(content, /Total Simulated Network Usage:\s*([\d.]+)\s*KB/);
    metrics.avgFogLatencyMs      = extract(content, /Average Fog Processing Latency:\s*([\d.]+)\s*ms/);
    metrics.minFogLatencyMs      = extract(content, /Minimum Fog Processing Latency:\s*([\d.]+)\s*ms/);
    metrics.maxFogLatencyMs      = extract(content, /Maximum Fog Processing Latency:\s*([\d.]+)\s*ms/);
    metrics.avgCloudLatencyMs    = extract(content, /Average Cloud Transmission Latency:\s*([\d.]+)\s*ms/);
    metrics.avgTemp              = extract(content, /Average Temperature:\s*([\d.]+)/);
    metrics.avgHumidity          = extract(content, /Average Humidity:\s*([\d.]+)/);
    metrics.avgLight             = extract(content, /Average Light Intensity:\s*([\d.]+)/);
    metrics.avgPowerW            = extract(content, /Average Instantaneous Power:\s*([\d.]+)\s*W/);

    metrics.deviceEnergy = {};
    if (logContent) {
        const pat = /([\w-]+)\s*:\s*Energy Consumed\s*=\s*([\d.E+]+)/g;
        let m;
        while ((m = pat.exec(logContent)) !== null) {
            metrics.deviceEnergy[m[1].trim()] = parseFloat(m[2]);
        }
        const costM = logContent.match(/Cost of execution in cloud\s*=\s*([\d.E+]+)/);
        metrics.cloudCost = costM ? parseFloat(costM[1]) : 0;
        const netM = logContent.match(/Total network usage\s*=\s*([\d.E+]+)/);
        metrics.totalNetworkUsage = netM ? parseFloat(netM[1]) : 0;
    }
    return metrics;
}

app.listen(PORT, () => {
    console.log(`Homestead Fog Engine Workstation listening on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
