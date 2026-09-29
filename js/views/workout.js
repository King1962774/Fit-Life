/* ================= ENTRENAMIENTO GUIADO ================= */
import { state, persist } from "../state.js";
import { EXERCISE_TYPES } from "../constants.js";
import { todayISO, esc, qs, fmtDuration } from "../utils.js";
import { icon } from "../icons.js";
import { exerciseById, isTimeBased, buildSet, formatPlanTarget } from "../exercises.js";
import { difficultyBadgeHtml } from "./library.js";
import { render } from "../app.js";

export function startWorkout(weekday) {
  const plan = state.data.weeklyPlan[weekday] || [];
  const sorted = [...state.data.weightLogs].sort((a, b) => (a.date < b.date ? 1 : -1));
  state.ui.workout = {
    weekday, plan,
    step: "bodyweight",
    exIndex: 0,
    sessionLogs: plan.map(() => []),
    bodyWeight: sorted.length ? String(sorted[0].weight) : "",
    restLeft: 0,
  };
  render();
}

/* Mejor marca previa, adaptada al tipo del ejercicio:
   - reps: el set con mayor peso levantado
   - time: el set con mayor duración sostenida */
function findPreviousBest(exerciseId) {
  let best = null;
  state.data.history.forEach((session) => {
    session.exercises.forEach((se) => {
      if (se.exerciseId !== exerciseId) return;
      se.sets.forEach((s) => {
        if (s.type === EXERCISE_TYPES.TIME) {
          if (!best || (s.durationSec || 0) > (best.durationSec || 0)) best = s;
        } else if (!best || (s.weight || 0) > (best.weight || 0)) {
          best = s;
        }
      });
    });
  });
  return best;
}

function isNewPR(set, prevBest) {
  if (!prevBest) return false;
  if (set.type === EXERCISE_TYPES.TIME) return (set.durationSec || 0) > (prevBest.durationSec || 0);
  return (set.weight || 0) > (prevBest.weight || 0);
}

function computeSessionPRs(w) {
  const found = [];
  w.plan.forEach((item, i) => {
    const ex = exerciseById(item.exerciseId);
    const sets = w.sessionLogs[i] || [];
    if (!ex || !sets.length) return;
    const prevBest = findPreviousBestExcludingToday(item.exerciseId);
    const best = isTimeBased(ex)
      ? sets.reduce((a, s) => (s.durationSec > (a?.durationSec || 0) ? s : a), null)
      : sets.reduce((a, s) => (s.weight > (a?.weight || 0) ? s : a), null);
    if (best && isNewPR(best, prevBest)) found.push({ exerciseId: item.exerciseId, set: best });
  });
  return found;
}

// Al calcular PRs del resumen, la sesión de hoy ya fue guardada en el
// historial por finishWorkout(), así que buscamos la mejor marca previa
// a esta sesión en lugar de reusar findPreviousBest (que la incluiría).
function findPreviousBestExcludingToday(exerciseId) {
  let best = null;
  state.data.history.forEach((session) => {
    if (session.date === todayISO()) return;
    session.exercises.forEach((se) => {
      if (se.exerciseId !== exerciseId) return;
      se.sets.forEach((s) => {
        if (s.type === EXERCISE_TYPES.TIME) {
          if (!best || (s.durationSec || 0) > (best.durationSec || 0)) best = s;
        } else if (!best || (s.weight || 0) > (best.weight || 0)) {
          best = s;
        }
      });
    });
  });
  return best;
}

