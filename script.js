const stage = document.getElementById("stage");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const dotEls = [0, 1, 2].map(i => document.getElementById(`dot${i}`));
const sceneNameEl = document.getElementById("sceneName");
const scoreEl = document.getElementById("score");
const subtitleEl = document.getElementById("subtitle");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");

const toast = document.getElementById("toast");
const miniRow1 = document.getElementById("miniRow1");
const miniRow2 = document.getElementById("miniRow2");

// Valentine modal
const valModal = document.getElementById("valModal");
const burnSub = document.getElementById("burnSub");
const modalYes = document.getElementById("modalYes");
const modalNo = document.getElementById("modalNo");
const burnBtns = document.getElementById("burnBtns");
const noHint = document.getElementById("noHint");

// Gift modal
const giftModal = document.getElementById("giftModal");
const giftRestart = document.getElementById("giftRestart");

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return Math.random() * (b - a) + a; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function W() { return stage.getBoundingClientRect().width; }
function H() { return stage.getBoundingClientRect().height; }

let DPR = 1;
function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  DPR = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(rect.width * DPR);
  canvas.height = Math.floor(rect.height * DPR);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resizeCanvas);

// Input
const keys = {};
const input = { pointerDown: false, pointerJustDown: false, x: 0, y: 0, tap: false };

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyR") resetAll();
});
document.addEventListener("keyup", (e) => keys[e.code] = false);

function pointerToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const p = pointerToCanvas(e.clientX, e.clientY);
  input.pointerDown = true;
  input.pointerJustDown = true;
  input.tap = true;
  input.x = p.x;
  input.y = p.y;
});
canvas.addEventListener("pointermove", (e) => {
  if (!input.pointerDown) return;
  const p = pointerToCanvas(e.clientX, e.clientY);
  input.x = p.x;
  input.y = p.y;
});
canvas.addEventListener("pointerup", () => input.pointerDown = false);

// Audio
let audioCtx = null;
function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function beep(freq, ms, type = "sine", gain = 0.06) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + ms / 1000);
}
function playYesMelody() {
  ensureAudio();
  const notes = [660, 740, 880, 990];
  let t = 0;
  for (const f of notes) {
    setTimeout(() => beep(f, 120, "triangle", 0.06), t);
    t += 130;
  }
}

// Start button router
let startAction = () => {};
startBtn.onclick = () => { ensureAudio(); startAction(); };

// Game state
let scene = 0;
let score = 0;
let running = false;

// Confetti
let confetti = [];
let confettiTimer = 0;

function spawnConfetti() {
  const w = W(), h = H();
  confetti = [];
  for (let i = 0; i < 140; i++) {
    confetti.push({
      x: rand(0, w),
      y: rand(-h, 0),
      vx: rand(-0.8, 0.8),
      vy: rand(2.0, 4.8),
      r: rand(2, 5),
      a: rand(0, Math.PI * 2),
      va: rand(-0.12, 0.12),
      t: i % 3
    });
  }
  confettiTimer = 2.4;
}
function updateConfetti(dt) {
  if (confettiTimer <= 0) return;
  confettiTimer -= dt;
  const w = W(), h = H();
  for (const p of confetti) {
    p.x += p.vx;
    p.y += p.vy;
    p.a += p.va;
    if (p.y > h + 20) { p.y = -20; p.x = rand(0, w); }
    if (p.x < -20) p.x = w + 20;
    if (p.x > w + 20) p.x = -20;
  }
}
function drawConfetti() {
  if (confettiTimer <= 0) return;
  for (const p of confetti) {
    let c = "rgba(150, 90, 255, 0.9)";
    if (p.t === 1) c = "rgba(255,255,255,0.95)";
    if (p.t === 2) c = "rgba(255, 47, 116, 0.9)";
    ctx.save();
    ctx.fillStyle = c;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
    ctx.restore();
  }
}

