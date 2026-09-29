/* ================= BIBLIOTECA (+ administración de ejercicios) ================= */
import { state } from "../state.js";
import { MUSCLE_GROUPS, EQUIPMENT_TYPES, EXERCISE_TYPES, TIME_UNITS, DIFFICULTY_LEVELS, DIFFICULTY_ORDER, DIFFICULTY_META } from "../constants.js";
import { esc, qs, qsa } from "../utils.js";
import { icon } from "../icons.js";
import { getAllExercises, isTimeBased, addExercise, updateExercise, deleteExercise, canManageExercise, exerciseOwnership, difficultyMeta } from "../exercises.js";
import { render } from "../app.js";

/* Insignia de dificultad: chip pequeño y coloreado, reutilizado en la
   fila de la biblioteca, el modal de detalle y la pantalla de
   entrenamiento guiado, para que se reconozca de un vistazo. */
export function difficultyBadgeHtml(exercise) {
  const meta = difficultyMeta(exercise);
  return `<span class="difficulty-badge ${meta.className}">${icon("bolt", 11)}${meta.label}</span>`;
}

/* Selector de dificultad: tres botones tipo "chip" en vez de un
   <select>, así se ve y se siente como parte del resto de insignias de
   la app, con una animación breve al cambiar de selección. */
export function difficultySelectorHtml(idPrefix, current) {
  const level = current?.difficulty || DIFFICULTY_LEVELS.INTERMEDIATE;
  return `
    <div class="difficulty-picker" id="${idPrefix}-difficulty" data-value="${level}">
      ${DIFFICULTY_ORDER.map((d) => `
        <button type="button" class="difficulty-chip ${DIFFICULTY_META[d].className} ${d === level ? "active" : ""}" data-difficulty="${d}">
          ${DIFFICULTY_META[d].label}
        </button>
      `).join("")}
    </div>
  `;
}

export function bindDifficultySelector(idPrefix) {
  const picker = qs(`#${idPrefix}-difficulty`);
  if (!picker) return;
  qsa(`#${idPrefix}-difficulty .difficulty-chip`).forEach((chip) => {
    chip.addEventListener("click", () => {
      picker.dataset.value = chip.dataset.difficulty;
      qsa(`#${idPrefix}-difficulty .difficulty-chip`).forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      chip.classList.add("difficulty-chip-pulse");
      setTimeout(() => chip.classList.remove("difficulty-chip-pulse"), 260);
    });
  });
}

export function typeSelectorHtml(idPrefix, current) {
  const type = current?.type || EXERCISE_TYPES.REPS;
  const unit = current?.defaultUnit || TIME_UNITS.SEG;
  const target = current?.defaultTarget ?? 30;
  return `
    <div style="display:flex;gap:10px;margin-top:8px">
      <select id="${idPrefix}-type" class="select-input">
        <option value="${EXERCISE_TYPES.REPS}" ${type === EXERCISE_TYPES.REPS ? "selected" : ""}>Por repeticiones</option>
        <option value="${EXERCISE_TYPES.TIME}" ${type === EXERCISE_TYPES.TIME ? "selected" : ""}>Por tiempo</option>
      </select>
    </div>
    <div id="${idPrefix}-time-fields" style="display:${type === EXERCISE_TYPES.TIME ? "flex" : "none"};gap:10px;margin-top:8px">
      <input id="${idPrefix}-target" type="number" class="num-input" placeholder="objetivo por defecto" value="${target}" />
      <select id="${idPrefix}-unit" class="select-input">
        <option value="${TIME_UNITS.SEG}" ${unit === TIME_UNITS.SEG ? "selected" : ""}>segundos</option>
        <option value="${TIME_UNITS.MIN}" ${unit === TIME_UNITS.MIN ? "selected" : ""}>minutos</option>
      </select>
    </div>
  `;
}

export function bindTypeSelector(idPrefix) {
  const typeSel = qs(`#${idPrefix}-type`);
  if (!typeSel) return;
  typeSel.addEventListener("change", () => {
    const fields = qs(`#${idPrefix}-time-fields`);
    fields.style.display = typeSel.value === EXERCISE_TYPES.TIME ? "flex" : "none";
  });
}

