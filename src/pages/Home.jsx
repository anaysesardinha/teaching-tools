import React from "react";
import { Link } from "react-router-dom";
import "./Home.css";

const GAMES = [
  {
    id: "unscramble",
    name: "Unscramble Sentences",
    description: "Drag words into place to rebuild a sentence.",
    path: "/unscramble",
    enabled: true,
  },
  {
    id: "spin-the-wheel",
    name: "Spin the Wheel",
    description: "Spin the wheel to randomly pick an item.",
    path: "/spin-the-wheel",
    enabled: true,
  },
  {
    id: "open-the-boxes",
    name: "Open the Boxes",
    description: "Click a box to reveal a discussion question.",
    path: "/open-the-boxes",
    enabled: true,
  },
  {
    id: "fill-in-the-blanks",
    name: "Fill in the Blanks",
    description: "Coming soon.",
    enabled: false,
  },
];

export default function Home() {
  return (
    <div className="home-root">
      <div className="home-shell">
        <div className="home-eyebrow">Classroom Games</div>
        <h1 className="home-title">Pick a game</h1>

        <div className="home-grid">
          {GAMES.map((game) =>
            game.enabled ? (
              <Link className="home-card" to={game.path} key={game.id}>
                <div className="home-card-name">{game.name}</div>
                <div className="home-card-desc">{game.description}</div>
              </Link>
            ) : (
              <div className="home-card home-card-disabled" key={game.id}>
                <div className="home-card-name">{game.name}</div>
                <div className="home-card-desc">{game.description}</div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