// Toast
let toastTimer = 0;
function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  toastTimer = 55;
}
function updateToast() {
  if (toastTimer > 0) {
    toastTimer -= 1;
    if (toastTimer === 0) toast.hidden = true;
  }
}

// UI helpers
function setScene(n) {
  scene = n;
  dotEls.forEach((d, i) => d.classList.toggle("on", i === scene));
  const names = ["Karaoke", "Ice skating", "Swimming tag"];
  sceneNameEl.textContent = names[scene];

  if (scene === 0) {
    subtitleEl.textContent = "Mini-game 1: Karaoke. Tap on the beat.";
    miniRow1.textContent = "Goal: Hit 8 notes correctly.";
    miniRow2.textContent = "Tip: Tap when the note touches the line.";
  } else if (scene === 1) {
    subtitleEl.textContent = "Mini-game 2: Ice skating. Slide and collect snow hearts.";
    miniRow1.textContent = "Goal: Collect 5 snow hearts.";
    miniRow2.textContent = "Tip: It is slippery, dodge the bars.";
  } else {
    subtitleEl.textContent = "Final: Swimming tag. Catch her, then she wins.";
    miniRow1.textContent = "Goal: Chase and tag. She tries to escape smarter now.";
    miniRow2.textContent = "Tip: Tap near her to lunge toward her.";
  }

  showOverlayForScene();
}

function showOverlayForScene() {
  overlay.hidden = false;
  running = false;

  if (scene === 0) {
    overlayTitle.textContent = "Karaoke";
    overlayText.textContent = "Tap when the falling note hits the line. Hit 8 notes to win.";
    startBtn.textContent = "Start karaoke";
  } else if (scene === 1) {
    overlayTitle.textContent = "Ice skating";
    overlayText.textContent = "Slide around and collect 5 snow hearts. Avoid the moving bars.";
    startBtn.textContent = "Start skating";
  } else {
    overlayTitle.textContent = "Swimming tag";
    overlayText.textContent = "You are the guy. Catch the girl. When you tag her, she wins.";
    startBtn.textContent = "Start swimming";
  }

  startAction = () => {
    overlay.hidden = true;
    running = true;
    resetSceneState();
  };
}

function showNextOverlay(title, text, btnText, action) {
  overlay.hidden = false;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startBtn.textContent = btnText;
  startAction = action;
}

function resetAll() {
  score = 0;
  scoreEl.textContent = String(score);

  valModal.classList.remove("show");
  valModal.setAttribute("aria-hidden", "true");
  giftModal.classList.remove("show");
  giftModal.setAttribute("aria-hidden", "true");

  confetti = [];
  confettiTimer = 0;

  setScene(0);
  initKaraoke();
  overlay.hidden = false;
  running = false;
}

// Scene states
let karaoke, skate, swim;
function resetSceneState() {
  if (scene === 0) initKaraoke();
  if (scene === 1) initSkate();
  if (scene === 2) initSwim();
}

