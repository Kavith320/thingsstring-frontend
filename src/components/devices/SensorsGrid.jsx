"use client";

import {
  Thermometer,
  Droplets,
  Wind,
  Gauge,
  Zap,
  Battery,
  Flame,
  Leaf,
  Sun,
  CloudRain,
  Activity,
  AlertTriangle,
  Waves,
  Sprout,
  Signal,
  Wifi,
  Timer,
  Percent,
  Ruler,
  Beaker,
  Lightbulb,
  Cpu,
  Eye,
  RadioTower,
  Unplug,
  Microchip,
  AlarmClock

} from "lucide-react";

/* ------------------ ALWAYS IGNORE THESE KEYS ------------------ */
const IGNORE_KEYS = new Set([
  "_id",
  "id",
  "uid",
  "uuid",
  "deviceId",
  "device_id",
  "chipId",
  "chip_id",
  "__v",
  "ts",
  "timestamp",
  "createdAt",
  "updatedAt",
  "time",
  "date",
  "meta",
  "raw",
  "up",
  "actuators", // you already show actuators elsewhere
]);

/* ------------------ keyword -> icon mapping ------------------ */
/**
 * The idea:
 * - normalize key (lowercase, remove symbols)
 * - match keywords
 * - return suitable icon + unit suggestion
 */
const SENSOR_CATALOG = [
  // Temperature
  {
    keywords: ["temp", "temperature", "t_c", "t_f", "heat","t","temp"],
    icon: Thermometer,
    unit: "°C",
    tone: "hot",
  },

  // Humidity
  {
    keywords: ["hum", "humidity", "rh","h","humid","hum"],
    icon: Droplets,
    unit: "%",
    tone: "wet",
  },

  // Pressure
  {
    keywords: ["pressure", "bar", "psi", "kpa", "hpa"],
    icon: Gauge,
    unit: "",
    tone: "neutral",
  },

  // CO2 / gas
  {
    keywords: ["co2", "carbon", "ppm", "gas", "mq", "smoke"],
    icon: Wind,
    unit: "ppm",
    tone: "warning",
  },

  // VOC / Air quality
  {
    keywords: ["voc", "aqi", "airquality", "air_quality"],
    icon: Activity,
    unit: "",
    tone: "warning",
  },

  // Light
  {
    keywords: ["lux", "light", "ldr", "illum"],
    icon: Lightbulb,
    unit: "lux",
    tone: "sun",
  },

  // Soil moisture
  {
    keywords: ["soil", "moist", "moisture", "vwc"],
    icon: Sprout,
    unit: "%",
    tone: "plant",
  },

   // Soil N
  {
    keywords: ["N"],
    icon: Leaf,
    unit: "ppm",
    tone: "nitrogen",
  },

   // Soil P
  {
    keywords: ["P"],
    icon: Leaf,
    unit: "ppm",
    tone: "phosphorus",
  },
   // Soil K
  {
    keywords: ["K"],
    icon: Leaf,
    unit: "ppm",
    tone: "potassium",
  },

  // pH
  {
    keywords: ["ph", "acidity", "alkaline","Ph"],
    icon: Leaf,
    unit: "",
    tone: "neutral",
  },

  // EC / TDS
  {
    keywords: ["ec", "tds", "conduct", "conductivity"],
    icon: Sprout,
    unit: "ppm",
    tone: "plant",
  },

  // Water level / flow
  {
    keywords: ["level", "waterlevel", "water_level", "flow", "lpm", "ml", "litre"],
    icon: Waves,
    unit: "",
    tone: "wet",
  },

  // Current / power / voltage
  {
    keywords: ["volt", "voltage", "vbat", "battery", "bat","vb"],
    icon: Battery,
    unit: "V",
    tone: "power",
  },
  {
    keywords: ["amp", "current", "ma", "a"],
    icon: Zap,
    unit: "A",
    tone: "power",
  },
  {
    keywords: ["watt", "power", "kw", "wh"],
    icon: Zap,
    unit: "W",
    tone: "power",
  },

  // Signal / WiFi / RSSI
  {
    keywords: ["rssi", "signal", "wifi", "ssid", "lte", "gsm","Rssi"],
    icon: Wifi,
    unit: "",
    tone: "wet",
  },

  // Rain / weather
  {
    keywords: ["rain", "rainfall"],
    icon: CloudRain,
    unit: "",
    tone: "wet",
  },
  {
    keywords: ["sun", "uv", "uvi"],
    icon: Sun,
    unit: "",
    tone: "sun",
  },

  // Flame / fire
  {
    keywords: ["flame", "fire"],
    icon: Flame,
    unit: "",
    tone: "danger",
  },

  // Percent generic
  {
    keywords: ["percent", "pct"],
    icon: Percent,
    unit: "%",
    tone: "neutral",
  },

  // Distance
  {
    keywords: ["distance", "cm", "mm", "meter", "m"],
    icon: Ruler,
    unit: "",
    tone: "neutral",
  },

  // Runtime / uptime / timer
  {
    keywords: ["uptime", "runtime", "seconds", "sec", "mins", "minutes", "timer","Up","up",],
    icon: AlarmClock,
    unit: "",
    tone: "neutral",
  },

  // CPU / memory / system
  {
    keywords: ["cpu", "ram", "mem", "heap", "disk", "storage","fw","Fw"],
    icon: Microchip,
    unit: "",
    tone: "sun",
  },
];

