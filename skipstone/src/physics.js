// physics.js — 打水漂的剛體模擬
//
// 世界座標：x＝丟出去的方向、y＝左、z＝上，水面在 z＝0（公制單位）。
//
// 模型（都是對「玩家雕出來的實際形狀」逐片表面積分，不是套公式）：
//  1. 六自由度剛體：質量、質心、慣性張量由體素算出；角動量用尤拉方程式（含陀螺項）。
//  2. 水的作用力：表面切成小片（surfel），每一片若在水面下且正在「推水」（v·n > 0），受到
//        dF = −½ ρ C |v| (v·n) n dA
//     這是 Bocquet (2003, Am. J. Phys.) 的 F = ½ C ρ V² S_im n 的逐片版本，升力係數隨局部迎角
//     線性變化；背水面在空腔裡不受動壓（Nagahiro & Hayakawa 2005 的假設）。
//     另加表面摩擦（切向）與靜水壓（下沉時的浮力）。
//  3. 空氣：同一套逐片公式，ρ 換成空氣密度。太輕太薄的石頭會被抬起來、翻掉。
//  4. 自轉穩定：不是寫死的規則，陀螺效應直接來自剛體方程式。轉得不夠快，入水力矩就會把石頭掀翻。
//
// 校正（test/calib.mjs）：平靜水面的準穩態模型算不出水花、空腔和水面堆高，所以有三個常數是
// 對照文獻調出來的，不是第一原理：
//   Cw＝3.0   讓 12 m/s 的接觸時間約 10 ms（Bocquet 的估計值）
//   kz＝0.2   垂直速度對動壓的貢獻；決定每一下彈起來剩多少（越小越有彈性）
//   tq＝0.03  動壓力矩修正。用靜止水面算壓力中心會落在石頭後緣，力矩大到一下就翻；真實的
//             石頭能連續彈幾十下，代表實際壓力中心很接近質心（水面堆高＋空腔），所以把力矩縮小。
// 對照：Bocquet 估 5／8／12 m/s 約 6／17／38 下；本模型 8 cm、131 g 圓盤約 4／13／18 下，
// 低速時最佳仰角約 15°、高速時 5–10°，沒有自轉只剩 2 下。

export const G = 9.81, RHO_W = 1000, RHO_A = 1.2;

export const PARAMS = {
  Cw: 3.0,      // 水的動壓係數
  Cf: 0.02,     // 水的切向摩擦係數
  Ca: 1.0,      // 空氣動壓係數
  hs: 0.001,    // 水面過渡半寬（讓小片入水時力量平滑）
  planing: 1,   // 1＝動壓集中在入水線附近（滑行平板的壓力分布，壓力中心在浸水長度前 1/4 處）
  tq: 0.03,     // 動壓力矩修正（<1 表示實際壓力中心比靜止水面算出來的更靠近質心）
  kz: 0.2,      // 垂直速度對動壓的貢獻比例（1＝準穩態升力；越小彈跳越有彈性）
  pile: 0,   // 入水時水沿著石頭底面往上堆（Wagner 入水理論：浸濕長度約為幾何值的 π/2 倍）
  dtWater: 1e-4,
  dtAir: 5e-4,
  airEvery: 4,  // 空中每幾步重算一次空氣力
  minAir: 0.03, // 離水這麼久才算一下（避免邊緣抖動重複計數）
  sinkDepth: 0.25,
  maxWet: 1.5,  // 連續貼在水面上這麼久（不再彈起）就算結束
  maxTime: 60,
};

// 手臂模型：出手動能固定，石頭越重出手越慢。v = V0 √(mArm / (mArm + m))
export const ARM = { V0: 16, mArm: 0.4, spinK: 0.32, maxSpin: 2 * Math.PI * 18, height: 0.3 };
export function throwSpeed(mass, effort = 1) { return effort * ARM.V0 * Math.sqrt(ARM.mArm / (ARM.mArm + mass)); }
// 食指撥石頭邊緣：邊緣線速度約為出手速度的 spinK 倍 → 石頭越小轉越快
export function throwSpin(speed, rGrip) { return Math.min(ARM.maxSpin, ARM.spinK * speed / Math.max(rGrip, 0.012)); }

