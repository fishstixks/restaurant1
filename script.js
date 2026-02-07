const stage = document.getElementById("stage");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const dotEls = [0,1,2].map(i => document.getElementById(`dot${i}`));
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

const valModal = document.getElementById("valModal");
const burnSub = document.getElementById("burnSub");
const modalYes = document.getElementById("modalYes");
const modalNo = document.getElementById("modalNo");
const burnBtns = document.getElementById("burnBtns");
const noHint = document.getElementById("noHint");

const flowersModal = document.getElementById("flowersModal");
const flowersRestart = document.getElementById("flowersRestart");

/* -------------------- Silent error handling (NO error popup) -------------------- */
let recovering = false;
function silentRecover() {
  if (recovering) return;
  recovering = true;
  try {
    running = false;
    valModal.classList.remove("show");
    flowersModal.classList.remove("show");
    confetti = [];
    confettiTimer = 0;
    // Reset to a safe start state
    setScene(0);
    overlay.hidden = false;
  } catch (e) {
    // last resort: reload
    try { location.reload(); } catch {}
  }
  setTimeout(() => { recovering = false; }, 600);
}

window.addEventListener("error", (e) => {
  // prevent our custom error screen and recover silently
  try { e.preventDefault(); } catch {}
  silentRecover();
}, true);

window.addEventListener("unhandledrejection", (e) => {
  try { e.preventDefault(); } catch {}
  silentRecover();
}, true);

/* -------------------- Helpers -------------------- */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return Math.random() * (b - a) + a; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function W() { return stage.getBoundingClientRect().width; }
function H() { return stage.getBoundingClientRect().height; }

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);

const keys = {};
const input = { down: false, tap: false, x: 0, y: 0 };

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyR") resetAll();
});
document.addEventListener("keyup", (e) => keys[e.code] = false);

function pointerToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}
function onDown(cx, cy) {
  const p = pointerToCanvas(cx, cy);
  input.down = true;
  input.tap = true;
  input.x = p.x;
  input.y = p.y;
}
function onMove(cx, cy) {
  if (!input.down) return;
  const p = pointerToCanvas(cx, cy);
  input.x = p.x;
  input.y = p.y;
}
function onUp() { input.down = false; }

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  try { canvas.setPointerCapture?.(e.pointerId); } catch {}
  onDown(e.clientX, e.clientY);
});
canvas.addEventListener("pointermove", (e) => onMove(e.clientX, e.clientY));
canvas.addEventListener("pointerup", () => onUp());

canvas.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  if (!t) return;
  onDown(t.clientX, t.clientY);
}, { passive: true });
canvas.addEventListener("touchmove", (e) => {
  const t = e.touches[0];
  if (!t) return;
  onMove(t.clientX, t.clientY);
}, { passive: true });
canvas.addEventListener("touchend", () => onUp(), { passive: true });

function roundRect(x, y, w, h, r, fill, stroke) {
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
function dampFactor(base, dt) { return Math.pow(base, dt * 60); }
function steerToward(obj, targetX, targetY, accel, dt) {
  if (!obj) return;
  const dx = targetX - obj.x;
  const dy = targetY - obj.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  obj.vx += (dx / d) * accel * dt;
  obj.vy += (dy / d) * accel * dt;
}

/* -------------------- Toast -------------------- */
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

/* -------------------- Confetti -------------------- */
let confetti = [];
let confettiTimer = 0;
function spawnConfetti() {
  const w = W(), h = H();
  confetti = [];
  for (let i = 0; i < 150; i++) {
    confetti.push({
      x: rand(0, w),
      y: rand(-h, 0),
      vx: rand(-70, 70),
      vy: rand(180, 360),
      r: rand(2, 5),
      a: rand(0, Math.PI * 2),
      va: rand(-3, 3),
      t: i % 3
    });
  }
  confettiTimer = 2.6;
}
function updateConfetti(dt) {
  if (confettiTimer <= 0) return;
  confettiTimer -= dt;
  const w = W(), h = H();
  for (const p of confetti) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.a += p.va * dt;
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
    ctx.fillStyle = c;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
    ctx.restore();
  }
}

