import Redis from "ioredis";

const ALLOWED_KEYS = new Set([
  "unscramble-sets",
  "open-the-boxes-sets",
  "spin-the-wheel-sets",
]);

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
  // Reading is public (students can open a shared play link with no passphrase).
  // Writing is not: only someone with the passphrase can create/edit/delete/reset sets.
  if (req.method !== "GET") {
    const passphrase = req.headers["x-app-passphrase"];
    if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const key = req.query.key;
  if (typeof key !== "string" || !ALLOWED_KEYS.has(key)) {
    res.status(400).json({ error: "Invalid key" });
    return;
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
