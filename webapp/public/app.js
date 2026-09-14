// ==========================================================================
// HOMESTEAD FOG ENGINE // APPLICATION WORKSTATION CONTROLLER
// Production-grade Technical Research Platform
// ==========================================================================

// ─────────────────────────────────────────────────────────────────────────────
// 1. Global Application State
// ─────────────────────────────────────────────────────────────────────────────
const state = {
    activeView: 'view-overview',
    simulationRunning: false,
    eventSource: null,
    dataset: [],
    filteredDataset: [],
    currentPage: 1,
    pageSize: 20,
    sortColumn: 'Timestamp',
    sortAsc: false,
    experiments: [],
    selectedExperiments: new Set(),
    activeNodeId: 'fog',
    packetSpeed: 'norm',
    viewMode3D: false,
    terminalFilter: 'all',
    autoScroll: true,
    runStartTime: null,
    tuplesReceived: 0,
    throughputTimer: null,
    // Metrics cache
    metrics: null,
    liveMetrics: null,
    // Chart instances
    charts: {
        overview: null,
        tempHumid: null,
        latency: null,
        light: null,
        power: null
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. DOM Element Selectors
// ─────────────────────────────────────────────────────────────────────────────
const DOM = {
    // Shell & Navigation
    appShell: document.getElementById('app-shell'),
    appSidebar: document.getElementById('app-sidebar'),
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
    navItems: document.querySelectorAll('.sidebar-nav .nav-item'),
    modeBtnConsole: document.getElementById('btn-mode-console'),
    modeBtnLanding: document.getElementById('btn-mode-landing'),
    crumbCurrent: document.getElementById('crumb-current-view'),
    views: document.querySelectorAll('.workspace-view'),
    
    // Status Bar & Tickers
    lblJvmStatus: document.getElementById('lbl-jvm-status'),
    clusterPulse: document.getElementById('cluster-pulse'),
    headerStatusDot: document.getElementById('header-status-dot'),
    headerStatusText: document.getElementById('header-status-text'),
    badgeOverviewLive: document.getElementById('badge-overview-live'),
    tickerTuples: document.getElementById('ticker-tuples'),
    tickerLatency: document.getElementById('ticker-latency'),
    tickerPower: document.getElementById('ticker-power'),
    footerConnectionStatus: document.getElementById('footer-connection-status'),
    footerDatasetStatus: document.getElementById('footer-dataset-status'),
    globalProgressStrip: document.getElementById('global-progress-strip'),
    globalProgressBar: document.getElementById('global-progress-bar'),
    progressPhaseTitle: document.getElementById('progress-phase-title'),
    progressPctLabel: document.getElementById('progress-pct-label'),
    systemAnomalyBanner: document.getElementById('system-anomaly-banner'),
    systemAnomalyDesc: document.getElementById('system-anomaly-desc'),

    // Global Run & Controls
    btnQuickRun: document.getElementById('btn-quick-run'),
    btnQuickRunText: document.getElementById('btn-quick-run-text'),
    btnQuickStop: document.getElementById('btn-quick-stop'),
    quickActuatorMode: document.getElementById('quick-actuator-mode'),
    btnOpenLanding: document.getElementById('btn-open-landing'),

    // Overview Metric Strip Elements
    valExecutionTime: document.getElementById('val-execution-time'),
    subExecutionSpeed: document.getElementById('sub-execution-speed'),
    valTuples: document.getElementById('val-tuples'),
    subTuplesRate: document.getElementById('sub-tuples-rate'),
    valLatency: document.getElementById('val-latency'),
    subCloudLatency: document.getElementById('sub-cloud-latency'),
    valPower: document.getElementById('val-power'),
    valNetworkUsage: document.getElementById('val-network-usage'),
    valFogEnergy: document.getElementById('val-fog-energy'),
    subCloudEnergy: document.getElementById('sub-cloud-energy'),

    // Topology in Overview
    topologyContainer: document.getElementById('topology-diagram'),
    lblTopologyStatus: document.getElementById('lbl-topology-status'),
    nodeCloudEnergy: document.getElementById('node-cloud-energy'),
    nodeFogEnergy: document.getElementById('node-fog-energy'),
    nodeMcuEnergy: document.getElementById('node-mcu-energy'),
    nodeFan: document.getElementById('node-actuator-fan'),
    nodeLed: document.getElementById('node-actuator-led'),
    lblFanState: document.getElementById('lbl-fan-state'),
    lblLedState: document.getElementById('lbl-led-state'),
    barFan: document.getElementById('bar-fan'),
    barLed: document.getElementById('bar-led'),
    pctFan: document.getElementById('pct-fan'),
    pctLed: document.getElementById('pct-led'),
    btnSpeedNorm: document.getElementById('btn-speed-norm'),
    btnSpeedFast: document.getElementById('btn-speed-fast'),
    btnSpeedPause: document.getElementById('btn-speed-pause'),

    // Overview Chart & Mini Table
    chartIdleOverlay: document.getElementById('chart-idle-overlay'),
    btnChartRun: document.getElementById('btn-chart-run'),
    btnExpandTelemetry: document.getElementById('btn-expand-telemetry'),
    overviewDatasetCount: document.getElementById('overview-dataset-count'),
    miniDatasetTbody: document.getElementById('mini-dataset-tbody'),

    // Simulation Workbench Elements
    btnSimRun: document.getElementById('btn-sim-run'),
    btnSimStop: document.getElementById('btn-sim-stop'),
    simOptActuatorMode: document.getElementById('sim-opt-actuator-mode'),
    simOptAnomalyChance: document.getElementById('sim-opt-anomaly-chance'),
    simRunStatusBadge: document.getElementById('sim-run-status-badge'),
    simStageLabel: document.getElementById('sim-stage-label'),
    simRowCount: document.getElementById('sim-row-count'),
    simProgressFill: document.getElementById('sim-progress-fill'),
    simStatRealtime: document.getElementById('sim-stat-realtime'),
    simStatSimtime: document.getElementById('sim-stat-simtime'),
    simStatThroughput: document.getElementById('sim-stat-throughput'),
    simStatAnomalies: document.getElementById('sim-stat-anomalies'),
    simTerminalOutput: document.getElementById('sim-terminal-output'),
    btnClearTerminal: document.getElementById('btn-clear-terminal'),
    chkAutoscroll: document.getElementById('chk-autoscroll'),

    // Full Topology Page Elements
    btnTopo2D: document.getElementById('btn-topo-2d'),
    btnTopo3D: document.getElementById('btn-topo-3d'),
    fullTopoContainer: document.getElementById('full-topology-container'),
    ftCloudEnergy: document.getElementById('ft-cloud-energy'),
    ftFogLatency: document.getElementById('ft-fog-latency'),
    ftFogEnergy: document.getElementById('ft-fog-energy'),
    ftMcuEnergy: document.getElementById('ft-mcu-energy'),
    inspId: document.getElementById('insp-id'),
    inspStatus: document.getElementById('insp-status'),
    inspType: document.getElementById('insp-type'),
    inspMips: document.getElementById('insp-mips'),
    inspRam: document.getElementById('insp-ram'),
    inspEnergy: document.getElementById('insp-energy'),
    inspModuleName: document.getElementById('insp-module-name'),
    inspModuleDesc: document.getElementById('insp-module-desc'),

    // Telemetry Analytics Elements
    tstatTemp: document.getElementById('tstat-temp'),
    tstatHumid: document.getElementById('tstat-humid'),
    tstatLight: document.getElementById('tstat-light'),
    tstatFogLat: document.getElementById('tstat-fog-lat'),
    tstatCloudLat: document.getElementById('tstat-cloud-lat'),
    tstatSpeedup: document.getElementById('tstat-speedup'),

    // Dataset Explorer Page Elements
    datasetFullSearch: document.getElementById('dataset-full-search'),
    filterAnomalySelect: document.getElementById('filter-anomaly-select'),
    filterOccupancySelect: document.getElementById('filter-occupancy-select'),
    filterActuatorSelect: document.getElementById('filter-actuator-select'),
    selectPageSize: document.getElementById('select-page-size'),
    datasetFilteredCount: document.getElementById('dataset-filtered-count'),
    navDatasetCount: document.getElementById('nav-dataset-count'),
    datasetFullTbody: document.getElementById('dataset-full-tbody'),
    fullPageInfo: document.getElementById('full-page-info'),
    btnFirstPage: document.getElementById('btn-first-page'),
    btnFullPrev: document.getElementById('btn-full-prev'),
    btnFullNext: document.getElementById('btn-full-next'),
    btnLastPage: document.getElementById('btn-last-page'),
    inputPageJump: document.getElementById('input-page-jump'),

    // Experiments Page Elements
    experimentsTbody: document.getElementById('experiments-tbody'),
    chkSelectAllExp: document.getElementById('chk-select-all-exp'),
    btnCompareRuns: document.getElementById('btn-compare-runs'),
    expComparisonCard: document.getElementById('exp-comparison-card'),
    btnCloseComparison: document.getElementById('btn-close-comparison'),
    compRunAName: document.getElementById('comp-run-a-name'),
    compRunBName: document.getElementById('comp-run-b-name'),
    comparisonGrid: document.getElementById('comparison-grid'),

    // Landing Page Elements
    btnLandingEnterConsole: document.getElementById('btn-landing-enter-console'),
    btnHeroExplore: document.getElementById('btn-hero-explore'),
    btnCtaLaunch: document.getElementById('btn-cta-launch'),
    btnLandingToDocs: document.getElementById('btn-landing-to-docs')
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Application Initialization
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    initRouting();
    initEventListeners();
    initCharts();
    fetchExistingResults();
    fetchExperiments();
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. View Routing & Navigation Management
// ─────────────────────────────────────────────────────────────────────────────
function initRouting() {
    window.addEventListener('hashchange', handleHashChange);
    // Initial hash routing or default to #overview
    const initialHash = window.location.hash || '#overview';
    navigateToHash(initialHash);
}

function handleHashChange() {
    navigateToHash(window.location.hash);
}

function navigateToHash(hash) {
    const cleanHash = hash.replace(/^#/, '') || 'overview';
    const viewMap = {
        'overview':      { id: 'view-overview',      crumb: 'Overview',             mode: 'console' },
        'simulation':    { id: 'view-simulation',    crumb: 'Simulation Workbench', mode: 'console' },
        'topology':      { id: 'view-topology',      crumb: 'Topology Visualizer',  mode: 'console' },
        'telemetry':     { id: 'view-telemetry',     crumb: 'Telemetry Analytics',  mode: 'console' },
        'dataset':       { id: 'view-dataset',       crumb: 'Dataset Explorer',     mode: 'console' },
        'experiments':   { id: 'view-experiments',   crumb: 'Experiments & Benchmarks', mode: 'console' },
        'documentation': { id: 'view-documentation', crumb: 'Documentation',        mode: 'console' },
        'settings':      { id: 'view-settings',      crumb: 'Platform Settings',    mode: 'console' },
        'landing':       { id: 'view-landing',       crumb: 'Public Briefing',      mode: 'landing' }
    };

    const target = viewMap[cleanHash] || viewMap['overview'];
    switchView(target.id, target.crumb, target.mode);
}

function switchView(viewId, crumbTitle, mode) {
    state.activeView = viewId;

    // Toggle active view element
    DOM.views.forEach(v => {
        if (v.id === viewId) {
            v.style.display = 'flex';
            v.classList.add('active');
        } else {
            v.style.display = 'none';
            v.classList.remove('active');
        }
    });

    // Update breadcrumb
    if (DOM.crumbCurrent) DOM.crumbCurrent.textContent = crumbTitle;

    // Update sidebar nav items
    DOM.navItems.forEach(item => {
        if (item.getAttribute('data-view') === viewId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update Mode Buttons in Sidebar
    if (mode === 'landing') {
        DOM.modeBtnLanding.classList.add('active');
        DOM.modeBtnConsole.classList.remove('active');
        document.getElementById('app-topbar').style.display = 'none';
        document.querySelector('.app-status-bar').style.display = 'none';
    } else {
        DOM.modeBtnConsole.classList.add('active');
        DOM.modeBtnLanding.classList.remove('active');
        document.getElementById('app-topbar').style.display = 'flex';
        document.querySelector('.app-status-bar').style.display = 'flex';
    }

    // Trigger chart resize / update on view switch
    setTimeout(() => {
        if (viewId === 'view-overview' && state.charts.overview) {
            state.charts.overview.resize();
        } else if (viewId === 'view-telemetry') {
            Object.values(state.charts).forEach(c => c && c.resize());
        }
    }, 50);

    // Close mobile drawer if open
    if (DOM.appSidebar) DOM.appSidebar.classList.remove('sidebar-open');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Event Listeners Setup
// ─────────────────────────────────────────────────────────────────────────────
function initEventListeners() {
    // Mobile sidebar toggle
    if (DOM.sidebarToggleBtn) {
        DOM.sidebarToggleBtn.addEventListener('click', () => {
            DOM.appSidebar.classList.toggle('sidebar-open');
        });
    }

    // Mode buttons
    DOM.modeBtnConsole.addEventListener('click', () => {
        window.location.hash = '#overview';
    });
    DOM.modeBtnLanding.addEventListener('click', () => {
        window.location.hash = '#landing';
    });
    DOM.btnOpenLanding.addEventListener('click', () => {
        window.location.hash = '#landing';
    });

    // Landing CTA buttons
    if (DOM.btnLandingEnterConsole) {
        DOM.btnLandingEnterConsole.addEventListener('click', () => { window.location.hash = '#overview'; });
    }
    if (DOM.btnHeroExplore) {
        DOM.btnHeroExplore.addEventListener('click', () => { window.location.hash = '#overview'; });
    }
    if (DOM.btnCtaLaunch) {
        DOM.btnCtaLaunch.addEventListener('click', () => { window.location.hash = '#simulation'; });
    }
    if (DOM.btnLandingToDocs) {
        DOM.btnLandingToDocs.addEventListener('click', () => { window.location.hash = '#documentation'; });
    }

    // Quick Run buttons
    DOM.btnQuickRun.addEventListener('click', runSimulation);
    if (DOM.btnSimRun) DOM.btnSimRun.addEventListener('click', runSimulation);
    if (DOM.btnChartRun) DOM.btnChartRun.addEventListener('click', runSimulation);

    // Stop / Abort buttons
    if (DOM.btnQuickStop) DOM.btnQuickStop.addEventListener('click', abortSimulation);
    if (DOM.btnSimStop) DOM.btnSimStop.addEventListener('click', abortSimulation);

    // Actuator mode synchronizers
    DOM.quickActuatorMode.addEventListener('change', (e) => {
        if (DOM.simOptActuatorMode) DOM.simOptActuatorMode.value = e.target.value;
    });
    if (DOM.simOptActuatorMode) {
        DOM.simOptActuatorMode.addEventListener('change', (e) => {
            DOM.quickActuatorMode.value = e.target.value;
        });
    }

    // Speed Controls in Topology
    DOM.btnSpeedNorm.addEventListener('click', () => setPacketSpeed('norm'));
    DOM.btnSpeedFast.addEventListener('click', () => setPacketSpeed('fast'));
    DOM.btnSpeedPause.addEventListener('click', () => setPacketSpeed('pause'));

    // 2D vs 3D Isometric View Mode
    if (DOM.btnTopo2D && DOM.btnTopo3D) {
        DOM.btnTopo2D.addEventListener('click', () => {
            DOM.btnTopo2D.classList.add('active');
            DOM.btnTopo3D.classList.remove('active');
            DOM.fullTopoContainer.classList.remove('isometric-view');
        });
        DOM.btnTopo3D.addEventListener('click', () => {
            DOM.btnTopo3D.classList.add('active');
            DOM.btnTopo2D.classList.remove('active');
            DOM.fullTopoContainer.classList.add('isometric-view');
        });
    }

    // Node Click to Inspect in Topology
    document.querySelectorAll('[data-node]').forEach(el => {
        el.addEventListener('click', () => {
            const nodeId = el.getAttribute('data-node');
            selectNodeForInspection(nodeId);
        });
    });

    // Expand Telemetry button
    if (DOM.btnExpandTelemetry) {
        DOM.btnExpandTelemetry.addEventListener('click', () => {
            window.location.hash = '#telemetry';
        });
    }

    // Terminal Controls
    if (DOM.btnClearTerminal) {
        DOM.btnClearTerminal.addEventListener('click', () => {
            DOM.simTerminalOutput.innerHTML = '';
        });
    }
    document.querySelectorAll('.t-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.t-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.terminalFilter = btn.getAttribute('data-filter');
            applyTerminalFilter();
        });
    });
    if (DOM.chkAutoscroll) {
        DOM.chkAutoscroll.addEventListener('change', (e) => {
            state.autoScroll = e.target.checked;
        });
    }

    // Dataset Controls
    DOM.datasetFullSearch.addEventListener('input', debounce(applyDatasetFilters, 150));
    DOM.filterAnomalySelect.addEventListener('change', applyDatasetFilters);
    DOM.filterOccupancySelect.addEventListener('change', applyDatasetFilters);
    DOM.filterActuatorSelect.addEventListener('change', applyDatasetFilters);
    DOM.selectPageSize.addEventListener('change', (e) => {
        state.pageSize = parseInt(e.target.value, 10);
        state.currentPage = 1;
        renderDatasetTable();
    });

    // Pagination
    DOM.btnFullPrev.addEventListener('click', () => {
        if (state.currentPage > 1) { state.currentPage--; renderDatasetTable(); }
    });
    DOM.btnFullNext.addEventListener('click', () => {
        const max = Math.ceil(state.filteredDataset.length / state.pageSize) || 1;
        if (state.currentPage < max) { state.currentPage++; renderDatasetTable(); }
    });
    DOM.btnFirstPage.addEventListener('click', () => {
        state.currentPage = 1; renderDatasetTable();
    });
    DOM.btnLastPage.addEventListener('click', () => {
        state.currentPage = Math.ceil(state.filteredDataset.length / state.pageSize) || 1;
        renderDatasetTable();
    });
    DOM.inputPageJump.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        const max = Math.ceil(state.filteredDataset.length / state.pageSize) || 1;
        if (!isNaN(val) && val >= 1 && val <= max) {
            state.currentPage = val;
            renderDatasetTable();
        }
    });

    // Table Column Sorting
    document.querySelectorAll('#dataset-full-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (state.sortColumn === col) {
                state.sortAsc = !state.sortAsc;
            } else {
                state.sortColumn = col;
                state.sortAsc = true;
            }
            sortAndRenderDataset();
        });
    });

    // Experiments Compare
    if (DOM.btnCompareRuns) {
        DOM.btnCompareRuns.addEventListener('click', openExperimentComparison);
    }
    if (DOM.btnCloseComparison) {
        DOM.btnCloseComparison.addEventListener('click', () => {
            DOM.expComparisonCard.style.display = 'none';
        });
    }
    if (DOM.chkSelectAllExp) {
        DOM.chkSelectAllExp.addEventListener('change', (e) => {
            document.querySelectorAll('.exp-chk').forEach(chk => {
                chk.checked = e.target.checked;
                const id = chk.getAttribute('data-exp-id');
                if (e.target.checked) state.selectedExperiments.add(id);
                else state.selectedExperiments.delete(id);
            });
            updateCompareButton();
        });
    }

    // Save Settings
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            alert('Settings updated successfully.');
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Simulation Execution (SSE Management)
// ─────────────────────────────────────────────────────────────────────────────
function runSimulation() {
    if (state.simulationRunning) return;
    state.simulationRunning = true;

    // Reset UI Indicators
    setEngineStatus('RUNNING', 'running');
    DOM.btnQuickRun.disabled = true;
    if (DOM.btnSimRun) DOM.btnSimRun.disabled = true;
    if (DOM.btnQuickStop) DOM.btnQuickStop.style.display = 'inline-flex';
    if (DOM.btnSimStop) DOM.btnSimStop.style.display = 'inline-flex';
    
    // Progress Bar
    DOM.globalProgressStrip.style.display = 'block';
    updateProgress(0, 'Initializing Java JVM & iFogSim2 Application Graph...');
    
    // Topology Animation Speedup
    DOM.topologyContainer.classList.add('running');
    setPacketSpeed('fast');

    // Reset metric readouts to live indicators
    resetLiveIndicators();

    // Clear and log to terminal
    logTerminal('System', 'Launching iFogSim2 Smart Home Simulation...', 'system');

    // Parameters
    const mode = DOM.quickActuatorMode.value;
    const anomaly = DOM.simOptAnomalyChance ? DOM.simOptAnomalyChance.value : '0.02';

    state.runStartTime = Date.now();
    state.tuplesReceived = 0;

    // Throughput ticker
    clearInterval(state.throughputTimer);
    state.throughputTimer = setInterval(() => {
        if (!state.simulationRunning) {
            clearInterval(state.throughputTimer);
            return;
        }
        const elapsedSec = (Date.now() - state.runStartTime) / 1000;
        if (elapsedSec > 0 && state.tuplesReceived > 0) {
            const rate = Math.round(state.tuplesReceived / elapsedSec);
            if (DOM.simStatThroughput) DOM.simStatThroughput.textContent = `${rate} pkts/s`;
            if (DOM.subTuplesRate) DOM.subTuplesRate.textContent = `${rate} pkts/s throughput`;
        }
    }, 1000);

    // Open SSE stream
    const eventSource = new EventSource(`/api/run?mode=${mode}&anomalyChance=${anomaly}`);
    state.eventSource = eventSource;

    // ── Live partial updates ──
    eventSource.addEventListener('live-update', (e) => {
        const data = JSON.parse(e.data);
        state.tuplesReceived = data.totalRows;
        
        applyLiveMetrics(data.metrics);
        applyChartPoints(data.chartData);

        const pct = Math.min(100, Math.round((data.totalRows / 10001) * 100));
        updateProgress(pct, `Processing discrete events: ${data.totalRows.toLocaleString()} / 10,001 tuples`);

        // Check for anomalies
        if (data.metrics && data.metrics.lastRow && (data.metrics.lastRow.IsAnomaly === true || data.metrics.lastRow.IsAnomaly === 'true')) {
            triggerAnomalyAlert(data.metrics.lastRow);
        }
    });

    // ── Terminal stdout ──
    eventSource.addEventListener('stdout', (e) => {
        const line = JSON.parse(e.data);
        logTerminal('Console', line, 'stdout');
    });

    // ── Terminal stderr ──
    eventSource.addEventListener('stderr', (e) => {
        const line = JSON.parse(e.data);
        logTerminal('Compiler', line, 'stderr');
    });

    // ── Status updates ──
    eventSource.addEventListener('status', (e) => {
        const status = JSON.parse(e.data);
        if (status === 'finished') {
            logTerminal('System', '✓ Simulation completed successfully! Performance report generated.', 'success');
            setEngineStatus('FINISHED', 'online');
            playCompletionSound();
        } else if (status === 'aborted') {
            logTerminal('System', '⚠ Simulation execution aborted by operator command.', 'stderr');
            setEngineStatus('ABORTED', '');
        } else if (status !== 'started') {
            logTerminal('System', `Simulation exited with status: ${status}`, 'stderr');
            setEngineStatus('ERROR', '');
        }
    });

    // ── Final comprehensive update ──
    eventSource.addEventListener('final-update', (e) => {
        const data = JSON.parse(e.data);
        if (data.metrics) applyFinalMetrics(data.metrics);
        if (data.liveMetrics) applyLiveMetrics(data.liveMetrics);
        applyChartPoints(data.chartData);

        if (data.allRows && data.allRows.length > 0) {
            state.dataset = data.allRows;
            applyDatasetFilters();
            renderMiniDatasetTable();
        }

        // Toggle actuator states from final row
        const lastRow = data.allRows && data.allRows[data.allRows.length - 1];
        if (lastRow) {
            updateActuatorStates(lastRow);
        }

        fetchExperiments();
    });

    // ── Done / Cleanup ──
    eventSource.addEventListener('done', () => {
        eventSource.close();
        state.eventSource = null;
        state.simulationRunning = false;
        clearInterval(state.throughputTimer);

        DOM.btnQuickRun.disabled = false;
        if (DOM.btnSimRun) DOM.btnSimRun.disabled = false;
        if (DOM.btnQuickStop) DOM.btnQuickStop.style.display = 'none';
        if (DOM.btnSimStop) DOM.btnSimStop.style.display = 'none';

        DOM.topologyContainer.classList.remove('running');
        setPacketSpeed('norm');

        updateProgress(100, 'Execution completed');
        setTimeout(() => {
            DOM.globalProgressStrip.style.display = 'none';
        }, 2500);
    });

    eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) return;
        logTerminal('System', 'Connection stream terminated or closed.', 'stderr');
        eventSource.close();
        state.eventSource = null;
        state.simulationRunning = false;
        clearInterval(state.throughputTimer);
        DOM.btnQuickRun.disabled = false;
        if (DOM.btnSimRun) DOM.btnSimRun.disabled = false;
        if (DOM.btnQuickStop) DOM.btnQuickStop.style.display = 'none';
        if (DOM.btnSimStop) DOM.btnSimStop.style.display = 'none';
        setEngineStatus('IDLE', '');
        DOM.topologyContainer.classList.remove('running');
        setPacketSpeed('norm');
    };
}

