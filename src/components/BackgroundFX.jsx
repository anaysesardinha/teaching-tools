import React from "react";
import "./BackgroundFX.css";

export default function BackgroundFX() {
  return (
    <div className="bgfx" aria-hidden="true">
      <div className="bgfx-blob bgfx-blob-1" />
      <div className="bgfx-blob bgfx-blob-2" />
      <div className="bgfx-blob bgfx-blob-3" />
    </div>
  );
}