/* Campo de imagen: una URL (subir un archivo requeriría un backend de
   almacenamiento aparte). Con vista previa en vivo para que la persona
   confirme que el enlace sí muestra una imagen antes de guardar. */
export function imageFieldHtml(idPrefix, current) {
  const url = current?.imageUrl || "";
  const description = current?.description || "";
  return `
    <div class="input-row" style="margin-top:8px">
      <input id="${idPrefix}-image" class="num-input" placeholder="URL de una imagen (opcional)" value="${esc(url)}" />
    </div>
    <div id="${idPrefix}-image-preview" style="margin-top:8px">${imagePreviewHtml(url)}</div>
    <div class="input-row" style="margin-top:8px">
      <textarea id="${idPrefix}-description" class="textarea-input" rows="3" placeholder="Descripción: cómo realizarlo bien (postura, movimiento, errores a evitar)">${esc(description)}</textarea>
    </div>
  `;
}

function imagePreviewHtml(url) {
  if (!url) return "";
  return `<img src="${esc(url)}" alt="" class="exercise-image-preview" onerror="this.remove()" />`;
}

export function bindImageField(idPrefix) {
  const input = qs(`#${idPrefix}-image`);
  const preview = qs(`#${idPrefix}-image-preview`);
  if (!input || !preview) return;
  input.addEventListener("input", () => { preview.innerHTML = imagePreviewHtml(input.value.trim()); });
}

export function renderLibraryList(q) {
  const all = getAllExercises();
  const filtered = all.filter((e) => (e.name + " " + e.muscle + " " + e.equipment).toLowerCase().includes(q.toLowerCase()));
  const grouped = {};
  filtered.forEach((e) => { (grouped[e.muscle] = grouped[e.muscle] || []).push(e); });
  return Object.keys(grouped).sort().map((m) => `
    <div style="margin-top:18px">
      <p class="group-label">${m}</p>
      <ul style="list-style:none;padding:0;margin:0">
        ${grouped[m].map((e) => renderLibraryRow(e)).join("")}
      </ul>
    </div>
  `).join("");
}

function ownerBadgeHtml(e) {
  const ownership = exerciseOwnership(e);
  if (ownership === "own") return `<span class="owner-badge owner-badge-own">Tuyo</span>`;
  if (ownership === "other") return `<span class="owner-badge owner-badge-other">De otro usuario</span>`;
  return "";
}

function thumbHtml(e) {
  if (e.imageUrl) {
    return `<button type="button" class="exercise-thumb" data-action="view-exercise" data-id="${e.id}" title="Ver imagen y cómo realizarlo">
      <img src="${esc(e.imageUrl)}" alt="${esc(e.name)}" onerror="this.parentElement.classList.add('exercise-thumb-empty');this.remove()" />
    </button>`;
  }
  return `<button type="button" class="exercise-thumb exercise-thumb-empty" data-action="view-exercise" data-id="${e.id}" title="Ver cómo realizarlo">${icon("image", 16, "var(--muted-2)")}</button>`;
}

function renderLibraryRow(e) {
  const typeLabel = isTimeBased(e) ? `por tiempo (${e.defaultTarget} ${e.defaultUnit})` : e.equipment;
  if (state.ui.editingExerciseId === e.id) return renderEditExerciseForm(e);
  return `
    <li class="library-row library-row-animated">
      <span class="library-row-main">
        ${thumbHtml(e)}
        <span class="library-row-name">${esc(e.name)}</span>
        ${difficultyBadgeHtml(e)}
        ${ownerBadgeHtml(e)}
      </span>
      <span style="display:flex;align-items:center;gap:10px">
        <span style="color:var(--muted);font-size:12px">${typeLabel}</span>
        <button class="icon-btn" data-action="view-exercise" data-id="${e.id}" title="Ver imagen y cómo realizarlo">${icon("eye", 14, "var(--muted)")}</button>
        ${canManageExercise(e) ? `
          <button class="icon-btn" data-action="edit-exercise" data-id="${e.id}">${icon("edit", 14, "var(--muted)")}</button>
          <button class="icon-btn" data-action="delete-exercise" data-id="${e.id}">${icon("trash", 14, "var(--rust)")}</button>
        ` : ""}
      </span>
    </li>
  `;
}

