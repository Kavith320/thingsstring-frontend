import type { Metadata } from "next";

// Public wall screens are opened by link only: keep them out of search engines and
// never send the page address to other sites.
export const metadata: Metadata = {
    title: "Wall display · ThingsString",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: "no-referrer",
};

export default function WallLayout({ children }: { children: React.ReactNode }) {
    return children;
}
