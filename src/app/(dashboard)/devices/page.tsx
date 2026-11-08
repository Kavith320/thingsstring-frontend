import DevicesClient from "./DevicesClient";

// Devices are loaded in the browser: the login token lives in localStorage, so a
// server-side fetch here can't authenticate (it always got 401 and an empty list).
export default function DevicesPage() {
    return <DevicesClient initialDevices={[]} />;
}
