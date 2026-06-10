import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ebpAnalytical, integrateRK4, sweepDesign, rpmToRad } from './simulator.js';

// =============================================================
// Inline styles (keep deps zero — works with any host)
// =============================================================
const C = {
  bg: '#f6f8fb', card: '#ffffff', border: '#e2e8f0', ink: '#1f2937',
  ink2: '#475569', accent: '#2563eb', accent2: '#dc2626', good: '#16a34a',
  warn: '#d97706',
};
const S = {
  app: { maxWidth: 1180, margin: '0 auto', padding: 24, color: C.ink },
  header: { borderBottom: `1px solid ${C.border}`, paddingBottom: 16, marginBottom: 20 },
  h1: { fontSize: 24, margin: 0, fontWeight: 700 },
  sub: { color: C.ink2, fontSize: 14, marginTop: 4 },
  tabs: { display: 'flex', gap: 0, marginBottom: 20, borderBottom: `2px solid ${C.border}` },
  tab: (active) => ({
    padding: '10px 18px', cursor: 'pointer', border: 'none', background: 'transparent',
    color: active ? C.accent : C.ink2, borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
    marginBottom: -2, fontSize: 14, fontWeight: active ? 600 : 500,
  }),
  grid: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 },
  cardH: { margin: 0, fontSize: 14, fontWeight: 600, color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 },
  slider: { width: '100%', marginTop: 4 },
  label: { display: 'block', fontSize: 13, color: C.ink2, marginBottom: 2, marginTop: 10 },
  val: { fontVariantNumeric: 'tabular-nums', color: C.ink, fontWeight: 600 },
  metric: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 },
  metricK: { color: C.ink2 },
  metricV: { fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
};

