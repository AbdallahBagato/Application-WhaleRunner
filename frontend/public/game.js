/* Whale Runner — a tiny Chrome-Dino-style game with a Docker twist.
   The whale (🐳) must jump over the Matrix-from-Hell fires (🔥) and bugs (🐛).
   Score is posted to the Flask API which stores it in PostgreSQL. */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const dlg = document.getElementById("gameover");
const scoresEl = document.getElementById("scores");

const GROUND_Y = 210;
const GRAVITY = 0.62;
const JUMP_V = -12.5;

let whale, obstacles, clouds, speed, score, best = 0, running, spawnTimer, raf;

function reset() {
  whale = { x: 70, y: GROUND_Y, vy: 0, size: 44, jumping: false };
  obstacles = [];
  clouds = [
    { x: 150, y: 40 }, { x: 420, y: 70 }, { x: 620, y: 30 }
  ];
  speed = 5;
  score = 0;
  spawnTimer = 0;
  running = true;
}

function jump() {
  if (!running) { start(); return; }
  if (!whale.jumping) {
    whale.vy = JUMP_V;
    whale.jumping = true;
  }
}

/* ---------- input ---------- */
addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
});
canvas.addEventListener("pointerdown", jump);

/* ---------- world ---------- */
function spawnObstacle() {
  const type = Math.random() < 0.6 ? "🔥" : "🐛";
  const big = Math.random() < 0.3;
  obstacles.push({
    x: canvas.width + 20,
    y: GROUND_Y + (type === "🐛" ? 4 : 0),
    emoji: type,
    size: big ? 46 : 34,
  });
}

function update() {
  // whale physics
  whale.vy += GRAVITY;
  whale.y += whale.vy;
  if (whale.y >= GROUND_Y) { whale.y = GROUND_Y; whale.vy = 0; whale.jumping = false; }

  // difficulty ramps up: your uptime SLO gets harder :)
  speed += 0.0018;
  score += 0.15 * speed;

  // spawn
  spawnTimer -= 1;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = 55 + Math.random() * 70 - Math.min(30, speed * 2);
  }

  // move & collide
  for (const o of obstacles) o.x -= speed;
  obstacles = obstacles.filter((o) => o.x > -60);
  for (const c of clouds) { c.x -= speed * 0.25; if (c.x < -80) c.x = canvas.width + 40; }

  for (const o of obstacles) {
    const dx = Math.abs((o.x) - (whale.x));
    const dy = Math.abs((o.y) - (whale.y));
    if (dx < (whale.size + o.size) * 0.32 && dy < (whale.size + o.size) * 0.35) {
      gameOver();
      return;
    }
  }
  draw();
  raf = requestAnimationFrame(update);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // sky decorations
  ctx.font = "28px serif";
  for (const c of clouds) ctx.fillText("☁️", c.x, c.y);

  // ground
  ctx.strokeStyle = "#065A82";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 28);
  ctx.lineTo(canvas.width, GROUND_Y + 28);
  ctx.stroke();
  ctx.setLineDash([6, 10]);
  ctx.strokeStyle = "#1C7293";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 36);
  ctx.lineTo(canvas.width, GROUND_Y + 36);
  ctx.stroke();
  ctx.setLineDash([]);

  // whale (flip horizontally so it faces right)
  ctx.save();
  ctx.translate(whale.x, whale.y);
  ctx.scale(-1, 1);
  ctx.font = `${whale.size}px serif`;
  ctx.textAlign = "center";
  ctx.fillText("🐳", 0, 0);
  ctx.restore();

  // containers on the whale's back when running fast (it's shipping!)
  if (speed > 7) {
    ctx.font = "16px serif";
    ctx.fillText("📦", whale.x - 2, whale.y - 34);
  }

  // obstacles
  ctx.textAlign = "center";
  for (const o of obstacles) {
    ctx.font = `${o.size}px serif`;
    ctx.fillText(o.emoji, o.x, o.y);
  }

  // HUD
  ctx.fillStyle = "#21295C";
  ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE ${Math.floor(score)}`, 16, 28);
  ctx.textAlign = "right";
  ctx.fillText(`BEST ${Math.floor(best)}`, canvas.width - 16, 28);

  if (!running) {
    ctx.textAlign = "center";
    ctx.font = "bold 22px 'Segoe UI', sans-serif";
    ctx.fillText("Press Space / Tap to run 🐳", canvas.width / 2, 120);
  }
}

/* ---------- lifecycle ---------- */
function start() {
  reset();
  cancelAnimationFrame(raf);
  update();
}

function gameOver() {
  running = false;
  best = Math.max(best, score);
  cancelAnimationFrame(raf);
  document.getElementById("finalScore").textContent =
    `Final score: ${Math.floor(score)} — save it to the database!`;
  dlg.showModal();
}

document.getElementById("save").addEventListener("click", async () => {
  const player = document.getElementById("player").value || "anonymous";
  try {
    await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player, score: Math.floor(score) }),
    });
  } catch (e) { console.error("API unreachable:", e); }
  dlg.close();
  loadScores();
  draw();
});

/* ---------- leaderboard ---------- */
async function loadScores() {
  try {
    const res = await fetch("/api/scores");
    const data = await res.json();
    scoresEl.innerHTML = data.length
      ? data.map((s, i) =>
          `<li><span>${["🥇","🥈","🥉"][i] ?? (i + 1) + "."} ${escapeHtml(s.player)}</span><b>${s.score}</b></li>`
        ).join("")
      : "<li><span>No captains yet — be the first!</span><span></span></li>";
  } catch (e) {
    scoresEl.innerHTML = "<li><span>API offline 😴 (is the api container healthy?)</span><span></span></li>";
  }
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

reset();
running = false;
draw();
loadScores();
setInterval(loadScores, 15000);
