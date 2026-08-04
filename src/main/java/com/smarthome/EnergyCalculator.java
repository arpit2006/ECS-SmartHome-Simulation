package com.smarthome;

/**
 * Calculates power consumption of the smart home setup (LED, Fan, NodeMCU controller)
 * and keeps track of cumulative energy usage during the simulation.
 */
public class EnergyCalculator {

    private double totalEnergyJoules = 0.0; // Watt-seconds
    private double lastUpdateTime = 0.0;

    /**
     * Calculates the instantaneous power consumption in Watts based on actuator states.
     * 
     * Formula:
     * - LED ON, Fan ON: 90 W
     * - LED OFF, Fan ON: 80 W
     * - LED ON, Fan OFF: 10 W
     * - LED OFF, Fan OFF: 5 W (controller idle power)
     *
     * @param fanStatus Actuator state ("ON" or "OFF")
     * @param ledStatus Actuator state ("ON" or "OFF")
     * @return Instantaneous power in Watts.
     */
    public static double calculateInstantaneousPower(String fanStatus, String ledStatus) {
        boolean fanOn = "ON".equalsIgnoreCase(fanStatus);
        boolean ledOn = "ON".equalsIgnoreCase(ledStatus);

        if (fanOn && ledOn) {
            return Constants.POWER_BOTH_ON;
        } else if (fanOn) {
            return Constants.POWER_FAN_ON;
        } else if (ledOn) {
            return Constants.POWER_LED_ON;
        } else {
            return Constants.POWER_BOTH_OFF;
        }
    }

    /**
     * Updates cumulative energy consumption.
     * 
     * @param currentTime Current simulation clock (seconds).
     * @param fanStatus   State of the Fan.
     * @param ledStatus   State of the LED.
     */
    public void updateEnergy(double currentTime, String fanStatus, String ledStatus) {
        double duration = currentTime - lastUpdateTime;
        if (duration > 0) {
            double power = calculateInstantaneousPower(fanStatus, ledStatus);
            totalEnergyJoules += power * duration; // Energy = Power * Time (Watt-seconds)
        }
        lastUpdateTime = currentTime;
    }

    public double getTotalEnergyJoules() {
        return totalEnergyJoules;
    }

    /**
     * Returns total energy consumed in Watt-hours (Wh).
     */
    public double getTotalEnergyWh() {
        return totalEnergyJoules / 3600.0;
    }

    /**
     * Returns total energy consumed in Kilowatt-hours (kWh).
     */
    public double getTotalEnergyKWh() {
        return totalEnergyJoules / (3600.0 * 1000.0);
    }
}
