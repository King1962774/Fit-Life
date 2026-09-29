/* ================= PERFIL ================= */
import { state, persist } from "../state.js";
import { esc, qs, qsa, uid } from "../utils.js";
import { icon } from "../icons.js";
import { updateDisplayName } from "../storage.js";
import { render, performLogout, NAV_ITEMS } from "../app.js";
import { renderProgressCard, bindProgressEvents } from "./progress.js";
import { THEMES } from "../constants.js";

/* ---------------- identidad ---------------- */
function cardLabel(iconName, text) {
  return `
    <div class="card-label-row">
      <span class="card-label-icon">${icon(iconName, 13, "var(--muted-2)")}</span>
      <p class="card-label">${text}</p>
    </div>
  `;
}

function renderIdentityCard() {
  const p = state.ui.profile;
  const name = state.displayName || state.data.profile.displayName || "";
  return `
    <div class="card">
      <div style="display:flex;align-items:center;gap:14px">
        <div class="profile-avatar">${icon("user", 20, "var(--paper)")}</div>
        <div style="flex:1;min-width:0">
          ${p.editingIdentity ? `
            <input id="profile-name-input" class="num-input" style="max-width:260px" placeholder="Tu nombre" value="${esc(p.nameDraft)}" ${p.identitySaving ? "disabled" : ""} />
          ` : `
            <p style="font-family:'Fraunces',serif;font-size:18px;margin:0">${name ? esc(name) : "Sin nombre"}${state.isAdmin ? '<span class="admin-badge" style="margin-left:8px">ADMIN</span>' : ""}</p>
          `}
          <p style="color:var(--muted);font-size:13px;margin:4px 0 0">${esc(state.userEmail)}</p>
        </div>
        ${p.editingIdentity ? `
          <div style="display:flex;gap:6px">
            <button class="btn-primary-sm" data-action="save-identity" ${p.identitySaving ? "disabled" : ""}>${icon("check", 14)}Guardar</button>
            <button class="btn-ghost-sm" data-action="cancel-identity" ${p.identitySaving ? "disabled" : ""}>Cancelar</button>
          </div>
        ` : `
          <button class="icon-btn" data-action="edit-identity" title="Editar nombre">${icon("edit", 16, "var(--muted)")}</button>
        `}
      </div>
      ${state.memberId ? `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid var(--hairline)">
          <div>
            <p class="card-label" style="margin:0 0 2px">Tu ID</p>
            <p style="font-family:'Fraunces',serif;font-size:16px;letter-spacing:0.06em;margin:0">${esc(state.memberId)}</p>
          </div>
          <button class="btn-ghost-sm" data-action="copy-member-id" data-value="${esc(state.memberId)}">${icon("edit", 14)}Copiar</button>
        </div>
        <p style="color:var(--muted);font-size:11px;margin:6px 0 0">Compártelo con tu entrenador para que te ubique rápido en el panel de administración.</p>
      ` : ""}
    </div>
  `;
}

/* ---------------- cuerpo: peso, estatura, meta, IMC ---------------- */
function currentWeight() {
  const sorted = [...state.data.weightLogs].sort((a, b) => (a.date < b.date ? 1 : -1));
  return sorted.length ? sorted[0].weight : null;
}

function computeBmi() {
  const p = state.data.profile;
  const w = currentWeight();
  if (!p.height || !w) return null;
  const kg = p.unit === "lb" ? w * 0.453592 : w;
  const m = p.height / 100;
  return Math.round((kg / (m * m)) * 10) / 10;
}

