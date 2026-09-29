/* ============================================================
   Estado global de la aplicación
   ============================================================
   Ya no se carga nada de forma síncrona desde localStorage: el estado
   arranca "vacío/no listo" y `init()` lo llena de forma asíncrona
   consultando la sesión de Supabase Auth y, si hay sesión, los datos
   del usuario. app.js espera a `init()` antes del primer render. */
import { jsWeekdayToKey, fixMisdatedPlanCompletions } from "./utils.js";
import {
  getSession, fetchProfile, loadUserData, saveUserData, emptyData, loadExerciseLibrary,
} from "./storage.js";

export const state = {
  ready: false,       // true cuando init() terminó de resolver
  authed: false,
  isAdmin: false,
  userId: null,
  userEmail: "",
  displayName: "",
  memberId: "",
  data: emptyData(),
  view: "today",
  ui: {
    activePlanDay: jsWeekdayToKey(new Date()),
    rescheduling: false,
    picking: false,
    adding: false,
    editingExerciseId: null,
    viewingExerciseId: null,
    workout: null, // { step, exIndex, sessionLogs, bodyWeight, restLeft }
    restTimerId: null,
    loginSubmitting: false,
    loginError: "",
    loginInfo: "",
    authMode: "login", // "login" | "signup"
    signupStep: 1, // 1: cuenta, 2: cuerpo
    signupError: "",
    signupSubmitting: false,
    signup: { name: "", email: "", password: "", confirm: "", weight: "", unit: "kg", height: "", goalWeight: "" },
    formError: "",
    market: {
      query: "",
      brand: "",
      minPrice: "",
      maxPrice: "",
      selectedProductId: null,
      requestQty: 1,
      requestError: "",
      adminTab: "productos", // "productos" | "solicitudes"
      adding: false,
      editingProductId: null,
      formError: "",
    },
    profile: {
      editingIdentity: false,
      nameDraft: "",
      identitySaving: false,
      bodyFormError: "",
      addingMeasurement: false,
      measurementLabel: "",
      measurementValue: "",
      measurementUnit: "cm",
      editingMeasurementId: null,
      measurementFormError: "",
      addingCustomSetting: false,
      customLabel: "",
      customValue: "",
      settingsFormError: "",
      confirmingLogout: false,
    },
  },
};

/* Guarda los datos de gimnasio del usuario actual en Supabase.
   Se hace un pequeño "debounce" para no disparar una escritura por
   cada tecla/click cuando varias mutaciones ocurren seguidas. */
let saveTimer = null;
export function persist() {
  if (!state.authed || !state.userId) return;
  const userId = state.userId;
  // El catálogo de ejercicios ya no se guarda aquí: vive en la tabla
  // compartida `exercises` y se escribe aparte (ver exercises.js). Se
  // excluye del snapshot para no dejar una copia vieja/duplicada
  // dando vueltas dentro del jsonb de cada usuario.
  const { exercises, ...rest } = state.data;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveUserData(userId, rest).catch((err) => {
      console.error("No se pudo guardar en Supabase:", err.message || err);
    });
  }, 300);
}

/* Carga sesión + perfil + datos antes de que la app pueda renderizar
   la interfaz autenticada. Se reutiliza tanto al arrancar la app como
   justo después de iniciar sesión / crear una cuenta. */
export async function hydrateFromSession(session) {
  if (!session) {
    state.authed = false;
    state.isAdmin = false;
    state.userId = null;
    state.userEmail = "";
    state.displayName = "";
    state.memberId = "";
    state.data = emptyData();
    return;
  }
  const user = session.user;
  const [profile, data] = await Promise.all([
    fetchProfile(user.id),
    loadUserData(user.id),
  ]);
  state.authed = true;
  state.userId = user.id;
  state.userEmail = user.email || "";
  state.isAdmin = !!(profile && profile.is_admin);
  state.displayName = (profile && profile.display_name) || "";
  state.memberId = (profile && profile.member_id) || "";
  state.data = data;
  // Repara/limpia registros de "cumplimiento de plan" que hayan
  // quedado duplicados por el viejo bug de zona horaria en la fecha
  // (ver fixMisdatedPlanCompletions en utils.js). Si algo cambió, se
  // guarda de una vez para que el historial quede limpio de forma
  // permanente y no solo en esta sesión.
  const fixedCompletions = fixMisdatedPlanCompletions(state.data.planCompletions);
  const hadChanges = JSON.stringify(fixedCompletions) !== JSON.stringify(state.data.planCompletions || []);
  state.data.planCompletions = fixedCompletions;
  if (hadChanges) persist();
  // Biblioteca de ejercicios: catálogo general (visible para todos) +
  // los ejercicios personales de esta persona (o, si es admin, los de
  // todo el mundo, gracias a la política de Supabase). Se pide aparte
  // de `loadUserData` porque ahora vive en su propia tabla compartida,
  // no dentro del jsonb de cada usuario.
  try {
    state.data.exercises = await loadExerciseLibrary();
  } catch (err) {
    console.error("No se pudo cargar la biblioteca de ejercicios:", err.message || err);
  }
}

export async function init() {
  try {
    const session = await getSession();
    await hydrateFromSession(session);
  } catch (err) {
    console.error("No se pudo inicializar la sesión de Supabase:", err.message || err);
  } finally {
    state.ready = true;
  }
}

export const root = document.getElementById("app");
