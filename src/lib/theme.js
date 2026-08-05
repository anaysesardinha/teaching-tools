import { useEffect, useState, useCallback } from "react";

// The theme is a per-device UI preference, not shared content, so it lives in
// localStorage rather than the cloud store — that also keeps it synchronous,
// which is what resolveInitialTheme() needs.
const STORAGE_KEY = "theme-preference";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function storedTheme() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch (e) {
    return null;
  }
}

function storeTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    // silent fail: the theme just won't be remembered for next time
  }
}

function systemTheme() {
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function resolveInitialTheme() {
  return storedTheme() || systemTheme();
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [theme, setTheme] = useState(resolveInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mql = window.matchMedia(MEDIA_QUERY);
    const onChange = () => {
      if (storedTheme() === null) {
        setTheme(systemTheme());
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      storeTheme(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
