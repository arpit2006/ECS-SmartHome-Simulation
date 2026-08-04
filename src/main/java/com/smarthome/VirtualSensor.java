package com.smarthome;

import java.util.Random;

/**
 * Simulates physical smart home sensors (DHT11 Temperature & Humidity, LDR Light Sensor)
 * by generating realistic readings based on diurnal, weekday/weekend, occupancy, and anomaly patterns.
 */
public class VirtualSensor {

    public enum SensorType {
        TEMPERATURE,
        HUMIDITY,
        LIGHT
    }

    private final SensorType type;
    private final Random random;

    public VirtualSensor(SensorType type) {
        this.type = type;
        this.random = new Random();
    }

    /**
     * Generates a telemetry value based on simulated clock time.
     *
     * @param simTime    Simulation clock in seconds.
     * @param isAnomaly  Whether this reading is forced to be an anomaly.
     * @param isWeekend  Whether it's the weekend.
     * @param occupancy  The occupancy status (0 for empty, 1 for occupied).
     * @return Realistic telemetry reading.
     */
    public double generateValue(double simTime, boolean isAnomaly, boolean isWeekend, int occupancy) {
        double totalHours = simTime / 3600.0;
        double hourOfDay = totalHours % 24.0;
        
        double baseValue = 0.0;
        double noise = 0.0;

        switch (type) {
            case TEMPERATURE:
                // Base temperature follows a diurnal pattern: highest at 3 PM (hour 15), lowest at 3 AM (hour 3)
                // Range: 20°C to 40°C
                baseValue = 28.0 + 8.0 * Math.sin((hourOfDay - 9.0) * Math.PI / 12.0);
                
                // Weekend pattern adjustment (e.g., household activity/appliance heat when occupied)
                if (isWeekend && occupancy == 1) {
                    baseValue += 1.0; 
                }
                
                // Add minor random noise (-0.5°C to +0.5°C)
                noise = (random.nextDouble() - 0.5);
                
                if (isAnomaly) {
                    // 2% Anomaly: Simulate fire/extreme spike or freezing draft/sensor failure
                    if (random.nextDouble() < 0.7) {
                        return 45.0 + random.nextDouble() * 5.0; // Spike to 45°C - 50°C
                    } else {
                        return 5.0 + random.nextDouble() * 5.0;  // Drop to 5°C - 10°C
                    }
                }
                
                double tempResult = baseValue + noise;
                // Clip to acceptable ranges
                return Math.max(20.0, Math.min(40.0, tempResult));

            case HUMIDITY:
                // Humidity is generally inversely proportional to temperature (higher at night, lower in afternoon)
                // Range: 35% to 90%
                baseValue = 62.5 - 25.0 * Math.sin((hourOfDay - 9.0) * Math.PI / 12.0);
                
                // Household activity like cooking/showers increases humidity
                if (occupancy == 1) {
                    baseValue += 3.0;
                }
                
                // Add minor noise (-3% to +3%)
                noise = (random.nextDouble() - 0.5) * 6.0;
                
                if (isAnomaly) {
                    // Anomaly: Extreme moisture spike or sensor drying out
                    if (random.nextDouble() < 0.5) {
                        return 95.0 + random.nextDouble() * 4.0; // 95% - 99%
                    } else {
                        return 10.0 + random.nextDouble() * 5.0;  // Drop to 10% - 15%
                    }
                }
                
                double humidResult = baseValue + noise;
                return Math.max(35.0, Math.min(90.0, humidResult));

            case LIGHT:
                // Ambient Light Intensity (LDR)
                // Range: 0 to 1023 (0 = pitch black, 1023 = full sunlight)
                // Daytime (6 AM to 6 PM): peak light at 12:30 PM (hour 12.5)
                if (hourOfDay >= 6.0 && hourOfDay < 18.0) {
                    baseValue = 150.0 + 800.0 * Math.sin((hourOfDay - 6.0) * Math.PI / 12.0);
                } else {
                    // Nighttime ambient light (moonlight, street lamps)
                    baseValue = 40.0 + random.nextDouble() * 40.0;
                }
                
                // Add noise (-15 to +15 LDR units)
                noise = (random.nextDouble() - 0.5) * 30.0;
                
                if (isAnomaly) {
                    // Anomaly: Sensor cover (drops to 0) or flashlight/malfunction (spikes to 1023)
                    if (random.nextDouble() < 0.5) {
                        return 0.0;
                    } else {
                        return 1023.0;
                    }
                }
                
                double lightResult = baseValue + noise;
                return Math.max(0.0, Math.min(1023.0, lightResult));

            default:
                return 0.0;
        }
    }
}
