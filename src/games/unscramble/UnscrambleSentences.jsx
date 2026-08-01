import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { getJSON, setJSON, removeItem } from "../../lib/storage.js";
import "./unscramble.css";

const STORAGE_KEY = "unscramble-sets";

function parseSentences(text) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function shuffledIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  if (n <= 1) return arr;
  let attempts = 0;
  let result = arr;
  do {
    result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    attempts++;
  } while (result.every((v, i) => v === arr[i]) && attempts < 8);
  return result;
}

export default function UnscrambleSentences() {
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [words, setWords] = useState([]);
  const [tray, setTray] = useState([]);
  const [slots, setSlots] = useState([]);
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
          setCurrentIndex(0);
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
    const sentences = parseSentences(formText);
    if (!formName.trim()) {
      setFormError("Give the set a name.");
      return;
    }
    if (sentences.length === 0) {
      setFormError("Add at least one sentence.");
      return;
    }
    const newSet = {
      id: String(Date.now()),
      name: formName.trim(),
      sentences,
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
    const url = `${window.location.origin}/unscramble/${setId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(setId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function startPlay(setId) {
    setActiveSetId(setId);
    setCurrentIndex(0);
    setView("play");
  }

  const activeSet = sets.find((s) => s.id === activeSetId);

  // reset puzzle whenever current sentence changes
  useEffect(() => {
    if (view !== "play" || !activeSet) return;
    const sentence = activeSet.sentences[currentIndex] || "";
    const tokens = sentence.split(/\s+/).filter(Boolean);
    setWords(tokens);
    setTray(shuffledIndices(tokens.length));
    setSlots(Array(tokens.length).fill(null));
  }, [view, activeSetId, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  function placeWordAt(wordIndex, targetSlot) {
    setSlots((prevSlots) => {
      let slotIndex = targetSlot;
      if (slotIndex === undefined || slotIndex === null) {
        slotIndex = prevSlots.indexOf(null);
      }
      if (slotIndex === -1 || prevSlots[slotIndex] !== null) return prevSlots;
      const next = [...prevSlots];
      next[slotIndex] = wordIndex;
      return next;
    });
    setTray((prevTray) => prevTray.filter((w) => w !== wordIndex));
  }

  function returnWord(slotIndex) {
    setSlots((prevSlots) => {
      const w = prevSlots[slotIndex];
      if (w === null || w === undefined) return prevSlots;
      const next = [...prevSlots];
      next[slotIndex] = null;
      setTray((prevTray) => [...prevTray, w]);
      return next;
    });
  }

  function handleDrop(e, slotIndex) {
    e.preventDefault();
    const wordIndex = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(wordIndex)) return;
    placeWordAt(wordIndex, slotIndex);
  }

  const allCorrect = slots.length > 0 && slots.every((s, i) => s === i);

  function goPrev() {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }
  function goNext() {
    if (!activeSet) return;
    setCurrentIndex((i) => Math.min(activeSet.sentences.length - 1, i + 1));
  }

  return (
    <div className="uw-root">
      <div className="uw-shell">
        {view === "loading" && (
          <div className="uw-empty">Loading saved sets...</div>
        )}

        {view === "error" && (
          <div className="uw-card uw-empty">
            Couldn't load your sets. Check your connection and try again.
            <div className="uw-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <button className="uw-btn uw-btn-primary uw-btn-sm" onClick={loadSets}>
                Retry
              </button>
            </div>
          </div>
        )}

        {view === "notfound" && (
          <div className="uw-card uw-empty">
            This set doesn't exist or was removed.
            <div className="uw-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <Link className="uw-btn uw-btn-primary uw-btn-sm" to="/">
                Home
              </Link>
            </div>
          </div>
        )}

        {view === "list" && (
          <>
            <div className="uw-eyebrow">Unscramble Sentences</div>
            <div className="uw-topbar">
              <h1 className="uw-title" style={{ marginBottom: 0 }}>Sentence sets</h1>
              {saveFlash && <span className="uw-flash">Set saved!</span>}
              {persistError && <span className="uw-flash uw-flash-error">Couldn't save — check connection</span>}
            </div>

            {sets.length === 0 ? (
              <div className="uw-card uw-empty" style={{ marginBottom: 20 }}>
                No sets yet.
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {sets.map((s) => (
                  <div className="uw-list-item" key={s.id}>
                    <div>
                      <div className="uw-list-item-name">{s.name}</div>
                      <div className="uw-list-item-meta">{s.sentences.length} sentence(s)</div>
                    </div>
                    <div className="uw-row">
                      <button className="uw-btn uw-btn-primary uw-btn-sm" onClick={() => startPlay(s.id)}>
                        Play
                      </button>
                      <button className="uw-btn uw-btn-ghost uw-btn-sm" onClick={() => copyShareLink(s.id)}>
                        {copiedId === s.id ? "Copied!" : "Share"}
                      </button>
                      {confirmDeleteId === s.id ? (
                        <button className="uw-btn uw-btn-danger uw-btn-sm" onClick={() => deleteSet(s.id)}>
                          Confirm
                        </button>
                      ) : (
                        <button className="uw-btn uw-btn-ghost uw-btn-sm" onClick={() => setConfirmDeleteId(s.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="uw-row" style={{ justifyContent: "space-between" }}>
              <div className="uw-row">
                <button className="uw-btn uw-btn-primary" onClick={openNewSetForm}>
                  + New set
                </button>
                <Link className="uw-btn uw-btn-ghost" to="/">
                  Home
                </Link>
              </div>
              {sets.length > 0 && (
                confirmResetAll ? (
                  <button className="uw-btn uw-btn-danger uw-btn-sm" onClick={resetAllData}>
                    Confirm clear all data
                  </button>
                ) : (
                  <button className="uw-btn uw-btn-ghost uw-btn-sm" onClick={() => setConfirmResetAll(true)}>
                    Clear all data
                  </button>
                )
              )}
            </div>
          </>
        )}

        {view === "form" && (
          <>
            <div className="uw-eyebrow">Unscramble Sentences</div>
            <h1 className="uw-title">New sentence set</h1>
            <div className="uw-card">
              <label className="uw-field-label" htmlFor="uw-name">Set name</label>
              <input
                id="uw-name"
                className="uw-input"
                placeholder="e.g. Present Perfect - Grade 7"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{ marginBottom: 16 }}
              />

              <label className="uw-field-label" htmlFor="uw-text">Sentences (one per line)</label>
              <textarea
                id="uw-text"
                className="uw-textarea"
                placeholder={"She has already finished her homework.\nThey have never visited Paris."}
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
              />
              <div className="uw-hint">
                {parseSentences(formText).length} sentence(s) detected
              </div>

              <div className="uw-row" style={{ marginTop: 14 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  style={{ display: "none" }}
                  onChange={handleFileImport}
                />
                <button className="uw-btn uw-btn-ghost uw-btn-sm" onClick={() => fileInputRef.current?.click()}>
                  Import .txt file
                </button>
              </div>

              {formError && <div className="uw-error">{formError}</div>}

              <div className="uw-row" style={{ marginTop: 20 }}>
                <button className="uw-btn uw-btn-primary" onClick={saveNewSet}>
                  Save set
                </button>
                <button className="uw-btn uw-btn-ghost" onClick={() => setView("list")}>
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

        {view === "play" && activeSet && (
          <>
            <div className="uw-eyebrow">{activeSet.name}</div>
            <div className="uw-topbar">
              <h1 className="uw-title" style={{ marginBottom: 0 }}>Unscramble the sentence</h1>
              <button className="uw-btn uw-btn-ghost uw-btn-sm" onClick={() => setView("list")}>
                Back
              </button>
            </div>

            <div className="uw-card">
              <div className="uw-progress">
                Sentence {currentIndex + 1} of {activeSet.sentences.length}
              </div>

              {allCorrect && (
                <div className="uw-sentence-banner">Correct!</div>
              )}

              <div
                className="uw-tray"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const wordIndex = Number(e.dataTransfer.getData("text/plain"));
                  if (!Number.isNaN(wordIndex) && !tray.includes(wordIndex)) {
                    const slotIndex = slots.indexOf(wordIndex);
                    if (slotIndex !== -1) returnWord(slotIndex);
                  }
                }}
              >
                {tray.length === 0 ? (
                  <span className="uw-hint">All words have been used</span>
                ) : (
                  tray.map((wordIndex) => (
                    <div
                      key={wordIndex}
                      className="uw-chip"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(wordIndex))}
                      onClick={() => placeWordAt(wordIndex)}
                    >
                      {words[wordIndex]}
                    </div>
                  ))
                )}
              </div>

              <div className="uw-slots">
                {slots.map((wordIndex, slotIndex) => {
                  let cls = "uw-slot";
                  if (wordIndex !== null) {
                    cls += wordIndex === slotIndex ? " uw-slot-correct" : " uw-slot-wrong";
                  }
                  return (
                    <div
                      key={slotIndex}
                      className={cls}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, slotIndex)}
                    >
                      {wordIndex !== null && (
                        <span className="uw-chip-inner" onClick={() => returnWord(slotIndex)}>
                          {words[wordIndex]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="uw-nav">
                <button
                  className="uw-btn uw-btn-ghost uw-btn-sm"
                  disabled={currentIndex === 0}
                  style={{ opacity: currentIndex === 0 ? 0.4 : 1 }}
                  onClick={goPrev}
                >
                  ← Previous
                </button>
                <button
                  className="uw-btn uw-btn-ghost uw-btn-sm"
                  disabled={currentIndex === activeSet.sentences.length - 1}
                  style={{ opacity: currentIndex === activeSet.sentences.length - 1 ? 0.4 : 1 }}
                  onClick={goNext}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
