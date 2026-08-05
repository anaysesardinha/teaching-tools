import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// In production /api/data is a Vercel function backed by Redis (api/data.js).
// `vite` alone doesn't run Vercel functions, so under `npm run dev` that route
// used to fall through to the SPA and return JavaScript — every set screen
// failed with "Couldn't load your sets". This stub gives local dev the same
// contract, backed by a gitignored JSON file, so the app is usable offline.
// It never ships: `apply: "serve"` keeps it out of the build, and the deployed
// app still uses api/data.js. There is no passphrase check here on purpose —
// local dev shouldn't prompt, and this store holds nothing but scratch data.
function devDataApi() {
  const file = path.resolve(process.cwd(), ".dev-data.json");

  const readStore = () => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch (e) {
      return {};
    }
  };
  const writeStore = (store) => fs.writeFileSync(file, JSON.stringify(store, null, 2));
  const send = (res, status, body) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };

  return {
    name: "dev-data-api",
    apply: "serve",
    configureServer(server) {
      // Mounting on the path strips it from req.url, so parse against a base.
      server.middlewares.use("/api/data", (req, res) => {
        const key = new URL(req.url, "http://localhost").searchParams.get("key");
        if (!key) return send(res, 400, { error: "Invalid key" });

        const store = readStore();

        if (req.method === "GET") {
          return send(res, 200, { value: key in store ? store[key] : null });
        }
        if (req.method === "DELETE") {
          delete store[key];
          writeStore(store);
          return send(res, 200, { ok: true });
        }
        if (req.method === "PUT") {
          let raw = "";
          req.on("data", (chunk) => {
            raw += chunk;
          });
          req.on("end", () => {
            try {
              store[key] = JSON.parse(raw).value;
            } catch (e) {
              return send(res, 400, { error: "Invalid body" });
            }
            writeStore(store);
            send(res, 200, { ok: true });
          });
          return;
        }
        return send(res, 405, { error: "Method not allowed" });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devDataApi()],
});
