import SettingsClient from "./SettingsClient";

export const metadata = {
    title: "Settings | ThingsString",
    description: "Manage your account and app preferences",
};

export default function SettingsPage() {
    return <SettingsClient />;
}
