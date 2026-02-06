"use client";

import { useState, useEffect } from "react";
import {
    User,
    Lock,
    Bell,
    Palette,
    Globe,
    Key,
    Shield,
    Save,
    Trash2,
    LogOut,
    Languages,
    Clock,
    Eye,
    EyeOff,
    Monitor,
    Sun,
    Moon,
    Activity,
    Cpu,
    Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUser } from "@/lib/auth";

const TABS = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "preferences", label: "Preferences", icon: Palette },
];

export default function SettingsClient() {
    const [activeTab, setActiveTab] = useState("profile");
    const [user, setUser] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

    useEffect(() => {
        setUser(getUser());
        const savedTheme = localStorage.getItem("theme") as any;
        if (savedTheme) {
            setTheme(savedTheme);
        }
    }, []);

    const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
        setTheme(newTheme);
        localStorage.setItem("theme", newTheme);

        if (newTheme === "system") {
            const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            document.documentElement.classList.toggle("dark", isDark);
        } else {
            document.documentElement.classList.toggle("dark", newTheme === "dark");
        }
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
        }, 1200);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 italic">Settings</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                        Configure your ThingsString workspace and personal preferences.
                    </p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl text-sm font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/5 dark:shadow-white/5 disabled:opacity-50"
                >
                    {isSaving ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {isSaving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            <div className="space-y-8 mt-8">
                {/* Horizontal Tabs at the top */}
                <div className="flex items-center gap-1 p-1 bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-fit overflow-x-auto scrollbar-hide">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 shrink-0",
                                    active
                                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700"
                                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                )}
                            >
                                <Icon className={cn("w-4 h-4", active ? "text-zinc-900 dark:text-white" : "text-zinc-400")} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="bg-white/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-6 md:p-10 shadow-sm backdrop-blur-xl min-h-[500px]">

                    {/* Profile Tab */}
                    {activeTab === "profile" && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h2 className="text-2xl font-bold mb-1">Public Profile</h2>
                                <p className="text-sm text-zinc-500">How you appear to other members of your organization.</p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-8 pb-8 border-b border-zinc-100 dark:border-zinc-800">
                                <div className="relative group">
                                    <div className="h-28 w-28 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border-4 border-white dark:border-zinc-900 shadow-2xl overflow-hidden">
                                        <User className="w-12 h-12 text-zinc-300" />
                                    </div>
                                    <button className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-full transition duration-300 backdrop-blur-[2px]">
                                        <span className="text-xs font-bold">Change</span>
                                    </button>
                                </div>
                                <div className="space-y-3 text-center sm:text-left">
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Profile Picture</h3>
                                        <p className="text-xs text-zinc-500 max-w-[200px]">We recommend an image of at least 400x400. Gifs work too!</p>
                                    </div>
                                    <div className="flex gap-2 justify-center sm:justify-start">
                                        <button className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                                            Upload New
                                        </button>
                                        <button className="px-4 py-2 text-red-500 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition">
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Full Name</label>
                                    <input
                                        type="text"
                                        defaultValue={user?.name || ""}
                                        className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Email Address</label>
                                    <input
                                        type="email"
                                        defaultValue={user?.email || ""}
                                        className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Bio / Organization Notes</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Tell us about yourself or your IoT projects..."
                                        className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === "security" && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h2 className="text-2xl font-bold mb-1">Security</h2>
                                <p className="text-sm text-zinc-500">Protect your account and IoT data integrity.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <Shield className="w-5 h-5 text-zinc-400" />
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Password</h3>
                                </div>
                                <div className="grid gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Current Password</label>
                                        <input type="password" placeholder="••••••••" className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition" />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">New Password</label>
                                            <input type="password" placeholder="New password" className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Confirm New Password</label>
                                            <input type="password" placeholder="Confirm new password" className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-10 border-t border-zinc-100 dark:border-zinc-800 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Key className="w-5 h-5 text-zinc-400" />
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Developer API Keys</h3>
                                    </div>
                                    <button className="text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline">
                                        Rotate Key
                                    </button>
                                </div>

                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                        <Cpu className="w-4 h-4 text-zinc-400" />
                                    </div>
                                    <input
                                        type={showApiKey ? "text" : "password"}
                                        readOnly
                                        value="ts_live_51P2u8Rj9v0x2yVw3x7z8a9b0c1d2e3f4g"
                                        className="w-full pl-12 pr-12 py-4 bg-zinc-950 border border-white/10 rounded-2xl text-sm font-mono text-zinc-300 outline-none"
                                    />
                                    <button
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute inset-y-0 right-4 flex items-center p-2 hover:text-white text-zinc-500 transition"
                                    >
                                        {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === "notifications" && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h2 className="text-2xl font-bold mb-1">Notifications</h2>
                                <p className="text-sm text-zinc-500">Configure how and when you receive alerts.</p>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { id: "notify_offline", title: "Device Connectivity", desc: "Alerts when devices go offline for more than 5 minutes." },
                                    { id: "notify_alert", title: "Critical Thresholds", desc: "Push notifications for sensor value anomalies." },
                                    { id: "notify_updates", title: "Platform Updates", desc: "Announcements about new features and scheduled maintenance." },
                                    { id: "notify_reports", title: "Weekly Insights", desc: "Summaries of your device performance and energy consumption." }
                                ].map((item) => (
                                    <div key={item.id} className="flex items-start justify-between p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition duration-300">
                                        <div className="space-y-1">
                                            <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">{item.title}</div>
                                            <div className="text-sm text-zinc-500 font-medium">{item.desc}</div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer mt-1">
                                            <input type="checkbox" className="sr-only peer" defaultChecked={item.id !== "notify_updates"} />
                                            <div className="w-12 h-6.5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black dark:peer-checked:bg-white"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Preferences Tab */}
                    {activeTab === "preferences" && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h2 className="text-2xl font-bold mb-1">Preferences</h2>
                                <p className="text-sm text-zinc-500">Personalize your ThingsString experience.</p>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Palette className="w-5 h-5 text-zinc-400" />
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Theme Appearance</h3>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        {[
                                            { id: "light", label: "Light", icon: Sun },
                                            { id: "dark", label: "Dark", icon: Moon },
                                            { id: "system", label: "System", icon: Monitor },
                                        ].map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => handleThemeChange(item.id as any)}
                                                className={cn(
                                                    "flex flex-col items-center justify-center gap-3 p-5 rounded-3xl border-2 transition-all duration-300",
                                                    theme === item.id
                                                        ? "bg-white dark:bg-zinc-900 border-zinc-900 dark:border-white shadow-xl scale-[1.02]"
                                                        : "bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-100 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700"
                                                )}
                                            >
                                                <item.icon className={cn("w-6 h-6", theme === item.id ? "text-zinc-900 dark:text-white" : "text-zinc-400")} />
                                                <span className={cn("text-sm font-bold", theme === item.id ? "text-zinc-900 dark:text-white" : "")}>{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Languages className="w-4 h-4 text-zinc-400" />
                                            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Language</label>
                                        </div>
                                        <select className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition appearance-none">
                                            <option>English (US)</option>
                                            <option>Spanish</option>
                                            <option>German</option>
                                            <option>Chinese</option>
                                        </select>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-zinc-400" />
                                            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Timezone</label>
                                        </div>
                                        <select className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition appearance-none">
                                            <option>(GMT+05:30) Colombo, Sri Lanka</option>
                                            <option>(GMT+00:00) London, United Kingdom</option>
                                            <option>(GMT-08:00) Pacific Time (US & Canada)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-16 pt-8 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                            <h4 className="text-sm font-bold text-red-500 mb-1">Danger Zone</h4>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Actions here are irreversible</p>
                        </div>
                        <button className="flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 px-6 py-3 rounded-2xl text-sm font-bold transition-all border border-red-100 dark:border-red-900/30">
                            <Trash2 className="w-4 h-4" /> Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
