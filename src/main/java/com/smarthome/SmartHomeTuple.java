package com.smarthome;

import org.cloudbus.cloudsim.UtilizationModel;
import org.fog.entities.Tuple;

/**
 * A custom tuple class in iFogSim2 that carries the environmental and contextual telemetry data
 * (Temperature, Humidity, Light Intensity, Occupancy, Anomaly status) across the network.
 */
public class SmartHomeTuple extends Tuple {

    private final double temperature;
    private final double humidity;
    private final int lightIntensity;
    private final int occupancy;
    private final int dayOfWeek;
    private final double simTimestamp;
    private final boolean isAnomaly;
    private final boolean isWeekend;

    /**
     * Constructor for creating a SmartHomeTuple with complete sensor and context payloads.
     */
    public SmartHomeTuple(String appId, int cloudletId, int direction, long cloudletLength, int pesNumber,
                          long cloudletFileSize, long cloudletOutputSize,
                          UtilizationModel utilizationModelCpu,
                          UtilizationModel utilizationModelRam,
                          UtilizationModel utilizationModelBw,
                          double temperature, double humidity, int lightIntensity,
                          int occupancy, int dayOfWeek, double simTimestamp,
                          boolean isAnomaly, boolean isWeekend) {
        super(appId, cloudletId, direction, cloudletLength, pesNumber, cloudletFileSize,
              cloudletOutputSize, utilizationModelCpu, utilizationModelRam, utilizationModelBw);
        this.temperature = temperature;
        this.humidity = humidity;
        this.lightIntensity = lightIntensity;
        this.occupancy = occupancy;
        this.dayOfWeek = dayOfWeek;
        this.simTimestamp = simTimestamp;
        this.isAnomaly = isAnomaly;
        this.isWeekend = isWeekend;
    }

    public double getTemperature() {
        return temperature;
    }

    public double getHumidity() {
        return humidity;
    }

    public int getLightIntensity() {
        return lightIntensity;
    }

    public int getOccupancy() {
        return occupancy;
    }

    public int getDayOfWeek() {
        return dayOfWeek;
    }

    public double getSimTimestamp() {
        return simTimestamp;
    }

    public boolean isAnomaly() {
        return isAnomaly;
    }

    public boolean isWeekend() {
        return isWeekend;
    }
}