/* Modal de detalle: imagen grande + descripción de cómo realizarlo.
   Se abre desde la miniatura o el ícono de ojo de cualquier fila, y
   también se podría abrir apenas se agrega un ejercicio nuevo. */
function renderExerciseDetailModal() {
  const e = getAllExercises().find((x) => x.id === state.ui.viewingExerciseId);
  if (!e) return "";
  const typeLabel = isTimeBased(e) ? `Por tiempo · objetivo ${e.defaultTarget} ${e.defaultUnit}` : `Por repeticiones · ${e.equipment}`;
  return `
    <div class="modal-overlay" data-action="close-exercise-detail">
      <div class="modal-card" style="width:min(520px, 100%);max-height:88vh;overflow:auto" onclick="event.stopPropagation()">
        <div class="modal-head-row">
          <p style="font-family:'Fraunces',serif;font-size:19px;margin:0">${esc(e.name)}</p>
          <button class="icon-btn" data-action="close-exercise-detail">${icon("x", 16)}</button>
        </div>
        <span class="exercise-detail-meta">${esc(e.muscle)} · ${esc(typeLabel)}</span>
        ${difficultyBadgeHtml(e)}
        ${e.imageUrl
          ? `<img src="${esc(e.imageUrl)}" alt="${esc(e.name)}" class="exercise-detail-image" onerror="this.remove()" />`
          : `<div class="exercise-detail-image exercise-detail-image-empty">${icon("image", 28, "var(--muted-2)")}</div>`}
        <div class="exercise-detail-howto">
          <p class="card-label" style="margin:0 0 6px">Cómo realizarlo</p>
          <p style="font-size:14px;line-height:1.5;margin:0">${e.description ? esc(e.description) : "Todavía no tiene una descripción. " + (canManageExercise(e) ? "Puedes agregarla editando este ejercicio." : "")}</p>
        </div>
      </div>
    </div>
  `;
}

function renderEditExerciseForm(e) {
  return `
    <li class="library-row" style="display:block;padding:12px 0">
      <div class="input-row"><input id="edit-ex-name" class="num-input" value="${esc(e.name)}" /></div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <select id="edit-ex-muscle" class="select-input">
          ${MUSCLE_GROUPS.map((m) => `<option value="${m}" ${m === e.muscle ? "selected" : ""}>${m}</option>`).join("")}
        </select>
        <select id="edit-ex-equipment" class="select-input">
          ${EQUIPMENT_TYPES.map((eq) => `<option value="${eq}" ${eq === e.equipment ? "selected" : ""}>${eq}</option>`).join("")}
        </select>
      </div>
      ${typeSelectorHtml("edit-ex", e)}
      <p class="card-label" style="margin:10px 0 4px">Dificultad</p>
      ${difficultySelectorHtml("edit-ex", e)}
      ${imageFieldHtml("edit-ex", e)}
      ${state.ui.formError ? `<p class="error-text">${esc(state.ui.formError)}</p>` : ""}
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-primary-sm" data-action="save-edit-exercise" data-id="${e.id}">Guardar cambios</button>
        <button class="btn-ghost-sm" data-action="cancel-edit-exercise">Cancelar</button>
      </div>
    </li>
  `;
}

export function renderLibrary() {
  const all = getAllExercises();
  const ownCount = all.filter((e) => exerciseOwnership(e) === "own").length;
  return `
    <p class="eyebrow">Biblioteca de ejercicios</p>
    <h2 class="page-title">${all.length} ejercicios</h2>
    ${state.isAdmin
      ? `<p style="color:var(--muted);font-size:13px;margin:-8px 0 12px">Como administrador puedes editar o eliminar cualquier ejercicio del catálogo, y lo que agregues aquí lo verá todo el mundo. Los ejercicios marcados <span class="owner-badge owner-badge-other" style="margin:0 2px">de otro usuario</span> solo son visibles para ti por ser admin.</p>`
      : `<p style="color:var(--muted);font-size:13px;margin:-8px 0 12px">El catálogo general lo comparten todas las personas. Lo que agregues tú queda marcado como <span class="owner-badge owner-badge-own" style="margin:0 2px">Tuyo</span>${ownCount ? ` (tienes ${ownCount})` : ""} y solo tú lo ves en tu biblioteca; nadie más puede verlo ni repetirlo.</p>`}
    <div class="search-row">
      ${icon("search", 14, "var(--muted)")}
      <input id="library-search" class="search-input" placeholder="Buscar por nombre, músculo o equipo" />
    </div>
    <button class="btn-ghost-sm" style="margin-top:10px" data-action="toggle-add-exercise">${icon("plus", 14)}Agregar ejercicio${state.isAdmin ? "" : " personalizado"}</button>
    <div id="add-exercise-form">${state.ui.adding ? renderAddExerciseForm() : ""}</div>
    <div id="library-list">${renderLibraryList("")}</div>
    ${renderExerciseDetailModal()}
  `;
}

