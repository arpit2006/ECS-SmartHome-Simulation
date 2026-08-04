package com.smarthome;

/**
 * Executes the control logic for the smart home actuators (Fan and LED)
 * based on environment readings (temperature, light intensity LDR) and occupancy.
 */
public class DecisionEngine {

    /**
     * Executes the decision rules for actuators.
     * 
     * Rules:
     * - If Occupancy is 0 (house is empty): Both Fan and LED are turned OFF to conserve energy.
     * - If Occupancy is 1 (occupied):
     *   - Fan = ON if Temperature > 30°C, else OFF.
     *   - LED = ON if Light Intensity < 400, else OFF.
     *
     * @param temperature   DHT11 Temperature in °C.
     * @param lightIntensity LDR Light Intensity (0 to 1023).
     * @param occupancy      Occupancy status (0 or 1).
     * @return DecisionResult containing the appliance statuses and the combined decision label.
     */
    public static DecisionResult makeDecision(double temperature, int lightIntensity, int occupancy) {
        String mode = System.getProperty("actuatorMode", "auto");

        boolean fanOn = false;
        boolean ledOn = false;

        if ("fan-on".equalsIgnoreCase(mode)) {
            fanOn = true;
        } else if ("led-on".equalsIgnoreCase(mode)) {
            ledOn = true;
        } else if ("both-off".equalsIgnoreCase(mode)) {
            // Keep both false
        } else {
            // "auto" (default rules)
            if (occupancy == 1) {
                if (temperature > 30.0) {
                    fanOn = true;
                }
                if (lightIntensity < 400) {
                    ledOn = true;
                }
            }
        }

        String fanStatus = fanOn ? "ON" : "OFF";
        String ledStatus = ledOn ? "ON" : "OFF";
        String decisionLabel;

        // Combine actuator states into a classification label for Machine Learning
        if (fanOn && ledOn) {
            decisionLabel = "FAN_ON_LED_ON";
        } else if (!fanOn && !ledOn) {
            decisionLabel = "FAN_OFF_LED_OFF";
        } else if (fanOn && !ledOn) {
            decisionLabel = "FAN_ON_LED_OFF";
        } else {
            decisionLabel = "FAN_OFF_LED_ON";
        }

        return new DecisionResult(fanStatus, ledStatus, decisionLabel);
    }

    /**
     * Represents the outcomes of a decision cycle.
     */
    public static class DecisionResult {
        private final String fanStatus;
        private final String ledStatus;
        private final String decisionLabel;

        public DecisionResult(String fanStatus, String ledStatus, String decisionLabel) {
            this.fanStatus = fanStatus;
            this.ledStatus = ledStatus;
            this.decisionLabel = decisionLabel;
        }

        public String getFanStatus() {
            return fanStatus;
        }

        public String getLEDStatus() {
            return ledStatus;
        }

        public String getDecisionLabel() {
            return decisionLabel;
        }
    }
}
