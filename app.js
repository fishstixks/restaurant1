document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const stage = $("stage");
  const canvas = $("game");
  const ctx = canvas?.getContext?.("2d");

  const dotEls = [$("dot0"), $("dot1"), $("dot2")].filter(Boolean);
  const sceneNameEl = $("sceneName");
  const scoreEl = $("score");
  const subtitleEl = $("subtitle");

  const overlay = $("overlay");
  const overlayTitle = $("overlayTitle");
  const overlayText = $("overlayText");
  const startBtn = $("startBtn");

  const toast = $("toast");
  const miniRow1 = $("miniRow1");
  const miniRow2 = $("miniRow2");

  const valModal = $("valModal");
  const burnSub = $("burnSub");
  const modalYes = $("modalYes");
  const modalNo = $("modalNo");
  const burnBtns = $("burnBtns");
  const noHint = $("noHint");

  const flowersModal = $("flowersModal");
  const flowersRestart = $("flowersRestart");

  if (!stage || !canvas || !ctx || !overlay || !startBtn) return;

  // Never show error UI
  window.addEventListener("error", (e) => { try { e.preventDefault(); } catch {} }, true);
  window.addEventListener("unhandledrejection", (e) => { try { e.preventDefault(); } catch {} }, true);

  /* ---------------- Helpers ---------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => Math.random() * (b - a) + a;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  let stageW = 0;
  let stageH = 0;

  const W = () => stageW;
  const H = () => stageH;

  function resizeCanvas() {
    const rect = stage.getBoundingClientRect();
    stageW = rect.width || stage.offsetWidth || window.innerWidth;
    stageH = rect.height || stage.offsetHeight || window.innerHeight;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resizeCanvas);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resizeCanvas);
    window.visualViewport.addEventListener("scroll", resizeCanvas);
  }
  resizeCanvas();
function roundRect(x, y, w, h, r, fill) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    if (fill) ctx.fill();
  }

  const dampFactor = (base, dt) => Math.pow(base, dt * 60);

  function steerToward(obj, tx, ty, accel, dt) {
    const dx = tx - obj.x;
    const dy = ty - obj.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    obj.vx += (dx / d) * accel * dt;
    obj.vy += (dy / d) * accel * dt;
  }

  /* -------- Collision helpers -------- */
  function circleRectHit(cx, cy, r, rect) {
    const closestX = clamp(cx, rect.x, rect.x + rect.w);
    const closestY = clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (r * r);
  }

  function resolveCircleCircle(a, ar, b, br, bounce = 0.8) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d = Math.hypot(dx, dy);
    const r = ar + br;
    if (d >= r || d === 0) return false;

    const overlap = r - d;
    const nx = dx / d;
    const ny = dy / d;

    a.x += nx * overlap;
    a.y += ny * overlap;

    const vn = a.vx * nx + a.vy * ny;
    a.vx -= (1 + bounce) * vn * nx;
    a.vy -= (1 + bounce) * vn * ny;

    a.vx *= 0.94;
    a.vy *= 0.94;
    return true;
  }

  function integrate(obj, radius, dt, bounds) {
    const speed = Math.hypot(obj.vx, obj.vy);
    const steps = clamp(Math.ceil((speed * dt) / 18), 1, 7);
    const stepDt = dt / steps;

    for (let i = 0; i < steps; i++) {
      obj.x += obj.vx * stepDt;
      obj.y += obj.vy * stepDt;

      if (bounds) {
        const pad = bounds.pad ?? 0;
        const left = bounds.x + pad;
        const right = bounds.x + bounds.w - pad;
        const top = bounds.y + pad;
        const bottom = bounds.y + bounds.h - pad;

        if (obj.x < left) { obj.x = left; obj.vx = Math.abs(obj.vx) * 0.85; }
        if (obj.x > right) { obj.x = right; obj.vx = -Math.abs(obj.vx) * 0.85; }
        if (obj.y < top) { obj.y = top; obj.vy = Math.abs(obj.vy) * 0.85; }
        if (obj.y > bottom) { obj.y = bottom; obj.vy = -Math.abs(obj.vy) * 0.85; }
      }
    }
  }

  /* ---------------- Input ---------------- */
  const keys = {};
  const input = { down: false, tap: false, x: 0, y: 0 };

  document.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "KeyR") resetAll();
  });
  document.addEventListener("keyup", (e) => { keys[e.code] = false; });

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

  canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); onDown(e.clientX, e.clientY); });
  canvas.addEventListener("pointermove", (e) => onMove(e.clientX, e.clientY));
  canvas.addEventListener("pointerup", () => onUp());

  /* ---------------- Toast ---------------- */
  let toastTimer = 0;
  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    toastTimer = 45;
  }
  function updateToast() {
    if (!toast) return;
    if (toastTimer > 0) {
      toastTimer -= 1;
      if (toastTimer === 0) toast.hidden = true;
    }
  }

  /* ---------------- Confetti ---------------- */
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
      let c = "rgba(150,90,255,0.9)";
      if (p.t === 1) c = "rgba(255,255,255,0.95)";
      if (p.t === 2) c = "rgba(255,47,116,0.9)";
      ctx.fillStyle = c;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
      ctx.restore();
    }
  }

  /* ---------------- Audio ---------------- */
  let audioCtx = null;
  function ensureAudio() {
    if (audioCtx) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { audioCtx = null; }
  }
  function resumeAudio() {
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      try { audioCtx.resume(); } catch {}
    }
  }
  function sfxBeep(freq, duration = 0.08, gain = 0.05, type = "triangle") {
    if (!audioCtx) return;
    const t = audioCtx.currentTime + 0.005;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }
  function noteToFreq(note) {
    if (note === "REST") return 0;
    const A4 = 440;
    const map = { C:0, "C#":1, D:2, "D#":3, E:4, F:5, "F#":6, G:7, "G#":8, A:9, "A#":10, B:11 };
    const m = note.match(/^([A-G]#?)(\d)$/);
    if (!m) return 0;
    const midi = (Number(m[2]) + 1) * 12 + map[m[1]];
    return A4 * Math.pow(2, (midi - 69) / 12);
  }
  function playMelody(seq, bpm = 135, gain = 0.06) {
    if (!audioCtx) return;
    const beat = 60 / bpm;
    for (const s of seq) {
      const dur = s.d * beat;
      if (s.n !== "REST") sfxBeep(noteToFreq(s.n), dur, gain, "triangle");
    }
  }
  const SONG = [
    {n:"G5",d:0.5},{n:"E5",d:0.5},{n:"F5",d:0.5},{n:"D5",d:0.5},
    {n:"E5",d:0.5},{n:"C5",d:0.5},{n:"D5",d:0.5},{n:"B4",d:0.5},
    {n:"C5",d:1.0},{n:"REST",d:0.5},{n:"C5",d:0.5},{n:"E5",d:0.5},
    {n:"G5",d:1.0},
  ];

  startBtn.addEventListener("click", () => { ensureAudio(); resumeAudio(); });

  /* ---------------- Game state ---------------- */
  let scene = 0;
  let score = 0;
  let running = false;

  let karaoke = null, skate = null, swim = null;
  let overlayAction = () => {};

  startBtn.addEventListener("click", () => overlayAction());

  /* ---------------- Karaoke ---------------- */
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
    if (karaoke.spawned >= karaoke.total) return;
    karaoke.notes.push({ y: -30, r: 16, speed: Math.max(260, H() * 0.65), alive: true });
    karaoke.spawned += 1;
  }
  function karaokeTryHit() {
    ensureAudio(); resumeAudio();

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
      if (scoreEl) scoreEl.textContent = String(score);
      sfxBeep(bestD <= 13 ? 880 : 740, 0.08, 0.055);
      showToast(bestD <= 13 ? "Perfect!" : "Good!");
    } else {
      karaoke.miss += 1;
      sfxBeep(260, 0.07, 0.04, "sine");
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
      showPhotoOverlay(
        "Cleared!",
        "Karaoke cleared ✅",
        "karaoke_win.png",
        "Next: Ice skating",
        () => {
          setScene(1);
          overlay.hidden = true;
          running = true;
          resetSceneState();
        }
      );
    }
  }
  function drawKaraoke() {
    if (!karaoke) return;
    const w = W(), h = H();
    const x = karaoke.x;

    ctx.fillStyle = "rgba(255,230,242,0.28)";
    ctx.fillRect(0, 0, w, h);

    const laneW = w * 0.28;
    const laneX = x - laneW / 2;

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    roundRect(laneX, h * 0.12, laneW, h * 0.80, 18, true);

    ctx.strokeStyle = "rgba(255,47,116,0.25)";
    ctx.strokeRect(laneX, h * 0.12, laneW, h * 0.80);

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
      ctx.fillStyle = "rgba(255,47,116,0.86)";
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

  /* ---------------- Ice skating: moving slip zones, NOT blockers ---------------- */
  function makeIceZones(w, h) {
    const zones = [];
    const count = 1; // ultra few for mobile

    // Spawn safe zone (center of rink)
    const spawn = { x: w * 0.5, y: h * 0.55, r: 140 };

    const minY = h * 0.22;
    const maxY = h * 0.84;

    for (let i = 0; i < count; i++) {
      let zw = rand(w * 0.18, w * 0.26);
      let zh = rand(22, 34);

      let placed = false;
      for (let tries = 0; tries < 80 && !placed; tries++) {
        const y = rand(minY, maxY - zh);
        const x = rand(-zw, w);

        // keep ice away from spawn zone (with buffer)
        const z = { x, y, w: zw, h: zh, vx: 0 };
        const safe = !circleRectHit(spawn.x, spawn.y, spawn.r, z);
        if (!safe) continue;

        const vx = rand(120, 190) * (Math.random() < 0.5 ? -1 : 1); // slower
        zones.push({ x, y, w: zw, h: zh, vx });
        placed = true;
      }

      if (!placed) {
        const y = rand(minY, maxY - zh);
        const x = rand(-zw, w);
        const vx = rand(120, 190) * (Math.random() < 0.5 ? -1 : 1);
        zones.push({ x, y, w: zw, h: zh, vx });
      }
    }
    return zones;
  }

  function updateIceZones(dt) {
    if (!skate) return;
    const w = W();

    // Stable wrap range so viewport changes don't "ping-pong" zones at the edges.
    for (const z of skate.ice) {
      z.x += z.vx * dt;

      const range = w + z.w + 20; // stage width + zone width + margins
      let nx = (z.x + z.w + 10) % range;
      if (nx < 0) nx += range;
      z.x = nx - (z.w + 10);
    }
  }
function safeTokenPos(x, y, ice, radius) {
    for (const z of ice) {
      const r = { x: z.x - radius, y: z.y - radius, w: z.w + radius * 2, h: z.h + radius * 2 };
      if (circleRectHit(x, y, 1, r)) return false;
    }
    return true;
  }

  function initSkate() {
    const w = W(), h = H();
    skate = {
      spawn:  { x: w * 0.5, y: h * 0.55, r: 150 },
      player: { x: w * 0.5, y: h * 0.55, vx: 0, vy: 0 },
      pr: 14,
      goal: 6,
      collected: 0,
      tokens: [],
      ice: makeIceZones(w, h),

      spawnShield: 1.4, // seconds: ignore ice after spawn
      resetting: false,
      resetT: 0
    };

    // Place hearts away from ice (at spawn time)
    const tokenMinDist = 66;
    for (let i = 0; i < skate.goal; i++) {
      let placed = false;
      for (let tries = 0; tries < 90 && !placed; tries++) {
        const x = rand(70, w - 70);
        const y = rand(80, h - 80);

        if (!safeTokenPos(x, y, skate.ice, 56)) continue;

        let ok = true;
        for (const t of skate.tokens) {
          if (dist(x, y, t.x, t.y) < tokenMinDist) { ok = false; break; }
        }
        if (!ok) continue;

        skate.tokens.push({ x, y, alive: true });
        placed = true;
      }
      if (!placed) skate.tokens.push({ x: rand(70, w - 70), y: rand(80, h - 80), alive: true });
    }
  }

  function drawBallPlayer(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,47,116,0.16)";
    ctx.fill();

    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,47,116,0.95)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawIceZone(z) {
    const g = ctx.createLinearGradient(z.x, z.y, z.x + z.w, z.y + z.h);
    g.addColorStop(0, "rgba(140,230,255,0.30)");
    g.addColorStop(1, "rgba(60,160,220,0.30)");
    ctx.fillStyle = g;
    roundRect(z.x, z.y, z.w, z.h, 12, true);

    ctx.fillStyle = "rgba(255,255,255,0.20)";
    roundRect(z.x + 6, z.y + 6, z.w - 12, Math.max(6, z.h * 0.35), 10, true);

    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(z.x, z.y, z.w, z.h);
  }

  function triggerSlip() {
    if (!skate || skate.slipCd > 0 || skate.slipping) return;
    skate.slipping = true;
    skate.slipT = 0;
    skate.slipCd = 0.25;

    // Launch into a slide, then reset to middle
    const ang = rand(0, Math.PI * 2);
    const spd = rand(820, 980);
    skate.player.vx = Math.cos(ang) * spd;
    skate.player.vy = Math.sin(ang) * spd;

    showToast("Slip!");
  }

  function updateSkate(dt) {
    if (!skate) return;

    const w = W(), h = H();
    const p = skate.player;

    updateIceZones(dt);

    // Spawn safe zone + short invulnerability timer
    skate.spawnShield = Math.max(0, (skate.spawnShield || 0) - dt);
    const inSafeZone = dist(p.x, p.y, skate.spawn.x, skate.spawn.y) <= skate.spawn.r;

    // If you touched ice: slow down, then quick reset (no long sliding)
    if (!skate.resetting && !inSafeZone && skate.spawnShield <= 0) {
      for (const z of skate.ice) {
        if (circleRectHit(p.x, p.y, skate.pr, z)) {
          skate.resetting = true;
          skate.resetT = 0;
          // Hard slow immediately
          p.vx *= 0.18;
          p.vy *= 0.18;
          showToast("Slowed!");
          break;
        }
      }
    }

    // During reset: freeze you briefly then pop back to spawn
    if (skate.resetting) {
      skate.resetT += dt;

      // Heavy damping so you don't drift far
      p.vx *= dampFactor(0.55, dt);
      p.vy *= dampFactor(0.55, dt);

      integrate(p, skate.pr, dt, { x: 0, y: 0, w, h, pad: skate.pr });

      if (skate.resetT >= 0.22) {
        p.x = skate.spawn.x;
        p.y = skate.spawn.y;
        p.vx = 0;
        p.vy = 0;
        skate.resetting = false;
        skate.spawnShield = 1.2; // give a moment to move away
        showToast("Reset!");
      }
      return;
    }

    // Normal control (less slippery for phone)
    let ax = 0, ay = 0;
    if (keys["KeyA"] || keys["ArrowLeft"]) ax -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) ax += 1;
    if (keys["KeyW"] || keys["ArrowUp"]) ay -= 1;
    if (keys["KeyS"] || keys["ArrowDown"]) ay += 1;

    const n = Math.hypot(ax, ay) || 1;
    ax /= n; ay /= n;

    const accel = 1750;
    const maxSpeed = 620;

    p.vx += ax * accel * dt;
    p.vy += ay * accel * dt;

    if (input.down) steerToward(p, input.x, input.y, 1350, dt);

    // Stronger friction so you don't slip far
    const damp = dampFactor(0.90, dt);
    p.vx *= damp;
    p.vy *= damp;

    const sp = Math.hypot(p.vx, p.vy);
    if (sp > maxSpeed) {
      p.vx = (p.vx / sp) * maxSpeed;
      p.vy = (p.vy / sp) * maxSpeed;
    }

    integrate(p, skate.pr, dt, { x: 0, y: 0, w, h, pad: skate.pr });

    // Collect hearts
    for (const t of skate.tokens) {
      if (!t.alive) continue;
      if (dist(p.x, p.y, t.x, t.y) < 32) {
        t.alive = false;
        skate.collected += 1;
        score += 12;
        if (scoreEl) scoreEl.textContent = String(score);
        showToast("💗");
      }
    }

    if (skate.collected >= skate.goal) {
      running = false;
      showPhotoOverlay(
        "Cleared!",
        "Ice skating cleared ✅",
        "ice_win.png",
        "Next: Swimming",
        () => {
          setScene(2);
          overlay.hidden = true;
          running = true;
          resetSceneState();
        }
      );
      // prevent repeating
      skate.collected = -9999;
    }
  }

  function drawSkate() {
    if (!skate) return;
    const w = W(), h = H();

    ctx.fillStyle = "rgba(210,240,255,0.30)";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.16)";
    for (let i = 0; i < 10; i++) {
      const y = h * (0.12 + i * 0.085);
      ctx.fillRect(w * 0.08, y, w * 0.84, 3);
    }

    for (const z of skate.ice) drawIceZone(z);

    for (const t of skate.tokens) {
      if (!t.alive) continue;
      ctx.font = "30px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💗", t.x, t.y);
    }

    drawBallPlayer(skate.player.x, skate.player.y, skate.pr);

    ctx.fillStyle = "rgba(107,22,55,0.9)";
    ctx.font = "14px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`Collected: ${Math.max(0, skate.collected)}/${skate.goal}   (Touch moving ice = slip + reset)`, 16, 22);
  }

  /* ---------------- Swimming (harder) ---------------- */
  function makeBuoys(pool) {
    const buoys = [];
    const count = 1; // ultra few for mobile

    for (let i = 0; i < count; i++) {
      const r = 22;

      // Try to place it far from the center-ish starts
      let x = 0, y = 0;
      const avoid1 = { x: pool.x + pool.w * 0.30, y: pool.y + pool.h * 0.55 };
      const avoid2 = { x: pool.x + pool.w * 0.70, y: pool.y + pool.h * 0.40 };
      let placed = false;

      for (let tries = 0; tries < 80 && !placed; tries++) {
        x = rand(pool.x + 80, pool.x + pool.w - 80);
        y = rand(pool.y + 80, pool.y + pool.h - 80);
        if (dist(x, y, avoid1.x, avoid1.y) < 180) continue;
        if (dist(x, y, avoid2.x, avoid2.y) < 180) continue;
        placed = true;
      }

      buoys.push({
        x, y, r,
        vx: rand(-70, 70), // slower
        vy: rand(-65, 65)  // slower
      });
    }
    return buoys;
  }

  function updateBuoys(dt, pool, buoys) {
    for (const b of buoys) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const pad = 18;
      if (b.x < pool.x + pad) { b.x = pool.x + pad; b.vx = Math.abs(b.vx); }
      if (b.x > pool.x + pool.w - pad) { b.x = pool.x + pool.w - pad; b.vx = -Math.abs(b.vx); }
      if (b.y < pool.y + pad) { b.y = pool.y + pad; b.vy = Math.abs(b.vy); }
      if (b.y > pool.y + pool.h - pad) { b.y = pool.y + pool.h - pad; b.vy = -Math.abs(b.vy); }

      const s = Math.hypot(b.vx, b.vy);
      const max = 190;
      if (s > max) { b.vx = (b.vx / s) * max; b.vy = (b.vy / s) * max; }
    }
  }

  function initSwim() {
    const w = W(), h = H();
    const pool = { x: w * 0.08, y: h * 0.10, w: w * 0.84, h: h * 0.82 };

    swim = {
      pool,
      buoys: makeBuoys(pool),
      guy:  { x: w * 0.30, y: h * 0.55, vx: 0, vy: 0 },
      girl: { x: w * 0.70, y: h * 0.40, vx: 0, vy: 0, stuckT: 0, lastX: w * 0.70, lastY: h * 0.40 },
      gr: 26,
      rr: 26,
      caught: false,
      kissT: 0,
      proposalShown: false,
      tagHold: 0 // must stay close to tag
    };
  }

  function integrateWithCircleObstacles(obj, radius, dt, bounds, circleObstacles = []) {
    const speed = Math.hypot(obj.vx, obj.vy);
    const steps = clamp(Math.ceil((speed * dt) / 18), 1, 7);
    const stepDt = dt / steps;

    for (let i = 0; i < steps; i++) {
      obj.x += obj.vx * stepDt;
      obj.y += obj.vy * stepDt;

      if (bounds) {
        const pad = bounds.pad ?? 0;
        const left = bounds.x + pad;
        const right = bounds.x + bounds.w - pad;
        const top = bounds.y + pad;
        const bottom = bounds.y + bounds.h - pad;

        if (obj.x < left) { obj.x = left; obj.vx = Math.abs(obj.vx) * 0.85; }
        if (obj.x > right) { obj.x = right; obj.vx = -Math.abs(obj.vx) * 0.85; }
        if (obj.y < top) { obj.y = top; obj.vy = Math.abs(obj.vy) * 0.85; }
        if (obj.y > bottom) { obj.y = bottom; obj.vy = -Math.abs(obj.vy) * 0.85; }
      }

      for (const c of circleObstacles) resolveCircleCircle(obj, radius, c, c.r, 0.78);
    }
  }

  function updateSwim(dt) {
    if (!swim) return;
    const p = swim.pool;
    const guy = swim.guy;
    const girl = swim.girl;

    updateBuoys(dt, p, swim.buoys);

    let ax = 0, ay = 0;
    if (keys["KeyA"] || keys["ArrowLeft"]) ax -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) ax += 1;
    if (keys["KeyW"] || keys["ArrowUp"]) ay -= 1;
    if (keys["KeyS"] || keys["ArrowDown"]) ay += 1;

    const n = Math.hypot(ax, ay) || 1;
    ax /= n; ay /= n;

    // Make guy slightly weaker so it is harder
    const guyAccel = 1350;
    const guyMax = 470;

    guy.vx += ax * guyAccel * dt;
    guy.vy += ay * guyAccel * dt;
    if (input.down) steerToward(guy, input.x, input.y, 1300, dt);

    const guyD = dampFactor(0.93, dt);
    guy.vx *= guyD;
    guy.vy *= guyD;

    let sp = Math.hypot(guy.vx, guy.vy);
    if (sp > guyMax) { guy.vx = (guy.vx / sp) * guyMax; guy.vy = (guy.vy / sp) * guyMax; }

    const dx = girl.x - guy.x;
    const dy = girl.y - guy.y;
    const d = Math.hypot(dx, dy) || 1;

    if (!swim.caught) {
      // Girl faster and more aggressive flee
      const fleeBoost = clamp((380 - d) / 380, 0, 1);

      const girlAccel = 1850 * (0.70 + 0.70 * fleeBoost);
      const girlMax = 720 * (0.78 + 0.42 * fleeBoost);

      // run away from guy
      girl.vx += (dx / d) * girlAccel * dt;
      girl.vy += (dy / d) * girlAccel * dt;

      // avoid buoys strongly
      for (const b of swim.buoys) {
        const bx = girl.x - b.x;
        const by = girl.y - b.y;
        const bd = Math.hypot(bx, by) || 1;
        const avoidR = b.r + 85;
        if (bd < avoidR) {
          const push = (avoidR - bd) / avoidR;
          girl.vx += (bx / bd) * (1400 * push) * dt;
          girl.vy += (by / bd) * (1400 * push) * dt;
        }
      }

      // wall avoidance
      const m = 75;
      const cx = p.x + p.w * 0.5;
      const cy = p.y + p.h * 0.5;
      if (girl.x < p.x + m) girl.vx += (cx - girl.x) * 11 * dt;
      if (girl.x > p.x + p.w - m) girl.vx += (cx - girl.x) * 11 * dt;
      if (girl.y < p.y + m) girl.vy += (cy - girl.y) * 11 * dt;
      if (girl.y > p.y + p.h - m) girl.vy += (cy - girl.y) * 11 * dt;

      const girlD = dampFactor(0.945, dt);
      girl.vx *= girlD;
      girl.vy *= girlD;

      sp = Math.hypot(girl.vx, girl.vy);
      if (sp > girlMax) { girl.vx = (girl.vx / sp) * girlMax; girl.vy = (girl.vy / sp) * girlMax; }

      // Collide with buoys
      integrateWithCircleObstacles(guy, swim.gr, dt, { x: p.x, y: p.y, w: p.w, h: p.h, pad: swim.gr }, swim.buoys);
      integrateWithCircleObstacles(girl, swim.rr, dt, { x: p.x, y: p.y, w: p.w, h: p.h, pad: swim.rr }, swim.buoys);

      // If guy hits buoy, penalize speed a bit
      for (const b of swim.buoys) {
        if (dist(guy.x, guy.y, b.x, b.y) < (swim.gr + b.r + 2)) {
          guy.vx *= 0.88;
          guy.vy *= 0.88;
          break;
        }
      }

      // Fix girl stuck
      const moved = dist(girl.x, girl.y, girl.lastX, girl.lastY);
      girl.lastX = girl.x; girl.lastY = girl.y;
      if (moved < 0.30) girl.stuckT += dt; else girl.stuckT = 0;
      if (girl.stuckT > 0.35) {
        girl.stuckT = 0;
        girl.vx += (cx - girl.x) * 14 * dt + rand(-160, 160) * dt;
        girl.vy += (cy - girl.y) * 14 * dt + rand(-160, 160) * dt;
      }

      // Harder tag: must stay close briefly
      const catchRadius = 42;
      if (dist(guy.x, guy.y, girl.x, girl.y) < catchRadius) swim.tagHold += dt;
      else swim.tagHold = 0;

      if (swim.tagHold > 0.35) {
        swim.caught = true;
        swim.kissT = 0;
        showToast("Tagged!");
      }
    } else {
      swim.kissT += dt;

      guy.vx *= dampFactor(0.85, dt);
      guy.vy *= dampFactor(0.85, dt);

      integrateWithCircleObstacles(guy, swim.gr, dt, { x: p.x, y: p.y, w: p.w, h: p.h, pad: swim.gr }, swim.buoys);

      girl.x += (guy.x - girl.x) * 0.10;
      girl.y += (guy.y - girl.y) * 0.10;

      girl.x = clamp(girl.x, p.x + swim.rr, p.x + p.w - swim.rr);
      girl.y = clamp(girl.y, p.y + swim.rr, p.y + p.h - swim.rr);

      if (swim.kissT > 1.35 && !swim.proposalShown) {
        swim.proposalShown = true;
        running = false;
        showPhotoOverlay(
          "Cleared!",
          "Swimming cleared ✅",
          "swim_win.png",
          "Next",
          () => {
            overlay.hidden = true;
            showProposal();
          }
        );
      }
    }
  }

  function drawSwim() {
    if (!swim) return;
    const w = W(), h = H();
    const p = swim.pool;

    ctx.fillStyle = "rgba(170,235,255,0.65)";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    roundRect(p.x, p.y, p.w, p.h, 22, true);

    ctx.strokeStyle = "rgba(107,22,55,0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, p.w, p.h);

    for (const b of swim.buoys) {
      ctx.fillStyle = "rgba(255,47,116,0.14)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "34px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🛟", b.x, b.y);
    }

    ctx.font = "52px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🧍‍♀️", swim.girl.x, swim.girl.y);
    ctx.fillText("🧍‍♂️", swim.guy.x, swim.guy.y);

    if (swim.caught) {
      const mx = (swim.guy.x + swim.girl.x) / 2;
      const my = (swim.guy.y + swim.girl.y) / 2 - 40;
      ctx.font = "44px system-ui";
      ctx.fillText("💗", mx, my);
    }

    ctx.fillStyle = "rgba(107,22,55,0.9)";
    ctx.font = "14px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(swim.caught ? "Aww..." : `Tag her: stay close briefly. Hold: ${(swim.tagHold || 0).toFixed(2)}s`, 16, 22);
  }

  /* ---------------- Proposal ---------------- */
  let noAttempts = 0;

  function showProposal() {
    if (!valModal) return;
    valModal.classList.add("show");
    if (burnSub) burnSub.textContent = "I LOVE YOU FRONDOZO JULIE ANN SEMIRA NOSEJOB LOVEYDUBS";
    if (noHint) noHint.textContent = "If you press No, it gets annoying.";

    noAttempts = 0;
    if (modalNo) { modalNo.style.transform = "translate(0px, 0px) scale(1)"; modalNo.style.opacity = "1"; }
    if (modalYes) modalYes.style.transform = "scale(1)";
  }

  function moveNoButton() {
    if (!burnBtns || !modalNo) return;
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

    if (modalYes) {
      const yesScale = clamp(1 + noAttempts * 0.10, 1, 1.7);
      modalYes.style.transform = `scale(${yesScale})`;
    }

    if (modalNo) {
      if (noAttempts >= 2) moveNoButton();
      if (noAttempts >= 4) modalNo.style.opacity = "0.85";
      if (noAttempts >= 6) modalNo.style.opacity = "0.55";
    }

    if (noHint) noHint.textContent = lines[Math.min(noAttempts - 1, lines.length - 1)];
  }

  if (modalYes) {
    modalYes.onclick = () => {
      ensureAudio();
      resumeAudio();

      if (valModal) valModal.classList.remove("show");
      spawnConfetti();

      if (flowersModal) flowersModal.classList.add("show");
      playMelody(SONG, 135, 0.06);
    };
  }
  if (modalNo) {
    modalNo.onmouseenter = () => { annoyNo(); moveNoButton(); };
    modalNo.onpointerdown = (e) => { e.preventDefault(); annoyNo(); moveNoButton(); };
  }

  if (flowersRestart) {
    flowersRestart.onclick = () => {
      if (flowersModal) flowersModal.classList.remove("show");
      resetAll();
    };
  }

  /* ---------------- Scene UI ---------------- */
  function resetSceneState() {
    if (scene === 0) initKaraoke();
    if (scene === 1) initSkate();
    if (scene === 2) initSwim();
  }

  function setScene(n) {
    scene = n;
    dotEls.forEach((d, i) => d.classList.toggle("on", i === scene));
    if (sceneNameEl) sceneNameEl.textContent = ["Karaoke", "Ice skating", "Swimming tag"][scene];

    if (scene === 0) {
      if (subtitleEl) subtitleEl.textContent = "Mini-game 1: Karaoke. Tap on beat.";
      if (miniRow1) miniRow1.textContent = "Goal: Hit 8 notes.";
      if (miniRow2) miniRow2.textContent = "Tap anywhere (or Space).";
    } else if (scene === 1) {
      if (subtitleEl) subtitleEl.textContent = "Mini-game 2: Ice skating. Moving slip zones reset you to middle.";
      if (miniRow1) miniRow1.textContent = "Goal: Collect 6 hearts.";
      if (miniRow2) miniRow2.textContent = "Touch ice = slip + reset.";
    } else {
      if (subtitleEl) subtitleEl.textContent = "Final: Swimming tag. Harder now.";
      if (miniRow1) miniRow1.textContent = "Goal: Tag her (stay close briefly).";
      if (miniRow2) miniRow2.textContent = "Buoys are faster and more.";
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
      overlayText.textContent = "Collect 6 hearts. Moving ice makes you slip and resets you to middle.";
      startBtn.textContent = "Start skating";
    } else {
      overlayTitle.textContent = "Swimming tag";
      overlayText.textContent = "Harder: you must stay close briefly to tag her. Avoid fast buoys.";
      startBtn.textContent = "Start swimming";
    }

    overlayAction = () => {
      overlay.hidden = true;
      running = true;
      resetSceneState();
    };
  }


  function showPhotoOverlay(title, caption, imgSrc, btnText, action) {
    overlay.hidden = false;
    overlayTitle.textContent = title;

    // Clear and rebuild overlay content
    overlayText.textContent = "";
    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "12px";
    wrap.style.justifyItems = "center";
    wrap.style.textAlign = "center";

    if (caption) {
      const p = document.createElement("div");
      p.textContent = caption;
      p.style.opacity = "0.92";
      wrap.appendChild(p);
    }

    const img = document.createElement("img");
    img.src = imgSrc;
    img.alt = title;
    img.style.maxWidth = "min(520px, 92vw)";
    img.style.width = "100%";
    img.style.borderRadius = "16px";
    img.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
    img.style.userSelect = "none";
    img.draggable = false;

    wrap.appendChild(img);
    overlayText.appendChild(wrap);

    startBtn.textContent = btnText;
    overlayAction = action;
  }

  function showNextOverlay(title, text, btnText, action) {
    overlay.hidden = false;
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    startBtn.textContent = btnText;
    overlayAction = action;
  }

  function resetAll() {
    score = 0;
    if (scoreEl) scoreEl.textContent = String(score);

    if (valModal) valModal.classList.remove("show");
    if (flowersModal) flowersModal.classList.remove("show");

    confetti = [];
    confettiTimer = 0;

    setScene(0);
    overlay.hidden = false;
    running = false;
  }

  /* ---------------- Main loop ---------------- */
  let last = performance.now();
  function loop(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;

    ctx.clearRect(0, 0, W(), H());

    if (scene === 0) { if (running) updateKaraoke(dt); drawKaraoke(); }
    if (scene === 1) { if (running) updateSkate(dt); drawSkate(); }
    if (scene === 2) { if (running) updateSwim(dt); drawSwim(); }

    updateConfetti(dt);
    drawConfetti();
    updateToast();

    input.tap = false;
    requestAnimationFrame(loop);
  }

  /* ---------------- Boot ---------------- */
  resizeCanvas();
  if (scoreEl) scoreEl.textContent = String(score);
  if (valModal) valModal.classList.remove("show");
  if (flowersModal) flowersModal.classList.remove("show");

  setScene(0);
  overlay.hidden = false;
  running = false;

  requestAnimationFrame(loop);
});
