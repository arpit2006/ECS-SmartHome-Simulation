package com.smarthome;

import org.cloudbus.cloudsim.UtilizationModelFull;
import org.cloudbus.cloudsim.core.CloudSim;
import org.fog.application.AppEdge;
import org.fog.entities.Sensor;
import org.fog.entities.Tuple;
import org.fog.utils.FogEvents;
import org.fog.utils.FogUtils;
import org.fog.utils.GeoLocation;
import org.fog.utils.distribution.Distribution;

/**
 * A specialized iFogSim2 Sensor that periodically triggers the VirtualSensor generation engine,
 * encapsulates the results in a SmartHomeTuple, and transmits it to the NodeMCU controller gateway.
 */
public class SmartHomeSensor extends Sensor {

    private final SensorGenerator generator;
    private final Statistics stats;

    /**
     * Constructor for SmartHomeSensor.
     */
    public SmartHomeSensor(String name, int userId, String appId, int gatewayDeviceId, double latency,
                           GeoLocation geoLocation, Distribution transmitDistribution,
                           String tupleType, String destModuleName, SensorGenerator generator, Statistics stats) {
        // Call the parent Sensor constructor
        super(name, userId, appId, gatewayDeviceId, latency, geoLocation, transmitDistribution, 
              100, 100, tupleType, destModuleName);
        this.generator = generator;
        this.stats = stats;
        setSensorName(name);
    }

    /**
     * Generates a telemetry payload and transmits it as a SmartHomeTuple to the parent NodeMCU device.
     */
    @Override
    public void transmit() {
        AppEdge edgeMatch = null;
        for (AppEdge edge : getApp().getEdges()) {
            if (edge.getSource().equals(getTupleType())) {
                edgeMatch = edge;
                break;
            }
        }
        if (edgeMatch == null) {
            return;
        }

        long cpuLength = (long) edgeMatch.getTupleCpuLength();
        long nwLength = (long) edgeMatch.getTupleNwLength();
        double currentTime = CloudSim.clock();

        // Generate telemetry data using the generator
        SensorGenerator.SensorReadings readings = generator.generateReadings(currentTime);

        // Package findings into a SmartHomeTuple
        SmartHomeTuple tuple = new SmartHomeTuple(
                getAppId(),
                FogUtils.generateTupleId(),
                Tuple.UP,
                cpuLength,
                1,
                nwLength,
                getOutputSize(),
                new UtilizationModelFull(),
                new UtilizationModelFull(),
                new UtilizationModelFull(),
                readings.temperature,
                readings.humidity,
                readings.lightIntensity,
                readings.occupancy,
                readings.dayOfWeek,
                readings.simTime,
                readings.isAnomaly,
                readings.isWeekend
        );

        tuple.setUserId(getUserId());
        tuple.setTupleType(getTupleType());
        tuple.setDestModuleName(edgeMatch.getDestination());
        tuple.setSrcModuleName(getSensorName());
        tuple.setDestinationDeviceId(getGatewayDeviceId());

        int actualTupleId = updateTimings(getSensorName(), tuple.getDestModuleName());
        tuple.setActualTupleId(actualTupleId);

        // Record metrics
        stats.incrementTuples();

        // Route tuple to parent NodeMCU Gateway
        send(getGatewayDeviceId(), getLatency(), FogEvents.TUPLE_ARRIVAL, tuple);
    }
}
