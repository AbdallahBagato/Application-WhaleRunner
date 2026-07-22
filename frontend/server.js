/**
 * Whale Runner — Tier 1 (Frontend) — Node.js + Express
 *
 * Responsibilities:
 *   1. Serve the static game (public/: index.html, style.css, game.js)
 *   2. Reverse-proxy every /api/* request to the Flask backend (Tier 2)
 *      so the browser talks to ONE origin (no CORS needed).
 *
 * Configuration comes from environment variables only (12-factor):
 *   PORT     - port this server listens on          (default 3000)
 *   API_URL  - base URL of the Flask backend        (default http://api:5000)
 *              NOTE: "api" is meant to be resolved by Docker's embedded DNS
 *              when both containers share a user-defined network.
 */
const express = require("express");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

const PORT = parseInt(process.env.PORT || "3000", 10);
const API_URL = process.env.API_URL || "http://api:5000";

const app = express();

// ---- 1) proxy /api/* → Flask backend ------------------------------------
app.use(
  "/api",
  createProxyMiddleware({
    target: API_URL,
    changeOrigin: true,
    // keep the /api prefix when forwarding (Flask routes are /api/...)
    pathRewrite: (p) => "/api" + p.replace(/^\/api/, ""),
    on: {
      error: (err, req, res) => {
        console.error(`[proxy] ${req.method} ${req.url} -> ${API_URL} failed: ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
        }
        res.end(JSON.stringify({ error: "backend unreachable" }));
      },
    },
  })
);

// ---- 2) static game files ------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

// ---- health endpoint for the frontend itself (use in your HEALTHCHECK) ---
app.get("/healthz", (_req, res) => res.json({ status: "ok", tier: "frontend" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[frontend] listening on :${PORT}, proxying /api -> ${API_URL}`);
});
