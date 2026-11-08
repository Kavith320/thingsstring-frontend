// "custom" = a cron this form can't edit (e.g. made elsewhere). It is kept unchanged on save.
export type ScheduleType = "every_second" | "every_minute" | "every_hour" | "daily" | "custom";

export interface ScheduleUiState {
    type: ScheduleType;
    time: string; // HH:MM for daily
    dow?: string; // day-of-week field for daily ("*" = every day, "1-5" = weekdays, ...)
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
        return `0 ${m || 0} ${h || 0} * * ${state.dow || "*"}`;
    }

    if (state.type === "custom") return state.cron;

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

    if (fields.length !== 6) return { type: "custom", time: "00:00", intervalValue: 1, cron };

    // 1. Daily: "0 30 08 * * *", optionally on some weekdays ("0 30 18 * * 1-5")
    if (
        sec === "0" &&
        /^\d{1,2}$/.test(min) && /^\d{1,2}$/.test(hour) &&
        day === "*" && month === "*" && /^(\*|[0-7](-[0-7])?(,[0-7](-[0-7])?)*)$/.test(dow)
    ) {
        const h = hour.padStart(2, "0");
        const m = min.padStart(2, "0");
        return {
            type: "daily",
            time: `${h}:${m}`,
            dow,
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

    // Anything else is shown and saved as-is instead of being silently rewritten
    return { type: "custom", time: "00:00", intervalValue: 1, cron };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function describeDays(dow: string | undefined): string {
    if (!dow || dow === "*") return "Every day";
    if (dow === "1-5") return "Weekdays";
    if (dow === "0,6" || dow === "6,0" || dow === "6-7") return "Weekends";
    return dow
        .split(",")
        .map((part) => {
            const [a, b] = part.split("-").map(Number);
            return b === undefined ? DAY_NAMES[a] : `${DAY_NAMES[a]}–${DAY_NAMES[b]}`;
        })
        .join(", ");
}

/** Human description of a schedule's timing, e.g. "Weekdays at 18:30". */
export function describeCron(cron: string): string {
    const ui = cronToUi(cron);
    const n = ui.intervalValue;
    switch (ui.type) {
        case "daily":
            return `${describeDays(ui.dow)} at ${ui.time}`;
        case "every_hour":
            return n === 1 ? "Every hour" : `Every ${n} hours`;
        case "every_minute":
            return n === 1 ? "Every minute" : `Every ${n} minutes`;
        case "every_second":
            return n === 1 ? "Every second" : `Every ${n} seconds`;
        default:
            return `Custom timing (${cron})`;
    }
}

/** 900 -> "15 min", 5400 -> "1 h 30 min", 45 -> "45 s". */
export function formatDuration(sec: number): string {
    const s = Math.max(0, Math.round(sec || 0));
    if (s < 60) return `${s} s`;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rest = s % 60;
    const parts = [];
    if (h) parts.push(`${h} h`);
    if (m) parts.push(`${m} min`);
    if (!h && rest) parts.push(`${rest} s`);
    return parts.join(" ");
}
