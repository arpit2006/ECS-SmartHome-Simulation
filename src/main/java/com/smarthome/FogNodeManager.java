package com.smarthome;

import org.cloudbus.cloudsim.Host;
import org.cloudbus.cloudsim.Pe;
import org.cloudbus.cloudsim.Storage;
import org.cloudbus.cloudsim.power.PowerHost;
import org.cloudbus.cloudsim.provisioners.RamProvisionerSimple;
import org.cloudbus.cloudsim.sdn.overbooking.BwProvisionerOverbooking;
import org.cloudbus.cloudsim.sdn.overbooking.PeProvisionerOverbooking;
import org.fog.entities.Actuator;
import org.fog.entities.FogDevice;
import org.fog.entities.FogDeviceCharacteristics;
import org.fog.entities.Sensor;
import org.fog.policy.AppModuleAllocationPolicy;
import org.fog.scheduler.StreamOperatorScheduler;
import org.fog.utils.FogLinearPowerModel;
import org.fog.utils.FogUtils;
import org.fog.utils.GeoLocation;
import org.fog.utils.distribution.DeterministicDistribution;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

/**
 * Manages physical device topologies in iFogSim2.
 *
 * Design note on device types:
 * - The CLOUD and NODEMCU are plain {@link FogDevice}s so the vanilla iFogSim2
 *   executeTuple / processCloudletSubmit pipeline runs without modification.
 * - The FOG NODE is the ONLY {@link SmartHomeFogDevice}.  It overrides
 *   executeTuple to intercept sensor telemetry, run the DecisionEngine, log to
 *   CSV, and dispatch actuator/cloud-summary commands.  Keeping the override
 *   isolated to this one device avoids NPEs in processCloudletSubmit for all
 *   other nodes.
 */
public class FogNodeManager {

    private final List<FogDevice> fogDevices;
    private final List<Sensor>    sensors;
    private final List<Actuator>  actuators;