function renderAddExerciseForm() {
  const err = state.ui.formError;
  return `
    <div class="card" style="margin-top:10px">
      <div class="input-row"><input id="new-ex-name" class="num-input" placeholder="Nombre del ejercicio" /></div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <select id="new-ex-muscle" class="select-input">
          ${MUSCLE_GROUPS.map((m) => `<option value="${m}">${m}</option>`).join("")}
        </select>
        <select id="new-ex-equipment" class="select-input">
          ${EQUIPMENT_TYPES.map((eq) => `<option value="${eq}">${eq}</option>`).join("")}
        </select>
      </div>
      ${typeSelectorHtml("new-ex", null)}
      <p class="card-label" style="margin:10px 0 4px">Dificultad</p>
      ${difficultySelectorHtml("new-ex", null)}
      ${imageFieldHtml("new-ex", null)}
      <p style="color:var(--muted);font-size:12px;margin:8px 0 0">
        ${state.isAdmin ? "Se agregará al catálogo general: lo verá todo el mundo." : "Solo tú verás este ejercicio en tu biblioteca."}
      </p>
      ${err ? `<p class="error-text">${esc(err)}</p>` : ""}
      <button class="btn-primary-sm" style="margin-top:10px" data-action="save-custom-exercise" data-saving="0">Guardar ejercicio</button>
    </div>
  `;
}

export function bindLibraryEvents() {
  const searchInput = qs("#library-search");
  if (searchInput) searchInput.addEventListener("input", () => {
    qs("#library-list").innerHTML = renderLibraryList(searchInput.value);
    bindLibraryRowEvents();
  });
  const toggleBtn = qs('[data-action="toggle-add-exercise"]');
  if (toggleBtn) toggleBtn.addEventListener("click", () => {
    state.ui.adding = !state.ui.adding;
    state.ui.formError = "";
    qs("#add-exercise-form").innerHTML = state.ui.adding ? renderAddExerciseForm() : "";
    bindAddExerciseForm();
  });
  bindAddExerciseForm();
  bindLibraryRowEvents();
  bindExerciseDetailModal();
}

function bindExerciseDetailModal() {
  qsa('[data-action="view-exercise"]').forEach((b) => b.addEventListener("click", () => {
    state.ui.viewingExerciseId = b.dataset.id;
    render();
  }));
  qsa('[data-action="close-exercise-detail"]').forEach((b) => b.addEventListener("click", () => {
    state.ui.viewingExerciseId = null;
    render();
  }));
}