function renderBodyCard() {
  const p = state.data.profile;
  const w = currentWeight();
  const bmi = computeBmi();
  const err = state.ui.profile.bodyFormError;
  return `
    <div class="card" style="margin-top:16px">
      ${cardLabel("scale", "Peso, estatura y medidas")}
      <div class="stats-strip" style="margin-bottom:14px">
        <div class="stat-cell">
          <p class="stat-value">${w ? `${w} ${p.unit}` : "—"}</p>
          <p class="stat-label">Peso actual</p>
        </div>
        <div class="stat-cell">
          <p class="stat-value">${p.goalWeight} ${p.unit}</p>
          <p class="stat-label">Peso meta</p>
        </div>
        <div class="stat-cell">
          <p class="stat-value">${bmi ?? "—"}</p>
          <p class="stat-label">IMC</p>
        </div>
      </div>
      <p style="color:var(--muted);font-size:12px;margin:0 0 10px">Registra tu peso del día en la sección Progreso, un poco más abajo. Aquí puedes ajustar tu estatura, unidad y meta.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="input-row" style="flex:1;min-width:140px">
          ${icon("trending", 14, "var(--muted-2)")}
          <input id="profile-height" type="number" class="num-input" placeholder="Estatura (cm)" value="${p.height ?? ""}" />
        </div>
        <div class="input-row" style="flex:1;min-width:140px">
          ${icon("trophy", 14, "var(--muted-2)")}
          <input id="profile-goal" type="number" class="num-input" placeholder="Peso meta" value="${p.goalWeight ?? ""}" />
        </div>
        <select id="profile-unit" class="select-input" style="flex:0 0 90px">
          <option value="kg" ${p.unit === "kg" ? "selected" : ""}>kg</option>
          <option value="lb" ${p.unit === "lb" ? "selected" : ""}>lb</option>
        </select>
      </div>
      ${err ? `<p class="error-text">${esc(err)}</p>` : ""}
      <button class="btn-primary-sm" style="margin-top:12px" data-action="save-body">${icon("check", 14)}Guardar datos</button>
    </div>
  `;
}

/* ---------------- medidas corporales personalizables ---------------- */
const QUICK_MEASUREMENTS = ["Pecho", "Cintura", "Cadera", "Brazo", "Muslo", "Cuello"];

