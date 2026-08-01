import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { getJSON, setJSON, removeItem } from "../../lib/storage.js";
import "./openTheBoxes.css";

const STORAGE_KEY = "open-the-boxes-sets";

function parseQuestions(text) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function OpenTheBoxes() {
  const { setId: sharedSetId } = useParams();
  const [view, setView] = useState("loading"); // loading | list | form | play | notfound | error
  const [sets, setSets] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [activeSetId, setActiveSetId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // form state
  const [formName, setFormName] = useState("");
  const [formText, setFormText] = useState("");
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef(null);

  // play state
  const [openedBoxIndex, setOpenedBoxIndex] = useState(null);
  const [openedFlags, setOpenedFlags] = useState([]);
  const [saveFlash, setSaveFlash] = useState(false);
  const [persistError, setPersistError] = useState(false);

  const loadSets = useCallback(async () => {
    setView("loading");
    try {
      const parsed = await getJSON(STORAGE_KEY, []);
      const list = Array.isArray(parsed) ? parsed : [];
      setSets(list);
      if (sharedSetId) {
        const shared = list.find((s) => s.id === sharedSetId);
        if (shared) {
          setActiveSetId(shared.id);
          setOpenedFlags(Array(shared.questions.length).fill(false));
          setOpenedBoxIndex(null);
          setView("play");
        } else {
          setView("notfound");
        }
      } else {
        setView("list");
      }
    } catch (e) {
      setView("error");
    }
  }, [sharedSetId]);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  const persistSets = useCallback((nextSets) => {
    setSets(nextSets);
    setJSON(STORAGE_KEY, nextSets).catch(() => {
      setPersistError(true);
      setTimeout(() => setPersistError(false), 2500);
    });
  }, []);

  function openNewSetForm() {
    setFormName("");
    setFormText("");
    setFormError("");
    setView("form");
  }

  function handleFileImport(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = String(evt.target.result || "");
      setFormText((prev) => (prev.trim() ? prev.trim() + "\n" + content : content));
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  function saveNewSet() {
    const questions = parseQuestions(formText);
    if (!formName.trim()) {
      setFormError("Give the set a name.");
      return;
    }
    if (questions.length === 0) {
      setFormError("Add at least one question.");
      return;
    }
    const newSet = {
      id: String(Date.now()),
      name: formName.trim(),
      questions,
    };
    const next = [...sets, newSet];
    persistSets(next);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
    setView("list");
  }

  function deleteSet(id) {
    const next = sets.filter((s) => s.id !== id);
    persistSets(next);
    setConfirmDeleteId(null);
  }

  function resetAllData() {
    setSets([]);
    setConfirmResetAll(false);
    removeItem(STORAGE_KEY).catch(() => {
      setPersistError(true);
      setTimeout(() => setPersistError(false), 2500);
    });
  }

  function copyShareLink(setId) {
    const url = `${window.location.origin}/open-the-boxes/${setId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(setId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function startPlay(setId) {
    const set = sets.find((s) => s.id === setId);
    setActiveSetId(setId);
    setOpenedFlags(Array(set ? set.questions.length : 0).fill(false));
    setOpenedBoxIndex(null);
    setView("play");
  }

  function resetBoxes() {
    setOpenedFlags((prev) => prev.map(() => false));
    setOpenedBoxIndex(null);
  }

  function openBox(index) {
    setOpenedFlags((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    setOpenedBoxIndex(index);
  }

  const activeSet = sets.find((s) => s.id === activeSetId);

  return (
    <div className="otb-root">
      <div className="otb-shell">
        {view === "loading" && (
          <div className="otb-empty">Loading saved sets...</div>
        )}

        {view === "error" && (
          <div className="otb-card otb-empty">
            Couldn't load your sets. Check your connection and try again.
            <div className="otb-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <button className="otb-btn otb-btn-primary otb-btn-sm" onClick={loadSets}>
                Retry
              </button>
            </div>
          </div>
        )}

        {view === "notfound" && (
          <div className="otb-card otb-empty">
            This set doesn't exist or was removed.
            <div className="otb-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <Link className="otb-btn otb-btn-primary otb-btn-sm" to="/">
                Home
              </Link>
            </div>
          </div>
        )}

        {view === "list" && (
          <>
            <div className="otb-eyebrow">Open the Boxes</div>
            <div className="otb-topbar">
              <h1 className="otb-title" style={{ marginBottom: 0 }}>Question sets</h1>
              {saveFlash && <span className="otb-flash">Set saved!</span>}
              {persistError && <span className="otb-flash otb-flash-error">Couldn't save — check connection</span>}
            </div>

            {sets.length === 0 ? (
              <div className="otb-card otb-empty" style={{ marginBottom: 20 }}>
                No sets yet.
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {sets.map((s) => (
                  <div className="otb-list-item" key={s.id}>
                    <div>
                      <div className="otb-list-item-name">{s.name}</div>
                      <div className="otb-list-item-meta">{s.questions.length} question(s)</div>
                    </div>
                    <div className="otb-row">
                      <button className="otb-btn otb-btn-primary otb-btn-sm" onClick={() => startPlay(s.id)}>
                        Play
                      </button>
                      <button className="otb-btn otb-btn-ghost otb-btn-sm" onClick={() => copyShareLink(s.id)}>
                        {copiedId === s.id ? "Copied!" : "Share"}
                      </button>
                      {confirmDeleteId === s.id ? (
                        <button className="otb-btn otb-btn-danger otb-btn-sm" onClick={() => deleteSet(s.id)}>
                          Confirm
                        </button>
                      ) : (
                        <button className="otb-btn otb-btn-ghost otb-btn-sm" onClick={() => setConfirmDeleteId(s.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="otb-row" style={{ justifyContent: "space-between" }}>
              <div className="otb-row">
                <button className="otb-btn otb-btn-primary" onClick={openNewSetForm}>
                  + New set
                </button>
                <Link className="otb-btn otb-btn-ghost" to="/">
                  Home
                </Link>
              </div>
              {sets.length > 0 && (
                confirmResetAll ? (
                  <button className="otb-btn otb-btn-danger otb-btn-sm" onClick={resetAllData}>
                    Confirm clear all data
                  </button>
                ) : (
                  <button className="otb-btn otb-btn-ghost otb-btn-sm" onClick={() => setConfirmResetAll(true)}>
                    Clear all data
                  </button>
                )
              )}
            </div>
          </>
        )}

        {view === "form" && (
          <>
            <div className="otb-eyebrow">Open the Boxes</div>
            <h1 className="otb-title">New question set</h1>
            <div className="otb-card">
              <label className="otb-field-label" htmlFor="otb-name">Set name</label>
              <input
                id="otb-name"
                className="otb-input"
                placeholder="e.g. Icebreaker Questions - Grade 7"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{ marginBottom: 16 }}
              />

              <label className="otb-field-label" htmlFor="otb-text">Questions (one per line)</label>
              <textarea
                id="otb-text"
                className="otb-textarea"
                placeholder={"What did you do last weekend?\nWhat's your favorite season and why?"}
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
              />
              <div className="otb-hint">
                {parseQuestions(formText).length} question(s) detected
              </div>

              <div className="otb-row" style={{ marginTop: 14 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  style={{ display: "none" }}
                  onChange={handleFileImport}
                />
                <button className="otb-btn otb-btn-ghost otb-btn-sm" onClick={() => fileInputRef.current?.click()}>
                  Import .txt file
                </button>
              </div>

              {formError && <div className="otb-error">{formError}</div>}

              <div className="otb-row" style={{ marginTop: 20 }}>
                <button className="otb-btn otb-btn-primary" onClick={saveNewSet}>
                  Save set
                </button>
                <button className="otb-btn otb-btn-ghost" onClick={() => setView("list")}>
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

        {view === "play" && activeSet && (
          <>
            <div className="otb-eyebrow">{activeSet.name}</div>
            <div className="otb-topbar">
              <h1 className="otb-title" style={{ marginBottom: 0 }}>Open the Boxes</h1>
              <button className="otb-btn otb-btn-ghost otb-btn-sm" onClick={() => setView("list")}>
                Back
              </button>
            </div>

            {openedBoxIndex === null ? (
              <>
                <div className="otb-grid">
                  {activeSet.questions.map((_, index) => (
                    <div
                      key={index}
                      className={"otb-box" + (openedFlags[index] ? " otb-box-opened" : "")}
                      onClick={() => openBox(index)}
                    >
                      {openedFlags[index] && <span className="otb-box-check">✓</span>}
                      {index + 1}
                    </div>
                  ))}
                </div>
                <button className="otb-btn otb-btn-ghost otb-reset-btn" onClick={resetBoxes}>
                  Reset boxes
                </button>
              </>
            ) : (
              <div className="otb-card otb-question-card">
                <div className="otb-question-progress">
                  Question {openedBoxIndex + 1} of {activeSet.questions.length}
                </div>
                <div className="otb-question-text">{activeSet.questions[openedBoxIndex]}</div>
                <button className="otb-btn otb-btn-primary" onClick={() => setOpenedBoxIndex(null)}>
                  Done
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
