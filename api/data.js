import Redis from "ioredis";

const EXACT_ALLOWED_KEYS = new Set([
  "unscramble-sets",
  "open-the-boxes-sets",
  "spin-the-wheel-sets",
  "whiteboard-students",
]);
// Whiteboard boards are one Redis key per student, so the id is dynamic —
// this regex bounds the character set/length instead of an exact-match list.
const WHITEBOARD_BOARD_KEY_RE = /^whiteboard-board-[A-Za-z0-9_-]{1,64}$/;

function isAllowedKey(key) {
  return EXACT_ALLOWED_KEYS.has(key) || WHITEBOARD_BOARD_KEY_RE.test(key);
}

// Whiteboard data can hold private notes about a student, unlike the other
// games' keys (which are meant to be readable via a public shared play link).
function isWhiteboardKey(key) {
  return key === "whiteboard-students" || WHITEBOARD_BOARD_KEY_RE.test(key);
}

let redisClient = null;
function getRedis() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not configured");
  }
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
    });
  }
  return redisClient;
}

export default async function handler(req, res) {
  const key = req.query.key;
  if (typeof key !== "string" || !isAllowedKey(key)) {
    res.status(400).json({ error: "Invalid key" });
    return;
  }

  // Reading is public for the other games (students can open a shared play
  // link with no passphrase). Whiteboard keys have no student-facing use
  // case and can hold private notes, so they require the passphrase to read
  // too. Writing always requires the passphrase, for every key.
  const requiresAuthForRead = isWhiteboardKey(key);
  if (req.method !== "GET" || requiresAuthForRead) {
    const passphrase = req.headers["x-app-passphrase"];
    if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  let redis;
  try {
    redis = getRedis();
  } catch (e) {
    res.status(500).json({ error: "Storage is not configured" });
    return;
  }

  try {
    if (req.method === "GET") {
      const raw = await redis.get(key);
      res.status(200).json({ value: raw ? JSON.parse(raw) : null });
      return;
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      await redis.set(key, JSON.stringify(body.value));
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      await redis.del(key);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    res.status(502).json({ error: "Storage request failed" });
  }
}