// 由 Stone 準備剛體資料
export function prepareBody(stone) {
  const mp = stone.massProps();
  const m = stone.mesh();
  const n = m.nq;
  const px = new Float64Array(n), py = new Float64Array(n), pz = new Float64Array(n);
  const nx = new Float64Array(n), ny = new Float64Array(n), nz = new Float64Array(n), ar = new Float64Array(n);
  const P = m.positions, Q = m.quads;
  let rB = 0, area = 0;
  const bins = new Float64Array(24);
  for (let q = 0; q < n; q++) {
    const a = Q[q * 4] * 3, b = Q[q * 4 + 1] * 3, c = Q[q * 4 + 2] * 3, e = Q[q * 4 + 3] * 3;
    const cx = (P[a] + P[b] + P[c] + P[e]) / 4 - mp.com[0], cy = (P[a + 1] + P[b + 1] + P[c + 1] + P[e + 1]) / 4 - mp.com[1], cz = (P[a + 2] + P[b + 2] + P[c + 2] + P[e + 2]) / 4 - mp.com[2];
    const ux = P[c] - P[a], uy = P[c + 1] - P[a + 1], uz = P[c + 2] - P[a + 2];
    const vx = P[e] - P[b], vy = P[e + 1] - P[b + 1], vz = P[e + 2] - P[b + 2];
    let ax = (uy * vz - uz * vy) / 2, ay = (uz * vx - ux * vz) / 2, az = (ux * vy - uy * vx) / 2;
    const A = Math.hypot(ax, ay, az);
    px[q] = cx; py[q] = cy; pz[q] = cz; ar[q] = A;
    if (A > 0) { nx[q] = ax / A; ny[q] = ay / A; nz[q] = az / A; }
    area += A;
    const r = Math.hypot(cx, cy, cz); if (r > rB) rB = r;
    const rp = Math.hypot(cx, cy), bi = Math.floor((Math.atan2(cy, cx) + Math.PI) / (2 * Math.PI) * 24) % 24;
    if (rp > bins[bi]) bins[bi] = rp;
  }
  let rg = 0; for (let i = 0; i < 24; i++) rg += bins[i]; rg /= 24;
  return {
    mass: mp.mass, I: Float64Array.from(mp.I), Iinv: inv3(mp.I), com: mp.com, n, px, py, pz, nx, ny, nz, ar,
    rBound: rB + 0.002, rGrip: rg, area, props: mp,
  };
}

function inv3(m) {
  const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1e-30;
  return Float64Array.from([A / det, (c * h - b * i) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, (c * d - a * f) / det, C / det, (b * g - a * h) / det, (a * e - b * d) / det]);
}

