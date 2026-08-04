package com.smarthome;

import java.util.Random;

/**
 * Orchestrates multiple virtual sensors, manages simulation-time context (days of week, weekends, occupancy),
 * and handles anomaly injection.
 */
public class SensorGenerator {

    private final VirtualSensor tempSensor;
    private final VirtualSensor humidSensor;
    private final VirtualSensor lightSensor;
    private final Random random;

    public SensorGenerator() {
        this.tempSensor = new VirtualSensor(VirtualSensor.SensorType.TEMPERATURE);
        this.humidSensor = new VirtualSensor(VirtualSensor.SensorType.HUMIDITY);
        this.lightSensor = new VirtualSensor(VirtualSensor.SensorType.LIGHT);
        this.random = new Random();
    }

    /**
     * Container class holding all the telemetry readings generated at a specific simulation timestep.
     */
    public static class SensorReadings {
        public double temperature;
        public double humidity;
        public int lightIntensity;
        public int occupancy;
        public int dayOfWeek;
        public boolean isAnomaly;
        public boolean isWeekend;
        public double simTime;

        @Override
        public String toString() {
            return String.format("Time: %.1fs, Temp: %.1f°C, Hum: %.1f%%, Light: %d, Occupancy: %d, Day: %d, Anomaly: %b",
                    simTime, temperature, humidity, lightIntensity, occupancy, dayOfWeek, isAnomaly);
        }
    }

    /**
     * Generates sensor readings for a given simulation time.
     *
     * @param simTime Simulation time in seconds.
     * @return Aggregated sensor readings.
     */
    public SensorReadings generateReadings(double simTime) {
        SensorReadings readings = new SensorReadings();
        readings.simTime = simTime;

        // Calculate hours and days
        double totalHours = simTime / 3600.0;
        double hourOfDay = totalHours % 24.0;
        int dayIndex = (int)(totalHours / 24.0);
        
        // Let's assume day 0 is Monday
        readings.dayOfWeek = dayIndex % 7; 
        readings.isWeekend = (readings.dayOfWeek == 5 || readings.dayOfWeek == 6);

        // Determine occupancy based on time and weekend
        readings.occupancy = determineOccupancy(hourOfDay, readings.isWeekend);

        // Read anomaly rate from system properties, defaulting to 2% (0.02)
        double anomalyChance = 0.02;
        String prop = System.getProperty("anomalyChance");
        if (prop != null) {
            try {
                anomalyChance = Double.parseDouble(prop);
            } catch (NumberFormatException e) {
                // fall back to default
            }
        }
        readings.isAnomaly = (random.nextDouble() < anomalyChance);

        // Generate individual sensor values
        readings.temperature = tempSensor.generateValue(simTime, readings.isAnomaly, readings.isWeekend, readings.occupancy);
        readings.humidity = humidSensor.generateValue(simTime, readings.isAnomaly, readings.isWeekend, readings.occupancy);
        readings.lightIntensity = (int) lightSensor.generateValue(simTime, readings.isAnomaly, readings.isWeekend, readings.occupancy);

        return readings;
    }

    /**
     * Simulates home occupancy (0 = unoccupied, 1 = occupied).
     */
    private int determineOccupancy(double hourOfDay, boolean isWeekend) {
        if (isWeekend) {
            // On weekends, people are mostly home except for occasional afternoon outings (e.g., 2 PM - 6 PM, 30% chance empty)
            if (hourOfDay >= 14.0 && hourOfDay < 18.0) {
                return (random.nextDouble() < 0.70) ? 1 : 0;
            }
            return 1; // Sleeping or staying home
        } else {
            // Weekdays: Monday to Friday
            // Sleep: 10 PM (22.0) to 6 AM (6.0) -> Occupied
            // Morning routine: 6 AM to 9 AM -> Occupied
            // Work/School: 9 AM to 5 PM (17.0) -> Unoccupied
            // Evening: 5 PM to 10 PM -> Occupied
            if (hourOfDay >= 9.0 && hourOfDay < 17.0) {
                return (random.nextDouble() < 0.10) ? 1 : 0; // 90% chance everyone is away
            }
            return 1; // Sleep or active at home
        }
    }
}
