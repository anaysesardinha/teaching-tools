import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { getJSON, setJSON, removeItem } from "../../lib/storage.js";
import "./whiteboard.css";

const STUDENTS_KEY = "whiteboard-students";
const boardKey = (studentId) => `whiteboard-board-${studentId}`;

const BOARD_WIDTH = 3200;
const BOARD_HEIGHT = 1800;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const DEFAULT_BOX_WIDTH = 220;
const DEFAULT_BOX_HEIGHT = 120;
const MIN_BOX_WIDTH = 140;
const MIN_BOX_HEIGHT = 60;
const TEXTBOX_HEADER_HEIGHT = 18;
const CLICK_MOVE_THRESHOLD = 5;
const SAVE_DEBOUNCE_MS = 600;
const SWATCHES = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#FED7AA", "#E5E7EB"];
const DEFAULT_FONT_SIZE = 15;
const MIN_FONT_SIZE = 11;
const MAX_FONT_SIZE = 40;
const FONT_SIZE_STEP = 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function WhiteboardTextBox({
  box,
  isSelected,
  onHeaderPointerDown,
  onResizeHandlePointerDown,
  onSelect,
  onChangeText,
  onDelete,
  justCreated,
}) {
  function handleChange(e) {
    const value = e.target.value;
    // grow the box to fit content that no longer fits — never shrinks on
    // its own, so a manual resize (bigger or smaller) is never undone here
    const needed = TEXTBOX_HEADER_HEIGHT + e.target.scrollHeight;
    onChangeText(box.id, value, needed > box.height ? needed : undefined);
  }

  return (
    <div
      className={"wb-textbox" + (isSelected ? " wb-textbox-selected" : "")}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        background: box.color,
        zIndex: box.zIndex,
      }}
      onPointerDown={() => onSelect(box.id)}
    >
      <div className="wb-textbox-header" onPointerDown={(e) => onHeaderPointerDown(e, box)}>
        <span className="wb-textbox-handle" aria-hidden="true">⠿⠿</span>
        <button
          className="wb-textbox-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(box.id);
          }}
          aria-label="Delete text box"
        >
          ×
        </button>
      </div>
      <textarea
        className="wb-textbox-textarea"
        value={box.text}
        onChange={handleChange}
        placeholder="Type here..."
        autoFocus={justCreated}
        style={{
          fontSize: box.fontSize || DEFAULT_FONT_SIZE,
          fontWeight: box.bold ? 800 : 500,
        }}
      />
      <div
        className="wb-textbox-resize-handle"
        onPointerDown={(e) => onResizeHandlePointerDown(e, box)}
        aria-hidden="true"
      />
    </div>
  );
}