function renderMeasurementRow(m) {
  const isEditing = state.ui.profile.editingMeasurementId === m.id;
  if (isEditing) {
    return `
      <div class="measurement-row" data-id="${m.id}">
        <input class="num-input measurement-edit-label" value="${esc(m.label)}" style="max-width:150px" />
        <div style="display:flex;gap:6px;align-items:center">
          <input type="number" class="small-num-input measurement-edit-value" style="width:64px" value="${esc(m.value)}" />
          <input class="small-num-input measurement-edit-unit" style="width:52px" value="${esc(m.unit || "cm")}" />
          <button class="icon-btn" data-action="save-measurement" data-id="${m.id}" title="Guardar">${icon("check", 14, "var(--green)")}</button>
          <button class="icon-btn" data-action="cancel-edit-measurement" title="Cancelar">${icon("x", 14, "var(--muted)")}</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="measurement-row" data-id="${m.id}">
      <span style="font-size:14px">${esc(m.label)}</span>
      <div style="display:flex;gap:10px;align-items:center">
        <span style="font-variant-numeric:tabular-nums;color:var(--muted);font-size:13px">${esc(m.value)} ${esc(m.unit || "cm")}</span>
        <button class="icon-btn" data-action="edit-measurement" data-id="${m.id}" title="Editar">${icon("edit", 14, "var(--muted)")}</button>
        <button class="icon-btn" data-action="delete-measurement" data-id="${m.id}" title="Eliminar">${icon("trash", 14, "var(--rust)")}</button>
      </div>
    </div>
  `;
}

function renderAddMeasurementForm() {
  const p = state.ui.profile;
  const err = p.measurementFormError;
  return `
    <div class="card" style="margin-top:10px;background:var(--row-hover)">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${QUICK_MEASUREMENTS.map((label) => `<button type="button" class="binder-tab" data-action="quick-measurement" data-label="${esc(label)}" style="padding:5px 10px;font-size:12px">${esc(label)}</button>`).join("")}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="measurement-label" class="num-input" style="flex:1;min-width:120px" placeholder="Nombre (ej. Pecho)" value="${esc(p.measurementLabel)}" />
        <input id="measurement-value" type="number" class="small-num-input" style="width:70px" placeholder="valor" value="${esc(p.measurementValue)}" />
        <input id="measurement-unit" class="small-num-input" style="width:60px" placeholder="cm" value="${esc(p.measurementUnit)}" />
      </div>
      ${err ? `<p class="error-text">${esc(err)}</p>` : ""}
      <button class="btn-primary-sm" style="margin-top:10px" data-action="save-new-measurement">${icon("check", 14)}Agregar medida</button>
    </div>
  `;
}

function renderMeasurementsCard() {
  const measurements = state.data.profile.measurements || [];
  const adding = state.ui.profile.addingMeasurement;
  return `
    <div class="card" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="card-label-row" style="margin:0">
          <span class="card-label-icon">${icon("ruler", 13, "var(--muted-2)")}</span>
          <p class="card-label" style="margin:0">Medidas corporales</p>
        </div>
        <button class="btn-ghost-sm" data-action="toggle-add-measurement">${icon(adding ? "x" : "plus", 14)}${adding ? "Cerrar" : "Agregar medida"}</button>
      </div>
      ${measurements.length ? `
        <div style="margin-top:10px">
          ${measurements.map(renderMeasurementRow).join("")}
        </div>
      ` : `<p style="color:var(--muted);font-size:13px;margin-top:10px">Aún no has agregado medidas. Registra las que quieras seguir: pecho, cintura, brazos, lo que te sirva.</p>`}
      <div id="add-measurement-form">${adding ? renderAddMeasurementForm() : ""}</div>
    </div>
  `;
}

/* ---------------- preferencias / personalización ---------------- */
function renderCustomSettingRow(c) {
  return `
    <div class="measurement-row" data-id="${c.id}">
      <span style="font-size:14px">${esc(c.label)}</span>
      <div style="display:flex;gap:10px;align-items:center">
        <span style="color:var(--muted);font-size:13px">${esc(c.value)}</span>
        <button class="icon-btn" data-action="delete-custom-setting" data-id="${c.id}" title="Eliminar">${icon("trash", 14, "var(--rust)")}</button>
      </div>
    </div>
  `;
}

function renderAddCustomSettingForm() {
  const p = state.ui.profile;
  const err = p.settingsFormError;
  return `
    <div class="card" style="margin-top:10px;background:var(--row-hover)">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="custom-setting-label" class="num-input" style="flex:1;min-width:120px" placeholder="Nombre de la opción" value="${esc(p.customLabel)}" />
        <input id="custom-setting-value" class="num-input" style="flex:1;min-width:120px" placeholder="Valor" value="${esc(p.customValue)}" />
      </div>
      ${err ? `<p class="error-text">${esc(err)}</p>` : ""}
      <button class="btn-primary-sm" style="margin-top:10px" data-action="save-custom-setting">${icon("check", 14)}Agregar</button>
    </div>
  `;
}

function renderThemeSwatches() {
  const current = (state.data.settings && state.data.settings.theme) || "claro";
  return `
    <div style="border-top:1px solid var(--hairline);margin-top:18px;padding-top:14px">
      <p style="font-size:13px;color:var(--muted);margin:0 0 4px">Apariencia de la página</p>
      <p style="font-size:12px;color:var(--muted-2);margin:0 0 4px">Elige un tema de color. Se aplica al instante y se guarda para tus próximas visitas.</p>
      <div class="theme-swatch-row">
        ${THEMES.map((t) => `
          <button type="button" class="theme-swatch ${t.id === current ? "active" : ""}" data-action="set-theme" data-theme="${t.id}" title="${esc(t.label)}">
            <span class="theme-swatch-preview" style="background:${t.swatch.card}">
              <span class="theme-swatch-dot" style="background:${t.swatch.accent}"></span>
            </span>
            <span class="theme-swatch-label">${esc(t.label)}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderPreferencesCard() {
  const s = state.data.settings || { restSeconds: 90, defaultView: "today", custom: [] };
  const adding = state.ui.profile.addingCustomSetting;
  return `
    <div class="card" style="margin-top:16px">
      ${cardLabel("sliders", "Personalización")}
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:1;min-width:160px">
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px">Vista al iniciar sesión</label>
          <select id="setting-default-view" class="select-input">
            ${NAV_ITEMS.filter((n) => n.key !== "profile").map((n) => `<option value="${n.key}" ${s.defaultView === n.key ? "selected" : ""}>${esc(n.label)}</option>`).join("")}
          </select>
        </div>
        <div style="flex:0 0 140px">
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px">Descanso entre series</label>
          <div class="input-row">
            <input id="setting-rest-seconds" type="number" min="0" class="num-input" value="${s.restSeconds}" />
            <span style="font-size:12px;color:var(--muted);white-space:nowrap">seg</span>
          </div>
        </div>
      </div>
      <button class="btn-primary-sm" style="margin-top:12px" data-action="save-preferences">${icon("check", 14)}Guardar preferencias</button>

      ${renderThemeSwatches()}

      <div style="border-top:1px solid var(--hairline);margin-top:18px;padding-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <p style="font-size:13px;color:var(--muted);margin:0">Tus propias opciones — agrega lo que quieras recordar o configurar</p>
          <button class="btn-ghost-sm" data-action="toggle-add-custom-setting">${icon(adding ? "x" : "plus", 14)}${adding ? "Cerrar" : "Agregar opción"}</button>
        </div>
        ${(s.custom || []).length ? `
          <div style="margin-top:10px">
            ${s.custom.map(renderCustomSettingRow).join("")}
          </div>
        ` : `<p style="color:var(--muted);font-size:13px;margin-top:8px">Ejemplos: "Días de entreno", "Objetivo del mes", "Recordatorio"…</p>`}
        <div id="add-custom-setting-form">${adding ? renderAddCustomSettingForm() : ""}</div>
      </div>
    </div>
  `;
}

/* ---------------- cuenta ---------------- */
function renderAccountCard() {
  return `
    <div class="card" style="margin-top:16px">
      ${cardLabel("lock", "Cuenta")}
      <p style="color:var(--muted);font-size:13px;margin:0 0 12px">Cierra tu sesión en este dispositivo. Tus datos quedan guardados en la nube.</p>
      <button class="btn-ghost full-width" data-action="profile-logout" style="color:var(--rust);border-color:var(--rust-border)">${icon("logout", 15, "var(--rust)")}Cerrar sesión</button>
    </div>
  `;
}

/* ---------------- modal: confirmar cierre de sesión ---------------- */
function renderLogoutModal() {
  if (!state.ui.profile.confirmingLogout) return "";
  return `
    <div class="modal-overlay" data-action="cancel-logout">
      <div class="modal-card" style="max-width:400px" onclick="event.stopPropagation()">
        <div style="display:flex;gap:14px;align-items:flex-start">
          <div class="logout-modal-icon">${icon("logout", 20, "var(--rust)")}</div>
          <div style="flex:1">
            <p style="font-family:'Fraunces',serif;font-size:18px;margin:0">¿Cerrar sesión?</p>
            <p style="color:var(--muted);font-size:13px;margin:6px 0 0">
              Vas a salir de tu cuenta en este dispositivo. Tus datos quedan guardados en la nube, así que puedes volver a entrar cuando quieras.
            </p>
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
          <button class="btn-ghost" data-action="cancel-logout">Cancelar</button>
          <button class="btn-danger" data-action="confirm-logout">${icon("logout", 15, "#fff")}Cerrar sesión</button>
        </div>
      </div>
    </div>
  `;
}

/* ---------------- render principal ---------------- */
export function renderProfile() {
  return `
    <p class="eyebrow">Perfil</p>
    <h2 class="page-title">Tu cuenta</h2>
    ${renderIdentityCard()}
    ${renderBodyCard()}
    ${renderProgressCard()}
    ${renderMeasurementsCard()}
    ${renderPreferencesCard()}
    ${renderAccountCard()}
    ${renderLogoutModal()}
  `;
}

/* ---------------- eventos: identidad ---------------- */
function bindIdentityEvents() {
  const copyBtn = qs('[data-action="copy-member-id"]');
  if (copyBtn) copyBtn.addEventListener("click", async () => {
    const value = copyBtn.dataset.value || "";
    try {
      await navigator.clipboard.writeText(value);
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = `${icon("check", 14)}Copiado`;
      setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
    } catch (err) {
      console.error("No se pudo copiar el ID:", err.message || err);
    }
  });
  const editBtn = qs('[data-action="edit-identity"]');
  if (editBtn) editBtn.addEventListener("click", () => {
    state.ui.profile.editingIdentity = true;
    state.ui.profile.nameDraft = state.displayName || state.data.profile.displayName || "";
    render();
  });
  const cancelBtn = qs('[data-action="cancel-identity"]');
  if (cancelBtn) cancelBtn.addEventListener("click", () => {
    state.ui.profile.editingIdentity = false;
    render();
  });
  const saveBtn = qs('[data-action="save-identity"]');
  if (saveBtn) saveBtn.addEventListener("click", async () => {
    const input = qs("#profile-name-input");
    const name = (input?.value || "").trim();
    state.ui.profile.identitySaving = true;
    render();
    try {
      await updateDisplayName(state.userId, name);
      state.displayName = name;
      state.data.profile.displayName = name;
      persist();
    } catch (err) {
      console.error("No se pudo actualizar el nombre:", err.message || err);
    }
    state.ui.profile.identitySaving = false;
    state.ui.profile.editingIdentity = false;
    render();
  });
}

/* ---------------- eventos: cuerpo ---------------- */
function bindBodyEvents() {
  const saveBtn = qs('[data-action="save-body"]');
  if (saveBtn) saveBtn.addEventListener("click", () => {
    const height = parseFloat(qs("#profile-height").value);
    const goal = parseFloat(qs("#profile-goal").value);
    const unit = qs("#profile-unit").value;
    if (qs("#profile-height").value && (isNaN(height) || height <= 0)) {
      state.ui.profile.bodyFormError = "Ingresa una estatura válida";
      render();
      return;
    }
    if (!qs("#profile-goal").value || isNaN(goal) || goal <= 0) {
      state.ui.profile.bodyFormError = "Ingresa un peso meta válido";
      render();
      return;
    }
    state.data.profile.height = qs("#profile-height").value ? height : null;
    state.data.profile.goalWeight = goal;
    state.data.profile.unit = unit;
    state.ui.profile.bodyFormError = "";
    persist();
    render();
  });
}

/* ---------------- eventos: medidas ---------------- */
function bindMeasurementsEvents() {
  const toggleBtn = qs('[data-action="toggle-add-measurement"]');
  if (toggleBtn) toggleBtn.addEventListener("click", () => {
    state.ui.profile.addingMeasurement = !state.ui.profile.addingMeasurement;
    state.ui.profile.measurementFormError = "";
    state.ui.profile.measurementLabel = "";
    state.ui.profile.measurementValue = "";
    state.ui.profile.measurementUnit = "cm";
    render();
  });

  qsa('[data-action="quick-measurement"]').forEach((b) => b.addEventListener("click", () => {
    qs("#measurement-label").value = b.dataset.label;
    qs("#measurement-label").focus();
  }));

  const saveNewBtn = qs('[data-action="save-new-measurement"]');
  if (saveNewBtn) saveNewBtn.addEventListener("click", () => {
    const label = qs("#measurement-label").value.trim();
    const value = qs("#measurement-value").value;
    const unit = qs("#measurement-unit").value.trim() || "cm";
    if (!label) {
      state.ui.profile.measurementFormError = "Dale un nombre a la medida";
      render();
      return;
    }
    if (!value || isNaN(parseFloat(value))) {
      state.ui.profile.measurementFormError = "Ingresa un valor numérico";
      render();
      return;
    }
    state.data.profile.measurements.push({ id: uid(), label, value: parseFloat(value), unit });
    state.ui.profile.addingMeasurement = false;
    state.ui.profile.measurementFormError = "";
    persist();
    render();
  });

  qsa('[data-action="edit-measurement"]').forEach((b) => b.addEventListener("click", () => {
    state.ui.profile.editingMeasurementId = b.dataset.id;
    render();
  }));
  qsa('[data-action="cancel-edit-measurement"]').forEach((b) => b.addEventListener("click", () => {
    state.ui.profile.editingMeasurementId = null;
    render();
  }));
  qsa('[data-action="save-measurement"]').forEach((b) => b.addEventListener("click", () => {
    const row = qs(`.measurement-row[data-id="${b.dataset.id}"]`);
    const label = row.querySelector(".measurement-edit-label").value.trim();
    const value = parseFloat(row.querySelector(".measurement-edit-value").value);
    const unit = row.querySelector(".measurement-edit-unit").value.trim() || "cm";
    if (!label || isNaN(value)) return;
    const m = state.data.profile.measurements.find((x) => x.id === b.dataset.id);
    if (m) { m.label = label; m.value = value; m.unit = unit; }
    state.ui.profile.editingMeasurementId = null;
    persist();
    render();
  }));
  qsa('[data-action="delete-measurement"]').forEach((b) => b.addEventListener("click", () => {
    state.data.profile.measurements = state.data.profile.measurements.filter((x) => x.id !== b.dataset.id);
    persist();
    render();
  }));
}

/* ---------------- eventos: preferencias ---------------- */
function bindPreferencesEvents() {
  const saveBtn = qs('[data-action="save-preferences"]');
  if (saveBtn) saveBtn.addEventListener("click", () => {
    const defaultView = qs("#setting-default-view").value;
    const restSeconds = parseInt(qs("#setting-rest-seconds").value, 10);
    state.data.settings.defaultView = defaultView;
    state.data.settings.restSeconds = isNaN(restSeconds) || restSeconds < 0 ? 90 : restSeconds;
    persist();
    render();
  });

  qsa('[data-action="set-theme"]').forEach((b) => b.addEventListener("click", () => {
    state.data.settings.theme = b.dataset.theme;
    persist();
    render();
  }));

  const toggleBtn = qs('[data-action="toggle-add-custom-setting"]');
  if (toggleBtn) toggleBtn.addEventListener("click", () => {
    state.ui.profile.addingCustomSetting = !state.ui.profile.addingCustomSetting;
    state.ui.profile.settingsFormError = "";
    state.ui.profile.customLabel = "";
    state.ui.profile.customValue = "";
    render();
  });

  const saveCustomBtn = qs('[data-action="save-custom-setting"]');
  if (saveCustomBtn) saveCustomBtn.addEventListener("click", () => {
    const label = qs("#custom-setting-label").value.trim();
    const value = qs("#custom-setting-value").value.trim();
    if (!label) {
      state.ui.profile.settingsFormError = "Dale un nombre a la opción";
      render();
      return;
    }
    state.data.settings.custom.push({ id: uid(), label, value });
    state.ui.profile.addingCustomSetting = false;
    state.ui.profile.settingsFormError = "";
    persist();
    render();
  });

  qsa('[data-action="delete-custom-setting"]').forEach((b) => b.addEventListener("click", () => {
    state.data.settings.custom = state.data.settings.custom.filter((x) => x.id !== b.dataset.id);
    persist();
    render();
  }));
}

/* ---------------- eventos: cuenta ---------------- */
function bindAccountEvents() {
  const logoutBtn = qs('[data-action="profile-logout"]');
  if (logoutBtn) logoutBtn.addEventListener("click", () => {
    state.ui.profile.confirmingLogout = true;
    render();
  });

  const cancelBtns = qsa('[data-action="cancel-logout"]');
  cancelBtns.forEach((b) => b.addEventListener("click", () => {
    state.ui.profile.confirmingLogout = false;
    render();
  }));

  const confirmBtn = qs('[data-action="confirm-logout"]');
  if (confirmBtn) confirmBtn.addEventListener("click", () => {
    state.ui.profile.confirmingLogout = false;
    performLogout();
  });
}

export function bindProfileEvents() {
  bindIdentityEvents();
  bindBodyEvents();
  bindProgressEvents();
  bindMeasurementsEvents();
  bindPreferencesEvents();
  bindAccountEvents();
}