/* ------------------ helpers ------------------ */

function normalizeKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function titleizeKey(k) {
  const s = String(k || "").replace(/_/g, " ").trim();
  if (!s) return "-";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pickSensorMeta(key) {
  const nk = normalizeKey(key);

  for (const item of SENSOR_CATALOG) {
    if (item.keywords.some((kw) => nk.includes(normalizeKey(kw)))) {
      return item;
    }
  }
  return { icon: Eye, unit: "", tone: "neutral" };
}

function isScalar(v) {
  return v == null || ["string", "number", "boolean"].includes(typeof v);
}

function formatValue(v) {
  if (v == null) return "-";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    // keep it readable
    const abs = Math.abs(v);
    if (abs >= 1000) return String(Math.round(v));
    if (abs >= 10) return v.toFixed(1).replace(/\.0$/, "");
    return v.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  }
  return String(v);
}

function toneClasses(tone) {
  // subtle accent ring/icon background
  switch (tone) {
    case "hot":
      return "bg-red-500/10 text-red-500 border-red-500/20";

    case "lightgreen":
      return "bg-green-500/10 text-green-500 border-green-500/20";

    case "wet":
      return "bg-sky-500/10 text-sky-500 border-sky-500/20";

    case "sun":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";

    case "plant":
      return "bg-green-500/10 text-green-500 border-green-500/20";

    case "power":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";

    case "warning":
      return "bg-orange-500/10 text-orange-500 border-orange-500/20";

    case "danger":
      return "bg-rose-500/10 text-rose-500 border-rose-500/20";

    case "nitrogen":
    case "n":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400";

    case "phosphorus":
    case "p":
      return "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400";

    case "potassium":
    case "k":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400";

    case "neutral":         
    default:
      return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
  }
}

/* ------------------ component ------------------ */

export default function SensorsGrid({ lastTelemetry }) {
  const t = lastTelemetry && typeof lastTelemetry === "object" ? lastTelemetry : null;

  // build sensor entries
  const entries = (() => {
    if (!t) return [];

    return Object.entries(t)
      .filter(([k]) => !IGNORE_KEYS.has(k))
      .filter(([k]) => !IGNORE_KEYS.has(normalizeKey(k)))
      .filter(([, v]) => isScalar(v)) // only scalars
      .sort(([a], [b]) => normalizeKey(a).localeCompare(normalizeKey(b)));
  })();

  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
        No sensor data yet. Send telemetry from the device to see values here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {entries.map(([k, v]) => {
        const meta = pickSensorMeta(k);
        const Icon = meta.icon || Eye;
        const valueText = formatValue(v);
        const label = titleizeKey(k);
        const accent = toneClasses(meta.tone);

        return (
          <div
            key={k}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/35"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {label}
                </div>
                <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100 break-words">
                  {valueText}
                  {meta.unit && typeof v === "number" ? (
                    <span className="ml-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {meta.unit}
                    </span>
                  ) : null}
                </div>
              </div>

              <div
                className={`shrink-0 rounded-2xl border p-2 ${accent}`}
                title={label}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>

            {/* small hint row (optional) */}
            <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400 break-all">
              key: <span className="font-mono">{normalizeKey(k)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
