import { useSyncExternalStore } from "react";

/*
  Light / dark theme. Light is the default because projectors wash out dark themes (brief, section 6).
  The choice is per browser (localStorage) and applied as <html data-theme="...">.
  Colours live in CSS variables (index.css); `token()` reads one for places that cannot use CSS
  variables directly, such as SVG attributes drawn by Leaflet and Recharts.
*/
export type Theme = "light" | "dark";
const KEY = "ct.theme";
const listeners = new Set<() => void>();

function stored(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

let current: Theme = stored();
if (typeof document !== "undefined") document.documentElement.dataset.theme = current;

export function setTheme(next: Theme) {
  const root = document.documentElement;
  root.classList.add("theme-anim");
  root.dataset.theme = next;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* the theme still applies for this visit */
  }
  window.setTimeout(() => root.classList.remove("theme-anim"), 350);
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => current,
    () => "light",
  );
}

/** Current value of a colour variable from index.css, e.g. token("--ink"). */
export function token(name: string): string {
  if (typeof document === "undefined") return "#000";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#000";
}