function qmul(a, b) {
  return [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
}
// 姿態 q 以本體角速度 w 轉 dt
function qstep(q, w, dt) {
  const wn = Math.hypot(w[0], w[1], w[2]), ang = wn * dt;
  if (ang < 1e-12) return q;
  const s = Math.sin(ang / 2) / wn, r = qmul(q, [Math.cos(ang / 2), w[0] * s, w[1] * s, w[2] * s]);
  const l = Math.hypot(r[0], r[1], r[2], r[3]);
  return [r[0] / l, r[1] / l, r[2] / l, r[3] / l];
}
function qaxis(x, y, z, ang) { const s = Math.sin(ang / 2); return [Math.cos(ang / 2), x * s, y * s, z * s]; }

export class Throw {
  // o: { speed, tilt（仰角，弧度，前緣抬高）, spin（rad/s，繞石頭 Z 軸）, yaw, pitch, height, flip }
  constructor(body, o) {
    this.b = body;
    const yaw = o.yaw || 0, pitch = o.pitch || 0;
    this.p = [0, 0, o.height ?? ARM.height];
    this.v = [o.speed * Math.cos(pitch) * Math.cos(yaw), o.speed * Math.cos(pitch) * Math.sin(yaw), o.speed * Math.sin(pitch)];
    let q = qmul(qaxis(0, 0, 1, yaw), qaxis(0, 1, 0, -(o.tilt || 0)));
    if (o.flip) q = qmul(q, qaxis(1, 0, 0, Math.PI));
    if (o.phase) q = qmul(q, qaxis(0, 0, 1, o.phase));   // 出手瞬間石頭繞自轉軸的角度（只影響外觀與不對稱石頭的相位）
    this.q = q;
    this.w = [0, 0, (o.flip ? -1 : 1) * (o.spin || 0)];   // 本體座標的角速度
    this.t = 0; this.skips = 0; this.done = false; this.sunk = false;
    this.inWater = false; this.wasIn = false; this.pendingOut = -1; this.contactStart = 0;
    this.events = [];        // {type:'in'|'skip'|'sink', t, x, y, speed}
    this.Fa = [0, 0, 0]; this.Ta = [0, 0, 0]; this.airCount = 0;
    this.depthMax = 0; this.topZ = 1;
    this.maxHeight = this.p[2]; this.lastSkipX = 0; this.lastSkipY = 0;
    this.R = new Float64Array(9); this._rot();
    // 世界座標角動量 L = R I ω_b
    { const I = body.I, w = this.w, R = this.R;
      const bx = I[0] * w[0] + I[1] * w[1] + I[2] * w[2], by = I[3] * w[0] + I[4] * w[1] + I[5] * w[2], bz = I[6] * w[0] + I[7] * w[1] + I[8] * w[2];
      this.L = [R[0] * bx + R[1] * by + R[2] * bz, R[3] * bx + R[4] * by + R[5] * bz, R[6] * bx + R[7] * by + R[8] * bz]; }
    this.nan = false;
  }
  _rot() {
    const [w, x, y, z] = this.q, R = this.R;
    R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - w * z); R[2] = 2 * (x * z + w * y);
    R[3] = 2 * (x * y + w * z); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - w * x);
    R[6] = 2 * (x * z - w * y); R[7] = 2 * (y * z + w * x); R[8] = 1 - 2 * (x * x + y * y);
  }
  // 由世界座標角動量算本體角速度 ω_b = I⁻¹ Rᵀ L
  _omega() {
    const R = this.R, L = this.L, J = this.b.Iinv, w = this.w;
    const bx = R[0] * L[0] + R[3] * L[1] + R[6] * L[2], by = R[1] * L[0] + R[4] * L[1] + R[7] * L[2], bz = R[2] * L[0] + R[5] * L[1] + R[8] * L[2];
    w[0] = J[0] * bx + J[1] * by + J[2] * bz; w[1] = J[3] * bx + J[4] * by + J[5] * bz; w[2] = J[6] * bx + J[7] * by + J[8] * bz;
  }
  // 石頭自轉軸（本體 Z）在世界座標的方向
  axis() { return [this.R[2], this.R[5], this.R[8]]; }
  spinRate() { return Math.hypot(this.w[0], this.w[1], this.w[2]); }
  speed() { return Math.hypot(this.v[0], this.v[1], this.v[2]); }
  distance() { return Math.hypot(this.p[0], this.p[1]); }

  // 往前模擬 T 秒（模擬時間）。回傳這段期間新增的事件。
  advance(T) {
    const e0 = this.events.length, P = PARAMS, tEnd = this.t + T;
    while (this.t < tEnd && !this.done) {
      const near = this.p[2] - this.b.rBound < 0.004;
      if (near) {
        const sp = this.speed();
        this._step(sp > 6 ? P.dtWater : sp > 3 ? 2 * P.dtWater : 4 * P.dtWater, true);
      } else {
        this._step(P.dtAir, false);
      }
    }
    return this.events.slice(e0);
  }
  run(maxT = PARAMS.maxTime) { while (!this.done && this.t < maxT) this.advance(0.05); return this; }

  _step(dt, water) {
    const b = this.b, R = this.R, P = PARAMS, p = this.p, v = this.v, w = this.w;
    // 世界座標角速度
    const wx = R[0] * w[0] + R[1] * w[1] + R[2] * w[2], wy = R[3] * w[0] + R[4] * w[1] + R[5] * w[2], wz = R[6] * w[0] + R[7] * w[1] + R[8] * w[2];
    const n = b.n, px = b.px, py = b.py, pz = b.pz, nx = b.nx, ny = b.ny, nz = b.nz, ar = b.ar;

    // ---- 空氣（每 airEvery 步重算，其餘沿用）----
    if (this.airCount-- <= 0) {
      this.airCount = water ? 20 : P.airEvery - 1;
      let fx = 0, fy = 0, fz = 0, tx = 0, ty = 0, tz = 0;
      const k = 0.5 * RHO_A * P.Ca * 3 * Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      for (let i = 0; i < n; i += 3) {
        const rx = R[0] * px[i] + R[1] * py[i] + R[2] * pz[i], ry = R[3] * px[i] + R[4] * py[i] + R[5] * pz[i], rz = R[6] * px[i] + R[7] * py[i] + R[8] * pz[i];
        if (p[2] + rz < 0) continue;
        const ux = v[0] + wy * rz - wz * ry, uy = v[1] + wz * rx - wx * rz, uz = v[2] + wx * ry - wy * rx;
        const ax = R[0] * nx[i] + R[1] * ny[i] + R[2] * nz[i], ay = R[3] * nx[i] + R[4] * ny[i] + R[5] * nz[i], az = R[6] * nx[i] + R[7] * ny[i] + R[8] * nz[i];
        const vn = ux * ax + uy * ay + uz * az;
        if (vn <= 0) continue;
        const f = -k * vn * ar[i];
        const gx = f * ax, gy = f * ay, gz = f * az;
        fx += gx; fy += gy; fz += gz;
        tx += ry * gz - rz * gy; ty += rz * gx - rx * gz; tz += rx * gy - ry * gx;
      }
      this.Fa[0] = fx; this.Fa[1] = fy; this.Fa[2] = fz; this.Ta[0] = tx; this.Ta[1] = ty; this.Ta[2] = tz;
    }
    let Fx = this.Fa[0], Fy = this.Fa[1], Fz = this.Fa[2] - b.mass * G;
    let Tx = this.Ta[0], Ty = this.Ta[1], Tz = this.Ta[2];

    // ---- 水 ----
    let wet = false;
    if (water) {
      // 動壓大小用質心速率（自轉不改變滑行壓力，只提供陀螺穩定）；v·n 用該片的實際速度
      const vc = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      const hs = P.hs, kw = 0.5 * RHO_W * P.Cw * vc, kf = 0.5 * RHO_W * P.Cf, kb = RHO_W * G;
      const R6 = R[6], R7 = R[7], R8 = R[8], pz0 = p[2];
      // 滑行壓力分布：水面沿底面堆高 zeta；u = 堆高水面下的深度 / 總浸濕深度，
      // w(u) = (2/π)√((1−u)/u)（平均 1、壓力中心在浸濕長度前 1/4）。整顆沒入水中時不套用。
      const Dm = this.depthMax, plan = P.planing && Dm > 1e-5 && this.topZ > 0.002;
      const zeta = plan ? P.pile * Dm : 0, span = zeta + Dm;
      let dmax = 0, top = -1e9, Dx = 0, Dy = 0, Dz = 0;
      for (let i = 0; i < n; i++) {
        const rz = R6 * px[i] + R7 * py[i] + R8 * pz[i];
        const z = pz0 + rz;
        if (z > top) top = z;
        if (z >= zeta + hs) continue;
        if (z < 0) { wet = true; if (-z > dmax) dmax = -z; }
        const zr = z - zeta;
        const wf = zr <= -hs ? 1 : (hs - zr) / (2 * hs);
        const rx = R[0] * px[i] + R[1] * py[i] + R[2] * pz[i], ry = R[3] * px[i] + R[4] * py[i] + R[5] * pz[i];
        const ax = R[0] * nx[i] + R[1] * ny[i] + R[2] * nz[i], ay = R[3] * nx[i] + R[4] * ny[i] + R[5] * nz[i], az = R6 * nx[i] + R7 * ny[i] + R8 * nz[i];
        const A = ar[i] * wf;
        // 靜水壓
        let pr = z < 0 ? -kb * z * A : 0;
        let gx = -pr * ax, gy = -pr * ay, gz = -pr * az;
        const ux = v[0] + wy * rz - wz * ry, uy = v[1] + wz * rx - wx * rz, uz = v[2] + wx * ry - wy * rx;
        const vn = ux * ax + uy * ay + uz * az;
        const ve = ux * ax + uy * ay + P.kz * uz * az;
        if (vn > 0 && ve > 0) {
          const sp = Math.sqrt(ux * ux + uy * uy + uz * uz);
          let f = kw * ve * A;
          if (plan) { const u = zr < 0 ? Math.min(1, -zr / span) : 0; f *= 0.6366 * Math.sqrt((1 - u) / (u + 0.03)); }
          const dx = -f * ax, dy = -f * ay, dz = -f * az;
          Fx += dx; Fy += dy; Fz += dz;
          Dx += ry * dz - rz * dy; Dy += rz * dx - rx * dz; Dz += rx * dy - ry * dx;
          const ff = kf * sp * A;
          gx -= ff * (ux - vn * ax); gy -= ff * (uy - vn * ay); gz -= ff * (uz - vn * az);
        }
        Fx += gx; Fy += gy; Fz += gz;
        Tx += ry * gz - rz * gy; Ty += rz * gx - rx * gz; Tz += rx * gy - ry * gx;
      }
      Tx += P.tq * Dx; Ty += P.tq * Dy; Tz += P.tq * Dz;
      this.depthMax = dmax; this.topZ = top;
    } else { this.depthMax = 0; this.topZ = 1; }

    // ---- 積分 ----
    const im = 1 / b.mass;
    v[0] += Fx * im * dt; v[1] += Fy * im * dt; v[2] += Fz * im * dt;
    p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
    // 角動量存在世界座標：L += τ dt（沒有力矩時角動量嚴格守恆），姿態用中點法轉
    const L = this.L;
    L[0] += Tx * dt; L[1] += Ty * dt; L[2] += Tz * dt;
    this._omega();
    const h = dt / 2, q0 = this.q;
    this.q = qstep(q0, w, h); this._rot(); this._omega();
    this.q = qstep(q0, w, dt);
    this._rot();
    this.t += dt;
    if (p[2] > this.maxHeight) this.maxHeight = p[2];
    if (!(v[0] === v[0] && p[2] === p[2] && w[0] === w[0])) { this.nan = true; this.done = true; return; }

    // ---- 入水、離水、沉沒 ----
    if (wet && !this.inWater) {
      this.inWater = true;
      if (this.pendingOut >= 0) this.pendingOut = -1;           // 離水太短，視為同一次接觸
      else { this.contactStart = this.t; this.events.push({ type: 'in', t: this.t, x: p[0], y: p[1], speed: this.speed(), vz: v[2] }); }
    } else if (!wet && this.inWater) {
      this.inWater = false;
      if (v[2] > 0) this.pendingOut = this.t;
    }
    if (this.pendingOut >= 0 && this.t - this.pendingOut >= PARAMS.minAir) {
      this.pendingOut = -1; this.skips++;
      this.lastSkipX = p[0]; this.lastSkipY = p[1];
      this.events.push({ type: 'skip', t: this.t, x: p[0], y: p[1], speed: this.speed(), n: this.skips });
    }
    if (p[2] < -PARAMS.sinkDepth || this.t > PARAMS.maxTime || (this.inWater && this.pendingOut < 0 && this.t - this.contactStart > PARAMS.maxWet)) {
      this.done = true; this.sunk = true;
      this.events.push({ type: 'sink', t: this.t, x: p[0], y: p[1], speed: this.speed() });
    }
  }
}

// 一次丟完（測試、校正用）
export function simulate(body, o) {
  const th = new Throw(body, o).run();
  return { skips: th.skips, distance: th.distance(), time: th.t, nan: th.nan, maxHeight: th.maxHeight, events: th.events };
}