export function renderGuidedWorkout() {
  const w = state.ui.workout;
  const err = state.ui.formError;

  if (w.step === "bodyweight") {
    return `
      <div class="card">
        <p class="card-label">Antes de empezar</p>
        <h3 style="font-family:'Fraunces',serif;font-size:20px;margin:4px 0 12px">¿Cuál es tu peso corporal hoy?</h3>
        <div class="input-row">
          <input id="bw-input" type="number" class="num-input" placeholder="${state.data.profile.unit}" value="${esc(w.bodyWeight)}" />
          <span style="color:var(--muted);font-size:14px">${state.data.profile.unit}</span>
        </div>
        ${err ? `<p class="error-text">${esc(err)}</p>` : ""}
        <div style="display:flex;gap:10px;margin-top:14px">
          <button class="btn-ghost" data-action="exit-workout">Cancelar</button>
          <button class="btn-primary" data-action="continue-bodyweight">Continuar</button>
        </div>
      </div>
    `;
  }

  if (w.step === "summary") {
    const prs = computeSessionPRs(w);
    return `
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px">
          ${icon("checkcircle", 22, "var(--green)")}
          <h3 style="font-family:'Fraunces',serif;font-size:20px;margin:0">Entrenamiento registrado</h3>
        </div>
        ${prs.length ? `
          <div class="pr-box">
            ${icon("trophy", 16, "var(--gold-dark)")}
            <span style="font-size:13px;margin-left:8px">${prs.length} récord${prs.length > 1 ? "s" : ""} nuevo${prs.length > 1 ? "s" : ""}: ${prs.map((p) => esc(exerciseById(p.exerciseId)?.name || "")).join(", ")}</span>
          </div>
        ` : ""}
        <ul class="exercise-list" style="margin-top:14px">
          ${w.plan.map((item, i) => {
            const sets = w.sessionLogs[i] || [];
            const ex = exerciseById(item.exerciseId);
            return `<li class="exercise-row"><span>${esc(ex?.name || "")}</span><span class="exercise-target">${sets.length ? sets.length + " series registradas" : "omitido"}</span></li>`;
          }).join("")}
        </ul>
        <button class="btn-primary" style="margin-top:14px" data-action="exit-workout">Listo</button>
      </div>
    `;
  }

  // paso de ejercicio
  const item = w.plan[w.exIndex];
  const ex = exerciseById(item.exerciseId);
  const timeBased = isTimeBased(ex);
  const prevBest = findPreviousBest(item.exerciseId);
  const sets = w.sessionLogs[w.exIndex] || [];

  return `
    <div class="workout-head-row">
      <p class="eyebrow">Ejercicio ${w.exIndex + 1} de ${w.plan.length}</p>
      <button class="icon-btn" data-action="exit-workout">${icon("x", 16)}</button>
    </div>
    <div class="card workout-exercise-card">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 4px">
        <h3 style="font-family:'Fraunces',serif;font-size:20px;margin:0">${esc(ex.name)}</h3>
        ${difficultyBadgeHtml(ex)}
      </div>
      <p style="color:var(--muted);font-size:13px;margin:0 0 14px">
        Objetivo: ${formatPlanTarget(item)}${prevBest
          ? (timeBased ? ` — mejor anterior: ${fmtDuration(prevBest.durationSec)}` : ` — mejor anterior: ${prevBest.weight} ${state.data.profile.unit} × ${prevBest.reps}`)
          : " — sin datos previos"}
      </p>
      <ul style="list-style:none;padding:0;margin:0 0 14px">
        ${sets.map((s, i) => `
          <li class="set-row">
            <span style="color:var(--muted);font-size:13px">Serie ${i + 1}</span>
            <span style="font-variant-numeric:tabular-nums">${timeBased ? fmtDuration(s.durationSec) : `${s.weight} ${state.data.profile.unit} × ${s.reps}`}</span>
            ${isNewPR(s, prevBest) ? icon("trophy", 13, "var(--gold-dark)") : ""}
          </li>
        `).join("")}
      </ul>
      ${w.restLeft > 0 ? `
        <div class="rest-box">
          ${icon("clock", 16, "var(--green)")}
          <span id="rest-timer-display" style="font-variant-numeric:tabular-nums;font-size:15px;margin-left:8px">Descanso — ${Math.floor(w.restLeft / 60)}:${String(w.restLeft % 60).padStart(2, "0")}</span>
          <button class="btn-link" data-action="skip-rest">Saltar descanso</button>
        </div>
      ` : `
        <div>
          <div class="input-row">
            ${timeBased ? `
              <input id="set-duration" type="number" class="num-input" placeholder="duración (${item.unit})" />
              <span style="color:var(--muted);font-size:13px">${item.unit}</span>
            ` : `
              <input id="set-weight" type="number" class="num-input" placeholder="peso (${state.data.profile.unit})" />
              <input id="set-reps" type="number" class="num-input" placeholder="Cantidad" />
            `}
            <button class="btn-primary-sm" data-action="log-set">${icon("check", 14)}Registrar serie</button>
          </div>
          ${err ? `<p class="error-text">${esc(err)}</p>` : ""}
        </div>
      `}
      <button class="btn-ghost full-width" style="margin-top:14px" data-action="next-exercise">
        ${icon("skip", 14)}${w.exIndex < w.plan.length - 1 ? "Siguiente ejercicio" : "Terminar entrenamiento"}
      </button>
    </div>
  `;
}

