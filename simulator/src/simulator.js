// =============================================================
// Spin-Coating Physics — Emslie-Bonner-Peck (EBP, 1958) and
// Meyerhofer (1978) extension with solvent evaporation.
// =============================================================

/**
 * EBP analytical thickness for constant viscosity, no evaporation.
 *   h(t) = h0 / sqrt(1 + 4*rho*omega^2*h0^2*t / (3*mu))
 *
 * @param {number} t      time [s]
 * @param {number} h0     initial film thickness [m]
 * @param {number} omega  angular velocity [rad/s]
 * @param {number} rho    density [kg/m^3]
 * @param {number} mu     viscosity [Pa.s]
 */
export function ebpAnalytical(t, h0, omega, rho, mu) {
  return h0 / Math.sqrt(1.0 + (4.0 * rho * omega * omega * h0 * h0 * t) / (3.0 * mu));
}

/**
 * Meyerhofer ODE right-hand side:
 *   dh/dt = -(2*rho*omega^2 / (3*mu(t))) * h^3 - E
 *   mu(t) = mu0 * exp(alpha * t)
 */
export function rhs(h, t, params) {
  const { omega, rho, mu0, alpha, E } = params;
  const mu = mu0 * Math.exp(alpha * t);
  return -((2.0 * rho * omega * omega) / (3.0 * mu)) * h * h * h - E;
}

/**
 * Integrate the Meyerhofer ODE with fixed-step RK4.
 *
 * @param {object} opts  {h0, tEnd, dt, omega, rho, mu0, alpha, E}
 * @returns {{t:number[], h:number[]}}
 */
export function integrateRK4(opts) {
  const { h0, tEnd, dt } = opts;
  const params = { omega: opts.omega, rho: opts.rho, mu0: opts.mu0, alpha: opts.alpha, E: opts.E };
  const n = Math.max(2, Math.floor(tEnd / dt) + 1);
  const t = new Array(n);
  const h = new Array(n);
  t[0] = 0;
  h[0] = h0;
  for (let i = 0; i < n - 1; i++) {
    const ti = t[i];
    const hi = Math.max(h[i], 1e-12);
    const k1 = rhs(hi, ti, params);
    const k2 = rhs(hi + 0.5 * dt * k1, ti + 0.5 * dt, params);
    const k3 = rhs(hi + 0.5 * dt * k2, ti + 0.5 * dt, params);
    const k4 = rhs(hi + dt * k3, ti + dt, params);
    h[i + 1] = Math.max(hi + (dt / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4), 1e-12);
    t[i + 1] = ti + dt;
  }
  return { t, h };
}

/**
 * Final-thickness sweep over (omega, mu0) for the design map.
 * Returns a Float64Array of shape (Neta * Nomega) flattened row-major.
 */
export function sweepDesign(omegaArr, muArr, base, tFinal = 30) {
  const Nw = omegaArr.length;
  const Nm = muArr.length;
  const Hf = new Float64Array(Nw * Nm);
  for (let i = 0; i < Nm; i++) {
    for (let j = 0; j < Nw; j++) {
      const { h } = integrateRK4({
        h0: base.h0, tEnd: tFinal, dt: 0.05,
        omega: omegaArr[j], rho: base.rho,
        mu0: muArr[i], alpha: base.alpha, E: base.E,
      });
      Hf[i * Nw + j] = h[h.length - 1];
    }
  }
  return Hf;
}

// =============================================================
// Unit helpers
// =============================================================
export const rpmToRad = (rpm) => (rpm * 2 * Math.PI) / 60.0;
export const radToRpm = (r) => (r * 60.0) / (2 * Math.PI);
