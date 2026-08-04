# 📚 ECS Smart Home Simulation — Study Guide

> **Project:** AI-Based Predictive Smart Home Automation Using Fog Computing  
> **Stack:** Java (iFogSim2 + CloudSim) · Node.js (Express) · HTML/CSS/JS  
> **Goal:** Learn this codebase from zero — understand every file, every concept, and how it all connects.

---

## 🗺️ How to Use This Guide

1. **Follow the order.** Each section builds on the last.
2. **Don't just read — run it.** Open the file, read the code, then answer the questions at the end of each section.
3. **Use the webapp.** Run `node webapp/server.js` → open `http://localhost:3000` to see the simulation live.
4. **Mark your progress.** Use `[ ]` → `[x]` as you complete each topic.

---

## 📁 Project File Map

```
ECS/
├── src/main/java/com/smarthome/
│   ├── MainSimulation.java        ← Entry point — simulation bootstrap
│   ├── Constants.java             ← All config values in one place
│   ├── FogNodeManager.java        ← Creates the physical device topology
│   ├── SmartHomeFogDevice.java    ← Custom fog node with AI decision logic
│   ├── SmartHomeSensor.java       ← Sensor that emits tuples every 5 seconds
│   ├── SmartHomeTuple.java        ← Extended tuple carrying sensor readings
│   ├── DecisionEngine.java        ← IF/THEN AI rules for fan & LED control
│   ├── SensorGenerator.java       ← Generates synthetic temperature/humidity/light
│   ├── EnergyCalculator.java      ← Calculates power consumption per tick
│   ├── CSVLogger.java             ← Writes dataset rows to SmartHomeDataset.csv
│   ├── Statistics.java            ← Collects & saves the PerformanceReport.txt
│   └── VirtualSensor.java         ← Low-level sensor value generator
│
├── webapp/
│   ├── server.js                  ← Express backend (runs simulation, serves API)
│   └── public/
│       └── index.html             ← Dashboard UI (charts, live logs, metrics)
│
├── SmartHomeDataset.csv           ← Output: 10,000+ rows of telemetry
├── PerformanceReport.txt          ← Output: final performance summary
├── SimulationLog.txt              ← Output: raw CloudSim logs
├── pom.xml                        ← Maven build config
└── topologies/                    ← (reference topology diagrams)
```

---

## 🧱 Section 1 — Constants.java (Start Here)

**File:** `src/main/java/com/smarthome/Constants.java`

This is the easiest file. It has no logic — only configuration values. Read it first to understand the system's parameters.

### What to understand:

| Constant | Value | What it means |
|---|---|---|
| `SIMULATION_TIME` | 50,005 seconds | Simulated clock runs for ~13.9 hours |
| `SENSOR_INTERVAL` | 5.0 seconds | A sensor reading fires every 5 simulated seconds |
| `MIPS_CLOUD` | 44,800 | Cloud server is ~560× more powerful than NodeMCU |
| `MIPS_NODEMCU` | 80 | ESP8266 micro-controller — very low power |
| `LATENCY_FOG_TO_CLOUD` | 40 ms | WAN delay from fog gateway to cloud |
| `LATENCY_CONTROLLER_TO_FOG` | 2 ms | Local LAN — very fast |
| `RAM_NODEMCU` | 4 MB | NodeMCU has almost no memory |

### Why 10,000 rows?
- `50,005 sec ÷ 5 sec/row = 10,001 rows` ✓

### Concept questions:
- [ ] What is a MIPS rating? Why does the cloud have so many more MIPS than the NodeMCU?
- [ ] Why is fog-to-cloud latency 20× higher than controller-to-fog?
- [ ] What do the `TUPLE_TYPE_*` constants represent?

---

## 🌐 Section 2 — System Architecture (The Big Picture)

Before reading more code, understand the 3-tier architecture this project simulates:

