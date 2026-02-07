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

  // Never show an error UI
  window.addEventListener("error", (e) => { try { e.preventDefault(); } catch {} }, true);
  window.addEventListener("unhandledrejection", (e) => { try { e.preventDefault(); } catch {} }, true);

  /* ---------------- Helpers ---------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => Math.random() * (b - a) + a;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  const W = () => stage.getBoundingClientRect().width;
  const H = () => stage.getBoundingClientRect().height;

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
    toastTimer = 55;
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

  // Small sound effect for karaoke taps
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

  // Cute ending melody
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
    let t = audioCtx.currentTime + 0.02;
    for (const s of seq) {
      const dur = s.d * beat;
      if (s.n !== "REST") {
        sfxBeep(noteToFreq(s.n), dur, gain, "triangle");
      }
      t += dur;
    }
  }
  const SONG = [
    {n:"G5",d:0.5},{n:"E5",d:0.5},{n:"F5",d:0.5},{n:"D5",d:0.5},
    {n:"E5",d:0.5},{n:"C5",d:0.5},{n:"D5",d:0.5},{n:"B4",d:0.5},
    {n:"C5",d:1.0},{n:"REST",d:0.5},{n:"C5",d:0.5},{n:"E5",d:0.5},
    {n:"G5",d:1.0},
  ];

  // Start button is a user gesture, so unlock audio there too
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
    karaoke.notes.push({
      y: -30,
      r: 16,
      speed: Math.max(260, H() * 0.65),
      alive: true
    });
    karaoke.spawned += 1;
  }

  function karaokeTryHit() {
    // Sound per press
    ensureAudio();
    resumeAudio();

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

      // Higher pitch for better timing
      const freq = bestD <= 13 ? 880 : 740;
      sfxBeep(freq, 0.08, 0.055);
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

  /* ---------------- Ice skating (slower) ---------------- */
  function initSkate() {
    const w = W(), h = H();
    skate = {
      player: { x: w * 0.45, y: h * 0.55, vx: 0, vy: 0 },
      collected: 0,
      goal: 6,
      tokens: [],
      done: false
    };
    for (let i = 0; i < skate.goal; i++) {
      skate.tokens.push({ x: rand(70, w - 70), y: rand(70, h - 70), alive: true });
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

    // Slower than before
    const accel = 850;
    const maxSpeed = 320;

    p.vx += ax * accel * dt;
    p.vy += ay * accel * dt;

    if (input.down) steerToward(p, input.x, input.y, 360, dt);

    // More damping so it does not rocket around
    const damp = dampFactor(0.80, dt);
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
        if (scoreEl) scoreEl.textContent = String(score);
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

    ctx.fillStyle = "rgba(210,240,255,0.28)";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (let i = 0; i < 8; i++) ctx.fillRect(w * 0.1, h * (0.15 + i * 0.1), w * 0.8, 4);

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

  /* ---------------- Swimming (harder + wall-smart) ---------------- */
  function initSwim() {
    const w = W(), h = H();
    swim = {
      pool: { x: w * 0.08, y: h * 0.10, w: w * 0.84, h: h * 0.82 },
      guy:  { x: w * 0.30, y: h * 0.55, vx: 0, vy: 0 },
      girl: { x: w * 0.68, y: h * 0.45, vx: 0, vy: 0, stuckT: 0, lastX: w*0.68, lastY: h*0.45 },
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

    const guyAccel = 980;
    const guyMax = 330;

    guy.vx += ax * guyAccel * dt;
    guy.vy += ay * guyAccel * dt;

    if (input.down) steerToward(guy, input.x, input.y, 720, dt);

    const guyD = dampFactor(0.88, dt);
    guy.vx *= guyD;
    guy.vy *= guyD;

    let sp = Math.hypot(guy.vx, guy.vy);
    if (sp > guyMax) { guy.vx = (guy.vx / sp) * guyMax; guy.vy = (guy.vy / sp) * guyMax; }

    const dx = girl.x - guy.x;
    const dy = girl.y - guy.y;
    const d = Math.hypot(dx, dy) || 1;

    if (!swim.caught) {
      // Harder: smaller catch radius and girl speed ramps up when close
      const catchRadius = 52;

      const fleeBoost = clamp((320 - d) / 320, 0, 1);
      const girlAccel = 760 * (0.45 + 0.85 * fleeBoost);
      const girlMax = 340 * (0.75 + 0.55 * fleeBoost);

      // Flee away from guy
      girl.vx += (dx / d) * girlAccel * dt;
      girl.vy += (dy / d) * girlAccel * dt;

      // Small wiggle so she does not move in straight lines
      girl.vx += Math.sin(performance.now() * 0.004) * 18 * dt;
      girl.vy += Math.cos(performance.now() * 0.004) * 18 * dt;

      // Wall avoidance: push her toward center if she gets near an edge
      const m = 50;
      const cx = p.x + p.w * 0.5;
      const cy = p.y + p.h * 0.5;

      if (girl.x < p.x + m) girl.vx += (cx - girl.x) * 6 * dt;
      if (girl.x > p.x + p.w - m) girl.vx += (cx - girl.x) * 6 * dt;
      if (girl.y < p.y + m) girl.vy += (cy - girl.y) * 6 * dt;
      if (girl.y > p.y + p.h - m) girl.vy += (cy - girl.y) * 6 * dt;

      // Damping
      const girlD = dampFactor(0.90, dt);
      girl.vx *= girlD;
      girl.vy *= girlD;

      sp = Math.hypot(girl.vx, girl.vy);
      if (sp > girlMax) { girl.vx = (girl.vx / sp) * girlMax; girl.vy = (girl.vy / sp) * girlMax; }

      // Move both
      guy.x += guy.vx * dt; guy.y += guy.vy * dt;
      girl.x += girl.vx * dt; girl.y += girl.vy * dt;

      // Clamp + bounce so she does not stick to walls
      const pad = 22;

      const oldGX = girl.x, oldGY = girl.y;

      if (girl.x <= p.x + pad) { girl.x = p.x + pad; girl.vx = Math.abs(girl.vx) * 0.85; }
      if (girl.x >= p.x + p.w - pad) { girl.x = p.x + p.w - pad; girl.vx = -Math.abs(girl.vx) * 0.85; }
      if (girl.y <= p.y + pad) { girl.y = p.y + pad; girl.vy = Math.abs(girl.vy) * 0.85; }
      if (girl.y >= p.y + p.h - pad) { girl.y = p.y + p.h - pad; girl.vy = -Math.abs(girl.vy) * 0.85; }

      // Stuck detector: if she barely moved for a while, nudge her inward
      const moved = dist(girl.x, girl.y, girl.lastX, girl.lastY);
      girl.lastX = girl.x; girl.lastY = girl.y;
      if (moved < 0.3) girl.stuckT += dt; else girl.stuckT = 0;
      if (girl.stuckT > 0.45) {
        girl.stuckT = 0;
        // Nudge toward center and sideways
        girl.vx += (cx - girl.x) * 9 * dt + rand(-80, 80) * dt;
        girl.vy += (cy - girl.y) * 9 * dt + rand(-80, 80) * dt;
      }

      // Clamp guy (no bounce needed)
      guy.x = clamp(guy.x, p.x + pad, p.x + p.w - pad);
      guy.y = clamp(guy.y, p.y + pad, p.y + p.h - pad);

      // Catch check after movement
      if (dist(guy.x, guy.y, girl.x, girl.y) < catchRadius) {
        swim.caught = true;
        swim.kissT = 0;
        showToast("Caught!");
      }
    } else {
      // Kiss + proposal timing
      swim.kissT += dt;

      guy.vx *= dampFactor(0.78, dt);
      guy.vy *= dampFactor(0.78, dt);
      girl.vx *= dampFactor(0.78, dt);
      girl.vy *= dampFactor(0.78, dt);

      guy.x += guy.vx * dt; guy.y += guy.vy * dt;

      girl.x += (guy.x - girl.x) * 0.08;
      girl.y += (guy.y - girl.y) * 0.08;

      const pad = 22;
      guy.x = clamp(guy.x, p.x + pad, p.x + p.w - pad);
      guy.y = clamp(guy.y, p.y + pad, p.y + p.h - pad);
      girl.x = clamp(girl.x, p.x + pad, p.x + p.w - pad);
      girl.y = clamp(girl.y, p.y + pad, p.y + p.h - pad);

      if (swim.kissT > 1.35 && !swim.proposalShown) {
        swim.proposalShown = true;
        running = false;
        showProposal();
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
    ctx.fillText(swim.caught ? "Aww..." : "Tag: Catch her!", 16, 22);
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
      if (subtitleEl) subtitleEl.textContent = "Mini-game 2: Ice skating. Collect snow hearts.";
      if (miniRow1) miniRow1.textContent = "Goal: Collect 6 snow hearts.";
      if (miniRow2) miniRow2.textContent = "Hold and drag to steer on mobile.";
    } else {
      if (subtitleEl) subtitleEl.textContent = "Final: Swimming tag. Catch her, kiss, then the question.";
      if (miniRow1) miniRow1.textContent = "Goal: Catch her once.";
      if (miniRow2) miniRow2.textContent = "Hold and drag to chase on mobile.";
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
      overlayText.textContent = "Collect 6 snow hearts. Slower movement.";
      startBtn.textContent = "Start skating";
    } else {
      overlayTitle.textContent = "Swimming tag";
      overlayText.textContent = "Chase her, catch her, cute ending unlocked.";
      startBtn.textContent = "Start swimming";
    }

    overlayAction = () => {
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