// ===== Karaoke =====
function initKaraoke() {
  const h = H();
  karaoke = { lineY: h * 0.78, notes: [], time: 0, spawnEvery: 40, total: 12, spawned: 0, hit: 0, miss: 0, done: false };
  showToast("Ready to sing!");
}
function spawnNote() {
  const w = W();
  karaoke.notes.push({ x: w * 0.5, y: -30, r: 16, speed: 4.0, alive: true });
  karaoke.spawned += 1;
}
function updateKaraoke() {
  if (karaoke.done) return;

  karaoke.time += 1;
  if (karaoke.spawned < karaoke.total && karaoke.time % karaoke.spawnEvery === 0) spawnNote();

  for (const n of karaoke.notes) {
    if (!n.alive) continue;
    n.y += n.speed;
    if (n.y > karaoke.lineY + 50) {
      n.alive = false;
      karaoke.miss += 1;
      beep(160, 80, "sine", 0.05);
      showToast("Miss!");
    }
  }

  const tapped = input.tap || keys["Space"];
  if (tapped) {
    let bestNote = null;
    let bestD = 9999;
    for (const n of karaoke.notes) {
      if (!n.alive) continue;
      const d = Math.abs(n.y - karaoke.lineY);
      if (d < bestD) { bestD = d; bestNote = n; }
    }

    if (bestNote && bestD <= 26) {
      bestNote.alive = false;
      karaoke.hit += 1;
      score += 10;
      scoreEl.textContent = String(score);
      beep(560, 70, "triangle", 0.06);
      showToast(bestD <= 10 ? "Perfect!" : "Good!");
    } else {
      karaoke.miss += 1;
      beep(140, 70, "sine", 0.05);
      showToast("Off beat!");
    }
  }

  if (karaoke.hit >= 8) {
    karaoke.done = true;
    running = false;
    showToast("Karaoke cleared!");
    showNextOverlay("Cleared!", "Ready for the next mini-game?", "Next: Ice skating", () => {
      setScene(1);
      overlay.hidden = true;
      running = true;
      resetSceneState();
    });
  }
}
function drawKaraoke() {
  const w = W(), h = H();

  ctx.fillStyle = "rgba(255, 230, 242, 0.3)";
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.arc(rand(0, w), rand(0, h * 0.6), rand(8, 22), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 47, 116, 0.55)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(w * 0.18, karaoke.lineY);
  ctx.lineTo(w * 0.82, karaoke.lineY);
  ctx.stroke();

  ctx.font = "26px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("🎤", w * 0.15, karaoke.lineY - 10);

  for (const n of karaoke.notes) {
    if (!n.alive) continue;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 47, 116, 0.85)";
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "16px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♪", n.x, n.y);
  }

  ctx.fillStyle = "rgba(107, 22, 55, 0.9)";
  ctx.font = "14px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Hit: ${karaoke.hit}/8`, 16, 22);
}

