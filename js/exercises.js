/* ============================================================
   Catálogo de ejercicios: lectura, formato y CRUD (admin)
   ============================================================ */
import { EXERCISE_TYPES, TIME_UNITS, DIFFICULTY_LEVELS, DIFFICULTY_META } from "./constants.js";
import { uid, fmtDuration, secondsFromValue } from "./utils.js";
import { state, persist } from "./state.js";
import { insertExercise, updateExerciseRow, deleteExerciseRow } from "./storage.js";

export function getAllExercises() { return state.data.exercises; }
export function exerciseById(id) { return state.data.exercises.find((e) => e.id === id); }

export function isTimeBased(exercise) { return exercise && exercise.type === EXERCISE_TYPES.TIME; }

/* Metadatos de dificultad listos para pintar una insignia (etiqueta +
   clase CSS). Si un ejercicio viejo no trae el campo, se asume
   "intermedio" para no dejar la insignia en blanco. */
export function difficultyMeta(exercise) {
  const level = (exercise && exercise.difficulty) || DIFFICULTY_LEVELS.INTERMEDIATE;
  return DIFFICULTY_META[level] || DIFFICULTY_META[DIFFICULTY_LEVELS.INTERMEDIATE];
}

/* Un ejercicio del catálogo general (ownerId null) lo puede editar o
   borrar solo un admin. Un ejercicio personal (ownerId = alguien) lo
   puede editar o borrar su dueño, o un admin. Así cada quien maneja lo
   suyo sin poder tocar lo de otra persona, salvo el admin. */
export function canManageExercise(exercise) {
  if (!exercise) return false;
  if (state.isAdmin) return true;
  return exercise.ownerId === state.userId;
}

/* Para mostrar de quién es cada fila en la Biblioteca. */
export function exerciseOwnership(exercise) {
  if (!exercise.ownerId) return "global";
  if (exercise.ownerId === state.userId) return "own";
  return "other"; // solo lo puede ver un admin
}

/* Genera el ítem de plan por defecto para un ejercicio, respetando su tipo. */
export function defaultPlanItem(exercise) {
  if (isTimeBased(exercise)) {
    return { exerciseId: exercise.id, sets: 1, target: exercise.defaultTarget || 20, unit: exercise.defaultUnit || TIME_UNITS.MIN };
  }
  return { exerciseId: exercise.id, sets: 3, target: 10, unit: "reps" };
}

/* "3 × 10 reps" | "3 × 30 seg" | "1 × 20 min" */
export function formatPlanTarget(item) {
  const unitLabel = item.unit === "reps" ? "reps" : item.unit;
  return `${item.sets} × ${item.target} ${unitLabel}`;
}

/* Registra una serie según el tipo de ejercicio.
   reps  -> { type: "reps", weight, reps }
   time  -> { type: "time", durationSec } */
export function buildSet(exercise, { weight, reps, durationValue, durationUnit } = {}) {
  if (isTimeBased(exercise)) {
    return { type: EXERCISE_TYPES.TIME, durationSec: secondsFromValue(durationValue, durationUnit) };
  }
  return { type: EXERCISE_TYPES.REPS, weight, reps };
}

export function formatSet(set, unit) {
  if (set.type === EXERCISE_TYPES.TIME) return fmtDuration(set.durationSec);
  return `${set.weight} × ${set.reps}`;
}

/* ---------------- CRUD (usado por Biblioteca / Admin) ----------------
   El catálogo de ejercicios ya no vive en el jsonb de cada usuario:
   es la tabla compartida `exercises` (ver storage.js y
   supabase/schema.sql), así que estas funciones ahora son async y
   escriben directo ahí. Un admin agrega al catálogo general (lo ve
   todo el mundo); cualquier otra persona agrega a su propia biblioteca
   personal (solo ella, o un admin, la ve), así que si dos usuarios
   agregan ejercicios parecidos no chocan entre sí. */
export async function addExercise({ name, muscle, equipment, type, difficulty, defaultUnit, defaultTarget, imageUrl, description }) {
  const ownerId = state.isAdmin ? null : state.userId;
  const ex = await insertExercise({ id: uid(), name, muscle, equipment, type, difficulty, defaultUnit, defaultTarget, imageUrl, description, ownerId });
  state.data.exercises.push(ex);
  state.data.exercises.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return ex;
}

export async function updateExercise(id, patch) {
  const ex = exerciseById(id);
  if (!ex) return;
  await updateExerciseRow(id, { ...ex, ...patch });
  Object.assign(ex, patch);
}

/* Elimina el ejercicio del catálogo y lo retira de cualquier día del
   plan semanal en el que estuviera asignado, para no dejar referencias
   colgantes. El historial ya registrado se conserva tal cual. */
export async function deleteExercise(id) {
  await deleteExerciseRow(id);
  state.data.exercises = state.data.exercises.filter((e) => e.id !== id);
  Object.keys(state.data.weeklyPlan).forEach((day) => {
    state.data.weeklyPlan[day] = state.data.weeklyPlan[day].filter((item) => item.exerciseId !== id);
  });
  persist(); // el plan semanal sigue viviendo en el jsonb del usuario
}