function abortSimulation() {
    fetch('/api/stop', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            logTerminal('System', data.message || 'Abort requested.', 'system');
        })
        .catch(err => console.error('Abort failed:', err));
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Existing Results Initial Fetch
// ─────────────────────────────────────────────────────────────────────────────
async function fetchExistingResults() {
    try {
        const res = await fetch('/api/results');
        const data = await res.json();
        
        if (data.metrics) applyFinalMetrics(data.metrics);
        if (data.liveMetrics) applyLiveMetrics(data.liveMetrics);

        if (data.dataset && data.dataset.length > 0) {
            state.dataset = data.dataset;
            applyDatasetFilters();
            renderMiniDatasetTable();

            // Downsample for charts
            const step = Math.max(1, Math.floor(data.dataset.length / 120));
            const sample = data.dataset.filter((_, i) => i % step === 0).map(r => ({
                timestamp: r.Timestamp || '',
                temp: parseFloat(r.Temperature) || 0,
                humid: parseFloat(r.Humidity) || 0,
                light: parseFloat(r.LightIntensity) || 0,
                fogLatency: parseFloat(r['FogProcessingTime(ms)']) || 0,
                cloudLatency: parseFloat(r['CloudLatency(ms)']) || 0,
                power: parseFloat(r['EnergyConsumption(W)']) || 0,
                fan: r.FanStatus && r.FanStatus.includes('ON') ? 1 : 0,
                led: r.LEDStatus && r.LEDStatus.includes('ON') ? 1 : 0
            }));
            applyChartPoints(sample);

            // Last row actuator toggle
            const last = data.dataset[data.dataset.length - 1];
            if (last) updateActuatorStates(last);

            if (DOM.chartIdleOverlay) DOM.chartIdleOverlay.style.display = 'none';
            setEngineStatus('READY', 'online');
        } else {
            if (DOM.chartIdleOverlay) DOM.chartIdleOverlay.style.display = 'flex';
            setEngineStatus('IDLE', '');
        }
    } catch (err) {
        console.error('fetchExistingResults error:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Metrics Mapping & Display
// ─────────────────────────────────────────────────────────────────────────────
function applyLiveMetrics(m) {
    if (!m) return;
    state.liveMetrics = m;

    if (DOM.valTuples) DOM.valTuples.textContent = m.totalRows ? Number(m.totalRows).toLocaleString() : '--';
    if (DOM.tickerTuples) DOM.tickerTuples.textContent = m.totalRows ? Number(m.totalRows).toLocaleString() : '0';
    if (DOM.valLatency) DOM.valLatency.textContent = m.avgFogLatencyMs || '--';
    if (DOM.tickerLatency) DOM.tickerLatency.textContent = m.avgFogLatencyMs ? `${m.avgFogLatencyMs} ms` : '--';
    if (DOM.valPower) DOM.valPower.textContent = m.avgPowerW || '--';
    if (DOM.tickerPower) DOM.tickerPower.textContent = m.avgPowerW ? `${m.avgPowerW} W` : '--';

    // Actuator Duty Cycle Bars
    const fanPct = parseFloat(m.fanOnPct) || 0;
    const ledPct = parseFloat(m.ledOnPct) || 0;
    if (DOM.barFan) DOM.barFan.style.width = `${fanPct}%`;
    if (DOM.pctFan) DOM.pctFan.textContent = `${fanPct.toFixed(1)}%`;
    if (DOM.barLed) DOM.barLed.style.width = `${ledPct}%`;
    if (DOM.pctLed) DOM.pctLed.textContent = `${ledPct.toFixed(1)}%`;

    // Telemetry Page Stats
    if (DOM.tstatTemp && m.avgTemp) DOM.tstatTemp.textContent = `${m.avgTemp} °C`;
    if (DOM.tstatHumid && m.avgHumidity) DOM.tstatHumid.textContent = `${m.avgHumidity} %`;
    if (DOM.tstatLight && m.avgLight) DOM.tstatLight.textContent = `${m.avgLight} LDR`;
    if (DOM.tstatFogLat && m.avgFogLatencyMs) DOM.tstatFogLat.textContent = `${m.avgFogLatencyMs} ms`;
    if (DOM.tstatCloudLat && m.avgCloudLatencyMs) DOM.tstatCloudLat.textContent = `${m.avgCloudLatencyMs} ms`;
    if (DOM.simStatAnomalies) DOM.simStatAnomalies.textContent = m.anomalyCount || 0;
}

function applyFinalMetrics(m) {
    if (!m) return;
    state.metrics = m;

    if (m.realExecutionTimeMs != null) {
        if (DOM.valExecutionTime) DOM.valExecutionTime.textContent = m.realExecutionTimeMs.toLocaleString();
        if (DOM.simStatRealtime) DOM.simStatRealtime.textContent = `${m.realExecutionTimeMs.toLocaleString()} ms`;
        if (DOM.subExecutionSpeed) {
            const speed = (50005 / (m.realExecutionTimeMs / 1000)).toFixed(0);
            DOM.subExecutionSpeed.textContent = `~${speed}x real-time speedup`;
        }
    }

    if (m.totalTuples != null) {
        if (DOM.valTuples) DOM.valTuples.textContent = m.totalTuples.toLocaleString();
        if (DOM.tickerTuples) DOM.tickerTuples.textContent = m.totalTuples.toLocaleString();
    }

    if (m.avgFogLatencyMs != null) {
        const val = typeof m.avgFogLatencyMs === 'number' ? m.avgFogLatencyMs.toFixed(3) : m.avgFogLatencyMs;
        if (DOM.valLatency) DOM.valLatency.textContent = val;
        if (DOM.tickerLatency) DOM.tickerLatency.textContent = `${val} ms`;
        if (DOM.ftFogLatency) DOM.ftFogLatency.textContent = `${val} ms`;
        if (DOM.tstatFogLat) DOM.tstatFogLat.textContent = `${val} ms`;
    }

    if (m.avgCloudLatencyMs != null) {
        const val = typeof m.avgCloudLatencyMs === 'number' ? m.avgCloudLatencyMs.toFixed(3) : m.avgCloudLatencyMs;
        if (DOM.subCloudLatency) DOM.subCloudLatency.textContent = `vs. ~${val} ms Cloud WAN`;
        if (DOM.tstatCloudLat) DOM.tstatCloudLat.textContent = `${val} ms`;
    }

    if (m.avgFogLatencyMs != null && m.avgCloudLatencyMs != null) {
        const reduction = (((m.avgCloudLatencyMs - m.avgFogLatencyMs) / m.avgCloudLatencyMs) * 100).toFixed(1);
        if (DOM.tstatSpeedup) DOM.tstatSpeedup.textContent = `${reduction}%`;
    }

    if (m.avgPowerW != null) {
        const val = typeof m.avgPowerW === 'number' ? m.avgPowerW.toFixed(2) : m.avgPowerW;
        if (DOM.valPower) DOM.valPower.textContent = val;
        if (DOM.tickerPower) DOM.tickerPower.textContent = `${val} W`;
    }

    if (m.networkUsageKb != null) {
        const val = typeof m.networkUsageKb === 'number' ? m.networkUsageKb.toFixed(1) : m.networkUsageKb;
        if (DOM.valNetworkUsage) DOM.valNetworkUsage.textContent = Number(val).toLocaleString();
    }

    // Energy Breakdowns
    if (m.deviceEnergy) {
        const fogJ = m.deviceEnergy['fog-node'];
        const cloudJ = m.deviceEnergy['cloud'];
        const mcuJ = m.deviceEnergy['nodemcu-controller'];

        if (fogJ) {
            const fmt = formatJoules(fogJ);
            if (DOM.valFogEnergy) DOM.valFogEnergy.textContent = fmt.value;
            if (DOM.nodeFogEnergy) DOM.nodeFogEnergy.textContent = fmt.full;
            if (DOM.ftFogEnergy) DOM.ftFogEnergy.textContent = fmt.full;
            if (DOM.inspEnergy) DOM.inspEnergy.textContent = `${fmt.full} (${fogJ.toLocaleString()} J)`;
        }
        if (cloudJ) {
            const fmt = formatJoules(cloudJ);
            if (DOM.nodeCloudEnergy) DOM.nodeCloudEnergy.textContent = fmt.full;
            if (DOM.ftCloudEnergy) DOM.ftCloudEnergy.textContent = fmt.full;
            if (DOM.subCloudEnergy) DOM.subCloudEnergy.textContent = `Cloud: ${fmt.full}`;
        }
        if (mcuJ) {
            const fmt = formatJoules(mcuJ);
            if (DOM.nodeMcuEnergy) DOM.nodeMcuEnergy.textContent = fmt.full;
            if (DOM.ftMcuEnergy) DOM.ftMcuEnergy.textContent = fmt.full;
        }
    }
}

function formatJoules(joules) {
    if (joules >= 1e6) return { value: (joules / 1e6).toFixed(2), unit: 'MJ', full: (joules / 1e6).toFixed(2) + ' MJ' };
    if (joules >= 1e3) return { value: (joules / 1e3).toFixed(1), unit: 'kJ', full: (joules / 1e3).toFixed(1) + ' kJ' };
    return { value: Number(joules).toFixed(0), unit: 'J', full: Number(joules).toFixed(0) + ' J' };
}

function updateActuatorStates(row) {
    const isFanOn = row.FanStatus && row.FanStatus.includes('ON');
    const isLedOn = row.LEDStatus && row.LEDStatus.includes('ON');

    if (DOM.nodeFan) {
        if (isFanOn) DOM.nodeFan.classList.add('actuator-active-fan');
        else DOM.nodeFan.classList.remove('actuator-active-fan');
    }
    if (DOM.lblFanState) DOM.lblFanState.textContent = isFanOn ? 'ON' : 'OFF';

    if (DOM.nodeLed) {
        if (isLedOn) DOM.nodeLed.classList.add('actuator-active-led');
        else DOM.nodeLed.classList.remove('actuator-active-led');
    }
    if (DOM.lblLedState) DOM.lblLedState.textContent = isLedOn ? 'ON' : 'OFF';
}

function triggerAnomalyAlert(row) {
    if (!DOM.systemAnomalyBanner) return;
    const temp = row.Temperature ? `${parseFloat(row.Temperature).toFixed(1)}°C` : '';
    const light = row.LightIntensity !== undefined ? `${row.LightIntensity} LDR` : '';
    DOM.systemAnomalyDesc.textContent = `Synthetic anomaly at T=${temp}, Light=${light}. Actuator policy reacted with label: ${row.Decision || 'ANOMALY_TRIGGER'}`;
    DOM.systemAnomalyBanner.style.display = 'flex';

    if (DOM.nodeMcuEnergy) {
        const card = document.getElementById('node-mcu');
        if (card) {
            card.style.borderColor = 'var(--status-warning)';
            setTimeout(() => { card.style.borderColor = ''; }, 3000);
        }
    }
}

function resetLiveIndicators() {
    if (DOM.valExecutionTime) DOM.valExecutionTime.textContent = '--';
    if (DOM.valTuples) DOM.valTuples.textContent = '0';
    if (DOM.valLatency) DOM.valLatency.textContent = '--';
    if (DOM.valPower) DOM.valPower.textContent = '--';
    if (DOM.chartIdleOverlay) DOM.chartIdleOverlay.style.display = 'none';
}

function updateProgress(pct, stage) {
    if (DOM.globalProgressBar) DOM.globalProgressBar.style.width = `${pct}%`;
    if (DOM.progressPctLabel) DOM.progressPctLabel.textContent = `${pct}%`;
    if (DOM.progressPhaseTitle && stage) DOM.progressPhaseTitle.textContent = stage;

    if (DOM.simProgressFill) DOM.simProgressFill.style.width = `${pct}%`;
    if (DOM.simStageLabel && stage) DOM.simStageLabel.textContent = stage;
    if (DOM.simRowCount) DOM.simRowCount.textContent = `${Math.round((pct / 100) * 10001).toLocaleString()} / 10,001 Tuples`;
}

function setEngineStatus(text, dotClass) {
    if (DOM.headerStatusText) DOM.headerStatusText.textContent = text;
    if (DOM.headerStatusDot) {
        DOM.headerStatusDot.className = 'status-indicator-dot' + (dotClass ? ' ' + dotClass : '');
    }
    if (DOM.badgeOverviewLive) {
        DOM.badgeOverviewLive.textContent = text;
        DOM.badgeOverviewLive.className = 'nav-badge' + (dotClass === 'running' ? ' live' : '');
    }
    if (DOM.simRunStatusBadge) {
        DOM.simRunStatusBadge.textContent = text;
        DOM.simRunStatusBadge.className = 'badge' + (dotClass ? ' status-' + dotClass : '');
    }
    if (DOM.lblTopologyStatus) {
        DOM.lblTopologyStatus.textContent = text;
        DOM.lblTopologyStatus.className = 'badge' + (dotClass ? ' status-' + dotClass : '');
    }
}

function setPacketSpeed(mode) {
    state.packetSpeed = mode;
    [DOM.btnSpeedNorm, DOM.btnSpeedFast, DOM.btnSpeedPause].forEach(b => b && b.classList.remove('active'));
    
    if (mode === 'fast') {
        if (DOM.btnSpeedFast) DOM.btnSpeedFast.classList.add('active');
        DOM.topologyContainer.classList.add('running');
        DOM.topologyContainer.classList.remove('paused');
    } else if (mode === 'pause') {
        if (DOM.btnSpeedPause) DOM.btnSpeedPause.classList.add('active');
        DOM.topologyContainer.classList.add('paused');
        DOM.topologyContainer.classList.remove('running');
    } else {
        if (DOM.btnSpeedNorm) DOM.btnSpeedNorm.classList.add('active');
        DOM.topologyContainer.classList.remove('running', 'paused');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Node Hardware Inspector (Topology View)
// ─────────────────────────────────────────────────────────────────────────────
const NODE_METADATA = {
    'cloud': {
        name: 'Cloud Datacenter',
        type: 'CloudServer / DatacenterEX',
        mips: '44,800 MIPS',
        ram: '40,000 MB',
        status: 'ONLINE (READY)',
        energy: '65.01 MJ',
        module: 'cloud_history_module',
        desc: 'Centralized cloud analytics datacenter. Serves as long-term historical archive. Consumes CLOUD_SUMMARY_DATA tuples forwarded from the fog gateway.'
    },
    'fog': {
        name: 'Smart Home Fog Gateway',
        type: 'SmartHomeFogDevice',
        mips: '2,800 MIPS',
        ram: '4,000 MB',
        status: 'ONLINE (ACTIVE)',
        energy: '4.21 MJ',
        module: 'fog_processor_module',
        desc: 'Autonomous local edge gateway. Runs DecisionEngine.java classification logic. Consumes AGGREGATED_SENSOR_DATA tuples and issues FAN_COMMAND / LED_COMMAND downstream.'
    },
    'mcu': {
        name: 'NodeMCU ESP8266',
        type: 'FogDevice (Microcontroller)',
        mips: '80 MIPS',
        ram: '4 MB',
        status: 'ONLINE (POLLING)',
        energy: '25.0 kJ',
        module: 'controller_module',
        desc: 'Physical room controller. Dispatches sensor generator probes every 5.0 seconds and triggers hardware GPIO / I2C pins for connected actuators.'
    },
    'sensor': {
        name: 'DHT11 / LDR Peripherals',
        type: 'VirtualSensor Hub',
        mips: 'Embedded Probe',
        ram: 'N/A',
        status: 'EMITTING (5s Period)',
        energy: 'N/A',
        module: 'SensorGenerator.java',
        desc: 'Generates diurnal temperature, humidity, and ambient light intensity values under occupancy influence and synthetic anomaly models.'
    },
    'fan': {
        name: 'Smart Fan Actuator',
        type: 'SmartHomeActuator (80W)',
        mips: 'N/A',
        ram: 'N/A',
        status: 'ACTUATOR READY',
        energy: 'Tracked in System Watts',
        module: 'FAN_ACTUATOR',
        desc: 'High-draw 80W cooling fan. Actuates automatically when indoor temperature exceeds 30.0°C during occupied intervals.'
    },
    'led': {
        name: 'Smart LED Actuator',
        type: 'SmartHomeActuator (10W)',
        mips: 'N/A',
        ram: 'N/A',
        status: 'ACTUATOR READY',
        energy: 'Tracked in System Watts',
        module: 'LED_ACTUATOR',
        desc: 'Low-draw 10W domestic lighting. Triggers automatically when ambient light levels drop below 400 LDR units.'
    }
};

function selectNodeForInspection(nodeId) {
    state.activeNodeId = nodeId;

    // Highlight node card
    document.querySelectorAll('.node-item, .full-node-card').forEach(n => {
        if (n.getAttribute('data-node') === nodeId) {
            n.classList.add('node-selected', 'active-node');
        } else {
            n.classList.remove('node-selected', 'active-node');
        }
    });

    const meta = NODE_METADATA[nodeId] || NODE_METADATA['fog'];
    if (DOM.inspId) DOM.inspId.textContent = nodeId;
    if (DOM.inspType) DOM.inspType.textContent = meta.type;
    if (DOM.inspStatus) DOM.inspStatus.textContent = meta.status;
    if (DOM.inspMips) DOM.inspMips.textContent = meta.mips;
    if (DOM.inspRam) DOM.inspRam.textContent = meta.ram;
    if (DOM.inspModuleName) DOM.inspModuleName.textContent = meta.module;
    if (DOM.inspModuleDesc) DOM.inspModuleDesc.textContent = meta.desc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Chart.js Management & Multi-Chart Workspace
// ─────────────────────────────────────────────────────────────────────────────
function initCharts() {
    const defaultFont = { family: "'Inter', sans-serif", size: 10 };
    const gridColor = 'rgba(255, 255, 255, 0.04)';

    // Global Chart defaults
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font = defaultFont;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.elements.point.radius = 0;
    Chart.defaults.elements.point.hoverRadius = 3;

    // 1. Overview Cockpit Chart
    const ctxOverview = document.getElementById('telemetryChart');
    if (ctxOverview) {
        state.charts.overview = new Chart(ctxOverview.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Temperature (°C)',
                        data: [],
                        borderColor: '#00e5ff',
                        backgroundColor: 'transparent',
                        borderWidth: 1.8,
                        yAxisID: 'y-temp',
                        tension: 0.2
                    },
                    {
                        label: 'Light (LDR)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent',
                        borderWidth: 1.8,
                        yAxisID: 'y-light',
                        tension: 0.2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 400 },
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        grid: { color: gridColor, drawTicks: false },
                        border: { display: false },
                        ticks: { maxTicksLimit: 8 }
                    },
                    'y-temp': {
                        type: 'linear',
                        position: 'left',
                        grid: { color: gridColor, drawTicks: false },
                        border: { display: false },
                        ticks: { callback: v => v + '°' }
                    },
                    'y-light': {
                        type: 'linear',
                        position: 'right',
                        grid: { drawOnChartArea: false, drawTicks: false },
                        border: { display: false }
                    }
                }
            }
        });
    }

    // 2. Telemetry Workspace Chart 1: Temp & Humidity
    const ctxTempHumid = document.getElementById('chart-temp-humid');
    if (ctxTempHumid) {
        state.charts.tempHumid = new Chart(ctxTempHumid.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Temperature (°C)',
                        data: [],
                        borderColor: '#00e5ff',
                        backgroundColor: 'transparent',
                        borderWidth: 1.8,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Humidity (%)',
                        data: [],
                        borderColor: '#34d399',
                        backgroundColor: 'transparent',
                        borderWidth: 1.8,
                        yAxisID: 'y2'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 8 } },
                    y1: { type: 'linear', position: 'left', grid: { color: gridColor } },
                    y2: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } }
                }
            }
        });
    }

    // 3. Telemetry Workspace Chart 2: Latency Comparison
    const ctxLatency = document.getElementById('chart-latency-compare');
    if (ctxLatency) {
        state.charts.latency = new Chart(ctxLatency.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Fog Processing Latency (ms)',
                        data: [],
                        borderColor: '#00e5ff',
                        backgroundColor: 'rgba(0, 229, 255, 0.05)',
                        fill: true,
                        borderWidth: 1.8
                    },
                    {
                        label: 'Cloud WAN Latency (ms)',
                        data: [],
                        borderColor: '#6366f1',
                        backgroundColor: 'transparent',
                        borderWidth: 1.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 8 } },
                    y: { grid: { color: gridColor }, title: { display: true, text: 'Latency (ms)' } }
                }
            }
        });
    }

    // 4. Telemetry Workspace Chart 3: Light & Actuation
    const ctxLight = document.getElementById('chart-light-actuation');
    if (ctxLight) {
        state.charts.light = new Chart(ctxLight.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Ambient Light (LDR)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent',
                        borderWidth: 1.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 8 } },
                    y: { grid: { color: gridColor }, min: 0, max: 1024 }
                }
            }
        });
    }

    // 5. Telemetry Workspace Chart 4: Power Profile
    const ctxPower = document.getElementById('chart-power-profile');
    if (ctxPower) {
        state.charts.power = new Chart(ctxPower.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'System Power Draw (W)',
                        data: [],
                        borderColor: '#f87171',
                        backgroundColor: 'rgba(248, 113, 113, 0.06)',
                        fill: true,
                        borderWidth: 1.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 8 } },
                    y: { grid: { color: gridColor }, min: 0 }
                }
            }
        });
    }
}

