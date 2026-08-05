import React from "react";
import { usePalette } from "../lib/palette.js";
import "./PaletteToggle.css";

export default function PaletteToggle() {
  const { palette, togglePalette } = usePalette();
  const label = palette === "violet" ? "Switch to green" : "Switch to violet";

  return (
    <button
      className="palette-toggle"
      onClick={togglePalette}
      aria-label={label}
      title={label}
    >
      {/* Two overlapping discs in the colours you'd get, so the button shows
          the choice rather than describing it. */}
      <span className="palette-swatch palette-swatch-accent" aria-hidden="true" />
      <span className="palette-swatch palette-swatch-strong" aria-hidden="true" />
    </button>
  );
}
