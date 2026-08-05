const PASSPHRASE_KEY = "app-passphrase";

function getStoredPassphrase() {
  try {
    return window.localStorage.getItem(PASSPHRASE_KEY) || "";
  } catch (e) {
    return "";
  }
}

function setStoredPassphrase(value) {
  try {
    window.localStorage.setItem(PASSPHRASE_KEY, value);
  } catch (e) {
    // silent fail: passphrase just won't be remembered for next time
  }
}

function promptForPassphrase() {
  const value = window.prompt("Enter the app passphrase:") || "";
  setStoredPassphrase(value);
  return value;
}

const READ_METHODS = new Set(["GET"]);

async function request(method, key, body) {
  // Send whatever passphrase we already have and let the server decide. Asking
  // up front was redundant — the 401 branch below already prompts and retries —
  // and it meant every first write popped a blocking window.prompt even against
  // a backend that doesn't require one (e.g. the local dev stub in
  // vite.config.js). Reads are public anyway, except whiteboard keys.
  let passphrase = getStoredPassphrase();

  const attempt = (pass) =>
    fetch(`/api/data?key=${encodeURIComponent(key)}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-app-passphrase": pass,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await attempt(passphrase);
  // Reads are normally public and never 401, except for whiteboard keys
  // (private student data) — prompt there too, not just on writes.
  if (res.status === 401) {
    passphrase = promptForPassphrase();
    res = await attempt(passphrase);
  }
  if (!res.ok) {
    throw new Error(`Storage request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export async function getJSON(key, fallback) {
  const data = await request("GET", key);
  return data && data.value !== null && data.value !== undefined ? data.value : fallback;
}

export async function setJSON(key, value) {
  await request("PUT", key, { value });
}

export async function removeItem(key) {
  await request("DELETE", key);
}