```
[Sensors] ──► [NodeMCU ESP8266] ──(2ms LAN)──► [Fog Node] ──(40ms WAN)──► [Cloud]
                 (controller_module)              (fog_processor_module)   (cloud_history_module)
                      80 MIPS / 4 MB RAM             2800 MIPS / 4 GB           44800 MIPS / 40 GB

                    ▲ Physical Level 2              ▲ Level 1                   ▲ Level 0
                    
[FAN_ACTUATOR]  ◄── fog node sends commands back DOWN to actuators
[LED_ACTUATOR]  ◄──
```

### Data flow (trace this carefully):
```
1. SensorGenerator generates temp/humidity/light values
2. SmartHomeSensor wraps them in a SmartHomeTuple
3. Tuple travels UP: NodeMCU → Fog Node (type: AGGREGATED_SENSOR_DATA)
4. SmartHomeFogDevice.executeTuple() intercepts the tuple
5. DecisionEngine evaluates IF rules → decides FAN_ON/OFF, LED_ON/OFF
6. CSVLogger writes the row to SmartHomeDataset.csv
7. Commands travel DOWN as FAN_COMMAND / LED_COMMAND tuples
8. Summary travels UP as CLOUD_SUMMARY_DATA to cloud module
```

### Concept questions:
- [ ] Why is processing done at the **fog node** instead of sending everything to the cloud?
- [ ] What is the advantage of fog computing over pure cloud computing for smart homes?
- [ ] What is a "tuple" in iFogSim2? How is it different from a message?

---

## 🏭 Section 3 — FogNodeManager.java (Topology Builder)

**File:** `src/main/java/com/smarthome/FogNodeManager.java`

This file creates the **physical devices** in the simulation.

### What it does:
1. Creates a **cloud** device (plain `FogDevice`) — Level 0, no custom logic
2. Creates a **fog node** (`SmartHomeFogDevice`) — Level 1, has custom tuple processing
3. Creates a **NodeMCU** controller (`FogDevice`) — Level 2, just forwards tuples
4. Creates **2 actuators** (Fan, LED) — attached to NodeMCU
5. Creates **1 combined sensor** (`SmartHomeSensor`) — emits every 5 seconds

### Key design decision (read the Javadoc):
> Only the fog node is a `SmartHomeFogDevice`. The cloud and NodeMCU are plain `FogDevice`s. This avoids NPE errors in `processCloudletSubmit` for nodes that don't need custom logic.

### Key method: `buildCharacteristics()`
This creates a `FogDeviceCharacteristics` object which defines the hardware:
- `Pe` (Processing Element) = a virtual CPU core
- `PowerHost` = a host with a power consumption model
- `FogLinearPowerModel(busyPower, idlePower)` = power scales linearly with CPU load

### Concept questions:
- [ ] What does `setParentId()` do? What does the hierarchy mean?
- [ ] What does `setUplinkLatency()` control?
- [ ] Why does the fog node use `SmartHomeFogDevice` while the cloud does not?
- [ ] What is `AppModuleAllocationPolicy`?

---

## 🧠 Section 4 — DecisionEngine.java (The "AI")

**File:** `src/main/java/com/smarthome/DecisionEngine.java`

This is the core decision-making logic. It's simple IF/THEN rules — **not machine learning** — but represents rule-based AI for automation.

### Rules to understand:
```
Temperature > threshold  →  FAN ON
Temperature ≤ threshold  →  FAN OFF

Light < threshold        →  LED ON
Light ≥ threshold        →  LED OFF
```

### What to look for in the code:
- What thresholds are used for temperature and light?
- What are the return types? (String labels like `FAN_ON`, `LED_OFF`)
- How does it handle edge cases?

### Concept questions:
- [ ] Why is rule-based AI used here instead of ML?
- [ ] What would you need to change to make the LED turn on based on time of day instead?
- [ ] Is the decision engine stateless or stateful? (Does it remember previous decisions?)

---

## 🔧 Section 5 — SmartHomeFogDevice.java (Custom Fog Node)

**File:** `src/main/java/com/smarthome/SmartHomeFogDevice.java`

This is the most important Java file. It **overrides** iFogSim2's `executeTuple()` method to inject custom logic.

