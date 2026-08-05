import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import UnscrambleSentences from "./games/unscramble/UnscrambleSentences.jsx";
import OpenTheBoxes from "./games/openTheBoxes/OpenTheBoxes.jsx";
import SpinTheWheel from "./games/spinTheWheel/SpinTheWheel.jsx";
import Whiteboard from "./games/whiteboard/Whiteboard.jsx";
import BackgroundFX from "./components/BackgroundFX.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import PaletteToggle from "./components/PaletteToggle.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <BackgroundFX />
      <PaletteToggle />
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/unscramble" element={<UnscrambleSentences />} />
        <Route path="/unscramble/:setId" element={<UnscrambleSentences />} />
        <Route path="/open-the-boxes" element={<OpenTheBoxes />} />
        <Route path="/open-the-boxes/:setId" element={<OpenTheBoxes />} />
        <Route path="/spin-the-wheel" element={<SpinTheWheel />} />
        <Route path="/spin-the-wheel/:setId" element={<SpinTheWheel />} />
        <Route path="/whiteboard" element={<Whiteboard />} />
        <Route path="/whiteboard/:studentId" element={<Whiteboard />} />
      </Routes>
    </BrowserRouter>
  );
}
