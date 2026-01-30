export type ScheduleType = "every_second" | "every_minute" | "every_hour" | "daily";

export interface ScheduleUiState {
    type: ScheduleType;
    time: string; // HH:MM for daily
    intervalValue: number; // for second, minute, hour
    cron: string; // internal storage
}

/**
 * Converts UI state to a Cron string (6 fields: sec min hour day month day-of-week)
 */
export function uiToCron(state: ScheduleUiState): string {
    const val = Math.max(1, Math.floor(state.intervalValue || 1));

    if (state.type === "every_second") {
        // "*/5 * * * * *" or "* * * * * *"
        // Limit to reasonable minimum? backend might choke on 1s.
        // Assuming backend handles it.
        if (val === 1) return "* * * * * *";
        return `*/${val} * * * * *`;
    }

    if (state.type === "every_minute") {
        // "0 */5 * * * *"
        if (val === 1) return "0 * * * * *";
        return `0 */${val} * * * *`;
    }

    if (state.type === "every_hour") {
        // "0 0 */5 * * *"
        if (val === 1) return "0 0 * * * *";
        return `0 0 */${val} * * *`;
    }

    if (state.type === "daily") {
        const [h, m] = state.time.split(":").map(Number);
        // "0 30 08 * * *"
        return `0 ${m || 0} ${h || 0} * * *`;
    }

    return state.cron;
}

/**
 * Tries to parse a Cron string back into UI state.
 * Returns ParseResult with best guess type.
 */
export function cronToUi(cronInput: string): ScheduleUiState {
    const cron = cronInput || "0 0 8 * * *";
    const parts = cron.trim().split(/\s+/);

    // Standardize to 6 fields
    const fields = parts.length === 5 ? ["0", ...parts] : parts;
    const [sec, min, hour, day, month, dow] = fields;

    // 1. Daily: "0 30 08 * * *"
    // Checks: sec=0, min/hour fixed, rest *
    if (
        sec === "0" &&
        !min.includes("*") && !min.includes("/") &&
        !hour.includes("*") && !hour.includes("/") &&
        day === "*" && month === "*" && dow === "*"
    ) {
        const h = hour.padStart(2, "0");
        const m = min.padStart(2, "0");
        return {
            type: "daily",
            time: `${h}:${m}`,
            intervalValue: 1,
            cron,
        };
    }

    // 2. Every Hour: "0 0 */N * * *" or "0 0 * * * *"
    if (
        sec === "0" && min === "0" &&
        day === "*" && month === "*" && dow === "*"
    ) {
        if (hour === "*") {
            return { type: "every_hour", time: "00:00", intervalValue: 1, cron };
        }
        if (hour.startsWith("*/")) {
            const val = parseInt(hour.replace("*/", ""), 10);
            return { type: "every_hour", time: "00:00", intervalValue: isNaN(val) ? 1 : val, cron };
        }
    }

    // 3. Every Minute: "0 */N * * * *" or "0 * * * * *"
    if (
        sec === "0" &&
        hour === "*" && day === "*" && month === "*" && dow === "*"
    ) {
        if (min === "*") {
            return { type: "every_minute", time: "00:00", intervalValue: 1, cron };
        }
        if (min.startsWith("*/")) {
            const val = parseInt(min.replace("*/", ""), 10);
            return { type: "every_minute", time: "00:00", intervalValue: isNaN(val) ? 1 : val, cron };
        }
    }

    // 4. Every Second: "*/N * * * * *" or "* * * * * *"
    if (
        min === "*" && hour === "*" && day === "*" && month === "*" && dow === "*"
    ) {
        if (sec === "*") {
            return { type: "every_second", time: "00:00", intervalValue: 1, cron };
        }
        if (sec.startsWith("*/")) {
            const val = parseInt(sec.replace("*/", ""), 10);
            return { type: "every_second", time: "00:00", intervalValue: isNaN(val) ? 1 : val, cron };
        }
    }

    // Fallback: Default to daily if unrecognizable, or maybe just return a custom-like state wrapped in daily?
    // Since we removed "custom" from UI, we have to map it to SOMETHING. 
    // Let's map to Daily at 00:00 as a fallback but keep the cron string if re-saved?
    // Actually, user said "no need advanced", so imperfect mapping is acceptable, 
    // but let's try to preserve standard daily.

    return {
        type: "daily",
        time: "08:00",
        intervalValue: 1,
        cron,
    };
}
