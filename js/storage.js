/* ============================================================
   Persistencia en Supabase (autenticación + datos de la app)
   Reemplaza por completo el antiguo almacenamiento en localStorage:
   ahora la sesión vive en Supabase Auth y los datos de cada persona
   viven en la tabla `user_data` (una fila jsonb por usuario), protegida
   con Row Level Security. Ver supabase/schema.sql.
   ============================================================ */
import { supabase } from "./supabaseClient.js";
import {
  WEEKDAYS,
  SEED_EXERCISES, EXERCISE_TYPES, TIME_UNITS, DIFFICULTY_LEVELS,
} from "./constants.js";

/* ---------------- forma de los datos de gimnasio de un usuario ---------------- */
export function emptyData() {
  const weeklyPlan = {};
  const dayRecommendations = {};
  WEEKDAYS.forEach((d) => { weeklyPlan[d] = []; dayRecommendations[d] = ""; });
  return {
    profile: { goalWeight: 75, unit: "kg", height: null, displayName: "", measurements: [] },
    weightLogs: [],
    // Placeholder hasta que loadExerciseLibrary() traiga el catálogo
    // real desde Supabase (ver hydrateFromSession en state.js). Se deja
    // la semilla aquí solo para que la app no se vea vacía un instante.
    exercises: SEED_EXERCISES.map((e) => ({ ...e })),
    weeklyPlan,
    dayRecommendations,
    dayOverrides: {},
    history: [],
    planCompletions: [],
    settings: { restSeconds: 90, defaultView: "today", theme: "claro", custom: [] },
  };
}

/* Convierte datos guardados por versiones anteriores (localStorage, o
   versiones previas del esquema) al modelo actual, sin perder el
   progreso ya registrado por el usuario. El "market" (productos y
   solicitudes) y el directorio de usuarios ya NO viven aquí: ahora son
   tablas compartidas reales (`products`, `market_requests`,
   `profiles`) en vez de datos embebidos por usuario. */
function migrate(raw) {
  const data = Object.assign(emptyData(), raw || {});
  data.profile = { goalWeight: 75, unit: "kg", height: null, displayName: "", measurements: [], ...((raw && raw.profile) || {}) };
  if (!Array.isArray(data.profile.measurements)) data.profile.measurements = [];
  data.settings = { restSeconds: 90, defaultView: "today", theme: "claro", custom: [], ...((raw && raw.settings) || {}) };
  if (!Array.isArray(data.settings.custom)) data.settings.custom = [];

  if (!Array.isArray(raw?.exercises)) {
    const custom = Array.isArray(raw?.customExercises) ? raw.customExercises : [];
    data.exercises = SEED_EXERCISES.map((e) => ({ ...e })).concat(
      custom.map((e) => ({ type: EXERCISE_TYPES.REPS, ...e }))
    );
  }
  data.exercises = data.exercises.map((e) => ({
    type: EXERCISE_TYPES.REPS,
    defaultUnit: e.type === EXERCISE_TYPES.TIME ? (e.defaultUnit || TIME_UNITS.SEG) : undefined,
    defaultTarget: e.type === EXERCISE_TYPES.TIME ? (e.defaultTarget || 30) : undefined,
    difficulty: e.difficulty || DIFFICULTY_LEVELS.INTERMEDIATE,
    ...e,
  }));
  delete data.customExercises;

  WEEKDAYS.forEach((day) => {
    data.weeklyPlan[day] = (data.weeklyPlan[day] || []).map((item) => normalizePlanItem(item, data.exercises));
  });

  data.history = (data.history || []).map((session) => ({
    ...session,
    exercises: (session.exercises || []).map((se) => ({
      ...se,
      sets: (se.sets || []).map((s) => normalizeSet(s)),
    })),
  }));

  // Campos viejos que ya no aplican con backend real (multiusuario de
  // verdad ya viene de Supabase Auth / tabla profiles).
  delete data.products;
  delete data.marketRequests;
  delete data.registeredUsers;

  return data;
}

function normalizePlanItem(item, exercises) {
  if (item.target !== undefined && item.unit !== undefined) return item;
  const ex = exercises.find((e) => e.id === item.exerciseId);
  if (ex && ex.type === EXERCISE_TYPES.TIME) {
    return { exerciseId: item.exerciseId, sets: item.sets || 1, target: item.duration || ex.defaultTarget || 30, unit: ex.defaultUnit || TIME_UNITS.SEG };
  }
  return { exerciseId: item.exerciseId, sets: item.sets || 3, target: item.reps || item.target || 10, unit: "reps" };
}

function normalizeSet(s) {
  if (s.type) return s;
  if (s.durationSec !== undefined) return { type: EXERCISE_TYPES.TIME, durationSec: s.durationSec };
  return { type: EXERCISE_TYPES.REPS, weight: s.weight || 0, reps: s.reps || 0 };
}

/* ---------------- catálogo de ejercicios (tabla compartida `exercises`) ----------------
   Ya no vive embebido en `user_data.data.exercises`. Cada fila con
   owner_id = null es del catálogo general (la ve cualquier persona);
   cada fila con owner_id = un usuario es un ejercicio personal que
   solo esa persona (o un admin) puede ver, así que si varias personas
   agregan ejercicios parecidos no se pisan ni se duplican entre sí.
   Ver "exercises: ..." en supabase/schema.sql para las políticas y el
   índice único que impide nombres repetidos por ámbito. */
