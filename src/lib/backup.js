import { getJSON, setJSON } from "./storage.js";
import { teacherKey } from "./teacher.js";
import {
  UNSCRAMBLE_SETS_KEY,
  OPEN_THE_BOXES_SETS_KEY,
  SPIN_THE_WHEEL_SETS_KEY,
  WHITEBOARD_STUDENTS_KEY,
  whiteboardBoardKey,
} from "./storageKeys.js";

const BACKUP_VERSION = 1;
const WHITEBOARD_BOARDS_KEY = "whiteboard-boards";
// A hosted free-tier database can vanish without warning (it happened once
// already — see the "Uninstalled" Redis incident). This is the only local
// safety net, so remind teachers to export well before that matters.
const REMINDER_THRESHOLD_DAYS = 14;

function lastBackupStorageKey(teacherId) {
  return `backup-last--${teacherId}`;
}

export function getLastBackupAt(teacherId) {
  try {
    return window.localStorage.getItem(lastBackupStorageKey(teacherId));
  } catch (e) {
    return null;
  }
}

function recordBackup(teacherId) {
  try {
    window.localStorage.setItem(lastBackupStorageKey(teacherId), new Date().toISOString());
  } catch (e) {
    // silent fail: the reminder just won't know a backup just happened
  }
}

export function daysSinceLastBackup(teacherId) {
  const last = getLastBackupAt(teacherId);
  if (!last) return null;
  return Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
}

export function shouldRemindBackup(teacherId) {
  const days = daysSinceLastBackup(teacherId);
  return days === null || days >= REMINDER_THRESHOLD_DAYS;
}

export async function exportTeacherData(teacherId) {
  const [unscramble, openTheBoxes, spinTheWheel, students] = await Promise.all([
    getJSON(teacherKey(UNSCRAMBLE_SETS_KEY, teacherId), []),
    getJSON(teacherKey(OPEN_THE_BOXES_SETS_KEY, teacherId), []),
    getJSON(teacherKey(SPIN_THE_WHEEL_SETS_KEY, teacherId), []),
    getJSON(teacherKey(WHITEBOARD_STUDENTS_KEY, teacherId), []),
  ]);

  const boardEntries = await Promise.all(
    (Array.isArray(students) ? students : []).map(async (student) => [
      student.id,
      await getJSON(whiteboardBoardKey(student.id), null),
    ])
  );

  const bundle = {
    version: BACKUP_VERSION,
    teacherId,
    exportedAt: new Date().toISOString(),
    data: {
      [UNSCRAMBLE_SETS_KEY]: unscramble,
      [OPEN_THE_BOXES_SETS_KEY]: openTheBoxes,
      [SPIN_THE_WHEEL_SETS_KEY]: spinTheWheel,
      [WHITEBOARD_STUDENTS_KEY]: students,
      [WHITEBOARD_BOARDS_KEY]: Object.fromEntries(boardEntries.filter(([, board]) => board)),
    },
  };

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `teaching-tools-backup-${teacherId}-${bundle.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  recordBackup(teacherId);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export async function importTeacherData(teacherId, file) {
  const parsed = JSON.parse(await file.text());
  const data = parsed && typeof parsed === "object" ? parsed.data : null;
  if (!data || typeof data !== "object") {
    throw new Error("This file doesn't look like a teaching-tools backup.");
  }

  await Promise.all([
    setJSON(teacherKey(UNSCRAMBLE_SETS_KEY, teacherId), asArray(data[UNSCRAMBLE_SETS_KEY])),
    setJSON(teacherKey(OPEN_THE_BOXES_SETS_KEY, teacherId), asArray(data[OPEN_THE_BOXES_SETS_KEY])),
    setJSON(teacherKey(SPIN_THE_WHEEL_SETS_KEY, teacherId), asArray(data[SPIN_THE_WHEEL_SETS_KEY])),
    setJSON(teacherKey(WHITEBOARD_STUDENTS_KEY, teacherId), asArray(data[WHITEBOARD_STUDENTS_KEY])),
  ]);

  const boards = data[WHITEBOARD_BOARDS_KEY] || {};
  await Promise.all(
    Object.entries(boards).map(([studentId, board]) => setJSON(whiteboardBoardKey(studentId), board))
  );

  recordBackup(teacherId);
}
