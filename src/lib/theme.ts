/** App theme: the user's saved preference, applied as the `dark` class on <html>. */
export type ThemePref = "light" | "dark" | "system";
const KEY = "ts_theme";

export function storedTheme(): ThemePref {
    try {
        const v = localStorage.getItem(KEY);
        return v === "light" || v === "dark" ? v : "system";
    } catch {
        return "system";
    }
}

export function applyTheme(pref: ThemePref) {
    try {
        localStorage.setItem(KEY, pref);
    } catch {
        // private mode etc.: still apply for this page
    }
    const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/** Inline script for <head>: applies the saved theme before first paint (no flash). */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${KEY}");var m=window.matchMedia("(prefers-color-scheme: dark)");var d=p==="dark"||(p!=="light"&&m.matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";m.addEventListener("change",function(e){var q=localStorage.getItem("${KEY}");if(q!=="light"&&q!=="dark"){document.documentElement.classList.toggle("dark",e.matches);document.documentElement.style.colorScheme=e.matches?"dark":"light";}});}catch(e){}})();`;