function applyChartPoints(points) {
    if (!points || points.length === 0) return;
    const labels = points.map((_, i) => i);

    // Overview chart
    if (state.charts.overview) {
        state.charts.overview.data.labels = labels;
        state.charts.overview.data.datasets[0].data = points.map(p => p.temp);
        state.charts.overview.data.datasets[1].data = points.map(p => p.light);
        state.charts.overview.update('none');
    }

    // Temp & Humid chart
    if (state.charts.tempHumid) {
        state.charts.tempHumid.data.labels = labels;
        state.charts.tempHumid.data.datasets[0].data = points.map(p => p.temp);
        state.charts.tempHumid.data.datasets[1].data = points.map(p => p.humid);
        state.charts.tempHumid.update('none');
    }

    // Latency chart
    if (state.charts.latency) {
        state.charts.latency.data.labels = labels;
        state.charts.latency.data.datasets[0].data = points.map(p => p.fogLatency || 5.67);
        state.charts.latency.data.datasets[1].data = points.map(p => p.cloudLatency || 41.0);
        state.charts.latency.update('none');
    }

    // Light chart
    if (state.charts.light) {
        state.charts.light.data.labels = labels;
        state.charts.light.data.datasets[0].data = points.map(p => p.light);
        state.charts.light.update('none');
    }

    // Power chart
    if (state.charts.power) {
        state.charts.power.data.labels = labels;
        state.charts.power.data.datasets[0].data = points.map(p => p.power || 10.47);
        state.charts.power.update('none');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Dataset Explorer & Filtering
// ─────────────────────────────────────────────────────────────────────────────
function applyDatasetFilters() {
    const q = (DOM.datasetFullSearch ? DOM.datasetFullSearch.value : '').toLowerCase().trim();
    const anomaly = DOM.filterAnomalySelect ? DOM.filterAnomalySelect.value : 'all';
    const occupancy = DOM.filterOccupancySelect ? DOM.filterOccupancySelect.value : 'all';
    const actuator = DOM.filterActuatorSelect ? DOM.filterActuatorSelect.value : 'all';

    state.filteredDataset = state.dataset.filter(r => {
        // Query search
        if (q) {
            const rowStr = `${r.Timestamp || ''} ${r.Temperature || ''} ${r.Humidity || ''} ${r.LightIntensity || ''} ${r.Decision || ''}`.toLowerCase();
            if (!rowStr.includes(q)) return false;
        }

        // Anomaly filter
        if (anomaly === 'true' && !(r.IsAnomaly === true || r.IsAnomaly === 'true')) return false;
        if (anomaly === 'false' && (r.IsAnomaly === true || r.IsAnomaly === 'true')) return false;

        // Occupancy filter
        if (occupancy !== 'all' && String(r.Occupancy) !== occupancy) return false;

        // Actuator filter
        if (actuator === 'fan-on' && !(r.FanStatus && r.FanStatus.includes('ON'))) return false;
        if (actuator === 'led-on' && !(r.LEDStatus && r.LEDStatus.includes('ON'))) return false;
        if (actuator === 'both-on' && !(r.FanStatus && r.FanStatus.includes('ON') && r.LEDStatus && r.LEDStatus.includes('ON'))) return false;
        if (actuator === 'both-off' && (r.FanStatus && r.FanStatus.includes('ON') || (r.LEDStatus && r.LEDStatus.includes('ON')))) return false;

        return true;
    });

    state.currentPage = 1;
    sortAndRenderDataset();
}

function sortAndRenderDataset() {
    const col = state.sortColumn;
    const asc = state.sortAsc;

    state.filteredDataset.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
    });

    renderDatasetTable();
}

