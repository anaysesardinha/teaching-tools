export function getJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function setJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // silent fail: state still updates in memory even if persistence fails
  }
}

export function removeItem(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    // silent fail
  }
}
