package com.smarthome;

import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Handles recording the simulation results to a CSV file.
 * Appends sensor data, decisions, latencies, and energy parameters in real-time.
 */
public class CSVLogger {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    // Start simulation date on Saturday, August 1, 2026
    private static final LocalDateTime START_DATE = LocalDateTime.of(2026, 8, 1, 0, 0, 0);

    private PrintWriter writer;

    public CSVLogger() {
        try {
            // Overwrite existing file and write header
            writer = new PrintWriter(new FileWriter(Constants.FILE_DATASET, false));
            writer.println("Timestamp,Temperature,Humidity,LightIntensity,FanStatus,LEDStatus," +
                    "FogProcessingTime(ms),CloudLatency(ms),EnergyConsumption(W),Decision," +
                    "Occupancy,DayOfWeek,IsWeekend,IsAnomaly");
            writer.flush();
        } catch (IOException e) {
            System.err.println("Error initializing CSVLogger: " + e.getMessage());
        }
    }

    /**
     * Converts simulation time in seconds to a formatted calendar timestamp starting from 2026-08-01 00:00:00.
     */
    public static String formatTimestamp(double simTime) {
        return START_DATE.plusSeconds((long) simTime).format(DATE_FORMATTER);
    }

    /**
     * Appends a record to the CSV file.
     */
    public synchronized void logRecord(double simTime, double temp, double humidity, int light,
                                       String fanStatus, String ledStatus, double fogProcTimeMs,
                                       double cloudLatencyMs, double energyW, String decision,
                                       int occupancy, int dayOfWeek, boolean isWeekend, boolean isAnomaly) {
        if (writer == null) return;

        String timestamp = formatTimestamp(simTime);
        
        // Format floats to 2 decimal places for clean formatting
        String record = String.format("%s,%.2f,%.2f,%d,%s,%s,%.2f,%.2f,%.2f,%s,%d,%d,%b,%b",
                timestamp, temp, humidity, light, fanStatus, ledStatus,
                fogProcTimeMs, cloudLatencyMs, energyW, decision,
                occupancy, dayOfWeek, isWeekend, isAnomaly);

        writer.println(record);
    }

    /**
     * Flushes buffers and closes the file writer.
     */
    public void close() {
        if (writer != null) {
            writer.flush();
            writer.close();
            writer = null;
        }
    }
}
