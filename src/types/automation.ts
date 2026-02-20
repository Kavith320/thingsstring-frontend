export interface AutomationFlow {
    _id: string;
    name: string;
    deviceId: string;
    enabled: boolean;
    intervalSec: number;
    metricPath: string;
    deltaThreshold: number;
    action: {
        deviceId?: string;
        actuatorKey: string;
        setValue: boolean | number | string;
    };
    cooldownSec: number;
    createdAt: string;
    updatedAt: string;
}

export interface Device {
    _id: string;
    deviceId: string;
    name: string;
    config?: {
        actuators?: Record<string, any>;
        device?: {
            device_id?: string;
            name?: string;
            model?: string;
        };
    };
    last_telemetry?: Record<string, any>;
}
