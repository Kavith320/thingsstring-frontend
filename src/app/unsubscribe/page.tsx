import UnsubscribeClient from "./UnsubscribeClient";

// Opened from an email link: the one-time token comes in the URL
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
    const { token } = await searchParams;
    return <UnsubscribeClient token={typeof token === "string" ? token : ""} />;
}