function stopRestTimer() {
  if (state.ui.restTimerId) { clearInterval(state.ui.restTimerId); state.ui.restTimerId = null; }
}

function startRestTimer() {
  stopRestTimer();
  state.ui.restTimerId = setInterval(() => {
    const w = state.ui.workout;
    if (!w) { stopRestTimer(); return; }
    w.restLeft -= 1;
    if (w.restLeft <= 0) {
      w.restLeft = 0;
      stopRestTimer();
      render();
      return;
    }
    const el = document.getElementById("rest-timer-display");
    if (el) el.textContent = `Descanso — ${Math.floor(w.restLeft / 60)}:${String(w.restLeft % 60).padStart(2, "0")}`;
  }, 1000);
}

function finishWorkout() {
  const w = state.ui.workout;
  const bw = parseFloat(w.bodyWeight);
  if (!isNaN(bw) && bw > 0) state.data.weightLogs.push({ date: todayISO(), weight: bw });
  const exercisesLogged = w.plan
    .map((item, i) => ({ exerciseId: item.exerciseId, sets: w.sessionLogs[i] || [] }))
    .filter((e) => e.sets.length > 0);
  state.data.history.push({ date: todayISO(), weekday: w.weekday, userId: state.userEmail || "invitado", exercises: exercisesLogged });
  persist();
  w.step = "summary";
  render();
}

export function bindGuidedWorkoutEvents() {
  const w = state.ui.workout;
  if (!w) return;

  const exitBtn = qs('[data-action="exit-workout"]');
  if (exitBtn) exitBtn.addEventListener("click", () => { stopRestTimer(); state.ui.workout = null; state.ui.formError = ""; render(); });

  const continueBtn = qs('[data-action="continue-bodyweight"]');
  if (continueBtn) continueBtn.addEventListener("click", () => {
    const val = qs("#bw-input").value;
    const n = parseFloat(val);
    if (!val || isNaN(n) || n <= 0) { state.ui.formError = "Ingresa tu peso corporal para continuar"; render(); return; }
    w.bodyWeight = val;
    state.ui.formError = "";
    w.step = "exercise";
    render();
  });

  const logSetBtn = qs('[data-action="log-set"]');
  if (logSetBtn) logSetBtn.addEventListener("click", () => {
    const item = w.plan[w.exIndex];
    const ex = exerciseById(item.exerciseId);

    let newSet;
    if (isTimeBased(ex)) {
      const dv = qs("#set-duration").value;
      const dn = parseFloat(dv);
      if (!dv || isNaN(dn) || dn <= 0) { state.ui.formError = "Ingresa una duración válida para esta serie"; render(); return; }
      newSet = buildSet(ex, { durationValue: dn, durationUnit: item.unit });
    } else {
      const wv = qs("#set-weight").value, rv = qs("#set-reps").value;
      const wn = parseFloat(wv), rn = parseInt(rv, 10);
      if (!wv || isNaN(wn) || wn < 0 || !rv || isNaN(rn) || rn <= 0) { state.ui.formError = "Ingresa peso y repeticiones para esta serie"; render(); return; }
      newSet = buildSet(ex, { weight: wn, reps: rn });
    }

    state.ui.formError = "";
    w.sessionLogs[w.exIndex] = [...(w.sessionLogs[w.exIndex] || []), newSet];
    w.restLeft = state.data.settings?.restSeconds || 90;
    render();
    startRestTimer();
  });

  const skipRestBtn = qs('[data-action="skip-rest"]');
  if (skipRestBtn) skipRestBtn.addEventListener("click", () => { stopRestTimer(); w.restLeft = 0; render(); });

  const nextBtn = qs('[data-action="next-exercise"]');
  if (nextBtn) nextBtn.addEventListener("click", () => {
    stopRestTimer();
    w.restLeft = 0;
    if (w.exIndex < w.plan.length - 1) { w.exIndex += 1; state.ui.formError = ""; render(); }
    else finishWorkout();
  });
}