/* -------------------- Audio (only at YES) -------------------- */
let audioCtx = null;
function ensureAudioSafe() {
  if (audioCtx) return;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
  catch { audioCtx = null; }
}
function noteToFreq(note) {
  if (note === "REST") return 0;
  const A4 = 440;
  const map = { C:0, "C#":1, D:2, "D#":3, E:4, F:5, "F#":6, G:7, "G#":8, A:9, "A#":10, B:11 };
  const m = note.match(/^([A-G]#?)(\d)$/);
  if (!m) return 0;
  const n = m[1], oct = Number(m[2]);
  const semitone = map[n];
  const midi = (oct + 1) * 12 + semitone;
  return A4 * Math.pow(2, (midi - 69) / 12);
}
function playMelody(seq, bpm = 140, type = "triangle", gain = 0.06) {
  if (!audioCtx) return;
  const beat = 60 / bpm;
  let t = audioCtx.currentTime + 0.02;
  for (const step of seq) {
    const dur = step.d * beat;
    if (step.n !== "REST") {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = noteToFreq(step.n);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
    t += dur;
  }
}
const SONG_FLOWERS = [
  {n:"G5",d:0.5},{n:"E5",d:0.5},{n:"F5",d:0.5},{n:"D5",d:0.5},
  {n:"E5",d:0.5},{n:"C5",d:0.5},{n:"D5",d:0.5},{n:"B4",d:0.5},
  {n:"C5",d:1.0},{n:"REST",d:0.5},{n:"C5",d:0.5},{n:"E5",d:0.5},
  {n:"G5",d:1.0},
];

/* -------------------- Game state -------------------- */
let scene = 0;
let score = 0;
let running = false;

let karaoke = null, skate = null, swim = null;

let startAction = () => {};
startBtn.onclick = () => startAction();

/* -------------------- Scenes -------------------- */
function initKaraoke() {
  karaoke = {
    x: W() * 0.5,
    lineY: H() * 0.80,
    notes: [],
    spawnTimer: 0,
    spawnEvery: 0.70,
    total: 14,
    spawned: 0,
    hit: 0,
    miss: 0,
    done: false
  };
  spawnKaraokeNote();
}
function spawnKaraokeNote() {
  if (!karaoke) return;
  if (karaoke.spawned >= karaoke.total) return;
  karaoke.notes.push({ y: -30, r: 16, speed: Math.max(260, H() * 0.65), alive: true });
  karaoke.spawned += 1;
}
function karaokeTryHit() {
  if (!karaoke) return;
  let best = null;
  let bestD = 9999;
  for (const n of karaoke.notes) {
    if (!n.alive) continue;
    const d = Math.abs(n.y - karaoke.lineY);
    if (d < bestD) { bestD = d; best = n; }
  }
  if (best && bestD <= 30) {
    best.alive = false;
    karaoke.hit += 1;
    score += 10;
    scoreEl.textContent = String(score);
    showToast(bestD <= 13 ? "Perfect!" : "Good!");
  } else {
    karaoke.miss += 1;
    showToast("Miss!");
  }
}
function updateKaraoke(dt) {
  if (!karaoke || karaoke.done) return;

  karaoke.spawnTimer += dt;
  while (karaoke.spawnTimer >= karaoke.spawnEvery) {
    karaoke.spawnTimer -= karaoke.spawnEvery;
    spawnKaraokeNote();
  }

  for (const n of karaoke.notes) {
    if (!n.alive) continue;
    n.y += n.speed * dt;
    if (n.y > karaoke.lineY + 70) {
      n.alive = false;
      karaoke.miss += 1;
      showToast("Too late!");
    }
  }

  if (input.tap || keys["Space"]) {
    keys["Space"] = false;
    karaokeTryHit();
  }

  if (karaoke.hit >= 8 && !karaoke.done) {
    karaoke.done = true;
    running = false;
    showNextOverlay("Cleared!", "Next: Ice skating.", "Next: Ice skating", () => {
      setScene(1);
      overlay.hidden = true;
      running = true;
      resetSceneState();
    });
  }
}
function drawKaraoke() {
  if (!karaoke) return;
  const w = W(), h = H();
  const x = karaoke.x;

  ctx.fillStyle = "rgba(255, 230, 242, 0.28)";
  ctx.fillRect(0, 0, w, h);

  const laneW = w * 0.28;
  const laneX = x - laneW/2;

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  roundRect(laneX, h*0.12, laneW, h*0.80, 18, true, false);
  ctx.strokeStyle = "rgba(255,47,116,0.25)";
  ctx.strokeRect(laneX, h*0.12, laneW, h*0.80);

  ctx.strokeStyle = "rgba(255,47,116,0.65)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(laneX, karaoke.lineY);
  ctx.lineTo(laneX + laneW, karaoke.lineY);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,47,116,0.18)";
  ctx.beginPath();
  ctx.arc(x, karaoke.lineY, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(107,22,55,0.9)";
  ctx.font = "14px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Tap / Space", x, karaoke.lineY + 26);

  for (const n of karaoke.notes) {
    if (!n.alive) continue;
    ctx.fillStyle = "rgba(255, 47, 116, 0.86)";
    ctx.beginPath();
    ctx.arc(x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "18px system-ui";
    ctx.textBaseline = "middle";
    ctx.fillText("♪", x, n.y);
  }

  ctx.fillStyle = "rgba(107,22,55,0.9)";
  ctx.font = "14px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Hit: ${karaoke.hit}/8   Miss: ${karaoke.miss}`, 16, 22);
}

function initSkate() {
  const w = W(), h = H();
  skate = {
    player: { x: w*0.45, y: h*0.55, vx: 0, vy: 0 },
    collected: 0,
    goal: 6,
    tokens: [],
    done: false
  };
  for (let i = 0; i < skate.goal; i++) {
    skate.tokens.push({ x: rand(70,w-70), y: rand(70,h-70), alive: true });
  }
}
function updateSkate(dt) {
  if (!skate || skate.done) return;
  const p = skate.player;

  let ax = 0, ay = 0;
  if (keys["KeyA"] || keys["ArrowLeft"]) ax -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) ax += 1;
  if (keys["KeyW"] || keys["ArrowUp"]) ay -= 1;
  if (keys["KeyS"] || keys["ArrowDown"]) ay += 1;

  const n = Math.hypot(ax, ay) || 1;
  ax /= n; ay /= n;

  const accel = 900;
  const maxSpeed = 320;

  p.vx += ax * accel * dt;
  p.vy += ay * accel * dt;

  if (input.down) steerToward(p, input.x, input.y, 520, dt);

  const damp = dampFactor(0.86, dt);
  p.vx *= damp;
  p.vy *= damp;

  const sp = Math.hypot(p.vx, p.vy);
  if (sp > maxSpeed) {
    p.vx = (p.vx / sp) * maxSpeed;
    p.vy = (p.vy / sp) * maxSpeed;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const w = W(), h = H();
  p.x = clamp(p.x, 26, w - 26);
  p.y = clamp(p.y, 26, h - 26);

  for (const t of skate.tokens) {
    if (!t.alive) continue;
    if (dist(p.x, p.y, t.x, t.y) < 34) {
      t.alive = false;
      skate.collected += 1;
      score += 12;
      scoreEl.textContent = String(score);
      showToast("❄️💗");
    }
  }

  if (skate.collected >= skate.goal && !skate.done) {
    skate.done = true;
    running = false;
    showNextOverlay("Cleared!", "Final: Swimming tag.", "Next: Swimming", () => {
      setScene(2);
      overlay.hidden = true;
      running = true;
      resetSceneState();
    });
  }
}
function drawSkate() {
  if (!skate) return;
  const w = W(), h = H();
  ctx.fillStyle = "rgba(210, 240, 255, 0.28)";
  ctx.fillRect(0,0,w,h);

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let i = 0; i < 8; i++) ctx.fillRect(w*0.1, h*(0.15+i*0.1), w*0.8, 4);

  for (const t of skate.tokens) {
    if (!t.alive) continue;
    ctx.font = "30px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("❄️💗", t.x, t.y);
  }

  ctx.font = "46px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("👫", skate.player.x, skate.player.y);

  ctx.fillStyle = "rgba(107,22,55,0.9)";
  ctx.font = "14px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Collected: ${skate.collected}/${skate.goal}`, 16, 22);
}

function initSwim() {
  const w = W(), h = H();
  swim = {
    pool: { x: w*0.08, y: h*0.10, w: w*0.84, h: h*0.82 },
    guy:  { x: w*0.30, y: h*0.55, vx: 0, vy: 0 },
    girl: { x: w*0.68, y: h*0.45, vx: 0, vy: 0 },
    caught: false,
    kissT: 0,
    proposalShown: false
  };
}
function updateSwim(dt) {
  if (!swim) return;
  const p = swim.pool;
  const guy = swim.guy;
  const girl = swim.girl;

  let ax = 0, ay = 0;
  if (keys["KeyA"] || keys["ArrowLeft"]) ax -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) ax += 1;
  if (keys["KeyW"] || keys["ArrowUp"]) ay -= 1;
  if (keys["KeyS"] || keys["ArrowDown"]) ay += 1;

  const n = Math.hypot(ax, ay) || 1;
  ax /= n; ay /= n;

  const guyAccel = 1050;
  const guyMax = 360;

  guy.vx += ax * guyAccel * dt;
  guy.vy += ay * guyAccel * dt;

  if (input.down) steerToward(guy, input.x, input.y, 780, dt);

  const guyDamp = dampFactor(0.88, dt);
  guy.vx *= guyDamp;
  guy.vy *= guyDamp;

  let sp = Math.hypot(guy.vx, guy.vy);
  if (sp > guyMax) { guy.vx = (guy.vx/sp) * guyMax; guy.vy = (guy.vy/sp) * guyMax; }

  const dx = girl.x - guy.x;
  const dy = girl.y - guy.y;
  const d = Math.hypot(dx, dy) || 1;

  if (!swim.caught) {
    const fleeBoost = clamp((300 - d) / 300, 0, 1);
    const girlAccel = 720 * (0.35 + 0.55 * fleeBoost);
    const girlMax = 300;

    girl.vx += (dx / d) * girlAccel * dt;
    girl.vy += (dy / d) * girlAccel * dt;

    girl.vx += Math.sin(performance.now() * 0.003) * 10 * dt;
    girl.vy += Math.cos(performance.now() * 0.003) * 10 * dt;

    const girlDamp = dampFactor(0.90, dt);
    girl.vx *= girlDamp;
    girl.vy *= girlDamp;

    sp = Math.hypot(girl.vx, girl.vy);
    if (sp > girlMax) { girl.vx = (girl.vx/sp) * girlMax; girl.vy = (girl.vy/sp) * girlMax; }

    if (d < 62) {
      swim.caught = true;
      swim.kissT = 0;
      showToast("Caught!");
    }
  } else {
    swim.kissT += dt;

    guy.vx *= dampFactor(0.78, dt);
    guy.vy *= dampFactor(0.78, dt);
    girl.vx *= dampFactor(0.78, dt);
    girl.vy *= dampFactor(0.78, dt);

    girl.x += (guy.x - girl.x) * 0.08;
    girl.y += (guy.y - girl.y) * 0.08;

    if (swim.kissT > 1.35 && !swim.proposalShown) {
      swim.proposalShown = true;
      running = false;
      showProposal();
    }
  }

  guy.x += guy.vx * dt;
  guy.y += guy.vy * dt;
  girl.x += girl.vx * dt;
  girl.y += girl.vy * dt;

  const pad = 22;
  guy.x = clamp(guy.x, p.x + pad, p.x + p.w - pad);
  guy.y = clamp(guy.y, p.y + pad, p.y + p.h - pad);
  girl.x = clamp(girl.x, p.x + pad, p.x + p.w - pad);
  girl.y = clamp(girl.y, p.y + pad, p.y + p.h - pad);
}
function drawSwim() {
  if (!swim) return;
  const w = W(), h = H();
  const p = swim.pool;

  ctx.fillStyle = "rgba(170, 235, 255, 0.65)";
  ctx.fillRect(0,0,w,h);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  roundRect(p.x, p.y, p.w, p.h, 22, true, false);
  ctx.strokeStyle = "rgba(107,22,55,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x, p.y, p.w, p.h);

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    const yy = p.y + 40 + i * (p.h/10);
    ctx.moveTo(p.x+30, yy);
    ctx.quadraticCurveTo(p.x+p.w/2, yy-10, p.x+p.w-30, yy);
    ctx.stroke();
  }
  ctx.restore();

  ctx.font = "52px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🧍‍♀️", swim.girl.x, swim.girl.y);
  ctx.fillText("🧍‍♂️", swim.guy.x, swim.guy.y);

  if (swim.caught) {
    const mx = (swim.guy.x + swim.girl.x)/2;
    const my = (swim.guy.y + swim.girl.y)/2 - 40;
    ctx.font = "44px system-ui";
    ctx.fillText("💗", mx, my);
  }

  ctx.fillStyle = "rgba(107,22,55,0.9)";
  ctx.font = "14px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(swim.caught ? "Aww..." : "Tag: Catch her!", 16, 22);
}

