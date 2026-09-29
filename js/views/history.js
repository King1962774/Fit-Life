/* ================= HISTORIAL ================= */
import { state } from "../state.js";
import { WEEKDAY_FULL } from "../constants.js";
import { esc, fmtDate } from "../utils.js";
import { icon } from "../icons.js";
import { exerciseById, formatSet } from "../exercises.js";

function renderPlanCompletions() {
  const completions = [...(state.data.planCompletions || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (completions.length === 0) return "";
  return `
    <p class="eyebrow" style="margin-top:22px">Cumplimiento de plan</p>
    <h2 class="page-title" style="font-size:18px">${completions.length} registro${completions.length > 1 ? "s" : ""} de plan completado</h2>
    ${completions.map((c) => `
      <div class="card" style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:8px">
            ${icon("checkcircle", 15, "var(--green)")}
            <p style="font-family:'Fraunces',serif;font-size:15px;margin:0">${WEEKDAY_FULL[c.weekday]}</p>
          </div>
          <span style="color:var(--muted);font-size:12px">${fmtDate(c.date)}</span>
        </div>
        ${c.recommendation ? `<p style="font-size:13px;color:var(--muted);margin:8px 0 0;white-space:pre-wrap">${esc(c.recommendation)}</p>` : ""}
      </div>
    `).join("")}
  `;
}

export function renderHistory() {
  const sorted = [...state.data.history].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (sorted.length === 0) {
    return `
      <p class="eyebrow">Historial</p>
      <h2 class="page-title">Aún no hay sesiones</h2>
      <p style="color:var(--muted);font-size:14px">Termina un entrenamiento guiado desde la pestaña Hoy y aparecerá aquí.</p>
      ${renderPlanCompletions()}
    `;
  }
  return `
    <p class="eyebrow">Historial</p>
    <h2 class="page-title">${sorted.length} sesión${sorted.length > 1 ? "es" : ""} registrada${sorted.length > 1 ? "s" : ""}</h2>
    ${sorted.map((session) => `
      <div class="card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between">
          <p style="font-family:'Fraunces',serif;font-size:16px;margin:0">${WEEKDAY_FULL[session.weekday]}</p>
          <span style="color:var(--muted);font-size:12px">${fmtDate(session.date)}</span>
        </div>
        <ul class="exercise-list" style="margin-top:10px">
          ${session.exercises.map((se) => `
            <li class="exercise-row">
              <span>${esc(exerciseById(se.exerciseId)?.name || "Desconocido")}</span>
              <span class="exercise-target">${se.sets.map((s) => formatSet(s)).join(", ")}</span>
            </li>
          `).join("")}
        </ul>
      </div>
    `).join("")}
    ${renderPlanCompletions()}
  `;
}
