import { Redis } from "@upstash/redis";

const ALLOWED_KEYS = new Set([
  "unscramble-sets",
  "open-the-boxes-sets",
  "spin-the-wheel-sets",
]);

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Redis env vars are not configured");
  }
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  const passphrase = req.headers["x-app-passphrase"];
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: "Unauthorized" });
    return;
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
      const value = await redis.get(key);
      res.status(200).json({ value: value ?? null });
      return;
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      await redis.set(key, body.value);
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