/* -------------------- Proposal -------------------- */
let noAttempts = 0;

function showProposal() {
  valModal.classList.add("show");
  burnSub.textContent = "I LOVE YOU FRONDOZO JULIE ANN SEMIRA NOSEJOB LOVEYDUBS";
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
  const yesScale = clamp(1 + noAttempts * 0.10, 1, 1.7);
  modalYes.style.transform = `scale(${yesScale})`;

  if (noAttempts >= 2) moveNoButton();
  if (noAttempts >= 4) modalNo.style.opacity = "0.85";
  if (noAttempts >= 6) modalNo.style.opacity = "0.55";

  noHint.textContent = lines[Math.min(noAttempts - 1, lines.length - 1)];
}

modalYes.onclick = () => {
  ensureAudioSafe();
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume?.();

  valModal.classList.remove("show");
  spawnConfetti();
  flowersModal.classList.add("show");
  playMelody(SONG_FLOWERS, 135, "triangle", 0.06);
};

modalNo.onmouseenter = () => { annoyNo(); moveNoButton(); };
modalNo.onpointerdown = (e) => { e.preventDefault(); annoyNo(); moveNoButton(); };

flowersRestart.onclick = () => {
  flowersModal.classList.remove("show");
  resetAll();
};

/* -------------------- Scene UI -------------------- */
function resetSceneState() {
  if (scene === 0) initKaraoke();
  if (scene === 1) initSkate();
  if (scene === 2) initSwim();
}

