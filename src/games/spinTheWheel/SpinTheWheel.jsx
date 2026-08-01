import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { getJSON, setJSON, removeItem } from "../../lib/storage.js";
import "./spinTheWheel.css";

const STORAGE_KEY = "spin-the-wheel-sets";
const SPIN_DURATION_MS = 4200;
const SLICE_COLOR_A = "var(--neutral-block)";
const SLICE_COLOR_B = "color-mix(in srgb, var(--neutral-block) 55%, white)";
const SLICE_COLOR_WINNER = "var(--accent)";

function parseItems(text) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function SpinTheWheel() {
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
  const [drawnFlags, setDrawnFlags] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winningIndex, setWinningIndex] = useState(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [persistError, setPersistError] = useState(false);
  const spinTimeoutRef = useRef(null);

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
          setDrawnFlags(Array(shared.items.length).fill(false));
          setRotation(0);
          setSpinning(false);
          setWinningIndex(null);
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

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, []);

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
    const items = parseItems(formText);
    if (!formName.trim()) {
      setFormError("Give the set a name.");
      return;
    }
    if (items.length === 0) {
      setFormError("Add at least one item.");
      return;
    }
    const newSet = {
      id: String(Date.now()),
      name: formName.trim(),
      items,
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
    const url = `${window.location.origin}/spin-the-wheel/${setId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(setId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function startPlay(setId) {
    const set = sets.find((s) => s.id === setId);
    setActiveSetId(setId);
    setDrawnFlags(Array(set ? set.items.length : 0).fill(false));
    setRotation(0);
    setSpinning(false);
    setWinningIndex(null);
    setView("play");
  }

  function resetWheel() {
    setDrawnFlags((prev) => prev.map(() => false));
    setWinningIndex(null);
  }

  const activeSet = sets.find((s) => s.id === activeSetId);

  // items still eligible to be drawn
  const remainingIndices = activeSet
    ? activeSet.items.map((_, i) => i).filter((i) => !drawnFlags[i])
    : [];
  const canSpin = !spinning && remainingIndices.length > 0;

  // items currently shown on the wheel: eligible ones, plus the just-landed winner
  // (kept visible, highlighted, until the next spin removes it from the wheel)
  const visibleIndices = activeSet
    ? activeSet.items.map((_, i) => i).filter((i) => !drawnFlags[i] || i === winningIndex)
    : [];
  const wheelSliceAngle = visibleIndices.length > 0 ? 360 / visibleIndices.length : 0;

  function spin() {
    if (!activeSet || !canSpin) return;
    // this spin's wheel is built from whatever is still eligible — the previous
    // winner already dropped out once it was marked drawn
    const spinIndices = remainingIndices;
    const spinSliceAngle = 360 / spinIndices.length;
    const winnerPos = Math.floor(Math.random() * spinIndices.length);
    const winner = spinIndices[winnerPos];
    const jitter = spinSliceAngle * 0.15 + Math.random() * spinSliceAngle * 0.7;
    const targetAngle = winnerPos * spinSliceAngle + jitter;

    const currentMod = ((rotation % 360) + 360) % 360;
    const desiredMod = ((-targetAngle % 360) + 360) % 360;
    let delta = desiredMod - currentMod;
    if (delta <= 0) delta += 360;
    const extraSpins = 6 + Math.floor(Math.random() * 3);
    const newRotation = rotation + delta + extraSpins * 360;

    setSpinning(true);
    setWinningIndex(null); // drop the previous winner from the wheel now, before this spin
    setRotation(newRotation);

    spinTimeoutRef.current = setTimeout(() => {
      setSpinning(false);
      setWinningIndex(winner);
      setDrawnFlags((prev) => {
        const next = [...prev];
        next[winner] = true;
        return next;
      });
    }, SPIN_DURATION_MS);
  }

  const wheelBackground = activeSet
    ? "conic-gradient(from 0deg, " +
      visibleIndices
        .map((originalIndex, pos) => {
          const start = pos * wheelSliceAngle;
          const end = start + wheelSliceAngle;
          const color = originalIndex === winningIndex && !spinning
            ? SLICE_COLOR_WINNER
            : pos % 2 === 0 ? SLICE_COLOR_A : SLICE_COLOR_B;
          return `${color} ${start}deg ${end}deg`;
        })
        .join(", ") +
      ")"
    : undefined;

  return (
    <div className="stw-root">
      <div className="stw-shell">
        {view === "loading" && (
          <div className="stw-empty">Loading saved sets...</div>
        )}

        {view === "error" && (
          <div className="stw-card stw-empty">
            Couldn't load your sets. Check your connection and try again.
            <div className="stw-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <button className="stw-btn stw-btn-primary stw-btn-sm" onClick={loadSets}>
                Retry
              </button>
            </div>
          </div>
        )}

        {view === "notfound" && (
          <div className="stw-card stw-empty">
            This set doesn't exist or was removed.
            <div className="stw-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <Link className="stw-btn stw-btn-primary stw-btn-sm" to="/">
                Home
              </Link>
            </div>
          </div>
        )}

        {view === "list" && (
          <>
            <div className="stw-eyebrow">Spin the Wheel</div>
            <div className="stw-topbar">
              <h1 className="stw-title" style={{ marginBottom: 0 }}>Item sets</h1>
              {saveFlash && <span className="stw-flash">Set saved!</span>}
              {persistError && <span className="stw-flash stw-flash-error">Couldn't save — check connection</span>}
            </div>

            {sets.length === 0 ? (
              <div className="stw-card stw-empty" style={{ marginBottom: 20 }}>
                No sets yet.
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {sets.map((s) => (
                  <div className="stw-list-item" key={s.id}>
                    <div>
                      <div className="stw-list-item-name">{s.name}</div>
                      <div className="stw-list-item-meta">{s.items.length} item(s)</div>
                    </div>
                    <div className="stw-row">
                      <button className="stw-btn stw-btn-primary stw-btn-sm" onClick={() => startPlay(s.id)}>
                        Play
                      </button>
                      <button className="stw-btn stw-btn-ghost stw-btn-sm" onClick={() => copyShareLink(s.id)}>
                        {copiedId === s.id ? "Copied!" : "Share"}
                      </button>
                      {confirmDeleteId === s.id ? (
                        <button className="stw-btn stw-btn-danger stw-btn-sm" onClick={() => deleteSet(s.id)}>
                          Confirm
                        </button>
                      ) : (
                        <button className="stw-btn stw-btn-ghost stw-btn-sm" onClick={() => setConfirmDeleteId(s.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="stw-row" style={{ justifyContent: "space-between" }}>
              <div className="stw-row">
                <button className="stw-btn stw-btn-primary" onClick={openNewSetForm}>
                  + New set
                </button>
                <Link className="stw-btn stw-btn-ghost" to="/">
                  Home
                </Link>
              </div>
              {sets.length > 0 && (
                confirmResetAll ? (
                  <button className="stw-btn stw-btn-danger stw-btn-sm" onClick={resetAllData}>
                    Confirm clear all data
                  </button>
                ) : (
                  <button className="stw-btn stw-btn-ghost stw-btn-sm" onClick={() => setConfirmResetAll(true)}>
                    Clear all data
                  </button>
                )
              )}
            </div>
          </>
        )}

        {view === "form" && (
          <>
            <div className="stw-eyebrow">Spin the Wheel</div>
            <h1 className="stw-title">New item set</h1>
            <div className="stw-card">
              <label className="stw-field-label" htmlFor="stw-name">Set name</label>
              <input
                id="stw-name"
                className="stw-input"
                placeholder="e.g. Class Roster - Grade 7"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{ marginBottom: 16 }}
              />

              <label className="stw-field-label" htmlFor="stw-text">Items (one per line)</label>
              <textarea
                id="stw-text"
                className="stw-textarea"
                placeholder={"Ana\nBruno\nCarla\nDiego"}
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
              />
              <div className="stw-hint">
                {parseItems(formText).length} item(s) detected
              </div>

              <div className="stw-row" style={{ marginTop: 14 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  style={{ display: "none" }}
                  onChange={handleFileImport}
                />
                <button className="stw-btn stw-btn-ghost stw-btn-sm" onClick={() => fileInputRef.current?.click()}>
                  Import .txt file
                </button>
              </div>

              {formError && <div className="stw-error">{formError}</div>}

              <div className="stw-row" style={{ marginTop: 20 }}>
                <button className="stw-btn stw-btn-primary" onClick={saveNewSet}>
                  Save set
                </button>
                <button className="stw-btn stw-btn-ghost" onClick={() => setView("list")}>
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

        {view === "play" && activeSet && (
          <>
            <div className="stw-eyebrow">{activeSet.name}</div>
            <div className="stw-topbar">
              <h1 className="stw-title" style={{ marginBottom: 0 }}>Spin the Wheel</h1>
              <button className="stw-btn stw-btn-ghost stw-btn-sm" onClick={() => setView("list")}>
                Back
              </button>
            </div>

            <div className="stw-wheel-area">
              <div className="stw-pointer" />
              <div
                className="stw-wheel"
                style={{
                  background: wheelBackground,
                  transform: `rotate(${rotation}deg)`,
                  transitionDuration: `${SPIN_DURATION_MS}ms`,
                }}
              >
                {visibleIndices.map((originalIndex, pos) => {
                  const midAngle = pos * wheelSliceAngle + wheelSliceAngle / 2;
                  return (
                    <div
                      key={originalIndex}
                      className="stw-label"
                      style={{ transform: `rotate(${midAngle - 90}deg)` }}
                    >
                      <span className="stw-label-text">{activeSet.items[originalIndex]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="stw-result-area">
              {winningIndex !== null && !spinning ? (
                <div className="stw-result">{activeSet.items[winningIndex]}</div>
              ) : (
                <div className="stw-result-hint">
                  {spinning ? "Spinning..." : "Click Spin to draw an item"}
                </div>
              )}
            </div>

            <div className="stw-row" style={{ justifyContent: "center", marginTop: 8 }}>
              <button
                className="stw-btn stw-btn-primary"
                disabled={!canSpin}
                style={{ opacity: canSpin ? 1 : 0.5, cursor: canSpin ? "pointer" : "not-allowed" }}
                onClick={spin}
              >
                Spin
              </button>
              <button className="stw-btn stw-btn-ghost" onClick={resetWheel}>
                Reset wheel
              </button>
            </div>

            {remainingIndices.length === 0 && (
              <div className="stw-hint stw-all-drawn-hint">
                Every item has been drawn. Click "Reset wheel" to spin again.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
