import { useEffect, useState, useCallback } from "react";
import { getJSON, setJSON } from "./storage.js";

const STORAGE_KEY = "theme-preference";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function systemTheme() {
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function resolveInitialTheme() {
  const stored = getJSON(STORAGE_KEY, null);
  return stored === "dark" || stored === "light" ? stored : systemTheme();
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
      if (getJSON(STORAGE_KEY, null) === null) {
        setTheme(systemTheme());
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      setJSON(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
