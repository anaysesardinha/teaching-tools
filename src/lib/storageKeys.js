// Single source of truth for the base storage key each game reads/writes
// through lib/storage.js (teacher-suffixed via teacherKey()). Centralised so
// lib/backup.js can enumerate every key without duplicating string literals
// that could drift from what each game actually uses. Keep in sync with
// api/data.js's own BASE_KEYS allow-list.

export const UNSCRAMBLE_SETS_KEY = "unscramble-sets";
export const OPEN_THE_BOXES_SETS_KEY = "open-the-boxes-sets";
export const SPIN_THE_WHEEL_SETS_KEY = "spin-the-wheel-sets";
export const FILL_IN_THE_BLANKS_SETS_KEY = "fill-in-the-blanks-sets";
export const WHITEBOARD_STUDENTS_KEY = "whiteboard-students";

// Whiteboard boards are one key per student, not teacher-suffixed: the
// student id is already unique, and the (teacher-suffixed) roster is what
// separates one teacher's students from the other's.
export const whiteboardBoardKey = (studentId) => `whiteboard-board-${studentId}`;
