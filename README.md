# AI-Based Predictive Smart Home Automation Using Fog Computing

This research-level simulation project uses **iFogSim2** and **CloudSim** to model a smart home network. Virtual sensors generate realistic environmental telemetry (temperature, humidity, light, occupancy) and a Fog Node executes a local decision engine to control smart actuators (Fan & LED), logging high-fidelity datasets suitable for training AI/ML models.

---

## Prerequisites
* **Java Development Kit (JDK) 21** or higher.
* The project includes a pre-packaged Maven distribution inside `./maven/apache-maven-3.9.6/`.

---

## How to Run the Simulation

To compile the codebase and run the smart home simulation, execute the following command in your terminal from the project root directory (`d:\ECS`):

### Windows (PowerShell)
```powershell
.\maven\apache-maven-3.9.6\bin\mvn.cmd clean compile exec:java "-Dexec.mainClass=com.smarthome.MainSimulation"
```

### Windows (Command Prompt)
```cmd
maven\apache-maven-3.9.6\bin\mvn.cmd clean compile exec:java "-Dexec.mainClass=com.smarthome.MainSimulation"
```

---

## Simulation Outputs

Upon successful execution, the simulation generates the following files in the project root:

1. **`SmartHomeDataset.csv`**
   * High-fidelity dataset containing ~10,000 sensor readings and decisions.
   * **Fields**: `Timestamp`, `Temperature (°C)`, `Humidity (%)`, `LightIntensity (LDR)`, `FanStatus`, `LEDStatus`, `FogProcessingLatency (ms)`, `CloudLatency (ms)`, `PowerConsumption (W)`, `DecisionLabel`, `Occupancy`, `DayOfWeek`, `IsWeekend`, `IsAnomaly`.
   * *Ideal for training downstream Machine Learning classifiers (e.g., predicting actuator states).*

2. **`PerformanceReport.txt`**
   * Human-readable report detailing simulation run metrics, device energy consumption, network usage, and latency statistics.

3. **`SimulationLog.txt`**
   * Detailed internal runtime execution events captured from CloudSim.

---

## System Topology & Architecture

* **Level 0: Cloud Datacenter (`cloud`)**
  * Handles long-term historical storage and archives telemetry logs sent up from the gateway.
* **Level 1: Fog Node Gateway (`fog-node`)**
  * Executes the local `DecisionEngine` and logs sensor values to the CSV dataset.
* **Level 2: Edge Controller (`nodemcu-controller`)**
  * Models a NodeMCU ESP8266 acting as a local sensor hub and command dispatcher for actuators.
* **Actuators & Sensors:**
  * **`Telemetry-Sensor`**: Generates diurnal readings every 5 simulated seconds.
  * **`FAN_ACTUATOR` & `LED_ACTUATOR`**: Receive automation command tuples from the Fog Node.
