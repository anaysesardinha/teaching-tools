import { getJSON } from "./storage.js";
import { TEACHERS, getActiveTeacherId, teacherKey } from "./teacher.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export async function loadOwnSets(baseKey, teacherId) {
  return asArray(await getJSON(teacherKey(baseKey, teacherId), null));
}

// A shared play link can be opened by anyone: a student with no teacher
// selected, or the other teacher. Look across every teacher's space.
// Wanderley's space is the un-suffixed key, so links shared before the split
// still resolve here.
export async function findSharedSet(baseKey, setId, preferTeacherId) {
  const active = preferTeacherId || getActiveTeacherId();
  const ids = [active, ...TEACHERS.map((t) => t.id)].filter(
    (id, index, all) => id && all.indexOf(id) === index
  );

  for (const id of ids) {
    const found = asArray(await getJSON(teacherKey(baseKey, id), null)).find(
      (s) => s.id === setId
    );
    if (found) return found;
  }

  return null;
}