function renderDatasetTable() {
    if (!DOM.datasetFullTbody) return;
    DOM.datasetFullTbody.innerHTML = '';

    const total = state.filteredDataset.length;
    if (DOM.datasetFilteredCount) {
        DOM.datasetFilteredCount.textContent = `${total.toLocaleString()} of ${state.dataset.length.toLocaleString()} rows`;
    }
    if (DOM.navDatasetCount) {
        DOM.navDatasetCount.textContent = total > 1000 ? `${(total / 1000).toFixed(0)}k` : total;
    }

    if (total === 0) {
        DOM.datasetFullTbody.innerHTML = '<tr><td colspan="12" class="empty-table">No matching rows found in dataset.</td></tr>';
        if (DOM.fullPageInfo) DOM.fullPageInfo.textContent = 'Page 0 of 0';
        DOM.btnFullPrev.disabled = DOM.btnFullNext.disabled = DOM.btnFirstPage.disabled = DOM.btnLastPage.disabled = true;
        return;
    }

    const totalPages = Math.ceil(total / state.pageSize);
    state.currentPage = Math.min(Math.max(state.currentPage, 1), totalPages);

    DOM.btnFullPrev.disabled = state.currentPage === 1;
    DOM.btnFirstPage.disabled = state.currentPage === 1;
    DOM.btnFullNext.disabled = state.currentPage === totalPages;
    DOM.btnLastPage.disabled = state.currentPage === totalPages;
    if (DOM.fullPageInfo) DOM.fullPageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
    if (DOM.inputPageJump) DOM.inputPageJump.value = state.currentPage;

    const start = (state.currentPage - 1) * state.pageSize;
    const end = Math.min(start + state.pageSize, total);

    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
        const row = state.filteredDataset[i];
        const tr = document.createElement('tr');
        if (row.IsAnomaly === true || row.IsAnomaly === 'true') tr.className = 'anomaly-row';

        const isFanOn = row.FanStatus && row.FanStatus.includes('ON');
        const isLedOn = row.LEDStatus && row.LEDStatus.includes('ON');

        tr.innerHTML = `
            <td class="mono">${row.Timestamp || '--'}</td>
            <td class="mono">${row.Temperature != null ? parseFloat(row.Temperature).toFixed(2) : '--'}</td>
            <td class="mono">${row.Humidity != null ? parseFloat(row.Humidity).toFixed(2) : '--'}</td>
            <td class="mono">${row.LightIntensity != null ? row.LightIntensity : '--'}</td>
            <td><span class="${isFanOn ? 'status-on':'status-off'}">${isFanOn ? 'ON':'OFF'}</span></td>
            <td><span class="${isLedOn ? 'status-on':'status-off'}">${isLedOn ? 'ON':'OFF'}</span></td>
            <td class="mono">${row.Occupancy != null ? row.Occupancy : '--'}</td>
            <td class="mono">${row.Decision || '--'}</td>
            <td class="mono">${row['FogProcessingTime(ms)'] != null ? parseFloat(row['FogProcessingTime(ms)']).toFixed(2) : '--'}</td>
            <td class="mono">${row['CloudLatency(ms)'] != null ? parseFloat(row['CloudLatency(ms)']).toFixed(2) : '--'}</td>
            <td class="mono">${row['EnergyConsumption(W)'] != null ? parseFloat(row['EnergyConsumption(W)']).toFixed(2) : '--'}</td>
            <td class="mono">${row.IsAnomaly === true || row.IsAnomaly === 'true' ? '⚠ TRUE' : 'FALSE'}</td>
        `;
        frag.appendChild(tr);
    }
    DOM.datasetFullTbody.appendChild(frag);
}