export default function Whiteboard() {
  const { studentId: sharedStudentId } = useParams();
  const [view, setView] = useState("loading"); // loading | roster | board | notfound | error
  const [students, setStudents] = useState([]);
  const [newStudentName, setNewStudentName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [persistError, setPersistError] = useState(false);

  const [activeStudentId, setActiveStudentId] = useState(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [textBoxes, setTextBoxes] = useState([]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [confirmClearBoard, setConfirmClearBoard] = useState(false);

  const viewportRef = useRef(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;

  const panDragRef = useRef(null);
  const boxDragRef = useRef(null);
  const resizeDragRef = useRef(null);
  const nextZIndexRef = useRef(1);
  const justCreatedIdRef = useRef(null);

  const saveTimerRef = useRef(null);
  const pendingSnapshotRef = useRef(null);
  const suppressSaveRef = useRef(false);

  const loadBoard = useCallback(async (studentId) => {
    setBoardLoading(true);
    try {
      const data = await getJSON(boardKey(studentId), null);
      const board = data && typeof data === "object" ? data : {};
      const boxes = Array.isArray(board.textBoxes) ? board.textBoxes : [];
      const viewport = board.viewport || {};
      suppressSaveRef.current = true;
      setTextBoxes(boxes);
      setPan({ x: viewport.x || 0, y: viewport.y || 0 });
      setZoom(typeof viewport.zoom === "number" ? viewport.zoom : 1);
      setSelectedBoxId(null);
      nextZIndexRef.current = boxes.reduce((max, b) => Math.max(max, b.zIndex || 0), 0) + 1;
    } catch (e) {
      setPersistError(true);
      setTimeout(() => setPersistError(false), 2500);
    } finally {
      setBoardLoading(false);
    }
  }, []);

  const openBoard = useCallback(
    (studentId) => {
      setActiveStudentId(studentId);
      setView("board");
      loadBoard(studentId);
    },
    [loadBoard]
  );

  const loadStudents = useCallback(async () => {
    setView("loading");
    try {
      const parsed = await getJSON(STUDENTS_KEY, []);
      const list = Array.isArray(parsed) ? parsed : [];
      setStudents(list);
      if (sharedStudentId) {
        const found = list.find((s) => s.id === sharedStudentId);
        if (found) {
          openBoard(found.id);
        } else {
          setView("notfound");
        }
      } else {
        setView("roster");
      }
    } catch (e) {
      setView("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedStudentId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (pendingSnapshotRef.current && activeStudentId) {
      const snapshot = pendingSnapshotRef.current;
      pendingSnapshotRef.current = null;
      setJSON(boardKey(activeStudentId), snapshot).catch(() => {
        setPersistError(true);
        setTimeout(() => setPersistError(false), 2500);
      });
    }
  }, [activeStudentId]);

  const scheduleSave = useCallback(
    (snapshot) => {
      pendingSnapshotRef.current = snapshot;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        flushSave();
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave]
  );

  // persist the board whenever its content or viewport changes, skipping the
  // save that would otherwise immediately re-write what loadBoard just read
  useEffect(() => {
    if (view !== "board") return;
    if (suppressSaveRef.current) {
      suppressSaveRef.current = false;
      return;
    }
    scheduleSave({ textBoxes, viewport: { x: pan.x, y: pan.y, zoom } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textBoxes, pan, zoom]);

  useEffect(() => {
    return () => flushSave();
  }, [flushSave]);

  const persistStudents = useCallback((next) => {
    setStudents(next);
    setJSON(STUDENTS_KEY, next).catch(() => {
      setPersistError(true);
      setTimeout(() => setPersistError(false), 2500);
    });
  }, []);

  function addStudent() {
    const name = newStudentName.trim();
    if (!name) return;
    const student = { id: String(Date.now()), name, createdAt: new Date().toISOString() };
    persistStudents([...students, student]);
    setNewStudentName("");
  }

  function deleteStudent(id) {
    const next = students.filter((s) => s.id !== id);
    persistStudents(next);
    setConfirmDeleteId(null);
    removeItem(boardKey(id)).catch(() => {});
  }

  function copyStudentLink(id) {
    const url = `${window.location.origin}/whiteboard/${id}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function backToRoster() {
    flushSave();
    setActiveStudentId(null);
    setSelectedBoxId(null);
    setView("roster");
  }

  const activeStudent = students.find((s) => s.id === activeStudentId);
  const selectedBox = textBoxes.find((b) => b.id === selectedBoxId);

  function getViewportRect() {
    return viewportRef.current.getBoundingClientRect();
  }

  function screenToWorld(clientX, clientY) {
    const rect = getViewportRect();
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }

  function addTextBoxAt(x, y) {
    const id = String(Date.now());
    nextZIndexRef.current += 1;
    const box = {
      id,
      x,
      y,
      width: DEFAULT_BOX_WIDTH,
      height: DEFAULT_BOX_HEIGHT,
      text: "",
      color: SWATCHES[0],
      fontSize: DEFAULT_FONT_SIZE,
      bold: false,
      zIndex: nextZIndexRef.current,
    };
    justCreatedIdRef.current = id;
    setTextBoxes((prev) => [...prev, box]);
    setSelectedBoxId(id);
  }

  function addTextBoxAtViewportCenter() {
    const rect = getViewportRect();
    const world = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    addTextBoxAt(world.x - DEFAULT_BOX_WIDTH / 2, world.y - DEFAULT_BOX_HEIGHT / 2);
  }

  function updateBox(id, patch) {
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function changeBoxText(id, text, growHeight) {
    updateBox(id, growHeight ? { text, height: growHeight } : { text });
  }

  function selectBox(id) {
    setSelectedBoxId(id);
    nextZIndexRef.current += 1;
    updateBox(id, { zIndex: nextZIndexRef.current });
  }

  function deleteBox(id) {
    setTextBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedBoxId((cur) => (cur === id ? null : cur));
  }

  function setSelectedBoxColor(color) {
    if (!selectedBoxId) return;
    updateBox(selectedBoxId, { color });
  }

  function changeSelectedBoxFontSize(delta) {
    if (!selectedBoxId) return;
    const current = textBoxes.find((b) => b.id === selectedBoxId);
    const base = current && current.fontSize ? current.fontSize : DEFAULT_FONT_SIZE;
    updateBox(selectedBoxId, { fontSize: clamp(base + delta, MIN_FONT_SIZE, MAX_FONT_SIZE) });
  }

  function toggleSelectedBoxBold() {
    if (!selectedBoxId) return;
    const current = textBoxes.find((b) => b.id === selectedBoxId);
    updateBox(selectedBoxId, { bold: !(current && current.bold) });
  }

  function handleViewportPointerDown(e) {
    if (e.target.closest(".wb-textbox")) return;
    setSelectedBoxId(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    panDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPan: panRef.current,
    };
  }

  function handleViewportPointerMove(e) {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setPan({
      x: drag.startPan.x + (e.clientX - drag.startClientX),
      y: drag.startPan.y + (e.clientY - drag.startClientY),
    });
  }

  function handleViewportPointerUp(e) {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    panDragRef.current = null;
    const moved = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
    // a click (barely any movement) adds a text box; a real drag just pans
    if (moved < CLICK_MOVE_THRESHOLD) {
      const world = screenToWorld(e.clientX, e.clientY);
      addTextBoxAt(world.x - DEFAULT_BOX_WIDTH / 2, world.y - DEFAULT_BOX_HEIGHT / 2);
    }
  }

  function handleBoxHeaderPointerDown(e, box) {
    e.stopPropagation();
    selectBox(box.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    boxDragRef.current = {
      id: box.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: box.x,
      startY: box.y,
    };
  }

  function handleBoxHeaderPointerMove(e) {
    const drag = boxDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = (e.clientX - drag.startClientX) / zoomRef.current;
    const dy = (e.clientY - drag.startClientY) / zoomRef.current;
    updateBox(drag.id, { x: drag.startX + dx, y: drag.startY + dy });
  }

  function handleBoxHeaderPointerUp(e) {
    const drag = boxDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    boxDragRef.current = null;
  }

  function handleResizeHandlePointerDown(e, box) {
    e.stopPropagation();
    selectBox(box.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeDragRef.current = {
      id: box.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWidth: box.width,
      startHeight: box.height,
    };
  }

  function handleResizeHandlePointerMove(e) {
    const drag = resizeDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = (e.clientX - drag.startClientX) / zoomRef.current;
    const dy = (e.clientY - drag.startClientY) / zoomRef.current;
    updateBox(drag.id, {
      width: clamp(drag.startWidth + dx, MIN_BOX_WIDTH, Infinity),
      height: clamp(drag.startHeight + dy, MIN_BOX_HEIGHT, Infinity),
    });
  }

  function handleResizeHandlePointerUp(e) {
    const drag = resizeDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    resizeDragRef.current = null;
  }

  // native (non-synthetic) wheel listener: React's passive root listener
  // can't reliably preventDefault() to stop page scroll while zooming
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || view !== "board") return;
    function handleWheel(e) {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const prevZoom = zoomRef.current;
      const prevPan = panRef.current;
      const worldX = (cursorX - prevPan.x) / prevZoom;
      const worldY = (cursorY - prevPan.y) / prevZoom;
      const nextZoom = clamp(prevZoom * Math.exp(-e.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM);
      setZoom(nextZoom);
      setPan({ x: cursorX - worldX * nextZoom, y: cursorY - worldY * nextZoom });
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [view]);

  function zoomBy(factor) {
    setZoom((z) => clamp(z * factor, MIN_ZOOM, MAX_ZOOM));
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function clearBoard() {
    setTextBoxes([]);
    setSelectedBoxId(null);
    setConfirmClearBoard(false);
  }

  return (
    <div className={view === "board" ? "wb-board-page" : "wb-root"}>
      {view === "loading" && (
        <div className="wb-shell">
          <div className="wb-empty">Loading students...</div>
        </div>
      )}

      {view === "error" && (
        <div className="wb-shell">
          <div className="wb-card wb-empty">
            Couldn't load your students. Check your connection and try again.
            <div className="wb-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <button className="wb-btn wb-btn-primary wb-btn-sm" onClick={loadStudents}>
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "notfound" && (
        <div className="wb-shell">
          <div className="wb-card wb-empty">
            This student's board doesn't exist or was removed.
            <div className="wb-row" style={{ justifyContent: "center", marginTop: 14 }}>
              <Link className="wb-btn wb-btn-primary wb-btn-sm" to="/">
                Home
              </Link>
            </div>
          </div>
        </div>
      )}

      {view === "roster" && (
        <div className="wb-shell">
          <div className="wb-eyebrow">Whiteboard</div>
          <div className="wb-topbar">
            <h1 className="wb-title" style={{ marginBottom: 0 }}>Students</h1>
            {persistError && <span className="wb-flash wb-flash-error">Couldn't save — check connection</span>}
          </div>

          <div className="wb-card" style={{ marginBottom: 20 }}>
            <label className="wb-field-label" htmlFor="wb-new-student">Add a student</label>
            <div className="wb-row">
              <input
                id="wb-new-student"
                className="wb-input"
                placeholder="Student name"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addStudent();
                }}
              />
              <button className="wb-btn wb-btn-primary wb-btn-sm" onClick={addStudent}>
                + Add student
              </button>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="wb-card wb-empty" style={{ marginBottom: 20 }}>
              No students yet.
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              {students.map((s) => (
                <div className="wb-list-item" key={s.id}>
                  <div>
                    <div className="wb-list-item-name">{s.name}</div>
                    <div className="wb-list-item-meta">
                      Created {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="wb-row">
                    <button className="wb-btn wb-btn-primary wb-btn-sm" onClick={() => openBoard(s.id)}>
                      Open board
                    </button>
                    <button className="wb-btn wb-btn-ghost wb-btn-sm" onClick={() => copyStudentLink(s.id)}>
                      {copiedId === s.id ? "Copied!" : "Copy link"}
                    </button>
                    {confirmDeleteId === s.id ? (
                      <button className="wb-btn wb-btn-danger wb-btn-sm" onClick={() => deleteStudent(s.id)}>
                        Confirm
                      </button>
                    ) : (
                      <button className="wb-btn wb-btn-ghost wb-btn-sm" onClick={() => setConfirmDeleteId(s.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="wb-row">
            <Link className="wb-btn wb-btn-ghost" to="/">
              Home
            </Link>
          </div>
        </div>
      )}

      {view === "board" && activeStudent && (
        <div className="wb-board-shell">
          <div className="wb-toolbar">
            <div className="wb-row">
              <button className="wb-btn wb-btn-ghost wb-btn-sm" onClick={backToRoster}>
                ← Students
              </button>
              <span className="wb-toolbar-name">{activeStudent.name}</span>
            </div>

            <div className="wb-row">
              <div className="wb-zoom-group">
                <button className="wb-btn wb-btn-ghost wb-btn-sm" onClick={() => zoomBy(0.8)}>
                  －
                </button>
                <span className="wb-zoom-value">{Math.round(zoom * 100)}%</span>
                <button className="wb-btn wb-btn-ghost wb-btn-sm" onClick={() => zoomBy(1.25)}>
                  ＋
                </button>
                <button className="wb-btn wb-btn-ghost wb-btn-sm" onClick={resetView}>
                  Reset view
                </button>
              </div>

              <button className="wb-btn wb-btn-primary wb-btn-sm" onClick={addTextBoxAtViewportCenter}>
                + Text
              </button>

              <div className="wb-zoom-group">
                <button
                  className="wb-btn wb-btn-ghost wb-btn-sm"
                  disabled={!selectedBoxId}
                  onClick={() => changeSelectedBoxFontSize(-FONT_SIZE_STEP)}
                >
                  Aa－
                </button>
                <span className="wb-zoom-value">{selectedBox ? selectedBox.fontSize || DEFAULT_FONT_SIZE : "—"}</span>
                <button
                  className="wb-btn wb-btn-ghost wb-btn-sm"
                  disabled={!selectedBoxId}
                  onClick={() => changeSelectedBoxFontSize(FONT_SIZE_STEP)}
                >
                  Aa＋
                </button>
                <button
                  className={"wb-btn wb-btn-sm" + (selectedBox && selectedBox.bold ? " wb-btn-primary" : " wb-btn-ghost")}
                  disabled={!selectedBoxId}
                  onClick={toggleSelectedBoxBold}
                  style={{ fontWeight: 800 }}
                >
                  B
                </button>
              </div>

              <div className="wb-swatches">
                {SWATCHES.map((color) => (
                  <button
                    key={color}
                    className="wb-swatch"
                    style={{ background: color }}
                    disabled={!selectedBoxId}
                    onClick={() => setSelectedBoxColor(color)}
                    aria-label={`Set color ${color}`}
                  />
                ))}
              </div>

              <button
                className="wb-btn wb-btn-ghost wb-btn-sm"
                disabled={!selectedBoxId}
                onClick={() => selectedBoxId && deleteBox(selectedBoxId)}
              >
                Delete
              </button>

              {confirmClearBoard ? (
                <button className="wb-btn wb-btn-danger wb-btn-sm" onClick={clearBoard}>
                  Confirm clear board
                </button>
              ) : (
                <button className="wb-btn wb-btn-ghost wb-btn-sm" onClick={() => setConfirmClearBoard(true)}>
                  Clear board
                </button>
              )}
            </div>
          </div>

          {persistError && (
            <div className="wb-flash wb-flash-error wb-flash-floating">Couldn't save — check connection</div>
          )}

          <div
            className="wb-viewport"
            ref={viewportRef}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={(e) => {
              handleViewportPointerMove(e);
              handleBoxHeaderPointerMove(e);
              handleResizeHandlePointerMove(e);
            }}
            onPointerUp={(e) => {
              handleViewportPointerUp(e);
              handleBoxHeaderPointerUp(e);
              handleResizeHandlePointerUp(e);
            }}
          >
            {boardLoading ? (
              <div className="wb-empty">Loading board...</div>
            ) : (
              <div
                className="wb-world"
                style={{
                  width: BOARD_WIDTH,
                  height: BOARD_HEIGHT,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                {textBoxes.map((box) => (
                  <WhiteboardTextBox
                    key={box.id}
                    box={box}
                    isSelected={selectedBoxId === box.id}
                    justCreated={justCreatedIdRef.current === box.id}
                    onHeaderPointerDown={handleBoxHeaderPointerDown}
                    onResizeHandlePointerDown={handleResizeHandlePointerDown}
                    onSelect={selectBox}
                    onChangeText={changeBoxText}
                    onDelete={deleteBox}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="wb-hint wb-board-hint">
            Click an empty area to add a text box. Drag empty space to pan, scroll to zoom.
          </div>
        </div>
      )}
    </div>
  );
}
