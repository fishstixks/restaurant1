function updateSwim(dt) {
  const p = swim.pool;

  // Guy controls
  let ax = 0, ay = 0;
  if (keys["KeyA"] || keys["ArrowLeft"]) ax -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) ax += 1;
  if (keys["KeyW"] || keys["ArrowUp"]) ay -= 1;
  if (keys["KeyS"] || keys["ArrowDown"]) ay += 1;

  const nn = Math.hypot(ax, ay) || 1;
  ax /= nn; ay /= nn;

  // Slightly stronger guy movement than before
  swim.guy.vx = (swim.guy.vx + ax * 0.72) * 0.86;
  swim.guy.vy = (swim.guy.vy + ay * 0.72) * 0.86;

  // Touch drag assist
  if (input.down) {
    const dxT = input.x - swim.guy.x;
    const dyT = input.y - swim.guy.y;
    const dT = Math.hypot(dxT, dyT) || 1;
    swim.guy.vx += (dxT / dT) * 0.26;
    swim.guy.vy += (dyT / dT) * 0.26;
  }

  // Girl AI
  const dx = swim.girl.x - swim.guy.x;
  const dy = swim.girl.y - swim.guy.y;
  const d = Math.hypot(dx, dy) || 1;

  if (!swim.caught) {
    // Easier: weaker flee, plus speed cap
    const fleeBoost = clamp((280 - d) / 280, 0, 1); // was more aggressive
    swim.girl.vx = (swim.girl.vx + (dx / d) * (0.22 + 0.55 * fleeBoost)) * 0.90;
    swim.girl.vy = (swim.girl.vy + (dy / d) * (0.22 + 0.55 * fleeBoost)) * 0.90;

    // Tiny wiggle so she still feels alive
    swim.girl.vx += Math.sin(performance.now() * 0.003) * 0.015;
    swim.girl.vy += Math.cos(performance.now() * 0.003) * 0.015;

    // Cap her max speed so she can’t perma-run forever
    const maxGirlSpeed = 4.4;
    const gsp = Math.hypot(swim.girl.vx, swim.girl.vy);
    if (gsp > maxGirlSpeed) {
      swim.girl.vx = (swim.girl.vx / gsp) * maxGirlSpeed;
      swim.girl.vy = (swim.girl.vy / gsp) * maxGirlSpeed;
    }

    // Easier: slightly bigger catch radius
    if (d < 58) {
      swim.caught = true;
      swim.kissT = 0;
      showToast("Caught!");
    }
  } else {
    // Kiss sequence
    swim.kissT += dt;
    swim.guy.vx *= 0.8; swim.guy.vy *= 0.8;
    swim.girl.vx *= 0.8; swim.girl.vy *= 0.8;

    swim.girl.x += (swim.guy.x - swim.girl.x) * 0.06;
    swim.girl.y += (swim.guy.y - swim.girl.y) * 0.06;

    if (swim.kissT > 1.4 && !swim.proposalShown) {
      swim.proposalShown = true;
      running = false;
      showProposal();
    }
  }

  // Apply movement
  swim.guy.x += swim.guy.vx;
  swim.guy.y += swim.guy.vy;
  swim.girl.x += swim.girl.vx;
  swim.girl.y += swim.girl.vy;

  // Pool bounds
  let pad = 22;
  swim.guy.x = clamp(swim.guy.x, p.x + pad, p.x + p.w - pad);
  swim.guy.y = clamp(swim.guy.y, p.y + pad, p.y + p.h - pad);
  swim.girl.x = clamp(swim.girl.x, p.x + pad, p.x + p.w - pad);
  swim.girl.y = clamp(swim.girl.y, p.y + pad, p.y + p.h - pad);
}