// ===== Ice skating =====
function initSkate() {
  const w = W(), h = H();
  skate = {
    player: { x: w * 0.35, y: h * 0.55, r: 16, vx: 0, vy: 0 },
    friction: 0.95, accel: 0.33,
    collected: 0, goal: 5,
    tokens: [],
    obstacles: [
      { x: w * 0.15, y: h * 0.30, w: w * 0.20, h: 16, vx: 1.3 },
      { x: w * 0.55, y: h * 0.48, w: w * 0.25, h: 16, vx: -1.1 },
      { x: w * 0.30, y: h * 0.76, w: w * 0.30, h: 16, vx: 0.95 }
    ],
    done: false
  };

  skate.tokens = [];
  for (let i = 0; i < skate.goal; i++) skate.tokens.push({ x: rand(70, w - 70), y: rand(70, h - 70), r: 18, alive: true });
  showToast("Skate time!");
}
function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  return Math.hypot(cx - closestX, cy - closestY) < cr;
}
function updateSkate() {
  if (skate.done) return;

  if (input.pointerJustDown) {
    const dx = input.x - skate.player.x;
    const dy = input.y - skate.player.y;
    const d = Math.hypot(dx, dy) || 1;
    skate.player.vx += (dx / d) * 2.2;
    skate.player.vy += (dy / d) * 2.2;
  }

  let ax = 0, ay = 0;
  if (keys["KeyA"] || keys["ArrowLeft"]) ax -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) ax += 1;
  if (keys["KeyW"] || keys["ArrowUp"]) ay -= 1;
  if (keys["KeyS"] || keys["ArrowDown"]) ay += 1;
  const n = Math.hypot(ax, ay) || 1;
  ax /= n; ay /= n;

  skate.player.vx += ax * skate.accel;
  skate.player.vy += ay * skate.accel;

  skate.player.vx *= skate.friction;
  skate.player.vy *= skate.friction;

  const w = W(), h = H();
  skate.player.x = clamp(skate.player.x + skate.player.vx, skate.player.r, w - skate.player.r);
  skate.player.y = clamp(skate.player.y + skate.player.vy, skate.player.r, h - skate.player.r);

  for (const o of skate.obstacles) {
    o.x += o.vx;
    if (o.x < 16 || o.x + o.w > w - 16) o.vx *= -1;
  }

  for (const o of skate.obstacles) {
    if (circleRectCollide(skate.player.x, skate.player.y, skate.player.r, o.x, o.y, o.w, o.h)) {
      showToast("Slipped!");
      skate.player.x = w * 0.35; skate.player.y = h * 0.55; skate.player.vx = 0; skate.player.vy = 0;
      beep(170, 70, "sine", 0.05);
      break;
    }
  }

  for (const tkn of skate.tokens) {
    if (!tkn.alive) continue;
    if (dist(skate.player.x, skate.player.y, tkn.x, tkn.y) < skate.player.r + tkn.r) {
      tkn.alive = false;
      skate.collected += 1;
      score += 12;
      scoreEl.textContent = String(score);
      showToast("Collected!");
      beep(520, 55, "triangle", 0.05);
    }
  }

  if (skate.collected >= skate.goal) {
    skate.done = true;
    running = false;
    showNextOverlay("Cleared!", "Final game time.", "Next: Swimming tag", () => {
      setScene(2);
      overlay.hidden = true;
      running = true;
      resetSceneState();
    });
  }
}
function drawSkate() {
  const w = W(), h = H();
  ctx.fillStyle = "rgba(210, 240, 255, 0.25)";
  ctx.fillRect(0, 0, w, h);

  for (const tkn of skate.tokens) {
    if (!tkn.alive) continue;
    ctx.font = "30px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("❄️💗", tkn.x, tkn.y);
  }

  for (const o of skate.obstacles) {
    ctx.fillStyle = "rgba(40, 20, 30, 0.18)";
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = "rgba(255, 47, 116, 0.25)";
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 47, 116, 0.95)";
  ctx.arc(skate.player.x, skate.player.y, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(107, 22, 55, 0.9)";
  ctx.font = "14px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Collected: ${skate.collected}/${skate.goal}`, 16, 22);
}

// ===== Swimming Tag (harder + no corner camping) =====
function initSwim() {
  const w = W(), h = H();
  const pad = 42;

  swim = {
    pool: { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2, r: 22 },
    guy:  { x: w * 0.30, y: h * 0.55, r: 18, vx: 0, vy: 0 },
    girl: { x: w * 0.70, y: h * 0.45, r: 18, vx: 0, vy: 0 },

    dragGuy: 0.92,
    accelGuy: 0.42,
    maxGuy: 6.2,

    // harder girl
    dragGirl: 0.93,
    accelGirl: 0.46,
    maxGirl: 7.4,

    target: { x: w * 0.70, y: h * 0.45 },
    targetTimer: 0,
    dodgeSign: Math.random() < 0.5 ? 1 : -1,
    dodgeTimer: 0,

    lungeCd: 0,

    done: false
  };

  pickNewEscapeTarget();
  showToast("Swim and tag!");
}

function keepInPool(p) {
  const pool = swim.pool;
  const minX = pool.x + p.r;
  const maxX = pool.x + pool.w - p.r;
  const minY = pool.y + p.r;
  const maxY = pool.y + pool.h - p.r;

  // soft bounce
  if (p.x < minX) { p.x = minX; p.vx = Math.abs(p.vx) * 0.35; }
  if (p.x > maxX) { p.x = maxX; p.vx = -Math.abs(p.vx) * 0.35; }
  if (p.y < minY) { p.y = minY; p.vy = Math.abs(p.vy) * 0.35; }
  if (p.y > maxY) { p.y = maxY; p.vy = -Math.abs(p.vy) * 0.35; }
}

function limitSpeed(p, maxV) {
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > maxV) {
    p.vx = (p.vx / sp) * maxV;
    p.vy = (p.vy / sp) * maxV;
  }
}

