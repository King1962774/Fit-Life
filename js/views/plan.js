/* ================= PLAN ================= */
import { state, persist } from "../state.js";
import { WEEKDAYS, WEEKDAY_FULL } from "../constants.js";
import { todayISO, esc, qs, qsa } from "../utils.js";
import { icon } from "../icons.js";
import { getAllExercises, exerciseById, defaultPlanItem, formatPlanTarget } from "../exercises.js";
import { difficultyBadgeHtml } from "./library.js";
import { getEffectiveWeekday } from "./today.js";
import { render } from "../app.js";

export function renderPlan() {
  const activeDay = state.ui.activePlanDay;
  const dayPlan = state.data.weeklyPlan[activeDay] || [];
  const recommendation = (state.data.dayRecommendations && state.data.dayRecommendations[activeDay]) || "";
  const isAdmin = state.isAdmin;
  const iso = todayISO();
  const isViewingToday = activeDay === getEffectiveWeekday();
  const completedToday = state.data.planCompletions.some((c) => c.date === iso && c.weekday === activeDay);
  const completionCount = state.data.planCompletions.filter((c) => c.weekday === activeDay).length;

  return `
    <p class="eyebrow">Plan semanal</p>
    <h2 class="page-title">${isAdmin ? "Crea la rutina por día" : "Tu rutina por día"}</h2>
    <div class="binder-tabs">
      ${WEEKDAYS.map((wd) => `<button class="binder-tab ${wd === activeDay ? "active" : ""}" data-action="set-plan-day" data-day="${wd}">${wd}</button>`).join("")}
    </div>
    <div class="card">
      <div class="plan-head-row">
        <p style="font-family:'Fraunces',serif;font-size:18px;margin:0">${WEEKDAY_FULL[activeDay]}</p>
        ${isAdmin
          ? `<button class="btn-ghost-sm" data-action="open-picker">${icon("plus", 14)}Agregar ejercicio</button>`
          : (completedToday ? `<span class="completed-badge">${icon("checkcircle", 14, "var(--green)")}Completado hoy</span>` : "")}
      </div>
      ${dayPlan.length === 0 ? `<p style="color:var(--muted);font-size:13px">Día de descanso — sin ejercicios asignados.</p>` : `
        <ul style="list-style:none;padding:0;margin:0">
          ${dayPlan.map((item, i) => {
            const ex = exerciseById(item.exerciseId);
            const unitLabel = item.unit === "reps" ? "Cantidad" : item.unit;
            return isAdmin ? `
              <li class="plan-row">
                <span style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap">${esc(ex?.name || "Desconocido")}${ex ? difficultyBadgeHtml(ex) : ""}</span>
                <input type="number" class="small-num-input" value="${item.sets}" data-action="update-sets" data-idx="${i}" />
                <span style="color:var(--muted);font-size:12px">series</span>
                <input type="number" class="small-num-input" value="${item.target}" data-action="update-target" data-idx="${i}" />
                <span style="color:var(--muted);font-size:12px">${unitLabel}</span>
                <button class="icon-btn" data-action="remove-plan-item" data-idx="${i}">${icon("trash", 14, "var(--rust)")}</button>
              </li>
            ` : `
              <li class="exercise-row">
                <span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${esc(ex?.name || "Desconocido")}${ex ? difficultyBadgeHtml(ex) : ""}</span>
                <span class="exercise-target">${formatPlanTarget(item)}</span>
              </li>
            `;
          }).join("")}
        </ul>
      `}
    </div>

    ${isAdmin ? `
      <div class="card" style="margin-top:16px">
        <p class="card-label">Recomendación del entrenador para ${WEEKDAY_FULL[activeDay]}</p>
        <textarea id="day-recommendation" class="textarea-input" rows="3" placeholder="Ej: enfócate en la técnica, sube el peso solo si completas las repeticiones limpias…">${esc(recommendation)}</textarea>
        <button class="btn-primary-sm" style="margin-top:10px" data-action="save-recommendation">${icon("check", 14)}Guardar recomendación</button>
      </div>
    ` : (recommendation ? `
      <div class="card" style="margin-top:16px;background:var(--gold-bg);border-color:var(--gold-border)">
        <p class="card-label" style="color:var(--gold-dark)">Recomendación del entrenador</p>
        <p style="font-size:14px;margin:0;white-space:pre-wrap">${esc(recommendation)}</p>
      </div>
    ` : "")}

    ${!isAdmin && dayPlan.length > 0 ? `
      <div class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <p class="card-label" style="margin-bottom:2px">Registro de cumplimiento</p>
            <p style="color:var(--muted);font-size:12px;margin:0">Completado ${completionCount} ${completionCount === 1 ? "vez" : "veces"}</p>
          </div>
          ${isViewingToday
            ? `<button class="btn-primary-sm" data-action="mark-plan-complete" ${completedToday ? "disabled" : ""}>${icon("check", 14)}${completedToday ? "Registrado hoy" : "Marcar como completado"}</button>`
            : `<span style="color:var(--muted);font-size:12px">Ve a la pestaña de hoy para registrarlo</span>`}
        </div>
      </div>
    ` : ""}

    ${state.ui.picking ? renderExercisePicker() : ""}
  `;
}

