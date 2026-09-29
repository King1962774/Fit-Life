/* ================= HOY ================= */
import { state, persist } from "../state.js";
import { WEEKDAYS, WEEKDAY_FULL, MUSCLE_GROUPS, EQUIPMENT_TYPES, EXERCISE_TYPES, DIFFICULTY_LEVELS } from "../constants.js";
import { todayISO, jsWeekdayToKey, esc, qs, qsa, computeStreak, computeWeekStats, fmtDate } from "../utils.js";
import { icon } from "../icons.js";
import { exerciseById, formatPlanTarget, formatSet, getAllExercises, defaultPlanItem, addExercise, updateExercise } from "../exercises.js";
import { difficultyBadgeHtml } from "./library.js";
import {
  loadAllUserActivity, loadUserData, saveUserData,
  sendCoachMessage, fetchMessagesForUser, markMessageRead, findUserByMemberId,
} from "../storage.js";
import { render } from "../app.js";
import { renderGuidedWorkout, bindGuidedWorkoutEvents, startWorkout } from "./workout.js";
import { typeSelectorHtml, bindTypeSelector, imageFieldHtml, bindImageField, difficultySelectorHtml, bindDifficultySelector } from "./library.js";

/* Caché en memoria de la actividad de usuarios para el panel de admin.
   Ya no es un directorio de logins de este navegador: viene de una
   consulta real a Supabase (todas las filas de user_data + profiles),
   permitida por la política RLS "user_data: admin select all". */
let adminActivity = [];
let adminActivityLoaded = false;

export async function refreshAdminActivity() {
  try {
    adminActivity = await loadAllUserActivity();
  } catch (err) {
    console.error("No se pudo cargar la actividad de usuarios:", err.message || err);
  } finally {
    adminActivityLoaded = true;
  }
}

/* ---------------- admin: editor de rutina por usuario ----------------
   Al entrar a una cuenta se trae su fila completa de user_data (permitido
   por RLS admin) y se guarda aquí como copia editable. Solo se toca la
   rebanada del día activo (plan + recomendación); el resto del objeto
   viaja intacto de vuelta al guardar, para no perder nada de esa persona. */
let adminSelectedUserId = null;
let adminEditData = null;
let adminEditLoading = false;
let adminEditDay = jsWeekdayToKey(new Date());
let adminApplyTargets = new Set();
let adminMessageDraft = "";
let adminSaveStatus = "";
let adminMsgStatus = "";
let adminApplyStatus = "";
let adminPicking = false;
let adminPickerQuery = "";
let adminAddingExercise = false;
let adminExerciseFormError = "";
let adminEditingExerciseId = null;
let adminUserQuery = "";
let adminSearchStatus = "";

function resetAdminEditor() {
  adminSelectedUserId = null;
  adminEditData = null;
  adminEditLoading = false;
  adminApplyTargets = new Set();
  adminMessageDraft = "";
  adminSaveStatus = "";
  adminMsgStatus = "";
  adminApplyStatus = "";
  adminPicking = false;
  adminPickerQuery = "";
  adminAddingExercise = false;
  adminExerciseFormError = "";
  adminEditingExerciseId = null;
}

async function openUserEditor(userId) {
  adminSelectedUserId = userId;
  adminEditData = null;
  adminEditLoading = true;
  adminEditDay = jsWeekdayToKey(new Date());
  adminApplyTargets = new Set();
  adminMessageDraft = "";
  adminSaveStatus = "";
  adminMsgStatus = "";
  adminApplyStatus = "";
  adminPicking = false;
  adminAddingExercise = false;
  adminExerciseFormError = "";
  render();
  try {
    adminEditData = await loadUserData(userId);
  } catch (err) {
    console.error("No se pudo cargar la cuenta:", err.message || err);
  } finally {
    adminEditLoading = false;
    render();
  }
}

/* Solo se puede asignar a la rutina de alguien un ejercicio que esa
   persona realmente podrá ver después: el catálogo general (ownerId
   null) o algo que ya sea suyo. El admin, gracias a RLS, ve en su
   propio catálogo TAMBIÉN los ejercicios personales de otras
   personas (marcados "de otro usuario" en la Biblioteca) — pero si
   se le asignaba uno de esos a un tercero, esa persona no lo podía
   ver y el ítem del plan se quedaba mostrando "Desconocido". Este
   filtro evita que eso vuelva a pasar. */
function assignableExercisesFor(targetUserId) {
  return getAllExercises().filter((e) => !e.ownerId || e.ownerId === targetUserId);
}

/* ---------------- bandeja de mensajes del entrenador (usuarios normales) ---------------- */
let myMessages = [];
let myMessagesLoaded = false;

export async function refreshMyMessages() {
  if (state.isAdmin || !state.userId) return;
  try {
    myMessages = await fetchMessagesForUser(state.userId);
  } catch (err) {
    console.error("No se pudieron cargar los mensajes:", err.message || err);
  } finally {
    myMessagesLoaded = true;
  }
}

export function getEffectiveWeekday() {
  const iso = todayISO();
  return state.data.dayOverrides[iso] || jsWeekdayToKey(new Date());
}

