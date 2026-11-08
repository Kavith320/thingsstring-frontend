import ResetPasswordClient from "./ResetPasswordClient";

// Opened from an email link: the one-time token comes in the URL
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
    const { token } = await searchParams;
    return <ResetPasswordClient token={typeof token === "string" ? token : ""} />;
}