    public FogNodeManager() {
        this.fogDevices = new ArrayList<>();
        this.sensors    = new ArrayList<>();
        this.actuators  = new ArrayList<>();
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Builds the complete physical topology and returns the list of devices.
     */
    public List<FogDevice> createTopology(int brokerId, String appId,
                                          CSVLogger csvLogger, Statistics stats,
                                          EnergyCalculator energyCalculator,
                                          SensorGenerator generator) throws Exception {

        // 1. Cloud Datacenter (Level 0) — plain FogDevice
        FogDevice cloud = createPlainFogDevice(
                Constants.CLOUD_NAME,
                Constants.MIPS_CLOUD, Constants.RAM_CLOUD,
                10000, 10000,
                0, 0.01,
                1600.0, 1300.0
        );
        cloud.setParentId(-1);
        fogDevices.add(cloud);
        System.out.println("Creating cloud on device cloud");

        // 2. Fog Node (Level 1) — SmartHomeFogDevice (custom executeTuple)
        SmartHomeFogDevice fogNode = createSmartFogDevice(
                Constants.FOG_NODE_NAME,
                Constants.MIPS_FOG, Constants.RAM_FOG,
                10000, 10000,
                1, 0.0,
                107.339, 83.4333,
                csvLogger, stats, energyCalculator
        );
        fogNode.setParentId(cloud.getId());
        fogNode.setUplinkLatency(Constants.LATENCY_FOG_TO_CLOUD);
        fogDevices.add(fogNode);
        System.out.println("Creating fog-node (SmartHomeFogDevice)");

        // 3. NodeMCU ESP8266 controller (Level 2) — plain FogDevice
        FogDevice nodeMcu = createPlainFogDevice(
                Constants.CONTROLLER_NAME,
                Constants.MIPS_NODEMCU, Constants.RAM_NODEMCU,
                10000, 10000,
                2, 0.0,
                0.5, 0.1
        );
        nodeMcu.setParentId(fogNode.getId());
        nodeMcu.setUplinkLatency(Constants.LATENCY_CONTROLLER_TO_FOG);
        fogDevices.add(nodeMcu);
        System.out.println("Creating nodemcu-controller on device nodemcu-controller");

        // 4. Actuators (connected to NodeMCU)
        Actuator fanActuator = new Actuator(
                Constants.ACTUATOR_FAN, brokerId, appId, Constants.ACTUATOR_FAN);
        fanActuator.setGatewayDeviceId(nodeMcu.getId());
        fanActuator.setLatency(1.0);
        actuators.add(fanActuator);

        Actuator ledActuator = new Actuator(
                Constants.ACTUATOR_LED, brokerId, appId, Constants.ACTUATOR_LED);
        ledActuator.setGatewayDeviceId(nodeMcu.getId());
        ledActuator.setLatency(1.0);
        actuators.add(ledActuator);

        // 5. Combined SmartHomeSensor (connected to NodeMCU)
        SmartHomeSensor telemetrySensor = new SmartHomeSensor(
                "Telemetry-Sensor",
                brokerId, appId,
                nodeMcu.getId(),
                1.0,
                new GeoLocation(0, 0),
                new DeterministicDistribution(Constants.SENSOR_INTERVAL),
                Constants.TUPLE_TYPE_AGGREGATED,
                Constants.MODULE_FOG_PROCESSOR,
                generator, stats
        );
        sensors.add(telemetrySensor);

        return fogDevices;
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    public List<FogDevice> getFogDevices() { return fogDevices; }
    public List<Sensor>    getSensors()     { return sensors;    }
    public List<Actuator>  getActuators()   { return actuators;  }

    // -------------------------------------------------------------------------
    // Factory helpers
    // -------------------------------------------------------------------------

    /**
     * Creates a vanilla {@link FogDevice} (cloud / edge-device nodes that do
     * not need custom tuple-processing logic).
     */
    private FogDevice createPlainFogDevice(String name, long mips, int ram,
                                           long upBw, long downBw,
                                           int level, double ratePerMips,
                                           double busyPower, double idlePower)
            throws Exception {

        FogDeviceCharacteristics characteristics = buildCharacteristics(
                mips, ram, busyPower, idlePower);

        List<Host> hostList = characteristics.getHostList();

        FogDevice device = new FogDevice(
                name, characteristics,
                new AppModuleAllocationPolicy(hostList),
                new LinkedList<>(),
                10.0, upBw, downBw, 0.0, ratePerMips);

        device.setLevel(level);
        return device;
    }

    /**
     * Creates a {@link SmartHomeFogDevice} that intercepts tuple execution to
     * run the DecisionEngine, log telemetry, and dispatch actuator commands.
     * Only the Fog Node should be created this way.
     */
    private SmartHomeFogDevice createSmartFogDevice(String name, long mips, int ram,
                                                     long upBw, long downBw,
                                                     int level, double ratePerMips,
                                                     double busyPower, double idlePower,
                                                     CSVLogger csvLogger, Statistics stats,
                                                     EnergyCalculator energyCalculator)
            throws Exception {

        FogDeviceCharacteristics characteristics = buildCharacteristics(
                mips, ram, busyPower, idlePower);

        List<Host> hostList = characteristics.getHostList();

        SmartHomeFogDevice device = new SmartHomeFogDevice(
                name, characteristics,
                new AppModuleAllocationPolicy(hostList),
                new LinkedList<>(),
                10.0, upBw, downBw, 0.0, ratePerMips,
                csvLogger, stats, energyCalculator);

        device.setLevel(level);
        return device;
    }

    /**
     * Shared helper: builds a {@link FogDeviceCharacteristics} with a single
     * PowerHost backed by one PE at the given MIPS.
     */
    private FogDeviceCharacteristics buildCharacteristics(long mips, int ram,
                                                          double busyPower,
                                                          double idlePower) {
        List<Pe> peList = new ArrayList<>();
        peList.add(new Pe(0, new PeProvisionerOverbooking(mips)));

        int    hostId   = FogUtils.generateEntityId();
        long   storage  = 1_000_000L;
        int    bw       = 10_000;

        PowerHost host = new PowerHost(
                hostId,
                new RamProvisionerSimple(ram),
                new BwProvisionerOverbooking(bw),
                storage,
                peList,
                new StreamOperatorScheduler(peList),
                new FogLinearPowerModel(busyPower, idlePower)
        );

        List<Host> hostList = new ArrayList<>();
        hostList.add(host);

        return new FogDeviceCharacteristics(
                "x86", "Linux", "Xen", host,
                10.0, 3.0, 0.05, 0.001, 0.0);
    }
}
