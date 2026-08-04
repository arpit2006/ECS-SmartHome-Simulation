package com.smarthome;

import org.cloudbus.cloudsim.Log;
import org.cloudbus.cloudsim.core.CloudSim;
import org.fog.application.AppEdge;
import org.fog.application.AppLoop;
import org.fog.application.Application;
import org.fog.application.selectivity.FractionalSelectivity;
import org.fog.entities.Actuator;
import org.fog.entities.FogBroker;
import org.fog.entities.FogDevice;
import org.fog.entities.Sensor;
import org.fog.entities.Tuple;
import org.fog.placement.Controller;
import org.fog.placement.ModuleMapping;
import org.fog.placement.ModulePlacementMapping;
import org.fog.utils.Config;
import org.fog.utils.TimeKeeper;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/**
 * Main entry point for the AI-Based Predictive Smart Home Automation simulation.
 * Initializes CloudSim and iFogSim2, sets up the physical network topology,
 * deploys the data-flow application modules, runs the simulation to generate
 * the dataset, and exports telemetry reports.
 */
public class MainSimulation {

    public static void main(String[] args) {
        // 1. Initialize Dual Stream Logging
        FileOutputStream fileOut = null;
        try {
            fileOut = new FileOutputStream(Constants.FILE_SIMULATION_LOG, false);
            PrintStream dualOut = new PrintStream(new DualStream(fileOut, System.out));
            PrintStream dualErr = new PrintStream(new DualStream(fileOut, System.err));
            System.setOut(dualOut);
            System.setErr(dualErr);
        } catch (IOException e) {
            System.err.println("Failed to initialize SimulationLog.txt logging: " + e.getMessage());
        }

        System.out.println("========================================================================");
        System.out.println(" Starting AI-Based Predictive Smart Home Automation Using Fog Computing ");
        System.out.println("========================================================================");

        try {
            // Disable default CloudSim event logs to prevent terminal flooding
            Log.disable();
            
            // 2. Initialize Telemetry Logging and Stats Collection
            CSVLogger csvLogger = new CSVLogger();
            Statistics stats = new Statistics();
            stats.startTimer();

            EnergyCalculator energyCalculator = new EnergyCalculator();
            SensorGenerator generator = new SensorGenerator();

            // 3. Register JVM Shutdown Hook
            // Essential because iFogSim2 Controller calls System.exit(0) upon STOP_SIMULATION
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                stats.stopTimer();
                stats.setNetworkUsage(org.fog.utils.NetworkUsageMonitor.getNetworkUsage());
                stats.printAndSaveReport();
                csvLogger.close();
                System.out.println("Simulation run completed. Dataset and reports successfully saved.");
            }));

            // 4. Initialize CloudSim
            int numUser = 1;
            Calendar calendar = Calendar.getInstance();
            boolean traceFlag = false;
            CloudSim.init(numUser, calendar, traceFlag);

            // Create simulation broker
            FogBroker broker = new FogBroker("broker");

            // 5. Override Simulation Stop Time in iFogSim
            Config.MAX_SIMULATION_TIME = (int) Constants.SIMULATION_TIME;

            // 6. Instantiate physical network topology
            FogNodeManager topologyManager = new FogNodeManager();
            List<FogDevice> fogDevices = topologyManager.createTopology(
                    broker.getId(), Constants.APP_ID, csvLogger, stats, energyCalculator, generator);

            // 7. Define iFogSim2 Application model
            Application application = createSmartHomeApplication(broker.getId());
            application.setUserId(broker.getId());

            // 8. Define Module Placement / Mapping
            ModuleMapping moduleMapping = ModuleMapping.createModuleMapping();
            // Place modules on physical devices according to our architecture
            moduleMapping.addModuleToDevice(Constants.MODULE_CLOUD_HISTORY, Constants.CLOUD_NAME);
            moduleMapping.addModuleToDevice(Constants.MODULE_FOG_PROCESSOR, Constants.FOG_NODE_NAME);
            moduleMapping.addModuleToDevice(Constants.MODULE_CONTROLLER, Constants.CONTROLLER_NAME);

            // 9. Initialize the Controller
            Controller controller = new Controller(
                    "SmartHome-Master-Controller",
                    fogDevices,
                    topologyManager.getSensors(),
                    topologyManager.getActuators()
            );

            // Submit application with its placement configuration
            controller.submitApplication(
                    application,
                    new ModulePlacementMapping(fogDevices, application, moduleMapping)
            );

            // 10. Start Simulation
            TimeKeeper.getInstance().setSimulationStartTime(Calendar.getInstance().getTimeInMillis());
            System.out.println("Running simulation for " + Constants.SIMULATION_TIME + " simulated seconds...");
            CloudSim.startSimulation();

            // Stop simulation (normally unreachable due to System.exit(0) in Controller, handled by shutdown hook)
            CloudSim.stopSimulation();

        } catch (Exception e) {
            System.err.println("Fatal error during simulation execution:");
            e.printStackTrace();
        }
    }

    /**
     * Builds the Smart Home Automation iFogSim2 Application.
     * Defines the modules, physical sensors/actuator edges, and loop routing policies.
     */
    private static Application createSmartHomeApplication(int userId) {
        Application application = Application.createApplication(Constants.APP_ID, userId);

        // 1. Add Application Modules
        application.addAppModule(Constants.MODULE_CONTROLLER, Constants.RAM_NODEMCU);
        application.addAppModule(Constants.MODULE_FOG_PROCESSOR, Constants.RAM_FOG);
        application.addAppModule(Constants.MODULE_CLOUD_HISTORY, Constants.RAM_CLOUD);

        // 2. Add App Edges
        // Sensor Edge: Aggregated Sensor readings (on NodeMCU) to Fog Processor (UP)
        // 10 MI CPU length, 100 Bytes network payload size
        application.addAppEdge(
                Constants.TUPLE_TYPE_AGGREGATED,
                Constants.MODULE_FOG_PROCESSOR,
                10,
                100,
                Constants.TUPLE_TYPE_AGGREGATED,
                Tuple.UP,
                AppEdge.SENSOR
        );

        // Actuator Edges: Commands from Fog Processor back DOWN to Fan & LED Actuators
        // 1 MI CPU length, 10 Bytes network payload size
        application.addAppEdge(
                Constants.MODULE_FOG_PROCESSOR,
                Constants.ACTUATOR_FAN,
                1,
                10,
                Constants.TUPLE_TYPE_ACTUATOR_FAN,
                Tuple.DOWN,
                AppEdge.ACTUATOR
        );
        application.addAppEdge(
                Constants.MODULE_FOG_PROCESSOR,
                Constants.ACTUATOR_LED,
                1,
                10,
                Constants.TUPLE_TYPE_ACTUATOR_LED,
                Tuple.DOWN,
                AppEdge.ACTUATOR
        );

        // Module Edge: Fog Processor reports historical database summaries to the Cloud module (UP)
        // 5 MI CPU length, 50 Bytes network payload size
        application.addAppEdge(
                Constants.MODULE_FOG_PROCESSOR,
                Constants.MODULE_CLOUD_HISTORY,
                5,
                50,
                Constants.TUPLE_TYPE_CLOUD_SUMMARY,
                Tuple.UP,
                AppEdge.MODULE
        );

        // 3. Define Input-Output Selectivity Mapping
        // Every incoming sensor reading triggers a decision and summary dispatch
        application.addTupleMapping(
                Constants.MODULE_FOG_PROCESSOR,
                Constants.TUPLE_TYPE_AGGREGATED,
                Constants.TUPLE_TYPE_ACTUATOR_FAN,
                new FractionalSelectivity(1.0)
        );
        application.addTupleMapping(
                Constants.MODULE_FOG_PROCESSOR,
                Constants.TUPLE_TYPE_AGGREGATED,
                Constants.TUPLE_TYPE_ACTUATOR_LED,
                new FractionalSelectivity(1.0)
        );
        application.addTupleMapping(
                Constants.MODULE_FOG_PROCESSOR,
                Constants.TUPLE_TYPE_AGGREGATED,
                Constants.TUPLE_TYPE_CLOUD_SUMMARY,
                new FractionalSelectivity(1.0)
        );

        // 4. Define Loops to Monitor Latency Metrics
        final AppLoop fanControlLoop = new AppLoop(new ArrayList<String>() {{
            add(Constants.TUPLE_TYPE_AGGREGATED);
            add(Constants.MODULE_FOG_PROCESSOR);
            add(Constants.ACTUATOR_FAN);
        }});
        
        final AppLoop ledControlLoop = new AppLoop(new ArrayList<String>() {{
            add(Constants.TUPLE_TYPE_AGGREGATED);
            add(Constants.MODULE_FOG_PROCESSOR);
            add(Constants.ACTUATOR_LED);
        }});

        List<AppLoop> loops = new ArrayList<>();
        loops.add(fanControlLoop);
        loops.add(ledControlLoop);
        application.setLoops(loops);

        return application;
    }

    /**
     * Utility PrintStream that writes data to two output streams simultaneously.
     */
    private static class DualStream extends OutputStream {
        private final OutputStream out1;
        private final OutputStream out2;

        public DualStream(OutputStream out1, OutputStream out2) {
            this.out1 = out1;
            this.out2 = out2;
        }

        @Override
        public void write(int b) throws IOException {
            out1.write(b);
            out2.write(b);
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            out1.write(b, off, len);
            out2.write(b, off, len);
        }

        @Override
        public void flush() throws IOException {
            out1.flush();
            out2.flush();
        }

        @Override
        public void close() throws IOException {
            out1.close();
            out2.close();
        }
    }
}