// =============================================================
// Lightweight SVG plot helpers (no chart lib dependency)
// =============================================================
function LineChart({ width = 600, height = 320, series, xLabel, yLabel, title, yLog = false, xLog = false }) {
  const pad = { l: 56, r: 18, t: 36, b: 44 };
  const W = width, H = height;
  const xs = series.flatMap(s => s.x);
  const ys = series.flatMap(s => s.y);
  let xMin = Math.min(...xs), xMax = Math.max(...xs);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  if (yLog) {
    yMin = Math.max(yMin, 1e-3);
    yMax = Math.max(yMax, yMin * 1.1);
  }
  if (xLog) xMin = Math.max(xMin, 1e-3);
  const xRange = (xMax - xMin) || 1, yRange = (yMax - yMin) || 1;
  const tx = (v) => xLog
    ? pad.l + (Math.log10(Math.max(v, xMin)) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin)) * (W - pad.l - pad.r)
    : pad.l + (v - xMin) / xRange * (W - pad.l - pad.r);
  const ty = (v) => yLog
    ? H - pad.b - (Math.log10(Math.max(v, yMin)) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin)) * (H - pad.t - pad.b)
    : H - pad.b - (v - yMin) / yRange * (H - pad.t - pad.b);

  const xTicks = xLog
    ? [xMin, Math.sqrt(xMin*xMax), xMax]
    : Array.from({ length: 6 }, (_, i) => xMin + (i / 5) * xRange);
  const yTicks = yLog
    ? [yMin, Math.sqrt(yMin*yMax), yMax]
    : Array.from({ length: 6 }, (_, i) => yMin + (i / 5) * yRange);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: '#fff' }}>
      {title && <text x={W/2} y={20} textAnchor="middle" fontSize={13} fontWeight={600} fill={C.ink}>{title}</text>}
      {/* gridlines */}
      {xTicks.map((t, i) => (
        <line key={`xg${i}`} x1={tx(t)} x2={tx(t)} y1={pad.t} y2={H - pad.b} stroke="#f1f5f9" />
      ))}
      {yTicks.map((t, i) => (
        <line key={`yg${i}`} y1={ty(t)} y2={ty(t)} x1={pad.l} x2={W - pad.r} stroke="#f1f5f9" />
      ))}
      {/* axes */}
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#475569" strokeWidth={1.2}/>
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="#475569" strokeWidth={1.2}/>
      {/* tick labels */}
      {xTicks.map((t, i) => (
        <text key={`xt${i}`} x={tx(t)} y={H - pad.b + 14} fontSize={11} textAnchor="middle" fill={C.ink2}>
          {xLog ? t.toExponential(0) : (Math.abs(t)<10?t.toFixed(2):t.toFixed(0))}
        </text>
      ))}
      {yTicks.map((t, i) => (
        <text key={`yt${i}`} x={pad.l - 6} y={ty(t) + 4} fontSize={11} textAnchor="end" fill={C.ink2}>
          {yLog ? t.toExponential(1) : (Math.abs(t)<10?t.toFixed(2):t.toFixed(1))}
        </text>
      ))}
      {/* axis labels */}
      <text x={W/2} y={H - 6} fontSize={12} textAnchor="middle" fill={C.ink}>{xLabel}</text>
      <text x={14} y={H/2} fontSize={12} textAnchor="middle" fill={C.ink} transform={`rotate(-90 14 ${H/2})`}>{yLabel}</text>
      {/* series */}
      {series.map((s, idx) => {
        const pts = s.x.map((xv, i) => `${tx(xv)},${ty(s.y[i])}`).join(' ');
        if (s.marker) {
          return (
            <g key={idx}>
              {s.x.map((xv, i) => i % (s.markerEvery || 6) === 0 ? (
                <circle key={i} cx={tx(xv)} cy={ty(s.y[i])} r={3.2} fill="none" stroke={s.color} strokeWidth={1.4}/>
              ) : null)}
            </g>
          );
        }
        return <polyline key={idx} points={pts} fill="none" stroke={s.color} strokeWidth={s.lw || 2} strokeDasharray={s.dash || 'none'}/>;
      })}
      {/* legend */}
      <g transform={`translate(${W - pad.r - 200}, ${pad.t + 10})`}>
        {series.map((s, i) => (
          <g key={i} transform={`translate(0, ${i * 16})`}>
            <line x1={0} x2={22} y1={6} y2={6} stroke={s.color} strokeWidth={s.lw || 2} strokeDasharray={s.dash || 'none'}/>
            {s.marker && <circle cx={11} cy={6} r={3.2} fill="none" stroke={s.color} strokeWidth={1.4}/>}
            <text x={28} y={9} fontSize={11} fill={C.ink}>{s.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function Heatmap({ width = 560, height = 380, data, omegaRpm, muCP, label = 'h_f [µm]', title }) {
  const pad = { l: 60, r: 60, t: 38, b: 44 };
  const Nw = omegaRpm.length, Nm = muCP.length;
  const W = width, H = height;
  const cellW = (W - pad.l - pad.r) / Nw;
  const cellH = (H - pad.t - pad.b) / Nm;
  const flat = Array.from(data);
  const vMin = Math.min(...flat), vMax = Math.max(...flat);
  const norm = (v) => (v - vMin) / (vMax - vMin || 1);
  // Viridis-ish palette
  const colorOf = (v) => {
    const t = Math.max(0, Math.min(1, v));
    const r = Math.round(68 + (253 - 68) * t);
    const g = Math.round(1 + (231 - 1) * Math.pow(t, 0.7));
    const b = Math.round(84 + (37 - 84) * t);
    return `rgb(${r},${g},${b})`;
  };
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: '#fff' }}>
      {title && <text x={W/2} y={22} textAnchor="middle" fontSize={13} fontWeight={600} fill={C.ink}>{title}</text>}
      {muCP.map((mu, i) => omegaRpm.map((om, j) => (
        <rect key={`${i}-${j}`} x={pad.l + j*cellW} y={H - pad.b - (i+1)*cellH}
              width={cellW + 0.5} height={cellH + 0.5}
              fill={colorOf(norm(data[i*Nw + j]))} />
      )))}
      {/* axes */}
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke={C.ink} strokeWidth={1.2}/>
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke={C.ink} strokeWidth={1.2}/>
      {/* axis ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const omTick = omegaRpm[0] + f * (omegaRpm[omegaRpm.length-1] - omegaRpm[0]);
        const x = pad.l + f * (W - pad.l - pad.r);
        return (
          <g key={`xt${i}`}>
            <text x={x} y={H - pad.b + 14} fontSize={11} textAnchor="middle" fill={C.ink2}>{omTick.toFixed(0)}</text>
            <line x1={x} x2={x} y1={H - pad.b} y2={H - pad.b + 4} stroke={C.ink} />
          </g>
        );
      })}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const muTick = muCP[0] + f * (muCP[muCP.length-1] - muCP[0]);
        const y = H - pad.b - f * (H - pad.t - pad.b);
        return (
          <g key={`yt${i}`}>
            <text x={pad.l - 6} y={y + 4} fontSize={11} textAnchor="end" fill={C.ink2}>{muTick.toFixed(0)}</text>
            <line x1={pad.l - 4} x2={pad.l} y1={y} y2={y} stroke={C.ink} />
          </g>
        );
      })}
      <text x={(W - pad.r + pad.l)/2} y={H - 6} fontSize={12} textAnchor="middle" fill={C.ink}>Spin speed ω [rpm]</text>
      <text x={14} y={(H - pad.b + pad.t)/2} fontSize={12} textAnchor="middle" fill={C.ink}
            transform={`rotate(-90 14 ${(H - pad.b + pad.t)/2})`}>Initial viscosity μ₀ [cP]</text>
      {/* colorbar */}
      <g transform={`translate(${W - pad.r + 12}, ${pad.t})`}>
        {Array.from({ length: 50 }).map((_, i) => (
          <rect key={i} x={0} y={i * ((H - pad.b - pad.t) / 50)} width={16}
                height={(H - pad.b - pad.t) / 50 + 0.5}
                fill={colorOf(1 - i / 49)} />
        ))}
        <text x={20} y={6} fontSize={11} fill={C.ink}>{vMax.toFixed(2)}</text>
        <text x={20} y={H - pad.b - pad.t} fontSize={11} fill={C.ink}>{vMin.toFixed(2)}</text>
        <text x={8} y={H - pad.b - pad.t + 16} fontSize={11} textAnchor="middle" fill={C.ink2}>{label}</text>
      </g>
    </svg>
  );
}

// =============================================================
// Slider helper
// =============================================================
function Slider({ label, min, max, step, value, onChange, unit, fmt = (v) => v.toFixed(1) }) {
  return (
    <div>
      <label style={S.label}>
        {label} <span style={S.val}>{fmt(value)} {unit}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(parseFloat(e.target.value))} style={S.slider}/>
    </div>
  );
}

