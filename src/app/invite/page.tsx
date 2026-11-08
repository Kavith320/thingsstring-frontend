import InviteClient from "./InviteClient";

// Opened from an email link: the one-time token comes in the URL
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
    const { token } = await searchParams;
    return <InviteClient token={typeof token === "string" ? token : ""} />;
}
