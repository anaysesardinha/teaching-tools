# Classroom Games — Project Spec

## Overview

A small collection of interactive games for a teacher to run during class. Built with vibe coding (Claude Code), starting from a validated prototype.

**Usage context:** classes are online. The teacher runs the game on their own device and shares the screen; students watch and answer verbally or in chat. There is no student-facing device or login, so no multiplayer sync, scoring server, or accounts are needed.

**Games planned:**
1. Unscramble Sentences — spec finalized, built
2. Spin the Wheel — spec finalized, built
3. Open the Boxes — spec finalized, built
4. Fill in the Blanks — not yet specified

All UI text, labels, and copy must be in English.

## Suggested stack

- React (the prototype is already a plain React component, framework-agnostic — works as-is inside Vite, Next.js, or Create React App)
- Local persistence: the prototype uses a `window.storage` API that only exists inside claude.ai artifacts. In the real project, replace it with:
  - `localStorage` for the simplest option (data lives in the browser, per device), or
  - a small JSON file read/written through a lightweight backend, if the teacher needs the same sets available across different computers
- No backend/auth needed unless cross-device sync becomes a requirement later

## Design system

Derived from the prototype, meant to be shared across all four games for visual consistency.

**Colors**
| Token | Hex | Use |
|---|---|---|
| `--bg` | #FAFAF8 | page background |
| `--surface` | #FFFFFF | cards |
| `--ink` | #1F2328 | primary text |
| `--ink-soft` | #6B7280 | secondary text |
| `--border` | #E5E7EB | borders, dividers |
| `--neutral-block` | #3F3F46 | untouched/neutral game pieces |
| `--accent` | #15803D | primary actions, correct state |
| `--accent-soft` | #DCFCE7 | correct background, subtle highlights |
| `--error` | #DC2626 | incorrect state |
| `--error-soft` | #FEE2E2 | incorrect background |

**Typography:** Manrope (700/800 for headings, 500 for body), system sans-serif fallback.

**Tone:** modern, minimal, one accent color (green) used sparingly. Built for on-screen clarity during a video call, not for physical projector distance.

## Game 1: Unscramble Sentences (finalized spec)

**Content setup**
- Teacher creates a named set (e.g. "Present Perfect - Grade 7")
- Sentences typed directly into a textarea, one per line
- Or imported from a `.txt` file (one sentence per line), appended into the same textarea
- Live count of detected sentences while typing
- Sets are saved and reusable across different classes/sessions

**Gameplay**
- Each sentence's words appear shuffled as draggable chips in a tray
- Teacher (or student, verbally guided) drags chips into ordered slots
- Words can also be placed by clicking a chip (falls into the next empty slot) — fallback for non-drag interaction
- Clicking a placed chip returns it to the tray
- Live feedback: as soon as a word is dropped (or clicked) into a slot, that slot turns green if it's in the correct position, light red if it's not — no separate "Check" step
- A confirmation banner appears once every slot is correct
- No scoring, no timer
- Prev/Next navigation between sentences in the set, with a "Sentence X of Y" counter

**Prototype:** `unscramble_sentences.jsx` (attached separately). Fully working except persistence, which needs to be swapped from `window.storage` to a real solution as described above.

## Game 2: Spin the Wheel (finalized spec)

**Content setup**
- Teacher creates a named set of items — could be student names, topics, questions, anything to randomly pick from
- Items typed directly into a textarea, one per line
- Or imported from a `.txt` file (one item per line), appended into the same textarea
- Live count of detected items while typing
- Sets are saved and reusable across different classes/sessions

**Gameplay**
- The wheel is divided into one slice per item, spun with a "Spin" button
- The wheel spins and decelerates to land on one random item, which is highlighted on the wheel and shown as large text below it
- Once an item has been drawn, it's excluded from future spins (visually dimmed on the wheel) until the teacher clicks "Reset wheel" — no repeats within a round, but the teacher can reset anytime without recreating the set
- No scoring, no timer

## Game 3: Open the Boxes (finalized spec)

**Content setup**
- Teacher creates a named set of open-ended conversation questions (no multiple choice — students answer verbally)
- Questions typed directly into a textarea, one per line
- Or imported from a `.txt` file (one question per line), appended into the same textarea
- Live count of detected questions while typing
- Sets are saved and reusable across different classes/sessions

**Gameplay**
- The game screen shows a grid of numbered boxes, one per question, numbered 1..N in the exact order the questions were typed (fixed, not shuffled)
- Clicking a box reveals that question, shown large enough to read during a video-call screen share
- A "Done" button on the revealed question returns to the box grid
- Once a box has been opened, it stays visually marked (muted, with a checkmark) but remains clickable, so the teacher can reread a question anytime
- A "Reset boxes" button clears every box back to unopened, without needing to recreate the set
- No scoring, no timer

## Game 4: not yet defined

Placeholder for a future spec session. Suggested next step: define it the same way the other three games were defined (usage context confirmed, one MVP decision at a time, prototype before building for real).

## Whiteboard (finalized spec)

**Usage context:** same as every other tool — the teacher runs it during a live video call, sharing their own screen. No student-facing device, login, or realtime sync.

**Content setup**
- The teacher keeps a roster of students (just a name each)
- Each student has their own persistent board that reopens exactly as it was left last time — no recreating or re-sharing anything between classes

**Gameplay / usage**
- Not a freehand-drawing tool — a lightweight, Miro-style board for typing notes: click "+ Text" or click empty space to create a movable text box there, type directly into it
- Pan by dragging empty space, zoom with the scroll wheel (centered on the cursor), "Reset view" recenters
- Each text box can be moved (drag its header), resized (drag its corner handle, and it also grows automatically as typed content no longer fits), recolored with a muted/dusty palette (or set to "no fill" for free-floating plain text with no card chrome), or deleted
- Bold and text size (Text/Subtitle/Title) both apply to just the selected text within a note (select a word/phrase, then Ctrl+B or a toolbar button), not the whole note — like a normal text editor
- "Clear board" empties a student's board but keeps them in the roster; "Delete student" removes the roster entry and its board entirely
- A board is a large but finite area (not infinite), matching the "doesn't need to be infinite" requirement
- No scoring, no timer

## Open questions for later

- Should sets eventually be shareable/exportable between the teacher's devices, or is per-device storage enough?
- Should there be a single unified "home" screen listing all four games, or four separate mini-apps?
- Any need for a simple "reset all data" option for the teacher?