function renderMiniDatasetTable() {
    if (!DOM.miniDatasetTbody) return;
    DOM.miniDatasetTbody.innerHTML = '';

    if (DOM.overviewDatasetCount) {
        DOM.overviewDatasetCount.textContent = `${state.dataset.length.toLocaleString()} rows`;
    }

    if (state.dataset.length === 0) {
        DOM.miniDatasetTbody.innerHTML = '<tr><td colspan="7" class="empty-table">No simulation data loaded.</td></tr>';
        return;
    }

    // Show last 6 rows
    const slice = state.dataset.slice(-6);
    const frag = document.createDocumentFragment();
    slice.forEach(row => {
        const tr = document.createElement('tr');
        if (row.IsAnomaly === true || row.IsAnomaly === 'true') tr.className = 'anomaly-row';

        const isFanOn = row.FanStatus && row.FanStatus.includes('ON');
        const isLedOn = row.LEDStatus && row.LEDStatus.includes('ON');

        tr.innerHTML = `
            <td class="mono">${row.Timestamp ? row.Timestamp.slice(11) : '--'}</td>
            <td class="mono">${row.Temperature ? parseFloat(row.Temperature).toFixed(1) + '°' : '--'}</td>
            <td class="mono">${row.Humidity ? parseFloat(row.Humidity).toFixed(0) + '%' : '--'}</td>
            <td class="mono">${row.LightIntensity || '--'}</td>
            <td><span class="${isFanOn ? 'status-on':'status-off'}">${isFanOn ? 'ON':'OFF'}</span></td>
            <td><span class="${isLedOn ? 'status-on':'status-off'}">${isLedOn ? 'ON':'OFF'}</span></td>
            <td class="mono">${row.Decision || '--'}</td>
        `;
        frag.appendChild(tr);
    });
    DOM.miniDatasetTbody.appendChild(frag);
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Experiments History & Comparison Suite
// ─────────────────────────────────────────────────────────────────────────────
async function fetchExperiments() {
    try {
        const res = await fetch('/api/experiments');
        const list = await res.json();
        state.experiments = list;
        renderExperimentsTable();
    } catch (err) {
        console.error('fetchExperiments error:', err);
    }
}

function renderExperimentsTable() {
    if (!DOM.experimentsTbody) return;
    DOM.experimentsTbody.innerHTML = '';

    if (state.experiments.length === 0) {
        DOM.experimentsTbody.innerHTML = '<tr><td colspan="10" class="empty-table">No experiment history available. Run a simulation to log runs.</td></tr>';
        return;
    }

    const frag = document.createDocumentFragment();
    state.experiments.forEach(exp => {
        const tr = document.createElement('tr');
        const isChecked = state.selectedExperiments.has(exp.id);

        tr.innerHTML = `
            <td><input type="checkbox" class="exp-chk" data-exp-id="${exp.id}" ${isChecked ? 'checked' : ''}></td>
            <td class="mono"><strong>${exp.id}</strong></td>
            <td class="mono">${exp.timestamp ? new Date(exp.timestamp).toLocaleString() : '--'}</td>
            <td>${exp.name || exp.mode}</td>
            <td class="mono">${exp.realExecutionTimeMs ? exp.realExecutionTimeMs + ' ms' : '--'}</td>
            <td class="mono">${exp.totalTuples ? exp.totalTuples.toLocaleString() : '--'}</td>
            <td class="mono accent">${exp.avgFogLatencyMs ? exp.avgFogLatencyMs.toFixed(3) + ' ms' : '--'}</td>
            <td class="mono">${exp.avgPowerW ? exp.avgPowerW.toFixed(2) + ' W' : '--'}</td>
            <td class="mono">${exp.energyFogJ ? formatJoules(exp.energyFogJ).full : '--'}</td>
            <td><span class="badge status-finished">${exp.status.toUpperCase()}</span></td>
        `;

        const chk = tr.querySelector('.exp-chk');
        chk.addEventListener('change', (e) => {
            if (e.target.checked) state.selectedExperiments.add(exp.id);
            else state.selectedExperiments.delete(exp.id);
            updateCompareButton();
        });

        frag.appendChild(tr);
    });
    DOM.experimentsTbody.appendChild(frag);
    updateCompareButton();
}

function updateCompareButton() {
    const count = state.selectedExperiments.size;
    if (DOM.btnCompareRuns) {
        DOM.btnCompareRuns.disabled = count !== 2;
        DOM.btnCompareRuns.textContent = `Compare Selected (${count})`;
    }
}

function openExperimentComparison() {
    const ids = Array.from(state.selectedExperiments);
    if (ids.length !== 2) return;

    const expA = state.experiments.find(e => e.id === ids[0]);
    const expB = state.experiments.find(e => e.id === ids[1]);
    if (!expA || !expB) return;

    DOM.compRunAName.textContent = `${expA.id} (${expA.mode})`;
    DOM.compRunBName.textContent = `${expB.id} (${expB.mode})`;

    const latDelta = (expB.avgFogLatencyMs - expA.avgFogLatencyMs).toFixed(3);
    const powerDelta = (expB.avgPowerW - expA.avgPowerW).toFixed(2);
    const timeDelta = expB.realExecutionTimeMs - expA.realExecutionTimeMs;

    DOM.comparisonGrid.innerHTML = `
        <div class="comp-metric-box">
            <span class="cmb-label">Fog Latency Delta</span>
            <div class="cmb-vals">
                <span class="cmb-val">${expA.avgFogLatencyMs.toFixed(2)}ms vs ${expB.avgFogLatencyMs.toFixed(2)}ms</span>
                <span class="cmb-delta ${latDelta <= 0 ? 'better' : 'worse'}">${latDelta > 0 ? '+' : ''}${latDelta} ms</span>
            </div>
        </div>

        <div class="comp-metric-box">
            <span class="cmb-label">System Power Delta</span>
            <div class="cmb-vals">
                <span class="cmb-val">${expA.avgPowerW.toFixed(1)}W vs ${expB.avgPowerW.toFixed(1)}W</span>
                <span class="cmb-delta ${powerDelta <= 0 ? 'better' : 'worse'}">${powerDelta > 0 ? '+' : ''}${powerDelta} W</span>
            </div>
        </div>

        <div class="comp-metric-box">
            <span class="cmb-label">Execution Time Delta</span>
            <div class="cmb-vals">
                <span class="cmb-val">${expA.realExecutionTimeMs}ms vs ${expB.realExecutionTimeMs}ms</span>
                <span class="cmb-delta ${timeDelta <= 0 ? 'better' : 'worse'}">${timeDelta > 0 ? '+' : ''}${timeDelta} ms</span>
            </div>
        </div>

        <div class="comp-metric-box">
            <span class="cmb-label">Anomaly Configuration</span>
            <div class="cmb-vals">
                <span class="cmb-val">${(parseFloat(expA.anomalyChance)*100).toFixed(0)}% vs ${(parseFloat(expB.anomalyChance)*100).toFixed(0)}%</span>
            </div>
        </div>
    `;

    DOM.expComparisonCard.style.display = 'block';
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Terminal Logging Utilities
// ─────────────────────────────────────────────────────────────────────────────
function logTerminal(source, message, type) {
    if (!DOM.simTerminalOutput) return;
    const div = document.createElement('div');
    div.className = `terminal-line ${type}-line`;
    div.setAttribute('data-type', type);
    div.textContent = `[${source}] ${message}`;

    if (state.terminalFilter !== 'all' && state.terminalFilter !== type) {
        div.style.display = 'none';
    }

    DOM.simTerminalOutput.appendChild(div);

    // Limit buffer
    if (DOM.simTerminalOutput.children.length > 500) {
        DOM.simTerminalOutput.removeChild(DOM.simTerminalOutput.firstChild);
    }

    if (state.autoScroll) {
        DOM.simTerminalOutput.scrollTop = DOM.simTerminalOutput.scrollHeight;
    }
}

function applyTerminalFilter() {
    const f = state.terminalFilter;
    const lines = DOM.simTerminalOutput.querySelectorAll('.terminal-line');
    lines.forEach(l => {
        const type = l.getAttribute('data-type');
        if (f === 'all' || f === type) l.style.display = '';
        else l.style.display = 'none';
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Audio Completion Chime
// ─────────────────────────────────────────────────────────────────────────────
function playCompletionSound() {
    const chk = document.getElementById('setting-sound-alert');
    if (chk && !chk.checked) return;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
        // AudioContext blocked or not supported
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. Helper Utilities
// ─────────────────────────────────────────────────────────────────────────────
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
