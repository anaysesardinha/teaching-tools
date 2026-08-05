// Two teachers share this app, so every teacher-owned storage key carries a
// suffix. The separation is organisational, not a security boundary: switching
// is one click away and nothing stops one teacher from opening the other's
// space. It exists so their sets don't get mixed up.

export const TEACHERS = [
  { id: "anayse", suffix: "--anayse", name: "Teacher Anayse" },
  // Wanderley keeps the original, un-suffixed keys. Everything saved before
  // there were separate spaces is his, so this leaves that data exactly where
  // it already lives — nothing is copied, moved, or deleted, and older share
  // links to those sets keep working.
  { id: "wanderley", suffix: "", name: "Teacher Wanderley" },
];

const ACTIVE_TEACHER_KEY = "active-teacher";

// The palette is stored per teacher, so switching has to tell the toggles that
// live outside the router. The browser's own `storage` event only fires in
// *other* tabs, which is the opposite of what's needed here.
export const TEACHER_CHANGED_EVENT = "teacher-changed";

function announceTeacherChange() {
  try {
    window.dispatchEvent(new Event(TEACHER_CHANGED_EVENT));
  } catch (e) {
    // silent fail: the next render picks it up anyway
  }
}

export function getActiveTeacherId() {
  try {
    const stored = window.localStorage.getItem(ACTIVE_TEACHER_KEY);
    return TEACHERS.some((t) => t.id === stored) ? stored : null;
  } catch (e) {
    return null;
  }
}

export function setActiveTeacherId(id) {
  try {
    window.localStorage.setItem(ACTIVE_TEACHER_KEY, id);
  } catch (e) {
    // silent fail: the picker will just come back next time
  }
  announceTeacherChange();
}

export function clearActiveTeacher() {
  try {
    window.localStorage.removeItem(ACTIVE_TEACHER_KEY);
  } catch (e) {
    // silent fail
  }
  announceTeacherChange();
}

export function teacherName(id) {
  const match = TEACHERS.find((t) => t.id === id);
  return match ? match.name : "";
}

export function teacherKey(baseKey, teacherId) {
  const id = teacherId || getActiveTeacherId();
  const teacher = TEACHERS.find((t) => t.id === id);
  // With no teacher resolved, deliberately return a key that belongs to nobody
  // rather than the bare base key — that one is Wanderley's real data, and a
  // stray write must not land there. The screens guard against this anyway.
  return teacher ? baseKey + teacher.suffix : `${baseKey}--none`;
}
