/**
 * The ThingsString mark, drawing itself on first paint (CSS in globals.css, ".ts-intro").
 * pathLength="1" lets the CSS animate stroke-dashoffset 1 -> 0 without measuring the paths.
 */
export default function IntroLogo({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="-30 85 460 175" fill="none" xmlns="http://www.w3.org/2000/svg" className={`ts-intro ${className}`} role="img" aria-label="ThingsString logo">
            <path className="ts-line" pathLength={1} d="M 0,160 C 40,155 60,110 100,110 S 150,180 200,180 S 250,110 300,110 S 360,110 400,150" stroke="#4898cf" strokeWidth={24} strokeLinecap="round" />
            <path className="ts-line ts-line-branch" pathLength={1} d="M 200,180 C 230,180 250,240 300,240" stroke="#7add8f" strokeWidth={24} strokeLinecap="round" />
            <circle className="ts-node ts-node-1" cx="100" cy="110" r="26" fill="#4898cf" />
            <circle className="ts-node ts-node-2" cx="200" cy="180" r="26" fill="#58b3a4" />
            <circle className="ts-node ts-node-3" cx="300" cy="110" r="26" fill="#58b3a4" />
            <circle className="ts-node ts-node-4" cx="300" cy="240" r="26" fill="#7add8f" />
        </svg>
    );
}