function wallRepelVec(x, y) {
  const pool = swim.pool;
  const margin = 92;
  const left = x - pool.x;
  const right = (pool.x + pool.w) - x;
  const top = y - pool.y;
  const bottom = (pool.y + pool.h) - y;

  let rx = 0, ry = 0;

  function push(d, dirX, dirY) {
    if (d >= margin) return;
    const t = (margin - d) / margin;          // 0..1
    const s = (t * t) * 1.35;                 // stronger near wall
    rx += dirX * s;
    ry += dirY * s;
  }

  push(left,  1,  0);
  push(right, -1, 0);
  push(top,   0,  1);
  push(bottom,0, -1);

  return { x: rx, y: ry };
}

function edgePenalty(px, py) {
  const pool = swim.pool;
  const left = px - pool.x;
  const right = (pool.x + pool.w) - px;
  const top = py - pool.y;
  const bottom = (pool.y + pool.h) - py;
  const nearest = Math.min(left, right, top, bottom);
  return 1 / Math.max(12, nearest); // larger when nearer to wall
}

function pickNewEscapeTarget() {
  const pool = swim.pool;
  const gx = swim.guy.x, gy = swim.guy.y;

  let best = null;
  let bestScore = -1e9;

  // sample points, prefer far from guy and not near edges
  for (let i = 0; i < 14; i++) {
    const px = rand(pool.x + 40, pool.x + pool.w - 40);
    const py = rand(pool.y + 40, pool.y + pool.h - 40);
    const d = dist(px, py, gx, gy);

    const pen = edgePenalty(px, py);          // smaller is better
    const score = d - (pen * 520);            // punish wall hugging

    if (score > bestScore) {
      bestScore = score;
      best = { x: px, y: py };
    }
  }

  swim.target = best || { x: pool.x + pool.w * 0.5, y: pool.y + pool.h * 0.5 };
  swim.targetTimer = rand(0.35, 0.8);

  // flip dodge direction occasionally so she feels “alive”
  swim.dodgeTimer = rand(0.35, 0.75);
  if (Math.random() < 0.55) swim.dodgeSign *= -1;
}

