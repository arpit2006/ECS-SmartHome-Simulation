package com.smarthome;

/**
 * Configuration constants for the AI-Based Predictive Smart Home Automation simulation.
 * This class groups all system parameters, networking latencies, MIPS ratings,
 * energy ratings, and output file names to ensure consistency across the project.
 */
public class Constants {
    
    // Application configurations
    public static final String APP_ID = "SmartHomeAutomation";
    public static final int USER_ID = 1;
    
    // Device names in the physical topology
    public static final String CLOUD_NAME = "cloud";
    public static final String FOG_NODE_NAME = "fog-node";
    public static final String CONTROLLER_NAME = "nodemcu-controller";
    
    // Tuple types for communication in iFogSim2
    public static final String TUPLE_TYPE_TEMP = "TEMPERATURE_DATA";
    public static final String TUPLE_TYPE_HUMID = "HUMIDITY_DATA";
    public static final String TUPLE_TYPE_LIGHT = "LIGHT_DATA";
    public static final String TUPLE_TYPE_AGGREGATED = "AGGREGATED_SENSOR_DATA";
    public static final String TUPLE_TYPE_CLOUD_SUMMARY = "CLOUD_SUMMARY_DATA";
    public static final String TUPLE_TYPE_ACTUATOR_FAN = "FAN_COMMAND";
    public static final String TUPLE_TYPE_ACTUATOR_LED = "LED_COMMAND";
    
    // Module names
    public static final String MODULE_CONTROLLER = "controller_module";
    public static final String MODULE_FOG_PROCESSOR = "fog_processor_module";
    public static final String MODULE_CLOUD_HISTORY = "cloud_history_module";
    
    // Actuator names
    public static final String ACTUATOR_FAN = "FAN_ACTUATOR";
    public static final String ACTUATOR_LED = "LED_ACTUATOR";
    
    // Sensor names
    public static final String SENSOR_TEMP = "temperature_sensor";
    public static final String SENSOR_HUMID = "humidity_sensor";
    public static final String SENSOR_LIGHT = "light_sensor";

    // Power Ratings (in Watts)
    public static final double POWER_LED_ON = 10.0;
    public static final double POWER_FAN_ON = 80.0;
    public static final double POWER_BOTH_ON = 90.0;
    public static final double POWER_BOTH_OFF = 5.0; // Controller only

    // Network bandwidths and latencies
    // Latency is in milliseconds, Bandwidth is in Mbps
    public static final double LATENCY_CONTROLLER_TO_FOG = 2.0;   // Local LAN network
    public static final double LATENCY_FOG_TO_CLOUD = 40.0;       // WAN backhaul link
    public static final double BANDWIDTH_UPLINK = 100.0;          // 100 Mbps
    public static final double BANDWIDTH_DOWNLINK = 100.0;        // 100 Mbps
    
    // Hardware configuration ratings (MIPS)
    public static final long MIPS_CLOUD = 44800; // High performance cloud datacenter
    public static final long MIPS_FOG = 2800;    // Edge/Fog gateway computer
    public static final long MIPS_NODEMCU = 80;  // NodeMCU ESP8266 micro-controller
    
    // Memory configurations (RAM in MB)
    public static final int RAM_CLOUD = 40000;
    public static final int RAM_FOG = 4000;
    public static final int RAM_NODEMCU = 4;
    
    // Sensor transmission interval in seconds
    public static final double SENSOR_INTERVAL = 5.0; // 5 seconds
    
    // Total simulated steps to generate at least 10,000 rows
    // Since sensor emits every 5 seconds, 10,000 rows require 50,000 seconds
    public static final double SIMULATION_TIME = 50005.0; 

    // Output filenames
    public static final String FILE_DATASET = "SmartHomeDataset.csv";
    public static final String FILE_SIMULATION_LOG = "SimulationLog.txt";
    public static final String FILE_PERFORMANCE_REPORT = "PerformanceReport.txt";
    
    // AI Decision labels
    public static final String DECISION_FAN_ON = "FAN_ON";
    public static final String DECISION_FAN_OFF = "FAN_OFF";
    public static final String DECISION_LED_ON = "LED_ON";
    public static final String DECISION_LED_OFF = "LED_OFF";
    public static final String DECISION_BOTH_ON = "FAN_ON_LED_ON";
    public static final String DECISION_BOTH_OFF = "FAN_OFF_LED_OFF";
}