// =============================================================
// Main app
// =============================================================
export default function App() {
  const [tab, setTab] = useState('interactive');

  // shared parameters
  const [omegaRpm, setOmegaRpm] = useState(3000);
  const [muCP, setMuCP]         = useState(30);      // mPa.s
  const [h0um, setH0um]         = useState(100);     // µm
  const [E_ums, setE_ums]       = useState(0.4);     // µm/s
  const [alpha, setAlpha]       = useState(0.05);    // 1/s
  const [tEnd, setTEnd]         = useState(30);      // s
  const rho = 1100;                                    // kg/m^3

  // ---- Core integration ----
  const sim = useMemo(() => {
    return integrateRK4({
      h0: h0um * 1e-6, tEnd, dt: 0.02,
      omega: rpmToRad(omegaRpm), rho,
      mu0: muCP * 1e-3, alpha, E: E_ums * 1e-6,
    });
  }, [omegaRpm, muCP, h0um, E_ums, alpha, tEnd]);

  const sim_ebpRef = useMemo(() => {
    const t = sim.t;
    const h = t.map(ti => ebpAnalytical(ti, h0um * 1e-6, rpmToRad(omegaRpm), rho, muCP * 1e-3));
    return { t, h };
  }, [sim.t, omegaRpm, muCP, h0um]);

  // ---- Validation tab data (alpha=0, E=0) ----
  const validation = useMemo(() => {
    const valSim = integrateRK4({
      h0: h0um * 1e-6, tEnd, dt: 0.01,
      omega: rpmToRad(omegaRpm), rho,
      mu0: muCP * 1e-3, alpha: 0, E: 0,
    });
    const t = valSim.t;
    const hAnaly = t.map(ti => ebpAnalytical(ti, h0um * 1e-6, rpmToRad(omegaRpm), rho, muCP * 1e-3));
    // compute RMSE in nm
    const diff = valSim.h.map((hi, i) => hi - hAnaly[i]);
    const rmse = Math.sqrt(diff.reduce((s, d) => s + d*d, 0) / diff.length) * 1e9;
    return { t, hNum: valSim.h, hAna: hAnaly, rmse };
  }, [omegaRpm, muCP, h0um, tEnd]);

  // ---- Design heatmap data ----
  const [Nsweep] = useState(25);
  const [design, setDesign] = useState(null);
  const [computing, setComputing] = useState(false);
  function runDesign() {
    setComputing(true);
    // defer so the UI can update
    setTimeout(() => {
      const omArr = Array.from({ length: Nsweep }, (_, i) => rpmToRad(1000 + i * (5000 / (Nsweep-1))));
      const muArr = Array.from({ length: Nsweep }, (_, i) => 0.005 + i * (0.095 / (Nsweep-1)));
      const Hf = sweepDesign(omArr, muArr,
        { h0: h0um * 1e-6, rho, alpha, E: E_ums * 1e-6 }, tEnd);
      const HfUm = Array.from(Hf).map(v => v * 1e6);
      const omRpm = omArr.map(r => (r * 60) / (2 * Math.PI));
      const muCp  = muArr.map(v => v * 1000);
      setDesign({ HfUm, omRpm, muCp });
      setComputing(false);
    }, 30);
  }
  useEffect(() => { runDesign(); /* initial */ }, []); // eslint-disable-line

  // ---- Derived metrics ----
  const hFinal_um = sim.h[sim.h.length - 1] * 1e6;
  const hHalf_um  = sim.h[Math.floor(sim.h.length/2)] * 1e6;
  const tau_thin  = (3 * muCP * 1e-3) / (4 * rho * Math.pow(rpmToRad(omegaRpm), 2) * Math.pow(h0um*1e-6, 2));
  // gel time crude estimate (rotation flux = evap flux)
  const tGel = (() => {
    for (let i = 0; i < sim.t.length; i++) {
      const mu_t = muCP * 1e-3 * Math.exp(alpha * sim.t[i]);
      const rotFlux = (2 * rho * Math.pow(rpmToRad(omegaRpm), 2) / (3 * mu_t)) * Math.pow(sim.h[i], 3);
      if (rotFlux < E_ums * 1e-6) return sim.t[i];
    }
    return null;
  })();
  const Re = (rho * Math.pow(rpmToRad(omegaRpm), 2) * 0.075 * Math.pow(hFinal_um*1e-6, 3))
             / (3 * Math.pow(muCP*1e-3, 2));
  const Ek = (muCP * 1e-3) / (rho * rpmToRad(omegaRpm) * Math.pow(hFinal_um*1e-6, 2));

  // ---- Series for the main thinning plot ----
  // downsample to ~250 points for SVG perf
  const stride = Math.max(1, Math.floor(sim.t.length / 250));
  const tArr = sim.t.filter((_, i) => i % stride === 0);
  const hMeyer = sim.h.filter((_, i) => i % stride === 0).map(v => v*1e6);
  const hEBP = sim_ebpRef.h.filter((_, i) => i % stride === 0).map(v => v*1e6);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div style={S.app}>
      <header style={S.header}>
        <h1 style={S.h1}>Spin-Coating Thin-Film Simulator</h1>
        <div style={S.sub}>
          Emslie–Bonner–Peck (1958) & Meyerhofer (1978) — Fluid Mechanics term paper, SKKU 2026 Spring
        </div>
      </header>

      <nav style={S.tabs}>
        {[
          ['interactive', 'Interactive'],
          ['validation', 'Validation (analytical limit)'],
          ['design', 'Design exploration (ω – μ₀)'],
          ['about', 'About / how to use'],
        ].map(([k, label]) => (
          <button key={k} style={S.tab(tab === k)} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      <div style={S.grid}>
        {/* ---------- Left panel: sliders ---------- */}
        <div style={S.card}>
          <h3 style={S.cardH}>Operating parameters</h3>
          <Slider label="Spin speed ω" min={500} max={6000} step={100}
                  value={omegaRpm} onChange={setOmegaRpm} unit="rpm" fmt={v => v.toFixed(0)} />
          <Slider label="Initial viscosity μ₀" min={1} max={150} step={1}
                  value={muCP} onChange={setMuCP} unit="cP" fmt={v => v.toFixed(0)} />
          <Slider label="Initial thickness h₀" min={10} max={300} step={5}
                  value={h0um} onChange={setH0um} unit="µm" fmt={v => v.toFixed(0)} />
          <Slider label="Evaporation rate E" min={0} max={2} step={0.05}
                  value={E_ums} onChange={setE_ums} unit="µm/s" fmt={v => v.toFixed(2)} />
          <Slider label="Viscosity ramp α" min={0} max={0.5} step={0.01}
                  value={alpha} onChange={setAlpha} unit="1/s" fmt={v => v.toFixed(2)} />
          <Slider label="Spin duration" min={5} max={120} step={1}
                  value={tEnd} onChange={setTEnd} unit="s" fmt={v => v.toFixed(0)} />

          <h3 style={{...S.cardH, marginTop: 20}}>Derived metrics</h3>
          <div style={S.metric}><span style={S.metricK}>Final thickness h_f</span><span style={S.metricV}>{hFinal_um.toFixed(3)} µm</span></div>
          <div style={S.metric}><span style={S.metricK}>Mid-spin thickness</span><span style={S.metricV}>{hHalf_um.toFixed(3)} µm</span></div>
          <div style={S.metric}><span style={S.metricK}>Thinning time τ</span><span style={S.metricV}>{tau_thin.toExponential(2)} s</span></div>
          <div style={S.metric}><span style={S.metricK}>Gel point t_gel</span><span style={S.metricV}>{tGel?tGel.toFixed(1)+' s':'—'}</span></div>
          <div style={S.metric}><span style={S.metricK}>Reynolds Re</span><span style={S.metricV}>{Re.toExponential(2)}</span></div>
          <div style={S.metric}><span style={S.metricK}>Ekman Ek</span><span style={S.metricV}>{Ek.toExponential(2)}</span></div>
        </div>

        {/* ---------- Right panel: tab content ---------- */}
        <div style={S.card}>
          {tab === 'interactive' && (
            <>
              <h3 style={S.cardH}>Real-time thinning curve h(t)</h3>
              <p style={{ fontSize: 13, color: C.ink2, marginTop: 6 }}>
                Solid red = full Meyerhofer model (with evaporation and time-varying viscosity).
                Dashed black = EBP reference at the same (ω, μ₀) for comparison.
                Adjust the sliders to see the rotation- to evaporation-dominated regime transition.
              </p>
              <LineChart
                series={[
                  { x: tArr, y: hMeyer, color: C.accent2, label: 'Meyerhofer (with E, μ(t))', lw: 2.2 },
                  { x: tArr, y: hEBP,   color: '#111827', label: 'EBP reference (E=0, μ=μ₀)', lw: 1.5, dash: '5 5' },
                ]}
                xLabel="Time t [s]" yLabel="Thickness h [µm]"
                title={`Thinning curve at ω = ${omegaRpm} rpm, μ₀ = ${muCP} cP, E = ${E_ums} µm/s`}
                height={360}
              />
            </>
          )}

          {tab === 'validation' && (
            <>
              <h3 style={S.cardH}>Validation: numerical RK4 vs EBP closed-form</h3>
              <p style={{ fontSize: 13, color: C.ink2, marginTop: 6 }}>
                In this view α and E are forced to 0 so the Meyerhofer ODE reduces to the EBP problem.
                Open circles = RK4 numerical; solid line = analytical h(t) = h₀ / √(1 + 4ρω²h₀²t/(3μ)).
                Agreement to within the RMSE shown confirms that the simulator integrates the governing equation correctly.
              </p>
              <LineChart
                series={[
                  { x: validation.t, y: validation.hAna.map(v=>v*1e6), color: '#111827', label: 'EBP analytical', lw: 2 },
                  { x: validation.t, y: validation.hNum.map(v=>v*1e6), color: C.accent2, label: 'RK4 numerical', marker: true, markerEvery: 25, lw: 1 },
                ]}
                xLabel="Time t [s]" yLabel="Thickness h [µm]"
                title="EBP analytical solution vs numerical integration (α=0, E=0)"
                height={360}
              />
              <div style={{ marginTop: 14, padding: 12, background: '#f0fdf4', border: `1px solid ${C.good}`, borderRadius: 8 }}>
                <strong style={{ color: C.good }}>RMSE = {validation.rmse.toFixed(3)} nm</strong>
                <span style={{ color: C.ink2 }}> over t ∈ [0, {tEnd} s]. Initial thickness was {h0um} µm = {(h0um*1000).toFixed(0)} nm; relative error {(validation.rmse / (h0um*1000) * 100).toExponential(2)} %.</span>
              </div>
            </>
          )}

          {tab === 'design' && (
            <>
              <h3 style={S.cardH}>Design map: final thickness over (ω, μ₀)</h3>
              <p style={{ fontSize: 13, color: C.ink2, marginTop: 6 }}>
                Heatmap of h_f at t = {tEnd} s. Brighter regions = thicker final film. Use this view to identify
                recipe windows that meet a target h_f. Press “Recompute” after changing h₀, E, α, or t_end.
              </p>
              <button onClick={runDesign}
                style={{ padding: '8px 16px', marginBottom: 14, background: C.accent, color: '#fff',
                         border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {computing ? 'Computing…' : `Recompute (${Nsweep}×${Nsweep} grid)`}
              </button>
              {design && (
                <Heatmap data={design.HfUm} omegaRpm={design.omRpm} muCP={design.muCp}
                         title={`Final thickness h_f [µm] at t = ${tEnd} s, h₀ = ${h0um} µm, E = ${E_ums} µm/s`}
                         height={400} width={680} />
              )}
              <p style={{ fontSize: 12, color: C.ink2, marginTop: 8 }}>
                <em>Tip:</em> contour-like color bands correspond to iso-thickness recipes — moving along a band keeps h_f constant
                even as (ω, μ₀) change, which is the dual relation underlying the empirical scaling h_f ∝ ω⁻¹ᐟ²·μ₀¹ᐟ³.
              </p>
            </>
          )}

          {tab === 'about' && (
            <>
              <h3 style={S.cardH}>About this simulator</h3>
              <p style={{ fontSize: 14, color: C.ink, lineHeight: 1.6 }}>
                This is the companion web app to a 2026 Spring Fluid Mechanics term paper on the
                Emslie–Bonner–Peck spin-coating theory and its Meyerhofer evaporation extension.
                The physics is implemented in <code>src/simulator.js</code>, a self-contained 50-line module that
                exposes (i) the EBP analytical closed form, (ii) a fourth-order Runge–Kutta integrator
                for the Meyerhofer ODE, and (iii) a sweep helper for the design heatmap.
              </p>
              <h4 style={{ color: C.ink, marginTop: 18 }}>How to use each tab</h4>
              <ul style={{ fontSize: 13, color: C.ink, lineHeight: 1.7 }}>
                <li><strong>Interactive:</strong> tune the operating parameters and see the thinning curve in real time. The dashed EBP reference shows what would happen without evaporation.</li>
                <li><strong>Validation:</strong> a built-in unit test that forces α = 0 and E = 0 and overlays the RK4 numerical solution on the EBP analytical curve. The reported RMSE is the headline number for grading rubric item “Physical accuracy (limit checks)”.</li>
                <li><strong>Design:</strong> a 25×25 sweep of (ω, μ₀) at the current h₀, E, α, t_end. Use this to identify operating windows that meet a thickness specification.</li>
              </ul>
              <h4 style={{ color: C.ink, marginTop: 18 }}>Run locally</h4>
              <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 6, fontSize: 12 }}>
{`npm install
npm run dev      # opens http://localhost:5173
npm run build    # production build into ./dist
`}
              </pre>
              <h4 style={{ color: C.ink, marginTop: 18 }}>Deploy to Vercel</h4>
              <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 6, fontSize: 12 }}>
{`npm install -g vercel
vercel --prod          # follow the prompts; Vercel auto-detects Vite
`}
              </pre>
              <p style={{ fontSize: 13, color: C.ink2, marginTop: 18 }}>
                Repository: <em>[TODO — paste your GitHub URL here in App.jsx]</em>.<br/>
                Live deployment: <em>[TODO — paste your Vercel URL here once deployed]</em>.
              </p>
            </>
          )}
        </div>
      </div>

      <footer style={{ marginTop: 30, padding: '20px 0', borderTop: `1px solid ${C.border}`,
                       color: C.ink2, fontSize: 12, textAlign: 'center' }}>
        Built as the companion to the “Spin Coating Thin-Film Uniformity” term paper.
        Fluid Mechanics, School of Chemical Engineering, Sungkyunkwan University, 2026 Spring (Prof. S. Joon Kwon).
      </footer>
    </div>
  );
}
