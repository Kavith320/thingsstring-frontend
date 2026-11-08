/**
 * Farm and industrial icons that Lucide doesn't have, drawn in the same style
 * (24×24 grid, 2px round strokes, currentColor). Stored as "ts:<name>".
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps & { children: React.ReactNode }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            {children}
        </svg>
    );
}

export const WaterPump = (p: IconProps) => (
    <Svg {...p}>
        <circle cx="10" cy="13" r="5" />
        <circle cx="10" cy="13" r="1.5" />
        <path d="M10 8V4h10" />
        <path d="M20 2v4" />
        <path d="M2 13h3" />
        <path d="M10 18v3" />
        <path d="M5 21h10" />
    </Svg>
);

export const Valve = (p: IconProps) => (
    <Svg {...p}>
        <path d="M3 9v8l9-4z" />
        <path d="M21 9v8l-9-4z" />
        <path d="M12 13V6" />
        <path d="M8 4h8" />
        <path d="M12 4v2" />
    </Svg>
);

export const Sprinkler = (p: IconProps) => (
    <Svg {...p}>
        <path d="M12 22v-8" />
        <path d="M8 22h8" />
        <rect x="9.5" y="11" width="5" height="3" rx="1" />
        <path d="M12 8V5" />
        <path d="M8.5 9 6 6.5" />
        <path d="m15.5 9 2.5-2.5" />
        <path d="M7 12H4" />
        <path d="M17 12h3" />
    </Svg>
);

export const DripIrrigation = (p: IconProps) => (
    <Svg {...p}>
        <path d="M2 5h20" />
        <path d="M6 5v3" />
        <path d="M12 5v3" />
        <path d="M18 5v3" />
        <path d="M6 11c-1 1.3-1.5 2.2-1.5 3a1.5 1.5 0 0 0 3 0c0-.8-.5-1.7-1.5-3z" />
        <path d="M12 11c-1 1.3-1.5 2.2-1.5 3a1.5 1.5 0 0 0 3 0c0-.8-.5-1.7-1.5-3z" />
        <path d="M18 11c-1 1.3-1.5 2.2-1.5 3a1.5 1.5 0 0 0 3 0c0-.8-.5-1.7-1.5-3z" />
        <path d="M2 20h20" />
    </Svg>
);

export const Pipe = (p: IconProps) => (
    <Svg {...p}>
        <path d="M5 6h7a5 5 0 0 1 5 5v8" />
        <path d="M5 11h5a2 2 0 0 1 2 2v6" />
        <path d="M4 4v9" />
        <path d="M10 20h9" />
    </Svg>
);

export const Silo = (p: IconProps) => (
    <Svg {...p}>
        <path d="M6 21V9a6 6 0 0 1 12 0v12" />
        <path d="M3 21h18" />
        <path d="M6 13h12" />
        <path d="M6 17h12" />
    </Svg>
);

export const Barn = (p: IconProps) => (
    <Svg {...p}>
        <path d="M3 21V10l9-6 9 6v11" />
        <path d="M2 21h20" />
        <path d="M9 21v-7h6v7" />
        <path d="m9 14 6 7" />
        <path d="m15 14-6 7" />
        <path d="M10.5 9h3" />
    </Svg>
);

export const Greenhouse = (p: IconProps) => (
    <Svg {...p}>
        <path d="M3 21v-9c0-4 4-7 9-7s9 3 9 7v9" />
        <path d="M2 21h20" />
        <path d="M12 5v16" />
        <path d="M7 6.5V21" />
        <path d="M17 6.5V21" />
        <path d="M3 13h18" />
    </Svg>
);

export const Cow = (p: IconProps) => (
    <Svg {...p}>
        <path d="M7 9c0-2.5 2.2-4 5-4s5 1.5 5 4v5c0 3.3-2.2 6-5 6s-5-2.7-5-6z" />
        <path d="M7 9H4.5L3 6.5" />
        <path d="M17 9h2.5L21 6.5" />
        <path d="M9 5.5 7.5 3" />
        <path d="m15 5.5 1.5-2.5" />
        <ellipse cx="12" cy="16" rx="3" ry="2" />
        <path d="M10 10h.01" />
        <path d="M14 10h.01" />
    </Svg>
);

export const WaterTank = (p: IconProps) => (
    <Svg {...p}>
        <ellipse cx="11" cy="5" rx="7" ry="2" />
        <path d="M4 5v14c0 1.1 3.1 2 7 2s7-.9 7-2V5" />
        <path d="M4 13c0 1.1 3.1 2 7 2s7-.9 7-2" />
        <path d="M18 9h3v8h-3" />
    </Svg>
);

export const Motor = (p: IconProps) => (
    <Svg {...p}>
        <rect x="2" y="7" width="14" height="10" rx="2" />
        <path d="M16 12h6" />
        <path d="M6 7V5h6v2" />
        <path d="M5 17v2" />
        <path d="M13 17v2" />
        <path d="M6 10v4" />
        <path d="M9 10v4" />
        <path d="M12 10v4" />
    </Svg>
);

export const Conveyor = (p: IconProps) => (
    <Svg {...p}>
        <rect x="2" y="14" width="20" height="6" rx="3" />
        <circle cx="5" cy="17" r="1" />
        <circle cx="19" cy="17" r="1" />
        <rect x="5" y="7" width="5" height="7" rx="1" />
        <rect x="13" y="9" width="5" height="5" rx="1" />
    </Svg>
);

/** name -> component, keyed the way they are stored ("ts:<name>") */
export const CUSTOM_ICONS = {
    "water-pump": WaterPump,
    valve: Valve,
    sprinkler: Sprinkler,
    "drip-irrigation": DripIrrigation,
    pipe: Pipe,
    silo: Silo,
    barn: Barn,
    greenhouse: Greenhouse,
    cow: Cow,
    "water-tank": WaterTank,
    motor: Motor,
    conveyor: Conveyor,
} as const;
