import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import UnscrambleSentences from "./games/unscramble/UnscrambleSentences.jsx";
import OpenTheBoxes from "./games/openTheBoxes/OpenTheBoxes.jsx";
import SpinTheWheel from "./games/spinTheWheel/SpinTheWheel.jsx";
import BackgroundFX from "./components/BackgroundFX.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <BackgroundFX />
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/unscramble" element={<UnscrambleSentences />} />
        <Route path="/open-the-boxes" element={<OpenTheBoxes />} />
        <Route path="/spin-the-wheel" element={<SpinTheWheel />} />
      </Routes>
    </BrowserRouter>
  );
}
