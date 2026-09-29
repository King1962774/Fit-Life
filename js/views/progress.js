/* ================= PROGRESO ================= */
import { state, persist } from "../state.js";
import { todayISO, fmtDate, qs } from "../utils.js";
import { icon } from "../icons.js";
import { render } from "../app.js";

function renderWeightChart() {
  const sorted = [...state.data.weightLogs].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length === 0) return "";
  const goal = state.data.profile.goalWeight;
  const W = 640, H = 220, padL = 36, padR = 12, padT = 14, padB = 26;
  const weights = sorted.map((l) => l.weight).concat([goal]);
  const min = Math.min(...weights) - 2, max = Math.max(...weights) + 2;
  const xStep = sorted.length > 1 ? (W - padL - padR) / (sorted.length - 1) : 0;
  const yFor = (v) => H - padB - ((v - min) / (max - min)) * (H - padT - padB);
  const xFor = (i) => padL + i * xStep;

  const points = sorted.map((l, i) => ({ x: xFor(i), y: yFor(l.weight), w: l.weight, date: l.date }));
  const linePts = points.map((p) => `${p.x},${p.y}`).join(" ");
  const goalY = yFor(goal);

  const gridLines = [];
  for (let i = 0; i <= 3; i++) {
    const y = padT + (i * (H - padT - padB)) / 3;
    gridLines.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--grid-line)" stroke-dasharray="2 4" />`);
  }

  const dots = points.map((p, i) => {
    let color = "var(--ink)";
    if (i > 0) {
      const prev = points[i - 1].w;
      const distPrev = Math.abs(prev - goal), distCur = Math.abs(p.w - goal);
      color = distCur <= distPrev ? "var(--green)" : "var(--rust)";
    }
    return `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="var(--panel)" stroke-width="1.5"><title>${fmtDate(p.date)}: ${p.w} ${state.data.profile.unit}</title></circle>`;
  }).join("");

  const labelStep = Math.max(1, Math.ceil(sorted.length / 6));
  const xLabels = points.filter((_, i) => i % labelStep === 0 || i === points.length - 1)
    .map((p) => `<text x="${p.x}" y="${H - 6}" font-size="10" fill="var(--muted)" text-anchor="middle">${fmtDate(p.date)}</text>`).join("");

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:240px" preserveAspectRatio="xMidYMid meet">
      ${gridLines.join("")}
      <line x1="${padL}" y1="${goalY}" x2="${W - padR}" y2="${goalY}" stroke="var(--gold)" stroke-dasharray="4 4" />
      <text x="${W - padR}" y="${goalY - 4}" font-size="10" fill="var(--gold-dark)" text-anchor="end">meta</text>
      <polyline points="${linePts}" fill="none" stroke="var(--ink)" stroke-width="2" />
      ${dots}
      ${xLabels}
    </svg>
    <div class="chart-legend">
      <span><span class="legend-dot" style="background:var(--green)"></span>Acercándose a la meta</span>
      <span><span class="legend-dot" style="background:var(--rust)"></span>Alejándose de la meta</span>
    </div>
  `;
}

/* Tarjeta de progreso pensada para vivir dentro del Perfil (ya no es
   una pestaña propia): el resto de datos de perfil (estatura, peso
   actual, IMC) ya se muestran en la tarjeta de "Peso, estatura y
   medidas" de profile.js, así que aquí solo va el gráfico + registro. */
export function renderProgressCard() {
  const hasData = state.data.weightLogs.length > 0;
  return `
    <div class="card" style="margin-top:16px">
      <div class="card-label-row">
        <span class="card-label-icon">${icon("trending", 13, "var(--muted-2)")}</span>
        <p class="card-label">Progreso — peso en el tiempo</p>
      </div>
      <div class="input-row">
        <input id="weight-input" type="number" class="num-input" placeholder="peso de hoy (${state.data.profile.unit})" />
        <button class="btn-primary-sm" data-action="log-weight">${icon("plus", 14)}Registrar</button>
      </div>
      <p id="weight-error" class="error-text" style="display:none"></p>
      <div style="margin-top:20px">
        ${hasData ? renderWeightChart() : `<p style="color:var(--muted);font-size:13px">Registra tu primer dato para iniciar el gráfico.</p>`}
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:18px;border-top:1px solid var(--border);padding-top:14px">
        ${icon("scale", 14, "var(--muted)")}
        <span style="font-size:13px;color:var(--muted)">Peso meta</span>
        <input id="goal-input" type="number" class="small-num-input" style="width:64px" value="${state.data.profile.goalWeight}" />
        <span style="font-size:13px;color:var(--muted)">${state.data.profile.unit}</span>
        <button class="btn-link" data-action="save-goal">Guardar</button>
      </div>
    </div>
  `;
}

export function bindProgressEvents() {
  const logBtn = qs('[data-action="log-weight"]');
  if (logBtn) logBtn.addEventListener("click", () => {
    const input = qs("#weight-input");
    const n = parseFloat(input.value);
    const errEl = qs("#weight-error");
    if (!input.value || isNaN(n) || n <= 0) { errEl.textContent = "Ingresa un peso válido"; errEl.style.display = "block"; return; }
    const iso = todayISO();
    const idx = state.data.weightLogs.findIndex((l) => l.date === iso);
    if (idx >= 0) state.data.weightLogs[idx].weight = n; else state.data.weightLogs.push({ date: iso, weight: n });
    persist();
    render();
  });
  const goalBtn = qs('[data-action="save-goal"]');
  if (goalBtn) goalBtn.addEventListener("click", () => {
    const n = parseFloat(qs("#goal-input").value);
    if (isNaN(n) || n <= 0) return;
    state.data.profile.goalWeight = n;
    persist();
    render();
  });
}
