export interface AutomationFlow {
    _id: string;
    name: string;
    deviceId: string;
    enabled: boolean;
    intervalSec: number;
    metricPath: string;
    deltaThreshold: number;
    condition?: {
        operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
        value: number;
    };
    /** null for an alert-only rule (needs notify.email) */
    action: {
        deviceId?: string;
        actuatorKey: string;
        setValue: boolean | number | string;
    } | null;
    /** "Email me when this runs" */
    notify?: { email: boolean };
    /** set when the backend paused the rule (e.g. access removed) */
    disabledReason?: string | null;
    cooldownSec: number;
    ui_metadata?: Record<string, any>;
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
