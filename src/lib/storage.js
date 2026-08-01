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

async function request(method, key, body) {
  let passphrase = getStoredPassphrase();
  if (!passphrase) passphrase = promptForPassphrase();

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