export function renderToday() {
  if (state.isAdmin) return renderTodayAdmin();
  if (state.ui.workout) return renderGuidedWorkout();

  const iso = todayISO();
  const weekday = getEffectiveWeekday();
  const plan = state.data.weeklyPlan[weekday] || [];
  const swapped = !!state.data.dayOverrides[iso];
  const sortedWeights = [...state.data.weightLogs].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastWeight = sortedWeights.length ? sortedWeights[0].weight : "";
  const unreadMessages = myMessages.filter((m) => !m.read);

  return `
    <div class="today-head">
      <div>
        <p class="eyebrow">${new Date().toLocaleDateString("es-ES", { weekday: "long", month: "long", day: "numeric" })}</p>
        <h2 class="page-title">${WEEKDAY_FULL[weekday]}${swapped ? '<span class="swapped-badge"> · cambiado</span>' : ""}</h2>
      </div>
      <button class="btn-ghost" data-action="open-reschedule">${icon("swap", 14)}Reprogramar</button>
    </div>

    ${state.ui.rescheduling ? renderRescheduleModal(weekday) : ""}

    ${myMessagesLoaded && unreadMessages.length ? renderCoachMessages(unreadMessages) : ""}

    ${renderStatsStrip()}

    ${plan.length === 0 ? `
      <div class="rest-card">
        <div style="display:flex;align-items:center;gap:10px">
          ${icon("flame", 18, "var(--muted-2)")}
          <p style="font-family:'Fraunces',serif;font-size:20px;margin:0">Día de descanso</p>
        </div>
        <p style="color:var(--muted);margin-top:6px;font-size:14px">
          No hay nada programado para ${WEEKDAY_FULL[weekday]}. Trae una sesión de otro día o ve a Plan para configurar una.
        </p>
      </div>
    ` : `
      <div class="card">
        <p class="card-label">Plan de hoy</p>
        <ul class="exercise-list">
          ${plan.map((item) => {
            const ex = exerciseById(item.exerciseId);
            return `<li class="exercise-row"><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${esc(ex ? ex.name : "Ejercicio desconocido")}${ex ? difficultyBadgeHtml(ex) : ""}</span><span class="exercise-target">${formatPlanTarget(item)}</span></li>`;
          }).join("")}
        </ul>
        <button class="btn-primary" data-action="start-workout">${icon("play", 15)}Comenzar entrenamiento</button>
      </div>
    `}

    <div class="card" style="margin-top:16px">
      <p class="card-label">Peso corporal</p>
      <p style="font-size:28px;font-variant-numeric:tabular-nums;margin:4px 0">${lastWeight ? `${lastWeight} ${state.data.profile.unit}` : "Aún sin registros"}</p>
      <p style="color:var(--muted);font-size:13px;margin:0">Meta: ${state.data.profile.goalWeight} ${state.data.profile.unit} — ve a tu Perfil, sección Progreso, para registrarlo y graficarlo.</p>
    </div>
  `;
}

function renderCoachMessages(unread) {
  return `
    <div class="card" style="margin-bottom:16px;background:var(--gold-bg);border-color:var(--gold-border)">
      <p class="card-label" style="color:var(--gold-dark)">Mensaje${unread.length > 1 ? "s" : ""} de tu entrenador</p>
      ${unread.map((m) => `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--gold-border)">
          <p style="font-size:14px;margin:0;white-space:pre-wrap">${esc(m.body)}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <span style="color:var(--muted);font-size:11px">${fmtDate(String(m.created_at).slice(0, 10))}</span>
            <button class="btn-link" data-action="dismiss-message" data-id="${m.id}">Marcar como leído</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

/* ================= Vista de administrador =================
   Para el admin, la pestaña Hoy es el panel de entrenador: primero una
   lista de todas las cuentas reales con su actividad, y al entrar a una
   persona, un editor para armarle la rutina de un día concreto,
   replicarla opcionalmente en otras cuentas y dejarle un mensaje. */
function renderTodayAdmin() {
  if (!adminActivityLoaded) {
    return `
      <p class="eyebrow">Hoy</p>
      <h2 class="page-title">Actividad de usuarios</h2>
      <p style="color:var(--muted);font-size:13px;margin-top:10px">Cargando actividad…</p>
    `;
  }
  if (adminSelectedUserId) return renderAdminUserEditor();

  const filteredList = adminActivity.filter((u) => matchesAdminQuery(u, adminUserQuery));

  return `
    <p class="eyebrow">Hoy</p>
    <h2 class="page-title">Actividad de usuarios</h2>
    <p style="color:var(--muted);font-size:12px;margin:-10px 0 18px">
      Datos reales desde la base de datos. Entra a una cuenta para asignarle su rutina, dejarle un mensaje, o replicar lo mismo en otras cuentas.
    </p>
    ${renderAdminSearchBox()}
    ${filteredList.length === 0
      ? `<p style="color:var(--muted);font-size:14px;margin-top:14px">${adminActivity.length === 0 ? "Aún no hay usuarios registrados." : "Ningún usuario coincide con esa búsqueda."}</p>`
      : filteredList.map(renderUserActivityCard).join("")}
  `;
}

function renderAdminSearchBox() {
  return `
    <div class="search-row">
      ${icon("search", 14, "var(--muted)")}
      <input id="admin-user-search" class="search-input" placeholder="Buscar por ID, nombre o correo" value="${esc(adminUserQuery)}" />
      ${adminUserQuery ? `<button class="icon-btn" data-action="admin-clear-search">${icon("x", 14)}</button>` : ""}
    </div>
    ${adminSearchStatus ? `<p style="color:var(--rust);font-size:12px;margin:8px 0 0">${esc(adminSearchStatus)}</p>` : ""}
  `;
}

