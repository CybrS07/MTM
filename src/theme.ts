// Palette 1 (light) and palette 2 (dark). Change colours here only.
export const palette1 = { tomato: "#F06543", platinum: "#E8E9EB", softLinen: "#E0DFD5", gunmetal: "#313638" };
export const palette2 = { onyx: "#121619", pineTeal: "#2D4739", seaGreen: "#09814A", drySage: "#BCB382" };

export type Mode = "light" | "dark";

export const themes: Record<Mode, Record<string, string>> = {
  light: {
    bg: palette1.platinum,
    surface: palette1.softLinen,
    surface2: "#FFFFFF",
    text: palette1.gunmetal,
    heading: palette1.gunmetal,
    muted: "#5d6366",
    accent: palette1.tomato,
    "on-accent": "#FFFFFF",
    border: "#c9c8bd",
    ok: palette1.gunmetal,
    danger: palette1.tomato,
  },
  dark: {
    bg: palette2.onyx,
    surface: palette2.pineTeal,
    surface2: "#1b2a22",
    text: palette2.drySage,
    heading: "#FFFFFF",
    muted: "#9d9770",
    accent: palette2.seaGreen,
    "on-accent": "#FFFFFF",
    border: "#3b5a4a",
    ok: "#4ade9a",
    danger: palette1.tomato,
  },
};

const KEY = "m2m-theme";
// localStorage can throw (private windows, blocked storage). A throw here would blank the page, so guard it.
const stored = (): Mode | null => { try { const v = localStorage.getItem(KEY); return v === "dark" || v === "light" ? v : null; } catch { return null; } };
export const initialMode = (): Mode =>
  stored() ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export function applyTheme(mode: Mode) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themes[mode])) root.style.setProperty(`--${k}`, v);
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
}