function bindAddExerciseForm() {
  bindTypeSelector("new-ex");
  bindDifficultySelector("new-ex");
  bindImageField("new-ex");
  const saveBtn = qs('[data-action="save-custom-exercise"]');
  if (!saveBtn) return;
  saveBtn.addEventListener("click", async () => {
    const name = qs("#new-ex-name").value.trim();
    if (!name) {
      state.ui.formError = "Dale un nombre al ejercicio";
      qs("#add-exercise-form").innerHTML = renderAddExerciseForm();
      bindAddExerciseForm();
      return;
    }
    // Aviso temprano de duplicado (el índice único de Supabase es la
    // fuente de verdad final, esto solo evita el viaje de red obvio).
    const scope = state.isAdmin ? "global" : "own";
    const exists = getAllExercises().some((e) => exerciseOwnership(e) === scope && e.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      state.ui.formError = "Ya existe un ejercicio con ese nombre";
      qs("#add-exercise-form").innerHTML = renderAddExerciseForm();
      bindAddExerciseForm();
      return;
    }
    const muscle = qs("#new-ex-muscle").value;
    const equipment = qs("#new-ex-equipment").value;
    const type = qs("#new-ex-type").value;
    const difficulty = qs("#new-ex-difficulty")?.dataset.value || DIFFICULTY_LEVELS.INTERMEDIATE;
    const defaultUnit = qs("#new-ex-unit")?.value;
    const defaultTarget = parseFloat(qs("#new-ex-target")?.value);
    const imageUrl = qs("#new-ex-image")?.value.trim();
    const description = qs("#new-ex-description")?.value.trim();
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando…";
    try {
      const created = await addExercise({ name, muscle, equipment, type, difficulty, defaultUnit, defaultTarget: isNaN(defaultTarget) ? undefined : defaultTarget, imageUrl, description });
      state.ui.adding = false;
      state.ui.formError = "";
      state.ui.viewingExerciseId = created.id; // así lo ve de inmediato, con imagen y descripción
      render();
    } catch (err) {
      state.ui.formError = err.code === "duplicate_name" ? err.message : "No se pudo guardar el ejercicio";
      qs("#add-exercise-form").innerHTML = renderAddExerciseForm();
      bindAddExerciseForm();
    }
  });
}

function bindLibraryRowEvents() {
  qsa('[data-action="edit-exercise"]').forEach((b) => b.addEventListener("click", () => {
    state.ui.editingExerciseId = b.dataset.id;
    state.ui.formError = "";
    qs("#library-list").innerHTML = renderLibraryList(qs("#library-search")?.value || "");
    bindLibraryRowEvents();
    bindTypeSelector("edit-ex");
    bindDifficultySelector("edit-ex");
    bindImageField("edit-ex");
  }));
  qsa('[data-action="cancel-edit-exercise"]').forEach((b) => b.addEventListener("click", () => {
    state.ui.editingExerciseId = null;
    state.ui.formError = "";
    qs("#library-list").innerHTML = renderLibraryList(qs("#library-search")?.value || "");
    bindLibraryRowEvents();
  }));
  qsa('[data-action="save-edit-exercise"]').forEach((b) => b.addEventListener("click", async () => {
    const name = qs("#edit-ex-name").value.trim();
    if (!name) return;
    const patch = {
      name,
      muscle: qs("#edit-ex-muscle").value,
      equipment: qs("#edit-ex-equipment").value,
      type: qs("#edit-ex-type").value,
      difficulty: qs("#edit-ex-difficulty")?.dataset.value || DIFFICULTY_LEVELS.INTERMEDIATE,
      imageUrl: qs("#edit-ex-image")?.value.trim() || "",
      description: qs("#edit-ex-description")?.value.trim() || "",
    };
    if (patch.type === EXERCISE_TYPES.TIME) {
      patch.defaultUnit = qs("#edit-ex-unit").value;
      const t = parseFloat(qs("#edit-ex-target").value);
      patch.defaultTarget = isNaN(t) ? 30 : t;
    } else {
      patch.defaultUnit = undefined;
      patch.defaultTarget = undefined;
    }
    b.disabled = true;
    try {
      await updateExercise(b.dataset.id, patch);
      state.ui.editingExerciseId = null;
      state.ui.formError = "";
      render();
    } catch (err) {
      state.ui.formError = err.code === "duplicate_name" ? err.message : "No se pudo guardar el ejercicio";
      qs("#library-list").innerHTML = renderLibraryList(qs("#library-search")?.value || "");
      bindLibraryRowEvents();
      bindTypeSelector("edit-ex");
      bindDifficultySelector("edit-ex");
      bindImageField("edit-ex");
    }
  }));
  qsa('[data-action="delete-exercise"]').forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este ejercicio del catálogo? También se quitará de cualquier día del plan que lo use.")) return;
    await deleteExercise(b.dataset.id);
    render();
  }));
  bindTypeSelector("edit-ex");
  bindDifficultySelector("edit-ex");
  bindImageField("edit-ex");
  bindExerciseDetailModal();
}
