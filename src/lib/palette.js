import { useEffect, useState, useCallback } from "react";
import { getActiveTeacherId, TEACHER_CHANGED_EVENT } from "./teacher.js";

// Light/dark and colour are separate choices: the sun/moon button owns the
// first, this owns the second. Stored per teacher rather than per device —
// they share a browser, and one of them wants violet while the other doesn't.
export const PALETTES = [
  { id: "green", name: "Green" },
  { id: "violet", name: "Violet" },
];

const DEFAULT_PALETTE = "green";

function storageKey(teacherId) {
  return teacherId ? `palette--${teacherId}` : "palette";
}

function storedPalette(teacherId) {
  try {
    const value = window.localStorage.getItem(storageKey(teacherId));
    return PALETTES.some((p) => p.id === value) ? value : DEFAULT_PALETTE;
  } catch (e) {
    return DEFAULT_PALETTE;
  }
}

function applyPalette(palette) {
  const root = document.documentElement;
  // Green is the base :root block, so it carries no attribute at all.
  if (palette === DEFAULT_PALETTE) root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", palette);
}

export function usePalette() {
  const [teacherId, setTeacherId] = useState(getActiveTeacherId);
  const [palette, setPalette] = useState(() => storedPalette(getActiveTeacherId()));

  useEffect(() => {
    const onTeacherChange = () => {
      const next = getActiveTeacherId();
      setTeacherId(next);
      setPalette(storedPalette(next));
    };
    window.addEventListener(TEACHER_CHANGED_EVENT, onTeacherChange);
    return () => window.removeEventListener(TEACHER_CHANGED_EVENT, onTeacherChange);
  }, []);

  useEffect(() => {
    applyPalette(palette);
  }, [palette]);

  const togglePalette = useCallback(() => {
    setPalette((prev) => {
      const next = prev === "green" ? "violet" : "green";
      try {
        window.localStorage.setItem(storageKey(teacherId), next);
      } catch (e) {
        // silent fail: the palette just won't be remembered for next time
      }
      return next;
    });
  }, [teacherId]);

  return { palette, togglePalette };
}