function rowToExercise(row) {
  const ex = {
    id: row.id,
    name: row.name,
    muscle: row.muscle,
    equipment: row.equipment,
    type: row.type,
    difficulty: row.difficulty || DIFFICULTY_LEVELS.INTERMEDIATE,
    imageUrl: row.image_url || "",
    description: row.description || "",
    ownerId: row.owner_id,
  };
  if (row.type === EXERCISE_TYPES.TIME) {
    ex.defaultUnit = row.default_unit || TIME_UNITS.SEG;
    ex.defaultTarget = row.default_target || 30;
  }
  return ex;
}

export async function loadExerciseLibrary() {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, muscle, equipment, type, difficulty, default_unit, default_target, image_url, description, owner_id")
    .order("name");
  if (error) throw error;
  return (data || []).map(rowToExercise);
}

/* Lanza un error con `.code === "duplicate_name"` si el nombre ya
   existe en ese ámbito (catálogo general, o la biblioteca personal de
   ese owner), para que la vista pueda mostrar un mensaje amable. */
export async function insertExercise({ id, name, muscle, equipment, type, difficulty, defaultUnit, defaultTarget, imageUrl, description, ownerId }) {
  const payload = {
    id, name, muscle, equipment: equipment || "", type,
    difficulty: difficulty || DIFFICULTY_LEVELS.INTERMEDIATE,
    default_unit: type === EXERCISE_TYPES.TIME ? (defaultUnit || TIME_UNITS.SEG) : null,
    default_target: type === EXERCISE_TYPES.TIME ? (defaultTarget || 30) : null,
    image_url: imageUrl || "",
    description: description || "",
    owner_id: ownerId,
  };
  const { data, error } = await supabase.from("exercises").insert(payload).select().maybeSingle();
  if (error) {
    if (error.code === "23505") { const e = new Error("Ya existe un ejercicio con ese nombre"); e.code = "duplicate_name"; throw e; }
    throw error;
  }
  return rowToExercise(data);
}

export async function updateExerciseRow(id, { name, muscle, equipment, type, difficulty, defaultUnit, defaultTarget, imageUrl, description }) {
  const payload = { name, muscle, equipment: equipment || "", type, difficulty: difficulty || DIFFICULTY_LEVELS.INTERMEDIATE, image_url: imageUrl || "", description: description || "" };
  payload.default_unit = type === EXERCISE_TYPES.TIME ? (defaultUnit || TIME_UNITS.SEG) : null;
  payload.default_target = type === EXERCISE_TYPES.TIME ? (defaultTarget || 30) : null;
  const { error } = await supabase.from("exercises").update(payload).eq("id", id);
  if (error) {
    if (error.code === "23505") { const e = new Error("Ya existe un ejercicio con ese nombre"); e.code = "duplicate_name"; throw e; }
    throw error;
  }
}

export async function deleteExerciseRow(id) {
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- autenticación (Supabase Auth) ---------------- */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  await supabase.auth.signOut();
}

/* ---------------- perfil (rol de admin real, no una contraseña fija) ---------------- */
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, is_admin, member_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDisplayName(userId, displayName) {
  await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId);
}

/* ---------------- datos de gimnasio por usuario (tabla user_data) ---------------- */
export async function loadUserData(userId) {
  const { data, error } = await supabase
    .from("user_data")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const fresh = emptyData();
    await saveUserData(userId, fresh);
    return fresh;
  }
  return migrate(data.data);
}

export async function saveUserData(userId, data) {
  const { error } = await supabase
    .from("user_data")
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

/* ---------------- panel de admin: actividad real de todos los usuarios ----------------
   Antes esto era un directorio falso guardado en el mismo navegador.
   Ahora, gracias a RLS ("user_data: admin select all" en schema.sql),
   un admin de verdad puede leer los datos de todas las personas. */
export async function loadAllUserActivity() {
  const { data, error } = await supabase
    .from("user_data")
    .select("user_id, data, profiles!inner(email, display_name, is_admin, member_id)");
  if (error) throw error;
  return (data || [])
    .filter((row) => !row.profiles.is_admin)
    .map((row) => ({
      id: row.user_id,
      memberId: row.profiles.member_id || "",
      email: row.profiles.email,
      displayName: row.profiles.display_name,
      history: (row.data && row.data.history) || [],
    }));
}

/* Busca un usuario por su member_id corto (ej: "A3F9K2") para el buscador
   del panel de admin. Devuelve { id } si existe, o null si no hay coincidencia. */
export async function findUserByMemberId(memberId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("member_id", memberId.trim())
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/* ---------------- panel de admin: rutina + mensajes por usuario ----------------
   `loadUserData` y `saveUserData` (arriba) ya sirven para leer y
   escribir los datos de gimnasio de CUALQUIER usuario cuando quien
   llama es un admin real: la lectura la permite "user_data: admin
   select all" y la escritura "user_data: admin update/insert" en
   schema.sql. El admin los usa para abrir la cuenta de una persona,
   armarle el plan de un día concreto y guardarlo. */

/* ---------------- mensajes del entrenador ---------------- */
export async function sendCoachMessage(userId, senderId, body) {
  const { error } = await supabase
    .from("coach_messages")
    .insert({ user_id: userId, sender_id: senderId, body });
  if (error) throw error;
}

export async function fetchMessagesForUser(userId) {
  const { data, error } = await supabase
    .from("coach_messages")
    .select("id, body, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function markMessageRead(id) {
  const { error } = await supabase.from("coach_messages").update({ read: true }).eq("id", id);
  if (error) throw error;
}
