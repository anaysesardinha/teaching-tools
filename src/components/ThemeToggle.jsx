import React from "react";
import { useTheme } from "../lib/theme.js";
import "./ThemeToggle.css";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M20.7 14.9c-.2-.3-.6-.5-1-.4-1 .3-2 .4-3 .3-3.6-.4-6.5-3.3-6.9-6.9-.1-1 0-2 .3-3 .1-.4-.1-.8-.4-1-.3-.2-.8-.2-1.1 0-3.4 1.9-5.3 5.8-4.5 9.8.8 4 4.2 7.1 8.3 7.5 4.2.4 8-2 9.5-5.8.2-.4.1-.8-.2-1.1z" />
        </svg>
      )}
    </button>
  );
}