function renderExercisePicker() {
  const q = state.ui.pickerQuery || "";
  const all = getAllExercises();
  const filtered = all.filter((e) => (e.name + " " + e.muscle).toLowerCase().includes(q.toLowerCase()));
  return `
    <div class="modal-overlay" data-action="close-picker">
      <div class="modal-card" style="max-height:70vh;display:flex;flex-direction:column" onclick="event.stopPropagation()">
        <div class="modal-head-row">
          <p style="font-family:'Fraunces',serif;font-size:18px;margin:0">Agregar un ejercicio</p>
          <button class="icon-btn" data-action="close-picker">${icon("x", 16)}</button>
        </div>
        <div class="search-row" style="margin-top:12px">
          ${icon("search", 14, "var(--muted)")}
          <input id="picker-search" class="search-input" placeholder="Buscar ejercicios o grupo muscular" value="${esc(q)}" />
        </div>
        <div style="overflow-y:auto;margin-top:8px" id="picker-results">
          ${renderPickerRows(filtered)}
        </div>
      </div>
    </div>
  `;
}

function renderPickerRows(filtered) {
  return filtered.map((e) => `<button class="pick-row" data-action="pick-exercise" data-id="${e.id}"><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${esc(e.name)}${difficultyBadgeHtml(e)}</span><span style="color:var(--muted);font-size:12px">${e.muscle}</span></button>`).join("")
    + (filtered.length === 0 ? `<p style="color:var(--muted);font-size:13px;padding:8px 0">Sin coincidencias.</p>` : "");
}

export function bindPlanEvents() {
  qsa('[data-action="set-plan-day"]').forEach((b) => b.addEventListener("click", () => { state.ui.activePlanDay = b.dataset.day; render(); }));
  const openPicker = qs('[data-action="open-picker"]');
  if (openPicker) openPicker.addEventListener("click", () => { state.ui.picking = true; state.ui.pickerQuery = ""; render(); });
  qsa('[data-action="close-picker"]').forEach((b) => b.addEventListener("click", () => { state.ui.picking = false; render(); }));

  qsa('[data-action="update-sets"]').forEach((inp) => inp.addEventListener("change", () => {
    const n = parseInt(inp.value, 10);
    if (isNaN(n) || n <= 0) return;
    state.data.weeklyPlan[state.ui.activePlanDay][inp.dataset.idx].sets = n;
    persist();
  }));
  qsa('[data-action="update-target"]').forEach((inp) => inp.addEventListener("change", () => {
    const n = parseFloat(inp.value);
    if (isNaN(n) || n <= 0) return;
    state.data.weeklyPlan[state.ui.activePlanDay][inp.dataset.idx].target = n;
    persist();
  }));
  qsa('[data-action="remove-plan-item"]').forEach((b) => b.addEventListener("click", () => {
    state.data.weeklyPlan[state.ui.activePlanDay].splice(parseInt(b.dataset.idx, 10), 1);
    persist();
    render();
  }));

  const saveRecBtn = qs('[data-action="save-recommendation"]');
  if (saveRecBtn) saveRecBtn.addEventListener("click", () => {
    const text = qs("#day-recommendation").value;
    state.data.dayRecommendations[state.ui.activePlanDay] = text;
    persist();
    render();
  });

  const markCompleteBtn = qs('[data-action="mark-plan-complete"]');
  if (markCompleteBtn) markCompleteBtn.addEventListener("click", () => {
    const day = state.ui.activePlanDay;
    const iso = todayISO();
    const already = state.data.planCompletions.some((c) => c.date === iso && c.weekday === day);
    if (!already) {
      state.data.planCompletions.push({
        date: iso,
        weekday: day,
        recommendation: (state.data.dayRecommendations && state.data.dayRecommendations[day]) || "",
      });
      persist();
      render();
    }
  });

  if (state.ui.picking) {
    const searchInput = qs("#picker-search");
    if (searchInput) {
      searchInput.focus();
      searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
      searchInput.addEventListener("input", () => {
        state.ui.pickerQuery = searchInput.value;
        const q = searchInput.value.toLowerCase();
        const results = qs("#picker-results");
        const all = getAllExercises();
        const filtered = all.filter((e) => (e.name + " " + e.muscle).toLowerCase().includes(q));
        results.innerHTML = renderPickerRows(filtered);
        bindPickRows();
      });
    }
    bindPickRows();
  }
}

function bindPickRows() {
  qsa('[data-action="pick-exercise"]').forEach((b) => b.addEventListener("click", () => {
    const ex = exerciseById(b.dataset.id);
    state.data.weeklyPlan[state.ui.activePlanDay].push(defaultPlanItem(ex));
    persist();
    state.ui.picking = false;
    render();
  }));
}
