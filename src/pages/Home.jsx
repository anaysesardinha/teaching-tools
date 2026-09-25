import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  TEACHERS,
  getActiveTeacherId,
  setActiveTeacherId,
  clearActiveTeacher,
  teacherName,
} from "../lib/teacher.js";
import {
  exportTeacherData,
  importTeacherData,
  daysSinceLastBackup,
  shouldRemindBackup,
} from "../lib/backup.js";
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
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupFlash, setBackupFlash] = useState("");
  const [backupError, setBackupError] = useState("");
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const importInputRef = useRef(null);

  function chooseTeacher(id) {
    setActiveTeacherId(id);
    setTeacherId(id);
  }

  function switchTeacher() {
    clearActiveTeacher();
    setTeacherId(null);
  }

  function flashBackupMessage(message) {
    setBackupFlash(message);
    setTimeout(() => setBackupFlash(""), 3000);
  }

  async function handleExport() {
    setBackupBusy(true);
    setBackupError("");
    try {
      await exportTeacherData(teacherId);
      flashBackupMessage("Backup downloaded!");
    } catch (e) {
      setBackupError("Couldn't export your data — check your connection and try again.");
    } finally {
      setBackupBusy(false);
    }
  }

  function handleImportFileChosen(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) setPendingImportFile(file);
  }

  async function confirmImport() {
    const file = pendingImportFile;
    setPendingImportFile(null);
    setBackupBusy(true);
    setBackupError("");
    try {
      await importTeacherData(teacherId, file);
      flashBackupMessage("Backup imported! Reopen a tool to see the restored data.");
    } catch (e) {
      setBackupError(e.message || "Couldn't import that file — check it's a teaching-tools backup.");
    } finally {
      setBackupBusy(false);
    }
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

        {shouldRemindBackup(teacherId) && (
          <div className="home-backup-banner">
            {daysSinceLastBackup(teacherId) === null
              ? "You haven't backed up your data yet."
              : `It's been ${daysSinceLastBackup(teacherId)} days since your last backup.`}{" "}
            A hosted database can disappear without warning — export a copy just in case.
          </div>
        )}

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

        <div className="home-backup">
          <div className="home-backup-row">
            <div>
              <div className="home-backup-title">Backup</div>
              <div className="home-backup-desc">
                {daysSinceLastBackup(teacherId) === null
                  ? "Download a copy of all your sets, questions, and boards."
                  : `Last backup: ${daysSinceLastBackup(teacherId)} day(s) ago.`}
              </div>
            </div>
            <div className="home-row">
              <button className="home-btn home-btn-primary home-btn-sm" onClick={handleExport} disabled={backupBusy}>
                Export backup
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={handleImportFileChosen}
              />
              <button
                className="home-btn home-btn-ghost home-btn-sm"
                onClick={() => importInputRef.current?.click()}
                disabled={backupBusy}
              >
                Import backup
              </button>
            </div>
          </div>
          {backupFlash && <div className="home-backup-flash">{backupFlash}</div>}
          {backupError && <div className="home-backup-error">{backupError}</div>}
        </div>

        {pendingImportFile && (
          <div className="home-backup-confirm">
            <div>
              Importing <strong>{pendingImportFile.name}</strong> will overwrite your current sets,
              questions, and boards with what's in that file. This can't be undone.
            </div>
            <div className="home-row">
              <button className="home-btn home-btn-danger home-btn-sm" onClick={confirmImport}>
                Overwrite and import
              </button>
              <button className="home-btn home-btn-ghost home-btn-sm" onClick={() => setPendingImportFile(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
