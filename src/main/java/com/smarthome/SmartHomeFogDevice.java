package com.smarthome;

import org.cloudbus.cloudsim.Storage;
import org.cloudbus.cloudsim.VmAllocationPolicy;
import org.cloudbus.cloudsim.core.CloudSim;
import org.cloudbus.cloudsim.core.SimEvent;
import org.cloudbus.cloudsim.power.models.PowerModel;
import org.fog.entities.FogDevice;
import org.fog.entities.FogDeviceCharacteristics;
import org.fog.entities.Tuple;
import org.fog.utils.FogEvents;
import org.fog.utils.FogUtils;
import org.cloudbus.cloudsim.UtilizationModelFull;

import java.util.List;
import java.util.Random;

/**
 * A custom FogDevice representing the physical Fog Node and Cloud datacenters.
 * Overrides executeTuple to capture SmartHome telemetry, invoke the DecisionEngine,
 * update the Energy model, log to CSV, and dispatch command/summary tuples.
 */
public class SmartHomeFogDevice extends FogDevice {

    private final CSVLogger csvLogger;
    private final Statistics stats;
    private final EnergyCalculator energyCalculator;
    private final Random random;

    /**
     * Constructor using full specifications.
     */
    public SmartHomeFogDevice(String name, FogDeviceCharacteristics characteristics,
                              VmAllocationPolicy vmAllocationPolicy, List<Storage> storageList,
                              double schedulingInterval, double uplinkBandwidth, double downlinkBandwidth,
                              double uplinkLatency, double ratePerMips,
                              CSVLogger csvLogger, Statistics stats, EnergyCalculator energyCalculator) throws Exception {
        super(name, characteristics, vmAllocationPolicy, storageList, schedulingInterval,
              uplinkBandwidth, downlinkBandwidth, uplinkLatency, ratePerMips);
        this.csvLogger = csvLogger;
        this.stats = stats;
        this.energyCalculator = energyCalculator;
        this.random = new Random();
    }

    /**
     * Overrides executeTuple to intercept execution events.
     */
    @Override
    protected void executeTuple(SimEvent ev, String moduleName) {
        Tuple tuple = (Tuple) ev.getData();

        // 1. If this is the Fog Node executing a sensor telemetry tuple
        if (tuple instanceof SmartHomeTuple && getName().equalsIgnoreCase(Constants.FOG_NODE_NAME)) {
            SmartHomeTuple shTuple = (SmartHomeTuple) tuple;

            // Extract sensor readings
            double temp = shTuple.getTemperature();
            int light = shTuple.getLightIntensity();
            double humidity = shTuple.getHumidity();
            int occupancy = shTuple.getOccupancy();
            int dayOfWeek = shTuple.getDayOfWeek();
            boolean isAnomaly = shTuple.isAnomaly();
            boolean isWeekend = shTuple.isWeekend();
            double simTime = shTuple.getSimTimestamp();

            // Run Decision Engine
            DecisionEngine.DecisionResult decision = DecisionEngine.makeDecision(temp, light, occupancy);

            // Compute power consumption
            double power = EnergyCalculator.calculateInstantaneousPower(decision.getFanStatus(), decision.getLEDStatus());

            // Accumulate energy metrics
            energyCalculator.updateEnergy(CloudSim.clock(), decision.getFanStatus(), decision.getLEDStatus());

            // Estimate processing latency (CPU Execution time + small random OS scheduling overhead)
            double cpuExecutionTimeMs = (tuple.getCloudletLength() / getHost().getTotalMips()) * 1000.0;
            double fogProcessingTimeMs = cpuExecutionTimeMs + 1.2 + (random.nextDouble() * 1.8);

            // Calculate network delay to Cloud
            double cloudLatencyMs = Constants.LATENCY_FOG_TO_CLOUD + (random.nextDouble() * 2.0);

            // Record statistical summaries
            stats.recordFogLatency(fogProcessingTimeMs);
            stats.recordCloudLatency(cloudLatencyMs);
            stats.recordEnvironment(temp, humidity, light);
            stats.recordPower(power);

            // Append telemetry row to CSV dataset
            csvLogger.logRecord(simTime, temp, humidity, light,
                    decision.getFanStatus(), decision.getLEDStatus(),
                    fogProcessingTimeMs, cloudLatencyMs, power, decision.getDecisionLabel(),
                    occupancy, dayOfWeek, isWeekend, isAnomaly);

            // Dispatch command tuples to actuators (routed downwards through NodeMCU)
            int nodeMcuId = shTuple.getSourceDeviceId();
            int brokerId = shTuple.getUserId();
            sendActuatorCommand(decision.getFanStatus(), Constants.TUPLE_TYPE_ACTUATOR_FAN, Constants.ACTUATOR_FAN, nodeMcuId, brokerId);
            sendActuatorCommand(decision.getLEDStatus(), Constants.TUPLE_TYPE_ACTUATOR_LED, Constants.ACTUATOR_LED, nodeMcuId, brokerId);

            // Dispatch database logging summary up to Cloud
            sendSummaryToCloud(shTuple);
        }

        // Delegate to superclass only if the tuple has a valid VM ID mapping
        if (tuple.getVmId() >= 0) {
            super.executeTuple(ev, moduleName);
        }
    }

    /**
     * Creates and dispatches command tuples to actuators.
     */
    private void sendActuatorCommand(String status, String tupleType, String destActuatorType, int nodeMcuId, int brokerId) {
        int actuatorId = org.cloudbus.cloudsim.core.CloudSim.getEntityId(destActuatorType);
        Tuple commandTuple = new Tuple(
                Constants.APP_ID,
                FogUtils.generateTupleId(),
                Tuple.ACTUATOR,
                10, // Small command size
                1,
                10,
                10,
                new UtilizationModelFull(),
                new UtilizationModelFull(),
                new UtilizationModelFull()
        );
        commandTuple.setUserId(brokerId);
        commandTuple.setTupleType(tupleType);
        commandTuple.setDestModuleName(destActuatorType);
        commandTuple.setSrcModuleName(getName());
        commandTuple.setActuatorId(actuatorId);
        commandTuple.setDestinationDeviceId(nodeMcuId);

        // Send down to NodeMCU (uplink/downlink latency is 2ms)
        send(nodeMcuId, Constants.LATENCY_CONTROLLER_TO_FOG, FogEvents.TUPLE_ARRIVAL, commandTuple);
    }

    /**
     * Dispatches summary telemetry up to Cloud storage.
     */
    private void sendSummaryToCloud(SmartHomeTuple shTuple) {
        Tuple summaryTuple = new Tuple(
                Constants.APP_ID,
                FogUtils.generateTupleId(),
                Tuple.UP,
                50, // Small footprint summary payload
                1,
                50,
                50,
                new UtilizationModelFull(),
                new UtilizationModelFull(),
                new UtilizationModelFull()
        );
        summaryTuple.setUserId(shTuple.getUserId());
        summaryTuple.setTupleType(Constants.TUPLE_TYPE_CLOUD_SUMMARY);
        summaryTuple.setDestModuleName(Constants.MODULE_CLOUD_HISTORY);
        summaryTuple.setSrcModuleName(getName());

        // Send up to parent (Fog Node's parent is Cloud)
        send(getParentId(), Constants.LATENCY_FOG_TO_CLOUD, FogEvents.TUPLE_ARRIVAL, summaryTuple);
    }
}