function updateSwim(dt) {
  if (swim.done) return;

  // guy control
  let ax = 0, ay = 0;
  if (keys["KeyA"] || keys["ArrowLeft"]) ax -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) ax += 1;
  if (keys["KeyW"] || keys["ArrowUp"]) ay -= 1;
  if (keys["KeyS"] || keys["ArrowDown"]) ay += 1;

  const n = Math.hypot(ax, ay) || 1;
  ax /= n; ay /= n;

  swim.guy.vx += ax * swim.accelGuy;
  swim.guy.vy += ay * swim.accelGuy;

  // tap lunge (cooldown so it feels fair)
  swim.lungeCd = Math.max(0, swim.lungeCd - dt);
  if (input.pointerJustDown && swim.lungeCd <= 0) {
    const dx = input.x - swim.guy.x;
    const dy = input.y - swim.guy.y;
    const d = Math.hypot(dx, dy) || 1;
    swim.guy.vx += (dx / d) * 2.7;
    swim.guy.vy += (dy / d) * 2.7;
    swim.lungeCd = 0.22;
  }

  swim.guy.vx *= swim.dragGuy;
  swim.guy.vy *= swim.dragGuy;
  limitSpeed(swim.guy, swim.maxGuy);

  swim.guy.x += swim.guy.vx;
  swim.guy.y += swim.guy.vy;
  keepInPool(swim.guy);

  // girl brain
  const gx = swim.guy.x, gy = swim.guy.y;
  const girl = swim.girl;

  const toGuyX = gx - girl.x;
  const toGuyY = gy - girl.y;
  const dGuy = Math.hypot(toGuyX, toGuyY) || 1;

  // refresh target regularly or if target reached
  swim.targetTimer -= dt;
  swim.dodgeTimer -= dt;
  const dTarget = dist(girl.x, girl.y, swim.target.x, swim.target.y);
  if (swim.targetTimer <= 0 || dTarget < 70) pickNewEscapeTarget();

  // seek target
  let sx = swim.target.x - girl.x;
  let sy = swim.target.y - girl.y;
  const sd = Math.hypot(sx, sy) || 1;
  sx /= sd; sy /= sd;

  // flee guy
  let fx = -(toGuyX / dGuy);
  let fy = -(toGuyY / dGuy);

  // dodge sideways when close (harder + stops straight-line corner pin)
  let dx = 0, dy = 0;
  if (dGuy < 210) {
    // perpendicular to toGuy
    dx = (-toGuyY / dGuy) * swim.dodgeSign;
    dy = (toGuyX / dGuy) * swim.dodgeSign;
  }

  // wall repel
  const wr = wallRepelVec(girl.x, girl.y);

  // if she is very close, she gets a burst away
  const panic = dGuy < 140 ? 1.0 : (dGuy < 220 ? 0.55 : 0.25);

  // combine steering
  // weights chosen to avoid edge camping and keep her moving unpredictably
  let steerX =
    sx * 0.55 +
    fx * (0.55 + panic) +
    dx * (0.30 + panic * 0.35) +
    wr.x * 0.95;

  let steerY =
    sy * 0.55 +
    fy * (0.55 + panic) +
    dy * (0.30 + panic * 0.35) +
    wr.y * 0.95;

  const st = Math.hypot(steerX, steerY) || 1;
  steerX /= st; steerY /= st;

  girl.vx += steerX * swim.accelGirl;
  girl.vy += steerY * swim.accelGirl;

  girl.vx *= swim.dragGirl;
  girl.vy *= swim.dragGirl;
  limitSpeed(girl, swim.maxGirl);

  girl.x += girl.vx;
  girl.y += girl.vy;
  keepInPool(girl);

  // anti-stuck: if slow and near a wall, push toward center
  const sp = Math.hypot(girl.vx, girl.vy);
  if (sp < 0.55) {
    const pool = swim.pool;
    const left = girl.x - pool.x;
    const right = (pool.x + pool.w) - girl.x;
    const top = girl.y - pool.y;
    const bottom = (pool.y + pool.h) - girl.y;
    const nearest = Math.min(left, right, top, bottom);
    if (nearest < 60) {
      const cx = pool.x + pool.w * 0.5;
      const cy = pool.y + pool.h * 0.5;
      const ux = cx - girl.x;
      const uy = cy - girl.y;
      const ud = Math.hypot(ux, uy) || 1;
      girl.vx += (ux / ud) * 1.2;
      girl.vy += (uy / ud) * 1.2;
    }
  }

  // tag check
  if (dist(swim.guy.x, swim.guy.y, girl.x, girl.y) < swim.guy.r + girl.r) {
    swim.done = true;
    running = false;

    score += 25;
    scoreEl.textContent = String(score);

    showToast("TAG! She wins 😳");

    // show proposal now, and only now
    showProposal();
  }
}

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSwim() {
  const w = W(), h = H();
  const pool = swim.pool;

  ctx.fillStyle = "rgba(160, 225, 255, 0.22)";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  drawRoundedRect(pool.x, pool.y, pool.w, pool.h, pool.r);
  ctx.fillStyle = "rgba(60, 160, 220, 0.28)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 47, 116, 0.35)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // waves
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const yy = pool.y + 22 + i * (pool.h / 10);
    ctx.beginPath();
    ctx.moveTo(pool.x + 14, yy);
    ctx.quadraticCurveTo(pool.x + pool.w * 0.33, yy - 8, pool.x + pool.w * 0.50, yy);
    ctx.quadraticCurveTo(pool.x + pool.w * 0.66, yy + 8, pool.x + pool.w - 14, yy);
    ctx.stroke();
  }

  // target hint (tiny dot, optional)
  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.arc(swim.target.x, swim.target.y, 5, 0, Math.PI * 2);
  ctx.fill();

  // girl
  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 47, 116, 0.90)";
  ctx.arc(swim.girl.x, swim.girl.y, swim.girl.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "18px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText("👧", swim.girl.x, swim.girl.y);

  // guy
  ctx.beginPath();
  ctx.fillStyle = "rgba(90, 80, 255, 0.88)";
  ctx.arc(swim.guy.x, swim.guy.y, swim.guy.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText("👦", swim.guy.x, swim.guy.y);

  ctx.fillStyle = "rgba(107, 22, 55, 0.9)";
  ctx.font = "14px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Tag her to finish (she wins). She dodges walls now.", 16, 22);
}

