import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { setJSON, removeItem } from "../../lib/storage.js";
import { loadOwnSets, findSharedSet } from "../../lib/sets.js";
import { getActiveTeacherId, teacherKey, teacherName } from "../../lib/teacher.js";
import "./openTheBoxes.css";

const STORAGE_KEY = "open-the-boxes-sets";

const GRID_GAP = 14;
// Past this the boxes stop looking generous and start looking silly — a
// three-question set shouldn't fill the screen with three huge tiles.
const MAX_BOX_SIZE = 150;

// Every box has to be visible at once: this gets screen-shared during a call,
// and scrolling to find box 37 kills the moment. So rather than a fixed column
// count, try every column count and keep the one that makes the square boxes
// biggest while still fitting inside the measured area.
function fitGrid(count, width, height) {
  if (!count || width <= 0 || height <= 0) return null;
  let best = { columns: 1, size: 0 };
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const size = Math.min(
      (width - GRID_GAP * (columns - 1)) / columns,
      (height - GRID_GAP * (rows - 1)) / rows
    );
    if (size > best.size) best = { columns, size };
  }
  return { columns: best.columns, size: Math.min(best.size, MAX_BOX_SIZE) };
}

function parseQuestions(text) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function OpenTheBoxes() {
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
  const fileInputRef = useRef(null);

  // play state
  const [openedBoxIndex, setOpenedBoxIndex] = useState(null);
  const [openedFlags, setOpenedFlags] = useState([]);
  const [saveFlash, setSaveFlash] = useState(false);
  const [persistError, setPersistError] = useState(false);
  const gridAreaRef = useRef(null);
  const [gridArea, setGridArea] = useState({ width: 0, height: 0 });

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
        setOpenedFlags(Array(shared.questions.length).fill(false));
        setOpenedBoxIndex(null);
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

  // Re-fit whenever the space changes: window resize, the browser chrome
  // appearing during a screen share, or a second monitor with a different size.
  useEffect(() => {
    const el = gridAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setGridArea({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [view, openedBoxIndex]);

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
    removeItem(teacherKey(STORAGE_KEY, teacherId)).catch(() => {
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

  const activeSet =
    sharedSet && sharedSet.id === activeSetId
      ? sharedSet
      : sets.find((s) => s.id === activeSetId);

  // The board is the only view that has to fill the viewport exactly; the set
  // list and the revealed question keep the normal centred column.
  const isBoard = view === "play" && !!activeSet && openedBoxIndex === null;
  const grid = useMemo(
    () => fitGrid(activeSet ? activeSet.questions.length : 0, gridArea.width, gridArea.height),
    [activeSet, gridArea]
  );

  if (!sharedSetId && !teacherId) return <Navigate to="/" replace />;

  return (
    <div className={"otb-root" + (isBoard ? " otb-root-board" : "")}>
      <div className={"otb-shell" + (isBoard ? " otb-shell-board" : "")}>
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
            <div className="otb-eyebrow">
              Open the Boxes · {teacherName(teacherId)}
            </div>
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
                      <div className="otb-list-item-name">
                        {s.name}
                      </div>
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
                <div className="otb-grid-area" ref={gridAreaRef}>
                  <div
                    className="otb-grid"
                    style={
                      grid
                        ? {
                            gridTemplateColumns: `repeat(${grid.columns}, ${grid.size}px)`,
                            gridAutoRows: `${grid.size}px`,
                            "--otb-box-size": `${grid.size}px`,
                          }
                        : // Hidden, not unmounted: the area still needs to be
                          // measurable before the first fit is known.
                          { visibility: "hidden" }
                    }
                  >
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
