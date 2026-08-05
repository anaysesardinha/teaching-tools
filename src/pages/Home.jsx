import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  TEACHERS,
  getActiveTeacherId,
  setActiveTeacherId,
  clearActiveTeacher,
  teacherName,
} from "../lib/teacher.js";
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
    id: "whiteboard",
    name: "Whiteboard",
    description: "A persistent board per student — pan, zoom, and jot notes.",
    path: "/whiteboard",
    enabled: true,
    // Opens in its own tab: the board usually lives on a second screen while a
    // game runs on the first, and one tab can only show one of them.
    newTab: true,
  },
  {
    id: "fill-in-the-blanks",
    name: "Fill in the Blanks",
    description: "Coming soon.",
    enabled: false,
  },
];

export default function Home() {
  const [teacherId, setTeacherId] = useState(getActiveTeacherId);

  function chooseTeacher(id) {
    setActiveTeacherId(id);
    setTeacherId(id);
  }

  function switchTeacher() {
    clearActiveTeacher();
    setTeacherId(null);
  }

  if (!teacherId) {
    return (
      <div className="home-root">
        <div className="home-shell">
          <div className="home-eyebrow">Classroom Toolkit</div>
          <h1 className="home-title">Who's teaching?</h1>

          <div className="home-grid">
            {TEACHERS.map((teacher) => (
              <button
                className="home-card home-card-button"
                key={teacher.id}
                onClick={() => chooseTeacher(teacher.id)}
              >
                <div className="home-card-name">{teacher.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-root">
      <div className="home-shell">
        <div className="home-topbar">
          <div className="home-eyebrow">Classroom Toolkit</div>
          <button className="home-switch" onClick={switchTeacher}>
            {teacherName(teacherId)} · Switch
          </button>
        </div>
        <h1 className="home-title">Select a tool to build your next class.</h1>

        <div className="home-grid">
          {GAMES.map((game) =>
            game.enabled ? (
              <Link
                className="home-card"
                to={game.path}
                key={game.id}
                target={game.newTab ? "_blank" : undefined}
                rel={game.newTab ? "noopener" : undefined}
              >
                <div className="home-card-name">
                  {game.name}
                  {game.newTab && (
                    <span className="home-card-newtab" aria-label="opens in a new tab">
                      ↗
                    </span>
                  )}
                </div>
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