// ===== Valentine modal logic =====
let noAttempts = 0;

function showProposal() {
  valModal.classList.add("show");
  valModal.setAttribute("aria-hidden", "false");
  burnSub.textContent = "Choose wisely.";
  noHint.textContent = "If you press No, it gets annoying.";
  noAttempts = 0;
  modalNo.style.transform = "translate(0px, 0px) scale(1)";
  modalNo.style.opacity = "1";
  modalYes.style.transform = "scale(1)";
}

function moveNoButton() {
  const area = burnBtns.getBoundingClientRect();
  const btn = modalNo.getBoundingClientRect();
  const pad = 8;

  const maxX = Math.max(pad, area.width - btn.width - pad);
  const maxY = Math.max(pad, area.height - btn.height - pad);

  const x = rand(pad, maxX);
  const y = rand(pad, maxY);

  const dx = x - (btn.left - area.left);
  const dy = y - (btn.top - area.top);

  modalNo.style.transform =
    `translate(${dx}px, ${dy}px) rotate(${rand(-6, 6)}deg) scale(${clamp(1 - noAttempts * 0.08, 0.45, 1)})`;
}

function annoyNo() {
  noAttempts += 1;
  const lines = ["No? are you sure?", "That is suspicious.", "Try again 😳", "You cannot escape.", "Ok stop.", "Just press Yes."];
  burnSub.textContent = lines[Math.min(noAttempts - 1, lines.length - 1)];

  const yesScale = clamp(1 + noAttempts * 0.10, 1, 1.7);
  modalYes.style.transform = `scale(${yesScale})`;

  if (noAttempts >= 2) moveNoButton();
  if (noAttempts >= 4) modalNo.style.opacity = "0.85";
  if (noAttempts >= 6) modalNo.style.opacity = "0.55";

  ensureAudio();
  beep(190, 70, "sine", 0.05);
}

modalYes.onclick = () => {
  // close question
  valModal.classList.remove("show");
  valModal.setAttribute("aria-hidden", "true");

  // reward
  spawnConfetti();
  playYesMelody();

  // show bouquet gift
  giftModal.classList.add("show");
  giftModal.setAttribute("aria-hidden", "false");
};

modalNo.onmouseenter = () => { annoyNo(); moveNoButton(); };
modalNo.onpointerdown = (e) => { e.preventDefault(); annoyNo(); moveNoButton(); };

giftRestart.onclick = () => {
  giftModal.classList.remove("show");
  giftModal.setAttribute("aria-hidden", "true");
  resetAll();
};

// Main loop
let last = performance.now();
function loop(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;

  ctx.clearRect(0, 0, W(), H());

  if (scene === 0) { if (running) updateKaraoke(); drawKaraoke(); }
  else if (scene === 1) { if (running) updateSkate(); drawSkate(); }
  else if (scene === 2) { if (running) updateSwim(dt); drawSwim(); }

  updateConfetti(dt);
  drawConfetti();
  updateToast();

  input.tap = false;
  input.pointerJustDown = false;

  requestAnimationFrame(loop);
}

// Boot
function boot() {
  resizeCanvas();

  valModal.classList.remove("show");
  valModal.setAttribute("aria-hidden", "true");
  giftModal.classList.remove("show");
  giftModal.setAttribute("aria-hidden", "true");

  scoreEl.textContent = String(score);
  setScene(0);
  resetSceneState();
  overlay.hidden = false;
  running = false;

  requestAnimationFrame(loop);
}

boot();