function matchesAdminQuery(user, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (user.memberId || "").toLowerCase().includes(needle)
    || (user.email || "").toLowerCase().includes(needle)
    || (user.displayName || "").toLowerCase().includes(needle);
}

function renderUserActivityCard(user) {
  const sessions = [...user.history].sort((a, b) => (a.date < b.date ? 1 : -1));
  return `
    <div class="card" style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <p style="font-family:'Fraunces',serif;font-size:16px;margin:0">${esc(user.displayName || user.email)}</p>
          <p style="color:var(--muted);font-size:12px;margin:2px 0 0">${esc(user.email)}${user.memberId ? ` · ID ${esc(user.memberId)}` : ""}</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="color:var(--muted);font-size:12px">${sessions.length} sesión${sessions.length === 1 ? "" : "es"} registrada${sessions.length === 1 ? "" : "s"}</span>
          <button class="btn-primary-sm" data-action="open-user" data-id="${user.id}">${icon("dumbbell", 13, "#fff")}Asignar rutina</button>
        </div>
      </div>
      ${sessions.length === 0
        ? `<p style="color:var(--muted);font-size:13px;margin-top:8px">Sin entrenamientos registrados todavía.</p>`
        : sessions.map(renderUserSessionDetail).join("")}
    </div>
  `;
}

