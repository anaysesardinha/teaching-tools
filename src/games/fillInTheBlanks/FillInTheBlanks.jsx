import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { setJSON, removeItem } from "../../lib/storage.js";
import { loadOwnSets, findSharedSet } from "../../lib/sets.js";
import { getActiveTeacherId, teacherKey, teacherName } from "../../lib/teacher.js";
import { FILL_IN_THE_BLANKS_SETS_KEY as STORAGE_KEY } from "../../lib/storageKeys.js";
import "./fillInTheBlanks.css";

// A candidate line becomes a blank sentence by pulling the first [bracketed]
// word out as the answer; a line with no brackets is flagged invalid so the
// teacher can fix or drop it in the review checklist instead of it silently
// becoming an un-fillable sentence.
function parseCandidates(text) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(/\[([^\[\]]+)\]/);
      if (!m) return { raw, valid: false };
      return {
        raw,
        valid: true,
        before: raw.slice(0, m.index),
        answer: m[1],
        after: raw.slice(m.index + m[0].length),
      };
    });
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

export default function FillInTheBlanks() {
  const { setId: sharedSetId } = useParams();
  // Read once at mount, not per write: with two tabs open, switching
  // teacher in one must not redirect where the other one saves.
  const [teacherId] = useState(getActiveTeacherId);
  const [view, setView] = useState("loading"); // loading | list | form | play | notfound | error
  const [sets, setSets] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [activeSetId, setActiveSetId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  // A shared set can belong to the other teacher, so it won't be in `sets` —
  // keep it aside instead of forcing it into the list.
  const [sharedSet, setSharedSet] = useState(null);

  // form state
  const [formName, setFormName] = useState("");
  const [formText, setFormText] = useState("");
  const [formError, setFormError] = useState("");
  // Indices (into the current parseCandidates(formText) result) the teacher
  // has deselected. Resets whenever the text changes, since edits can shift
  // every line's index — see the review checklist in the form view.
  const [uncheckedIndices, setUncheckedIndices] = useState(() => new Set());
  const fileInputRef = useRef(null);

  // play state
  const [bankOrder, setBankOrder] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [saveFlash, setSaveFlash] = useState(false);
  const [persistError, setPersistError] = useState(false);

  const loadSets = useCallback(async () => {
    // Without a teacher there is no space to read; Home takes over below.
    if (!sharedSetId && !teacherId) return;
    setView("loading");
    try {
      if (sharedSetId) {
        const shared = await findSharedSet(STORAGE_KEY, sharedSetId, teacherId);
        if (!shared) {
          setView("notfound");
          return;
        }
        setSharedSet(shared);
        setActiveSetId(shared.id);
        setView("play");
        return;
      }
      setSets(await loadOwnSets(STORAGE_KEY, teacherId));
      setView("list");
    } catch (e) {
      setView("error");
    }
  }, [sharedSetId, teacherId]);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  useEffect(() => {
    setUncheckedIndices(new Set());
  }, [formText]);

  const persistSets = useCallback((nextSets) => {
    setSets(nextSets);
    setJSON(teacherKey(STORAGE_KEY, teacherId), nextSets).catch(() => {
      setPersistError(true);
      setTimeout(() => setPersistError(false), 2500);
    });
  }, [teacherId]);

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

  function toggleChecked(index) {
    setUncheckedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function saveNewSet() {
    const candidates = parseCandidates(formText);
    const sentences = candidates
      .map((c, i) => ({ ...c, index: i }))
      .filter((c) => c.valid && !uncheckedIndices.has(c.index))
      .map(({ before, answer, after }) => ({ before, answer, after }));
    if (!formName.trim()) {
      setFormError("Give the set a name.");
      return;
    }
    if (sentences.length === 0) {
      setFormError("Add at least one sentence with a [bracketed] answer.");
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
    removeItem(teacherKey(STORAGE_KEY, teacherId)).catch(() => {
      setPersistError(true);
      setTimeout(() => setPersistError(false), 2500);
    });
  }

  function copyShareLink(setId) {
    const url = `${window.location.origin}/fill-in-the-blanks/${setId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(setId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function startPlay(setId) {
    setActiveSetId(setId);
    setView("play");
  }

  const activeSet =
    sharedSet && sharedSet.id === activeSetId
      ? sharedSet
      : sets.find((s) => s.id === activeSetId);

  // Every sentence is shown at once (unlike Unscramble's one-at-a-time play),
  // so the bank/placements only need to reset when the set itself changes.
  useEffect(() => {
    if (view !== "play" || !activeSet) return;
    setBankOrder(shuffledIndices(activeSet.sentences.length));
    setPlacements(Array(activeSet.sentences.length).fill(null));
  }, [view, activeSetId]); // eslint-disable-line react-hooks/exhaustive-deps

  function placeWordAt(bankId, targetSlot) {
    setPlacements((prevPlacements) => {
      let slotIndex = targetSlot;
      if (slotIndex === undefined || slotIndex === null) {
        slotIndex = prevPlacements.indexOf(null);
      }
      if (slotIndex === -1 || prevPlacements[slotIndex] !== null) return prevPlacements;
      const next = [...prevPlacements];
      next[slotIndex] = bankId;
      return next;
    });
  }

  function returnWord(slotIndex) {
    setPlacements((prevPlacements) => {
      if (prevPlacements[slotIndex] === null || prevPlacements[slotIndex] === undefined) {
        return prevPlacements;
      }
      const next = [...prevPlacements];
      next[slotIndex] = null;
      return next;
    });
  }

  function resetPlacements() {
    setPlacements((prev) => prev.map(() => null));
  }

  function handleSlotDrop(e, slotIndex) {
    e.preventDefault();
    const bankId = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(bankId)) return;
    placeWordAt(bankId, slotIndex);
  }

  function handleBankDrop(e) {
    e.preventDefault();
    const bankId = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(bankId)) return;
    const slotIndex = placements.indexOf(bankId);
    if (slotIndex !== -1) returnWord(slotIndex);
  }

  function isSlotCorrect(slotIndex, placedId) {
    if (!activeSet || placedId === null || placedId === undefined) return false;
    const expected = activeSet.sentences[slotIndex].answer.trim().toLowerCase();
    const placed = activeSet.sentences[placedId].answer.trim().toLowerCase();
    return expected === placed;
  }

  const bank = activeSet ? bankOrder.filter((id) => !placements.includes(id)) : [];
  const allCorrect =
    !!activeSet &&
    placements.length > 0 &&
    placements.every((id, i) => isSlotCorrect(i, id));

  if (!sharedSetId && !teacherId) return <Navigate to="/" replace />;

  const isPlay = view === "play";
  const candidates = view === "form" ? parseCandidates(formText) : [];
  const validCount = candidates.filter((c) => c.valid).length;
  const selectedCount = candidates.filter(
    (c, i) => c.valid && !uncheckedIndices.has(i)
  ).length;

  return (
    <div className={"fitb-root" + (isPlay ? " fitb-root-play" : "")}>
      <div className={"fitb-shell" + (isPlay ? " fitb-shell-play" : "")}>
        {view === "loading" && (
          <div className="fitb-empty">Loading saved sets...</div>
        )}

        {view === "error" && (
          <div className="fitb-card fitb-empty">
            Couldn't load your sets. Check your connection and try again.
            <div className="fitb-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <button className="fitb-btn fitb-btn-primary fitb-btn-sm" onClick={loadSets}>
                Retry
              </button>
            </div>
          </div>
        )}

        {view === "notfound" && (
          <div className="fitb-card fitb-empty">
            This set doesn't exist or was removed.
            <div className="fitb-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <Link className="fitb-btn fitb-btn-primary fitb-btn-sm" to="/">
                Home
              </Link>
            </div>
          </div>
        )}

        {view === "list" && (
          <>
            <div className="fitb-eyebrow">
              Fill in the Blanks · {teacherName(teacherId)}
            </div>
            <div className="fitb-topbar">
              <h1 className="fitb-title" style={{ marginBottom: 0 }}>Blank sets</h1>
              {saveFlash && <span className="fitb-flash">Set saved!</span>}
              {persistError && <span className="fitb-flash fitb-flash-error">Couldn't save — check connection</span>}
            </div>

            {sets.length === 0 ? (
              <div className="fitb-card fitb-empty" style={{ marginBottom: 20 }}>
                No sets yet.
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {sets.map((s) => (
                  <div className="fitb-list-item" key={s.id}>
                    <div>
                      <div className="fitb-list-item-name">
                        {s.name}
                      </div>
                      <div className="fitb-list-item-meta">{s.sentences.length} sentence(s)</div>
                    </div>
                    <div className="fitb-row">
                      <button className="fitb-btn fitb-btn-primary fitb-btn-sm" onClick={() => startPlay(s.id)}>
                        Play
                      </button>
                      <button className="fitb-btn fitb-btn-ghost fitb-btn-sm" onClick={() => copyShareLink(s.id)}>
                        {copiedId === s.id ? "Copied!" : "Share"}
                      </button>
                      {confirmDeleteId === s.id ? (
                        <button className="fitb-btn fitb-btn-danger fitb-btn-sm" onClick={() => deleteSet(s.id)}>
                          Confirm
                        </button>
                      ) : (
                        <button className="fitb-btn fitb-btn-ghost fitb-btn-sm" onClick={() => setConfirmDeleteId(s.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="fitb-row" style={{ justifyContent: "space-between" }}>
              <div className="fitb-row">
                <button className="fitb-btn fitb-btn-primary" onClick={openNewSetForm}>
                  + New set
                </button>
                <Link className="fitb-btn fitb-btn-ghost" to="/">
                  Home
                </Link>
              </div>
              {sets.length > 0 && (
                confirmResetAll ? (
                  <button className="fitb-btn fitb-btn-danger fitb-btn-sm" onClick={resetAllData}>
                    Confirm clear all data
                  </button>
                ) : (
                  <button className="fitb-btn fitb-btn-ghost fitb-btn-sm" onClick={() => setConfirmResetAll(true)}>
                    Clear all data
                  </button>
                )
              )}
            </div>
          </>
        )}

        {view === "form" && (
          <>
            <div className="fitb-eyebrow">Fill in the Blanks</div>
            <h1 className="fitb-title">New blank set</h1>
            <div className="fitb-card">
              <label className="fitb-field-label" htmlFor="fitb-name">Set name</label>
              <input
                id="fitb-name"
                className="fitb-input"
                placeholder="e.g. Past Simple - Grade 7"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{ marginBottom: 16 }}
              />

              <label className="fitb-field-label" htmlFor="fitb-text">
                Sentences (one per line, correct word in [brackets])
              </label>
              <textarea
                id="fitb-text"
                className="fitb-textarea"
                placeholder={"She [went] to school yesterday.\nThey [have] never visited Paris."}
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
              />
              <div className="fitb-hint">
                {validCount} sentence(s) detected · {selectedCount} selected
              </div>

              <div className="fitb-row" style={{ marginTop: 14 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  style={{ display: "none" }}
                  onChange={handleFileImport}
                />
                <button className="fitb-btn fitb-btn-ghost fitb-btn-sm" onClick={() => fileInputRef.current?.click()}>
                  Import .txt file
                </button>
              </div>

              {candidates.length > 0 && (
                <div className="fitb-checklist">
                  {candidates.map((c, i) =>
                    c.valid ? (
                      <label className="fitb-check-row" key={i}>
                        <input
                          type="checkbox"
                          checked={!uncheckedIndices.has(i)}
                          onChange={() => toggleChecked(i)}
                        />
                        <span className="fitb-check-preview">
                          {c.before}
                          <span className="fitb-check-blank">___</span>
                          {c.after}
                        </span>
                        <span className="fitb-check-answer">{c.answer}</span>
                      </label>
                    ) : (
                      <div className="fitb-check-row fitb-check-row-invalid" key={i}>
                        No [bracketed] answer found: "{c.raw}"
                      </div>
                    )
                  )}
                </div>
              )}

              {formError && <div className="fitb-error">{formError}</div>}

              <div className="fitb-row" style={{ marginTop: 20 }}>
                <button className="fitb-btn fitb-btn-primary" onClick={saveNewSet}>
                  Save set
                </button>
                <button className="fitb-btn fitb-btn-ghost" onClick={() => setView("list")}>
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

        {view === "play" && activeSet && (
          <>
            <div className="fitb-eyebrow">{activeSet.name}</div>
            <div className="fitb-topbar">
              <h1 className="fitb-title" style={{ marginBottom: 0 }}>Fill in the Blanks</h1>
              <button className="fitb-btn fitb-btn-ghost fitb-btn-sm" onClick={() => setView("list")}>
                Back
              </button>
            </div>

            {allCorrect && <div className="fitb-banner">All blanks filled correctly!</div>}

            <div className="fitb-play-layout">
              <div className="fitb-sentences">
                {activeSet.sentences.map((s, i) => {
                  const placedId = placements[i];
                  let cls = "fitb-blank";
                  if (placedId !== null && placedId !== undefined) {
                    cls += isSlotCorrect(i, placedId) ? " fitb-blank-correct" : " fitb-blank-wrong";
                  }
                  return (
                    <div className="fitb-sentence-row" key={i}>
                      <span className="fitb-sentence-index">{i + 1}.</span>
                      <span className="fitb-sentence-text">
                        {s.before}
                        <span
                          className={cls}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleSlotDrop(e, i)}
                          onClick={() => (placedId !== null && placedId !== undefined) && returnWord(i)}
                        >
                          {placedId !== null && placedId !== undefined
                            ? activeSet.sentences[placedId].answer
                            : ""}
                        </span>
                        {s.after}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div
                className="fitb-bank"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleBankDrop}
              >
                <div className="fitb-bank-title">Word bank</div>
                <div className="fitb-bank-words">
                  {bank.length === 0 ? (
                    <span className="fitb-hint">All words have been used</span>
                  ) : (
                    bank.map((id) => (
                      <div
                        key={id}
                        className="fitb-chip"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", String(id))}
                        onClick={() => placeWordAt(id)}
                      >
                        {activeSet.sentences[id].answer}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="fitb-row" style={{ marginTop: 8 }}>
              <button className="fitb-btn fitb-btn-ghost fitb-btn-sm" onClick={resetPlacements}>
                Reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