### What happens when a tuple arrives:
```java
@Override
protected void executeTuple(SimEvent ev, String moduleName) {
    // 1. Check if it's our sensor tuple (AGGREGATED_SENSOR_DATA)
    // 2. Cast to SmartHomeTuple to extract sensor values
    // 3. Call DecisionEngine.decide() → get fan/LED decision
    // 4. Calculate energy usage with EnergyCalculator
    // 5. Log the row to CSV with CSVLogger
    // 6. Update Statistics
    // 7. Call super.executeTuple() to continue normal iFogSim2 processing
}
```

### Concept questions:
- [ ] What is `SimEvent`? What does it carry?
- [ ] Why do we call `super.executeTuple()` at the end?
- [ ] What would happen if we called `super.executeTuple()` first before our logic?
- [ ] What is the risk of doing heavy I/O (CSV writes) inside `executeTuple()`?

---

## 📡 Section 6 — SmartHomeSensor.java & SmartHomeTuple.java

**Files:** `SmartHomeSensor.java`, `SmartHomeTuple.java`, `VirtualSensor.java`

### SmartHomeTuple:
Extends iFogSim2's `Tuple` class to carry extra fields:
- `temperature`, `humidity`, `lightIntensity`
- These are attached to the tuple payload so the fog node can read them

### SmartHomeSensor:
Extends iFogSim2's `Sensor` class. Overrides `transmit()` to:
1. Ask `SensorGenerator` for current readings
2. Create a `SmartHomeTuple` with those readings
3. Send the tuple upstream every `SENSOR_INTERVAL` seconds

### VirtualSensor:
Generates realistic-looking synthetic values using formulas:
- Temperature oscillates like a sine wave (day/night cycle)
- Humidity is inversely correlated with temperature
- Light follows a day cycle (dark at night, bright at noon)

### Concept questions:
- [ ] Why extend `Tuple` instead of just using the base class?
- [ ] How does the sensor schedule itself to fire every 5 seconds?
- [ ] What is `DeterministicDistribution`? Why use it instead of random intervals?

---

## 📊 Section 7 — CSVLogger.java & Statistics.java

**Files:** `CSVLogger.java`, `Statistics.java`

### CSVLogger:
- Opens `SmartHomeDataset.csv` at simulation start
- Writes one row per sensor reading with: timestamp, temp, humidity, light, fan status, LED status, fog latency, cloud latency, energy
- Must be **thread-safe** because iFogSim2 events fire in simulation threads

### Statistics:
- Accumulates running totals (sum of latency, count of tuples, etc.)
- Calculates averages and min/max
- On shutdown → calls `printAndSaveReport()` to write `PerformanceReport.txt`

### Why the shutdown hook matters:
iFogSim2 calls `System.exit(0)` when the simulation ends. Without a **JVM shutdown hook**, the statistics would never be saved. The hook in `MainSimulation.java` ensures stats are flushed before the process dies.

### Concept questions:
- [ ] What is a JVM shutdown hook? How does it work?
- [ ] What data is in each CSV row? (Look at the CSV headers)
- [ ] What is the difference between `PrintWriter` and `FileWriter`?

---

## 🔌 Section 8 — MainSimulation.java (Putting It All Together)

**File:** `src/main/java/com/smarthome/MainSimulation.java`

This is the **entry point**. Follow the 10-step bootstrap sequence:

```
1.  Initialize dual-stream logging (console + file simultaneously)
2.  Create CSVLogger, Statistics, EnergyCalculator, SensorGenerator
3.  Register JVM shutdown hook (saves stats before System.exit)
4.  CloudSim.init() — start the simulation engine
5.  Create FogBroker — manages application deployment
6.  Set Config.MAX_SIMULATION_TIME — tells iFogSim2 when to stop
7.  FogNodeManager.createTopology() — build the physical network
8.  createSmartHomeApplication() — define the data-flow application
9.  Controller.submitApplication() — deploy modules to devices
10. CloudSim.startSimulation() — run the clock
```