function renderUserSessionDetail(session) {
  return `
    <div style="border-top:1px solid var(--hairline);margin-top:12px;padding-top:12px">
      <p style="font-size:13px;color:var(--muted);margin:0 0 8px">${WEEKDAY_FULL[session.weekday]} · ${fmtDate(session.date)}</p>
      ${session.exercises.map((se) => {
        const ex = exerciseById(se.exerciseId);
        return `
          <div style="margin-bottom:10px">
            <p style="font-size:14px;font-weight:500;margin:0 0 4px">${esc(ex?.name || "Ejercicio desconocido")}</p>
            <ul style="list-style:none;padding:0;margin:0">
              ${se.sets.map((s, i) => `
                <li style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;border-bottom:1px solid var(--surface-2)">
                  <span style="color:var(--muted)">Serie ${i + 1}</span>
                  <span style="font-variant-numeric:tabular-nums">${formatSet(s)}</span>
                </li>
              `).join("")}
            </ul>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* ---------------- editor de rutina de una cuenta (admin) ---------------- */
function renderAdminUserEditor() {
  const user = adminActivity.find((u) => u.id === adminSelectedUserId);
  const label = user ? (user.displayName || user.email) : "Cuenta";

  return `
    <button class="btn-link" style="padding-left:0;margin-bottom:6px" data-action="back-to-users">&larr; Volver a usuarios</button>
    <p class="eyebrow">Hoy · Panel de entrenador</p>
    <h2 class="page-title">${esc(label)}</h2>
    ${user ? `<p style="color:var(--muted);font-size:12px;margin:-12px 0 16px">${esc(user.email)}${user.memberId ? ` · ID ${esc(user.memberId)}` : ""}</p>` : ""}

    ${adminEditLoading || !adminEditData ? `
      <p style="color:var(--muted);font-size:13px">Cargando datos de la cuenta…</p>
    ` : `
      <div class="binder-tabs">
        ${WEEKDAYS.map((wd) => `<button class="binder-tab ${wd === adminEditDay ? "active" : ""}" data-action="admin-set-day" data-day="${wd}">${wd}</button>`).join("")}
      </div>

      ${renderAdminDayEditorCard()}
      ${renderAdminRecommendationCard()}

      <div style="margin-top:16px">
        <button class="btn-primary" data-action="admin-save-day">${icon("check", 15)}Guardar rutina de ${WEEKDAY_FULL[adminEditDay]} para ${esc(label)}</button>
        ${adminSaveStatus ? `<p style="color:var(--green);font-size:13px;margin:8px 0 0">${esc(adminSaveStatus)}</p>` : ""}
      </div>

      ${renderApplyToOthersCard(label)}
      ${renderMessageCard(label)}

      ${adminPicking ? renderAdminExercisePicker() : ""}
    `}
  `;
}

function renderAdminDayEditorCard() {
  const dayPlan = adminEditData.weeklyPlan[adminEditDay] || [];
  return `
    <div class="card">
      <div class="plan-head-row">
        <p style="font-family:'Fraunces',serif;font-size:18px;margin:0">${WEEKDAY_FULL[adminEditDay]}</p>
        <button class="btn-ghost-sm" data-action="admin-open-picker">${icon("plus", 14)}Agregar ejercicio</button>
      </div>
      ${dayPlan.length === 0 ? `<p style="color:var(--muted);font-size:13px">Día de descanso — sin ejercicios asignados.</p>` : `
        <ul style="list-style:none;padding:0;margin:0">
          ${dayPlan.map((item, i) => {
            const ex = exerciseById(item.exerciseId);
            if (adminEditingExerciseId === item.exerciseId && ex) return renderAdminEditExerciseForm(ex, i);
            const unitLabel = item.unit === "reps" ? "Cantidad" : item.unit;
            return `
              <li class="plan-row">
                <span style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap">${esc(ex?.name || "Desconocido")}${ex ? difficultyBadgeHtml(ex) : ""}</span>
                <input type="number" class="small-num-input" value="${item.sets}" data-action="admin-update-sets" data-idx="${i}" />
                <span style="color:var(--muted);font-size:12px">series</span>
                <input type="number" class="small-num-input" value="${item.target}" data-action="admin-update-target" data-idx="${i}" />
                <span style="color:var(--muted);font-size:12px">${unitLabel}</span>
                ${ex ? `<button class="icon-btn" data-action="admin-edit-exercise" data-id="${ex.id}" title="Editar nombre, imagen, descripción...">${icon("edit", 14, "var(--muted)")}</button>` : ""}
                <button class="icon-btn" data-action="admin-remove-plan-item" data-idx="${i}">${icon("trash", 14, "var(--rust)")}</button>
              </li>
            `;
          }).join("")}
        </ul>
      `}
    </div>
  `;
}

function renderAdminEditExerciseForm(ex, idx) {
  return `
    <li class="plan-row" style="display:block;padding:12px 0">
      <p style="color:var(--muted);font-size:12px;margin:0 0 8px">Editando "${esc(ex.name)}" — ${ex.ownerId ? "ejercicio personal de esa cuenta" : "esto lo verá todo el mundo"}</p>
      <div class="input-row"><input id="admin-edit-ex-name" class="num-input" value="${esc(ex.name)}" /></div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <select id="admin-edit-ex-muscle" class="select-input">
          ${MUSCLE_GROUPS.map((m) => `<option value="${m}" ${m === ex.muscle ? "selected" : ""}>${m}</option>`).join("")}
        </select>
        <select id="admin-edit-ex-equipment" class="select-input">
          ${EQUIPMENT_TYPES.map((eq) => `<option value="${eq}" ${eq === ex.equipment ? "selected" : ""}>${eq}</option>`).join("")}
        </select>
      </div>
      ${typeSelectorHtml("admin-edit-ex", ex)}
      <p class="card-label" style="margin:10px 0 4px">Dificultad</p>
      ${difficultySelectorHtml("admin-edit-ex", ex)}
      ${imageFieldHtml("admin-edit-ex", ex)}
      ${adminExerciseFormError ? `<p class="error-text">${esc(adminExerciseFormError)}</p>` : ""}
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-primary-sm" data-action="admin-save-edit-exercise" data-id="${ex.id}" data-idx="${idx}">Guardar cambios</button>
        <button class="btn-ghost-sm" data-action="admin-cancel-edit-exercise">Cancelar</button>
      </div>
    </li>
  `;
}

function renderAdminRecommendationCard() {
  const recommendation = (adminEditData.dayRecommendations && adminEditData.dayRecommendations[adminEditDay]) || "";
  return `
    <div class="card" style="margin-top:16px">
      <p class="card-label">Recomendación del entrenador para ${WEEKDAY_FULL[adminEditDay]}</p>
      <textarea id="admin-day-recommendation" class="textarea-input" rows="3" placeholder="Ej: enfócate en la técnica, sube el peso solo si completas las repeticiones limpias…">${esc(recommendation)}</textarea>
    </div>
  `;
}

function renderApplyToOthersCard(label) {
  const others = adminActivity.filter((u) => u.id !== adminSelectedUserId);
  if (others.length === 0) return "";
  return `
    <div class="card" style="margin-top:16px">
      <p class="card-label">Aplicar la misma rutina a otras cuentas (opcional)</p>
      <p style="color:var(--muted);font-size:12px;margin:-4px 0 10px">
        Marca las cuentas donde también quieras dejar esta rutina de ${WEEKDAY_FULL[adminEditDay]} como sugerencia adicional. Es completamente opcional: si no marcas ninguna, solo se guarda para ${esc(label)}.
      </p>
      <ul style="list-style:none;padding:0;margin:0">
        ${others.map((u) => `
          <li class="plan-row" style="gap:10px">
            <label style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer">
              <input type="checkbox" data-action="admin-toggle-target" data-id="${u.id}" ${adminApplyTargets.has(u.id) ? "checked" : ""} />
              <span>${esc(u.displayName || u.email)}${u.memberId ? ` <span style="color:var(--muted);font-size:12px">· ID ${esc(u.memberId)}</span>` : ""}</span>
            </label>
          </li>
        `).join("")}
      </ul>
      <button class="btn-ghost-sm" style="margin-top:12px" data-action="admin-apply-others" ${adminApplyTargets.size === 0 ? "disabled" : ""}>
        ${icon("checkcircle", 14)}Aplicar rutina a ${adminApplyTargets.size || ""} cuenta${adminApplyTargets.size === 1 ? "" : "s"} seleccionada${adminApplyTargets.size === 1 ? "" : "s"}
      </button>
      ${adminApplyStatus ? `<p style="color:var(--green);font-size:13px;margin:8px 0 0">${esc(adminApplyStatus)}</p>` : ""}
    </div>
  `;
}

function renderMessageCard(label) {
  return `
    <div class="card" style="margin-top:16px">
      <p class="card-label">Dejar un mensaje</p>
      <textarea id="admin-message-draft" class="textarea-input" rows="3" placeholder="Ej: buen trabajo esta semana, recuerda calentar antes de la sesión de piernas…">${esc(adminMessageDraft)}</textarea>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:10px">
        <button class="btn-primary-sm" data-action="admin-send-message">${icon("mail", 14)}Enviar a ${esc(label)}${adminApplyTargets.size > 0 ? ` y ${adminApplyTargets.size} más` : ""}</button>
        ${adminMsgStatus ? `<span style="color:var(--green);font-size:13px">${esc(adminMsgStatus)}</span>` : ""}
      </div>
      ${adminApplyTargets.size > 0 ? `<p style="color:var(--muted);font-size:12px;margin:8px 0 0">Se enviará también, de forma opcional, a las cuentas que marcaste arriba.</p>` : ""}
    </div>
  `;
}

function renderAdminExercisePicker() {
  const q = adminPickerQuery || "";
  const all = assignableExercisesFor(adminSelectedUserId);
  const filtered = all.filter((e) => (e.name + " " + e.muscle).toLowerCase().includes(q.toLowerCase()));
  return `
    <div class="modal-overlay" data-action="admin-close-picker">
      <div class="modal-card" style="max-height:80vh;display:flex;flex-direction:column" onclick="event.stopPropagation()">
        <div class="modal-head-row">
          <p style="font-family:'Fraunces',serif;font-size:18px;margin:0">Agregar un ejercicio</p>
          <button class="icon-btn" data-action="admin-close-picker">${icon("x", 16)}</button>
        </div>
        <p style="color:var(--muted);font-size:12px;margin:4px 0 0">Solo se muestran ejercicios del catálogo general (los ve todo el mundo) o ya propios de esta persona, para que nunca le aparezca "Desconocido".</p>
        ${adminAddingExercise ? renderAdminNewExerciseForm() : `
          <button class="btn-ghost-sm" style="margin-top:10px;align-self:flex-start" data-action="admin-toggle-new-exercise">${icon("plus", 14)}Crear ejercicio nuevo (quedará visible para todos)</button>
          <div class="search-row" style="margin-top:10px">
            ${icon("search", 14, "var(--muted)")}
            <input id="admin-picker-search" class="search-input" placeholder="Buscar ejercicios o grupo muscular" value="${esc(q)}" />
          </div>
          <div style="overflow-y:auto;margin-top:8px" id="admin-picker-results">
            ${renderAdminPickerRows(filtered)}
          </div>
        `}
      </div>
    </div>
  `;
}

function renderAdminNewExerciseForm() {
  return `
    <div class="card" style="margin-top:10px">
      <div class="input-row"><input id="admin-new-ex-name" class="num-input" placeholder="Nombre del ejercicio" /></div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <select id="admin-new-ex-muscle" class="select-input">
          ${MUSCLE_GROUPS.map((m) => `<option value="${m}">${m}</option>`).join("")}
        </select>
        <select id="admin-new-ex-equipment" class="select-input">
          ${EQUIPMENT_TYPES.map((eq) => `<option value="${eq}">${eq}</option>`).join("")}
        </select>
      </div>
      ${typeSelectorHtml("admin-new-ex", null)}
      <p class="card-label" style="margin:10px 0 4px">Dificultad</p>
      ${difficultySelectorHtml("admin-new-ex", null)}
      ${imageFieldHtml("admin-new-ex", null)}
      ${adminExerciseFormError ? `<p class="error-text">${esc(adminExerciseFormError)}</p>` : ""}
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-primary-sm" data-action="admin-save-new-exercise">Crear y agregar al día</button>
        <button class="btn-ghost-sm" data-action="admin-cancel-new-exercise">Cancelar</button>
      </div>
    </div>
  `;
}

function renderAdminPickerRows(filtered) {
  return filtered.map((e) => `<button class="pick-row" data-action="admin-pick-exercise" data-id="${e.id}"><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${esc(e.name)}${difficultyBadgeHtml(e)}</span><span style="color:var(--muted);font-size:12px">${e.muscle}</span></button>`).join("")
    + (filtered.length === 0 ? `<p style="color:var(--muted);font-size:13px;padding:8px 0">Sin coincidencias.</p>` : "");
}

function renderStatsStrip() {
  const streak = computeStreak(state.data.history);
  const week = computeWeekStats(state.data.history);
  const items = [
    { label: "Racha de días", value: streak, icon: "flame", color: "var(--rust)" },
    { label: "Esta semana", value: week.sessions, icon: "calendar", color: "var(--green)" },
    { label: "Volumen (sem)", value: week.volume ? week.volume.toLocaleString("es-ES") : "0", icon: "trending", color: "var(--ink)" },
  ];
  return `
    <div class="stats-strip">
      ${items.map((it) => `
        <div class="stat-cell">
          ${icon(it.icon, 14, it.color)}
          <p class="stat-value" style="margin-top:6px">${it.value}</p>
          <p class="stat-label">${it.label}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderRescheduleModal(current) {
  const plan = state.data.weeklyPlan;
  return `
    <div class="modal-overlay" data-action="close-reschedule">
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-head-row">
          <p style="font-family:'Fraunces',serif;font-size:18px;margin:0">Traer el plan de otro día</p>
          <button class="icon-btn" data-action="close-reschedule">${icon("x", 16)}</button>
        </div>
        <p style="color:var(--muted);font-size:13px;margin-top:4px">Tu plan semanal no cambia — esto solo reemplaza lo que se carga hoy.</p>
        <div class="reschedule-grid">
          ${WEEKDAYS.map((wd) => `
            <button class="reschedule-opt ${wd === current ? "active" : ""}" data-action="pick-reschedule" data-day="${wd}">
              <span class="day">${wd}</span>
              <span class="count">${plan[wd].length ? plan[wd].length + " ejercicios" : "Día de descanso"}</span>
            </button>
          `).join("")}
        </div>
        <button class="btn-link" data-action="reset-reschedule">Restablecer al plan real de hoy</button>
      </div>
    </div>
  `;
}

export function bindTodayEvents() {
  if (state.isAdmin) { bindAdminTodayEvents(); return; }

  qsa('[data-action="dismiss-message"]').forEach((b) => b.addEventListener("click", async () => {
    const id = b.dataset.id;
    myMessages = myMessages.map((m) => (m.id === id ? { ...m, read: true } : m));
    render();
    try { await markMessageRead(id); } catch (err) { console.error("No se pudo marcar el mensaje como leído:", err.message || err); }
  }));

  const openBtn = qs('[data-action="open-reschedule"]');
  if (openBtn) openBtn.addEventListener("click", () => { state.ui.rescheduling = true; render(); });
  const closeBtns = qsa('[data-action="close-reschedule"]');
  closeBtns.forEach((b) => b.addEventListener("click", () => { state.ui.rescheduling = false; render(); }));
  qsa('[data-action="pick-reschedule"]').forEach((b) => b.addEventListener("click", () => {
    state.data.dayOverrides[todayISO()] = b.dataset.day;
    persist();
    state.ui.rescheduling = false;
    render();
  }));
  const resetBtn = qs('[data-action="reset-reschedule"]');
  if (resetBtn) resetBtn.addEventListener("click", () => {
    delete state.data.dayOverrides[todayISO()];
    persist();
    state.ui.rescheduling = false;
    render();
  });
  const startBtn = qs('[data-action="start-workout"]');
  if (startBtn) startBtn.addEventListener("click", () => { startWorkout(getEffectiveWeekday()); });
  bindGuidedWorkoutEvents();
}

function bindAdminTodayEvents() {
  qsa('[data-action="open-user"]').forEach((b) => b.addEventListener("click", () => { openUserEditor(b.dataset.id); }));

  if (!adminSelectedUserId) {
    const searchInput = qs("#admin-user-search");
    if (searchInput) {
      searchInput.focus();
      searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
      searchInput.addEventListener("input", () => {
        adminUserQuery = searchInput.value;
        adminSearchStatus = "";
        render();
      });
      searchInput.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        const q = searchInput.value.trim();
        if (!q) return;
        const alreadyVisible = adminActivity.some((u) => matchesAdminQuery(u, q));
        if (alreadyVisible) return; // ya se ve filtrado en la lista, no hace falta ir al servidor
        adminSearchStatus = "Buscando…";
        render();
        try {
          const found = await findUserByMemberId(q);
          if (found) {
            adminSearchStatus = "";
            openUserEditor(found.id);
          } else {
            adminSearchStatus = `No se encontró ninguna cuenta con el ID "${q}".`;
            render();
          }
        } catch (err) {
          console.error("No se pudo buscar por ID:", err.message || err);
          adminSearchStatus = "No se pudo completar la búsqueda. Intenta de nuevo.";
          render();
        }
      });
    }
    const clearBtn = qs('[data-action="admin-clear-search"]');
    if (clearBtn) clearBtn.addEventListener("click", () => { adminUserQuery = ""; adminSearchStatus = ""; render(); });
    return;
  }

  const backBtn = qs('[data-action="back-to-users"]');
  if (backBtn) backBtn.addEventListener("click", () => { resetAdminEditor(); render(); });

  if (adminEditLoading || !adminEditData) return;

  qsa('[data-action="admin-set-day"]').forEach((b) => b.addEventListener("click", () => {
    adminEditDay = b.dataset.day;
    adminSaveStatus = "";
    adminApplyStatus = "";
    render();
  }));

  qsa('[data-action="admin-update-sets"]').forEach((inp) => inp.addEventListener("change", () => {
    const n = parseInt(inp.value, 10);
    if (isNaN(n) || n <= 0) return;
    adminEditData.weeklyPlan[adminEditDay][inp.dataset.idx].sets = n;
  }));
  qsa('[data-action="admin-update-target"]').forEach((inp) => inp.addEventListener("change", () => {
    const n = parseFloat(inp.value);
    if (isNaN(n) || n <= 0) return;
    adminEditData.weeklyPlan[adminEditDay][inp.dataset.idx].target = n;
  }));
  qsa('[data-action="admin-remove-plan-item"]').forEach((b) => b.addEventListener("click", () => {
    adminEditData.weeklyPlan[adminEditDay].splice(parseInt(b.dataset.idx, 10), 1);
    adminSaveStatus = "";
    render();
  }));

  if (adminEditingExerciseId) {
    bindTypeSelector("admin-edit-ex");
    bindDifficultySelector("admin-edit-ex");
    bindImageField("admin-edit-ex");
  }

  qsa('[data-action="admin-edit-exercise"]').forEach((b) => b.addEventListener("click", () => {
    adminEditingExerciseId = b.dataset.id;
    adminExerciseFormError = "";
    render();
  }));
  qsa('[data-action="admin-cancel-edit-exercise"]').forEach((b) => b.addEventListener("click", () => {
    adminEditingExerciseId = null;
    adminExerciseFormError = "";
    render();
  }));
  qsa('[data-action="admin-save-edit-exercise"]').forEach((b) => b.addEventListener("click", async () => {
    const name = qs("#admin-edit-ex-name").value.trim();
    if (!name) return;
    const patch = {
      name,
      muscle: qs("#admin-edit-ex-muscle").value,
      equipment: qs("#admin-edit-ex-equipment").value,
      type: qs("#admin-edit-ex-type").value,
      difficulty: qs("#admin-edit-ex-difficulty")?.dataset.value || DIFFICULTY_LEVELS.INTERMEDIATE,
      imageUrl: qs("#admin-edit-ex-image")?.value.trim() || "",
      description: qs("#admin-edit-ex-description")?.value.trim() || "",
    };
    if (patch.type === EXERCISE_TYPES.TIME) {
      patch.defaultUnit = qs("#admin-edit-ex-unit").value;
      const t = parseFloat(qs("#admin-edit-ex-target").value);
      patch.defaultTarget = isNaN(t) ? 30 : t;
    } else {
      patch.defaultUnit = undefined;
      patch.defaultTarget = undefined;
    }
    b.disabled = true;
    try {
      await updateExercise(b.dataset.id, patch);
      adminEditingExerciseId = null;
      adminExerciseFormError = "";
      render();
    } catch (err) {
      adminExerciseFormError = err.code === "duplicate_name" ? err.message : "No se pudo guardar el ejercicio";
      render();
    }
  }));

  const openPicker = qs('[data-action="admin-open-picker"]');
  if (openPicker) openPicker.addEventListener("click", () => { adminPicking = true; adminPickerQuery = ""; adminAddingExercise = false; adminExerciseFormError = ""; render(); });
  qsa('[data-action="admin-close-picker"]').forEach((b) => b.addEventListener("click", () => { adminPicking = false; adminAddingExercise = false; render(); }));

  if (adminPicking && !adminAddingExercise) {
    const searchInput = qs("#admin-picker-search");
    if (searchInput) {
      searchInput.focus();
      searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
      searchInput.addEventListener("input", () => {
        adminPickerQuery = searchInput.value;
        const q = searchInput.value.toLowerCase();
        const results = qs("#admin-picker-results");
        const all = assignableExercisesFor(adminSelectedUserId);
        const filtered = all.filter((e) => (e.name + " " + e.muscle).toLowerCase().includes(q));
        results.innerHTML = renderAdminPickerRows(filtered);
        bindAdminPickRows();
      });
    }
    bindAdminPickRows();
  }

  const toggleNewEx = qs('[data-action="admin-toggle-new-exercise"]');
  if (toggleNewEx) toggleNewEx.addEventListener("click", () => {
    adminAddingExercise = true;
    adminExerciseFormError = "";
    render();
  });
  const cancelNewEx = qs('[data-action="admin-cancel-new-exercise"]');
  if (cancelNewEx) cancelNewEx.addEventListener("click", () => {
    adminAddingExercise = false;
    adminExerciseFormError = "";
    render();
  });
  if (adminAddingExercise) {
    bindTypeSelector("admin-new-ex");
    bindDifficultySelector("admin-new-ex");
    bindImageField("admin-new-ex");
    const saveNewEx = qs('[data-action="admin-save-new-exercise"]');
    if (saveNewEx) saveNewEx.addEventListener("click", async () => {
      const name = qs("#admin-new-ex-name").value.trim();
      if (!name) { adminExerciseFormError = "Dale un nombre al ejercicio"; render(); return; }
      const muscle = qs("#admin-new-ex-muscle").value;
      const equipment = qs("#admin-new-ex-equipment").value;
      const type = qs("#admin-new-ex-type").value;
      const difficulty = qs("#admin-new-ex-difficulty")?.dataset.value || DIFFICULTY_LEVELS.INTERMEDIATE;
      const defaultUnit = qs("#admin-new-ex-unit")?.value;
      const defaultTarget = parseFloat(qs("#admin-new-ex-target")?.value);
      const imageUrl = qs("#admin-new-ex-image")?.value.trim();
      const description = qs("#admin-new-ex-description")?.value.trim();
      saveNewEx.disabled = true;
      try {
        // Se crea como admin -> queda global (ownerId null), así lo ve
        // todo el mundo, incluida la persona a la que se lo asignamos aquí.
        const created = await addExercise({ name, muscle, equipment, type, difficulty, defaultUnit, defaultTarget: isNaN(defaultTarget) ? undefined : defaultTarget, imageUrl, description });
        adminEditData.weeklyPlan[adminEditDay].push(defaultPlanItem(created));
        adminAddingExercise = false;
        adminPicking = false;
        adminExerciseFormError = "";
        adminSaveStatus = "";
        render();
      } catch (err) {
        adminExerciseFormError = err.code === "duplicate_name" ? err.message : "No se pudo guardar el ejercicio";
        render();
      }
    });
  }

  qsa('[data-action="admin-toggle-target"]').forEach((cb) => cb.addEventListener("change", () => {
    if (cb.checked) adminApplyTargets.add(cb.dataset.id); else adminApplyTargets.delete(cb.dataset.id);
    adminApplyStatus = "";
    render();
  }));

  const saveDayBtn = qs('[data-action="admin-save-day"]');
  if (saveDayBtn) saveDayBtn.addEventListener("click", async () => {
    const recInput = qs("#admin-day-recommendation");
    if (recInput) adminEditData.dayRecommendations[adminEditDay] = recInput.value;
    saveDayBtn.disabled = true;
    adminSaveStatus = "Guardando…";
    render();
    try {
      // `exercises` ya no vive dentro de user_data (vive en la tabla
      // compartida), así que no se reenvía al guardar para no resucitar
      // una copia vieja/placeholder dentro del jsonb de esta persona.
      const { exercises, ...toSave } = adminEditData;
      await saveUserData(adminSelectedUserId, toSave);
      adminSaveStatus = "Guardado ✓";
      const cached = adminActivity.find((u) => u.id === adminSelectedUserId);
      if (cached) cached.history = adminEditData.history || [];
    } catch (err) {
      console.error("No se pudo guardar la rutina:", err.message || err);
      adminSaveStatus = "No se pudo guardar. Intenta de nuevo.";
    }
    render();
  });

  const applyOthersBtn = qs('[data-action="admin-apply-others"]');
  if (applyOthersBtn) applyOthersBtn.addEventListener("click", async () => {
    const recInput = qs("#admin-day-recommendation");
    const recommendation = recInput ? recInput.value : (adminEditData.dayRecommendations[adminEditDay] || "");
    const fullDayPlan = adminEditData.weeklyPlan[adminEditDay].map((item) => ({ ...item }));
    // Al aplicar la misma rutina a OTRAS cuentas, solo se puede llevar
    // lo que esas cuentas también podrán ver: el catálogo general. Un
    // ejercicio personal de la cuenta que se estaba editando no es
    // visible para nadie más, así que se deja fuera para no volver a
    // dejar un "Desconocido" en la rutina de otra persona.
    const dayPlanCopy = fullDayPlan.filter((item) => {
      const ex = exerciseById(item.exerciseId);
      return ex && !ex.ownerId;
    });
    const skipped = fullDayPlan.length - dayPlanCopy.length;
    const targets = Array.from(adminApplyTargets);
    if (targets.length === 0) return;
    applyOthersBtn.disabled = true;
    adminApplyStatus = "Aplicando…";
    render();
    let okCount = 0;
    for (const targetId of targets) {
      try {
        const targetData = await loadUserData(targetId);
        targetData.weeklyPlan[adminEditDay] = dayPlanCopy.map((item) => ({ ...item }));
        targetData.dayRecommendations[adminEditDay] = recommendation;
        const { exercises, ...toSave } = targetData;
        await saveUserData(targetId, toSave);
        okCount += 1;
      } catch (err) {
        console.error("No se pudo aplicar la rutina a una cuenta:", err.message || err);
      }
    }
    const skippedNote = skipped > 0 ? ` (se omitió ${skipped} ejercicio${skipped === 1 ? "" : "s"} personal${skipped === 1 ? "" : "es"} que esas cuentas no pueden ver)` : "";
    adminApplyStatus = okCount === targets.length
      ? `Rutina aplicada a ${okCount} cuenta${okCount === 1 ? "" : "s"} adicional${okCount === 1 ? "" : "es"}.${skippedNote}`
      : `Se aplicó a ${okCount} de ${targets.length} cuentas.${skippedNote}`;
    render();
  });

  const sendMsgBtn = qs('[data-action="admin-send-message"]');
  if (sendMsgBtn) sendMsgBtn.addEventListener("click", async () => {
    const textarea = qs("#admin-message-draft");
    const text = (textarea ? textarea.value : adminMessageDraft).trim();
    if (!text) { adminMsgStatus = "Escribe un mensaje antes de enviarlo."; render(); return; }
    adminMessageDraft = text;
    sendMsgBtn.disabled = true;
    adminMsgStatus = "Enviando…";
    render();
    const recipients = [adminSelectedUserId, ...Array.from(adminApplyTargets)];
    let okCount = 0;
    for (const userId of recipients) {
      try {
        await sendCoachMessage(userId, state.userId, text);
        okCount += 1;
      } catch (err) {
        console.error("No se pudo enviar el mensaje:", err.message || err);
      }
    }
    adminMsgStatus = okCount === recipients.length
      ? `Mensaje enviado a ${okCount} cuenta${okCount === 1 ? "" : "s"}.`
      : `Se envió a ${okCount} de ${recipients.length} cuentas.`;
    if (okCount > 0) adminMessageDraft = "";
    render();
  });
}

function bindAdminPickRows() {
  qsa('[data-action="admin-pick-exercise"]').forEach((b) => b.addEventListener("click", () => {
    const ex = assignableExercisesFor(adminSelectedUserId).find((e) => e.id === b.dataset.id);
    if (!ex) return;
    adminEditData.weeklyPlan[adminEditDay].push(defaultPlanItem(ex));
    adminPicking = false;
    adminSaveStatus = "";
    render();
  }));
}
