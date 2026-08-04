package com.smarthome;

import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Locale;

/**
 * Collects, processes, and prints statistical summaries from the simulation run.
 * Generates the performance report automatically.
 */
public class Statistics {

    // Latency trackers
    private double totalFogLatency = 0.0;
    private double maxFogLatency = Double.MIN_VALUE;
    private double minFogLatency = Double.MAX_VALUE;
    private int fogLatencyCount = 0;

    private double totalCloudLatency = 0.0;
    private int cloudLatencyCount = 0;

    // Environmental trackers
    private double totalTemperature = 0.0;
    private int tempCount = 0;

    private double totalHumidity = 0.0;
    private int humidCount = 0;

    private double totalLight = 0.0;
    private int lightCount = 0;

    // Energy trackers
    private double totalPowerConsumption = 0.0;
    private int energyCount = 0;

    // Network & Tuples
    private double totalNetworkUsage = 0.0;
    private int totalTuplesGenerated = 0;

    // Timers
    private long realStartTime = 0;
    private long realEndTime = 0;

    public void startTimer() {
        this.realStartTime = System.currentTimeMillis();
    }

    public void stopTimer() {
        this.realEndTime = System.currentTimeMillis();
    }

    public synchronized void recordFogLatency(double latencyMs) {
        totalFogLatency += latencyMs;
        fogLatencyCount++;
        if (latencyMs > maxFogLatency) maxFogLatency = latencyMs;
        if (latencyMs < minFogLatency) minFogLatency = latencyMs;
    }

    public synchronized void recordCloudLatency(double latencyMs) {
        totalCloudLatency += latencyMs;
        cloudLatencyCount++;
    }

    public synchronized void recordEnvironment(double temp, double humidity, int light) {
        totalTemperature += temp;
        tempCount++;
        totalHumidity += humidity;
        humidCount++;
        totalLight += light;
        lightCount++;
    }

    public synchronized void recordPower(double powerW) {
        totalPowerConsumption += powerW;
        energyCount++;
    }

    public synchronized void incrementTuples() {
        totalTuplesGenerated++;
    }

    public void setNetworkUsage(double networkUsage) {
        this.totalNetworkUsage = networkUsage;
    }

    public double getAverageFogLatency() {
        return fogLatencyCount == 0 ? 0.0 : totalFogLatency / fogLatencyCount;
    }

    public double getAverageCloudLatency() {
        return cloudLatencyCount == 0 ? 0.0 : totalCloudLatency / cloudLatencyCount;
    }

    public double getAverageTemperature() {
        return tempCount == 0 ? 0.0 : totalTemperature / tempCount;
    }

    public double getAverageHumidity() {
        return humidCount == 0 ? 0.0 : totalHumidity / humidCount;
    }

    public double getAverageLight() {
        return lightCount == 0 ? 0.0 : totalLight / lightCount;
    }

    public double getAverageEnergyConsumption() {
        return energyCount == 0 ? 0.0 : totalPowerConsumption / energyCount;
    }

    public long getSimulationExecutionTimeMs() {
        return realEndTime - realStartTime;
    }

    /**
     * Prints statistical details to console and writes them to the performance report file.
     */
    public void printAndSaveReport() {
        double avgFog = getAverageFogLatency();
        double avgCloud = getAverageCloudLatency();
        double maxFog = maxFogLatency == Double.MIN_VALUE ? 0.0 : maxFogLatency;
        double minFog = minFogLatency == Double.MAX_VALUE ? 0.0 : minFogLatency;
        double avgTemp = getAverageTemperature();
        double avgHumid = getAverageHumidity();
        double avgLight = getAverageLight();
        double avgEnergy = getAverageEnergyConsumption();
        long executionTime = getSimulationExecutionTimeMs();

        StringBuilder sb = new StringBuilder();
        sb.append("========================================================================\n");
        sb.append("      AI-Based Predictive Smart Home Automation - Performance Report    \n");
        sb.append("========================================================================\n");
        sb.append(String.format(Locale.US, "Simulation Real Execution Time: %d ms\n", executionTime));
        sb.append(String.format(Locale.US, "Total Tuples Processed:        %d\n", totalTuplesGenerated));
        sb.append(String.format(Locale.US, "Total Simulated Network Usage:  %.4f KB\n", totalNetworkUsage / 1024.0));
        sb.append("------------------------------------------------------------------------\n");
        sb.append("LATENCY METRICS:\n");
        sb.append(String.format(Locale.US, "  Average Fog Processing Latency: %.4f ms\n", avgFog));
        sb.append(String.format(Locale.US, "  Minimum Fog Processing Latency: %.4f ms\n", minFog));
        sb.append(String.format(Locale.US, "  Maximum Fog Processing Latency: %.4f ms\n", maxFog));
        sb.append(String.format(Locale.US, "  Average Cloud Transmission Latency: %.4f ms\n", avgCloud));
        sb.append("------------------------------------------------------------------------\n");
        sb.append("ENVIRONMENTAL DATA SUMMARY:\n");
        sb.append(String.format(Locale.US, "  Average Temperature:            %.2f °C\n", avgTemp));
        sb.append(String.format(Locale.US, "  Average Humidity:               %.2f %%\n", avgHumid));
        sb.append(String.format(Locale.US, "  Average Light Intensity:        %.2f LDR\n", avgLight));
        sb.append("------------------------------------------------------------------------\n");
        sb.append("ENERGY SUMMARY:\n");
        sb.append(String.format(Locale.US, "  Average Instantaneous Power:    %.2f W\n", avgEnergy));
        sb.append("========================================================================\n");

        // Print to stdout
        System.out.println(sb);

        // Save to file
        try (PrintWriter prWriter = new PrintWriter(new FileWriter(Constants.FILE_PERFORMANCE_REPORT, false))) {
            prWriter.print(sb);
            prWriter.flush();
        } catch (IOException e) {
            System.err.println("Error saving performance report file: " + e.getMessage());
        }
    }
}