### Application model (`createSmartHomeApplication()`):
```
AppModule: controller_module   → on NodeMCU
AppModule: fog_processor_module → on Fog Node
AppModule: cloud_history_module → on Cloud

AppEdge (SENSOR): AGGREGATED_SENSOR_DATA → fog_processor_module (UP)
AppEdge (ACTUATOR): fog_processor_module → FAN_ACTUATOR (DOWN)
AppEdge (ACTUATOR): fog_processor_module → LED_ACTUATOR (DOWN)
AppEdge (MODULE): fog_processor_module → cloud_history_module (UP)

AppLoop: sensor_data → fog_processor → FAN_ACTUATOR (for latency tracking)
AppLoop: sensor_data → fog_processor → LED_ACTUATOR (for latency tracking)
```

### `DualStream` inner class:
Wraps two `OutputStream`s and writes to both simultaneously. This is how every `System.out.println()` appears both in the terminal AND in `SimulationLog.txt`.

### Concept questions:
- [ ] What is `FogBroker`? What would happen without one?
- [ ] What is `ModuleMapping`? Why do we need to explicitly say which module runs on which device?
- [ ] What is `FractionalSelectivity(1.0)`? What would `0.5` mean?
- [ ] What does `AppLoop` track? How is it used for performance measurement?

---

## 🌐 Section 9 — webapp/server.js (The Web Backend)

**File:** `webapp/server.js`

Express.js backend with 2 main routes and 3 helpers.

### Routes:

| Route | Type | Purpose |
|---|---|---|
| `GET /api/run` | SSE Stream | Spawns Maven, streams live logs & data |
| `GET /api/results` | JSON | Returns saved results on page load |

### Server-Sent Events (SSE):
The `/api/run` route uses SSE (not WebSocket) to stream real-time data:
- Sets `Content-Type: text/event-stream`
- Calls `res.write()` repeatedly without closing the connection
- Each event has a name + JSON data payload

### Event types sent:
```
status       → "started" / "finished" / "failed"
stdout       → live simulation log lines
stderr       → Maven compiler output
live-update  → metrics + chart data every 2 seconds
final-update → complete dataset + report metrics at the end
done         → signals stream is over
```

### Live polling mechanism:
Every 2 seconds, the server reads `SmartHomeDataset.csv` from disk, counts rows, and if new rows appeared, pushes a `live-update` event. This is simpler than tailing the file but slightly inefficient.

### Helper functions:
- `readCSVSync()` — fast synchronous CSV reader
- `computeLiveMetrics()` — computes averages/percentages from CSV rows
- `parsePerformanceReport()` — regex-extracts numbers from the text report
- `readLastLines()` — reads the last N lines of a file

### Concept questions:
- [ ] What is the difference between SSE and WebSockets? When would you use each?
- [ ] Why does the server poll the CSV file instead of using a file watcher (`fs.watch`)?
- [ ] What does `child_process.spawn()` do? How is it different from `exec()`?
- [ ] What is `res.flushHeaders()`? Why is it needed for SSE?

---

## 🖥️ Section 10 — Maven Build (pom.xml)

**File:** `pom.xml`

Maven is the build tool for the Java project. Key concepts:

### Key sections:
```xml
<dependencies>    → iFogSim2 JAR (local), CloudSim, Apache Commons
<build>           → exec:java plugin (runs MainSimulation)
<repositories>    → points to local /jars directory for iFogSim2
```

### How the webapp triggers the build:
```
server.js → spawn('mvn.cmd', ['clean', 'compile', 'exec:java', ...])
         → Maven compiles Java → runs MainSimulation → produces CSV/reports
```

### Concept questions:
- [ ] What does `mvn clean compile exec:java` do step by step?
- [ ] Why is iFogSim2 in a local `/jars` folder instead of Maven Central?
- [ ] What is `exec.mainClass`? Why do we pass it as a `-D` argument?

---

## 🔄 Section 11 — End-to-End Flow (Everything Together)

Trace a single sensor reading all the way through the system:

```
1. [SensorGenerator]     → generates: temp=28.5, humidity=62, light=450
2. [SmartHomeSensor]     → creates SmartHomeTuple with these values
3. [iFogSim2 clock]      → fires transmit() at simTime=5.0
4. [Tuple routing]       → travels UP from NodeMCU to Fog Node
5. [SmartHomeFogDevice]  → executeTuple() fires
6. [DecisionEngine]      → temp>26 → FAN_ON; light>300 → LED_OFF
7. [EnergyCalculator]    → FAN_ON consumes 80W
8. [CSVLogger]           → writes CSV row: 5.0, 28.5, 62, 450, FAN_ON, LED_OFF, 2.1ms, 40.3ms, 80.0W
9. [Statistics]          → updates running totals
10.[iFogSim2 routing]    → FAN_COMMAND tuple travels DOWN to FAN_ACTUATOR
11.[iFogSim2 routing]    → CLOUD_SUMMARY_DATA travels UP to Cloud
12.[server.js polling]   → reads CSV, sees new row, pushes live-update SSE
13.[index.html chart]    → receives SSE, updates temperature chart
```

---

## 📝 Study Checklist

### Week 1 — Understand the foundations
- [ ] Read Constants.java, understand all values
- [ ] Draw the 3-tier architecture on paper
- [ ] Read FogNodeManager.java, understand device creation
- [ ] Read DecisionEngine.java, understand the IF rules

### Week 2 — Understand the simulation engine
- [ ] Read SmartHomeTuple + SmartHomeSensor, understand data flow
- [ ] Read SmartHomeFogDevice, understand executeTuple override
- [ ] Read MainSimulation, trace the 10-step bootstrap
- [ ] Run the simulation, observe the CSV being generated

### Week 3 — Understand the web layer
- [ ] Read server.js, understand SSE streaming
- [ ] Open browser DevTools → Network tab → watch SSE events arrive
- [ ] Read index.html (or public/ folder), understand how charts update
- [ ] Modify a threshold in DecisionEngine and re-run, observe CSV changes

### Week 4 — Go deeper
- [ ] Research: What is CloudSim? What problem does it solve?
- [ ] Research: What is iFogSim2? How does it extend CloudSim?
- [ ] Research: What is Fog Computing vs Edge Computing vs Cloud Computing?
- [ ] Research: What are real-world IoT protocols (MQTT, CoAP)?

---

## 💡 Key Concepts Glossary

| Term | Definition |
|---|---|
| **Fog Computing** | Processing data close to the source (edge), not in a distant cloud |
| **Tuple** | A unit of data/work in iFogSim2, like a network packet with a CPU cost |
| **AppEdge** | Defines which module a tuple type flows between |
| **AppLoop** | Tracks end-to-end latency between two points in the data flow |
| **ModuleMapping** | Specifies which software module runs on which physical device |
| **FogBroker** | The CloudSim entity that owns the application and manages its lifecycle |
| **MIPS** | Millions of Instructions Per Second — a measure of CPU power |
| **SSE** | Server-Sent Events — one-way real-time push from server to browser |
| **FractionalSelectivity** | Probability that processing an input tuple generates an output tuple |
| **DeterministicDistribution** | Fires events at a fixed interval (no randomness) |
| **PE (Processing Element)** | A virtual CPU core in CloudSim |
| **JVM Shutdown Hook** | Code that runs when the JVM exits, even via System.exit() |

---

## ❓ Common Interview Questions About This Project

1. **"Explain fog computing and why you used it."**  
   → Reduces latency by processing locally, reduces bandwidth by not sending all data to cloud.

2. **"What is iFogSim2?"**  
   → A Java simulation toolkit built on CloudSim for modeling fog/IoT environments.

3. **"How does your AI decision engine work?"**  
   → Rule-based IF/THEN logic using sensor thresholds. Simple but interpretable.

4. **"How does the web dashboard get real-time updates?"**  
   → SSE (Server-Sent Events) from an Express backend that polls the CSV file every 2 seconds.

5. **"What metrics does your simulation produce?"**  
   → Fog latency, cloud latency, energy consumption, network usage, actuator activation rates.

6. **"How would you scale this to 100 homes?"**  
   → Add more NodeMCU/Fog instances in the topology, scale the fog node horizontally, use a message queue instead of direct CSV polling.

---

*Last updated: 2026-08-04 · Study this file alongside the source code, not instead of it.*