function setScene(n) {
  scene = n;
  dotEls.forEach((d, i) => d && d.classList.toggle("on", i === scene));
  sceneNameEl.textContent = ["Karaoke","Ice skating","Swimming tag"][scene];

  if (scene === 0) {
    subtitleEl.textContent = "Mini-game 1: Karaoke. Tap on beat.";
    miniRow1.textContent = "Goal: Hit 8 notes.";
    miniRow2.textContent = "Tap anywhere (or Space).";
  } else if (scene === 1) {
    subtitleEl.textContent = "Mini-game 2: Ice skating. Collect snow hearts.";
    miniRow1.textContent = "Goal: Collect 6 snow hearts.";
    miniRow2.textContent = "Hold and drag to steer on mobile.";
  } else {
    subtitleEl.textContent = "Final: Swimming tag. Catch her, kiss, then the question.";
    miniRow1.textContent = "Goal: Catch her once.";
    miniRow2.textContent = "Hold and drag to chase on mobile.";
  }

  resetSceneState();
  showOverlayForScene();
}

function showOverlayForScene() {
  overlay.hidden = false;
  running = false;

  if (scene === 0) {
    overlayTitle.textContent = "Karaoke";
    overlayText.textContent = "Tap when the note hits the line. Hit 8 notes to win.";
    startBtn.textContent = "Start karaoke";
  } else if (scene === 1) {
    overlayTitle.textContent = "Ice skating";
    overlayText.textContent = "Collect 6 snow hearts. Less slippery.";
    startBtn.textContent = "Start skating";
  } else {
    overlayTitle.textContent = "Swimming tag";
    overlayText.textContent = "Chase her, catch her, cute ending unlocked.";
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
  flowersModal.classList.remove("show");
  confetti = [];
  confettiTimer = 0;
  setScene(0);
  overlay.hidden = false;
  running = false;
}

/* -------------------- Draw loop -------------------- */
let last = performance.now();

function loop(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;

  try {
    ctx.clearRect(0, 0, W(), H());

    if (scene === 0) { if (running) updateKaraoke(dt); drawKaraoke(); }
    if (scene === 1) { if (running) updateSkate(dt); drawSkate(); }
    if (scene === 2) { if (running) updateSwim(dt); drawSwim(); }

    updateConfetti(dt);
    drawConfetti();
    updateToast();

    // clear one-frame tap
    input.tap = false;

  } catch (e) {
    // No error screen, just recover
    silentRecover();
  }

  requestAnimationFrame(loop);
}

/* -------------------- Boot -------------------- */
function boot() {
  resizeCanvas();
  scoreEl.textContent = String(score);
  valModal.classList.remove("show");
  flowersModal.classList.remove("show");
  setScene(0);
  overlay.hidden = false;
  running = false;
  requestAnimationFrame(loop);
}
boot();