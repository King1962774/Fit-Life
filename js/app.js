/* ============================================================
   FitLife — build en vanilla JS/HTML/CSS (módulos ES, sin bundler)
   Los datos persisten en Supabase: autenticación real (Supabase Auth)
   y datos por usuario en la tabla `user_data`. Ver supabase/schema.sql
   y js/config.js para la configuración de conexión.
   ============================================================ */
import { state, root, persist, init, hydrateFromSession } from "./state.js";
import { signUp, signIn, signOut } from "./storage.js";
import { esc, qs, qsa, todayISO } from "./utils.js";
import { icon } from "./icons.js";

import { renderToday, bindTodayEvents, refreshAdminActivity, refreshMyMessages } from "./views/today.js";
import { renderPlan, bindPlanEvents } from "./views/plan.js";
import { renderLibrary, bindLibraryEvents } from "./views/library.js";
import { renderHistory } from "./views/history.js";
import { renderMarket, bindMarketEvents } from "./views/market.js";
import { loadMarketData } from "./market.js";
import { renderProfile, bindProfileEvents } from "./views/profile.js";

/* ---------------- render raíz ---------------- */
export function render() {
  document.body.dataset.theme = (state.data.settings && state.data.settings.theme) || "claro";
  if (!state.ready) {
    root.innerHTML = renderLoading();
    return;
  }
  if (!state.authed) {
    root.innerHTML = renderLogin();
    bindLoginEvents();
    return;
  }
  root.innerHTML = `
    <div class="app-shell">
      ${renderHeader()}
      ${renderNav()}
      <main class="page">
        <div class="margin-rule"></div>
        <div class="page-inner">
          ${renderView()}
        </div>
      </main>
    </div>
  `;
  bindGlobalEvents();
  bindViewEvents();
}

function renderLoading() {
  return `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-badge">${icon("dumbbell", 22, "var(--paper)")}</div>
        <h1 class="login-wordmark">FitLife</h1>
        <p class="login-sub">Conectando…</p>
      </div>
    </div>
  `;
}

/* Después de un login/signup exitoso: hidrata el estado desde la
   sesión actual y precarga los datos que necesita la primera pantalla
   (market para todos, actividad de usuarios si es admin). */
async function afterAuthSuccess(session) {
  await hydrateFromSession(session);
  state.view = state.data.settings?.defaultView || "today";
  const tasks = [loadMarketData()];
  if (state.isAdmin) tasks.push(refreshAdminActivity()); else tasks.push(refreshMyMessages());
  await Promise.all(tasks);
}

/* ---------------- login / crear perfil ---------------- */
function renderLogin() {
  const mode = state.ui.authMode;
  return `
    <div class="login-wrap">
      <div class="login-card auth-card-${mode}">
        <div class="login-badge">${icon("dumbbell", 22, "var(--paper)")}</div>
        <h1 class="login-wordmark login-fade delay-1">FitLife</h1>
        <p class="login-sub login-fade delay-2">${mode === "signup" ? "crea tu perfil en segundos" : "tu registro, tus datos"}</p>
        ${mode === "signup" ? renderSignupForm() : renderLoginForm()}
      </div>
    </div>
  `;
}

function renderLoginForm() {
  const err = state.ui.loginError;
  const info = state.ui.loginInfo;
  const submitting = state.ui.loginSubmitting;
  return `
    <form id="login-form" style="width:100%">
      <div class="login-field login-fade delay-3">
        ${icon("mail", 15, "var(--muted-2)")}
        <input id="login-email" type="email" class="login-input" placeholder="tú@ejemplo.com" value="${esc(state.ui.signup.email || "")}" ${submitting ? "disabled" : ""} />
      </div>
      <div class="login-field login-fade delay-4">
        ${icon("lock", 15, "var(--muted-2)")}
        <input id="login-password" type="password" class="login-input" placeholder="Contraseña" ${submitting ? "disabled" : ""} />
      </div>
      ${err ? `<p class="error-text shake" style="text-align:center">${esc(err)}</p>` : ""}
      ${info ? `<p class="login-sub" style="text-align:center;margin-top:6px">${esc(info)}</p>` : ""}
      <button type="submit" class="btn-primary login-fade delay-5 ${submitting ? "btn-loading" : ""}" style="margin-top:14px" ${submitting ? "disabled" : ""}>
        ${submitting ? `<span class="spin" style="margin-right:8px;display:flex">${icon("loader", 15, "#fff")}</span>Iniciando sesión…` : "Iniciar sesión"}
      </button>
    </form>
    <p class="auth-switch login-fade delay-5">¿No tienes perfil? <button type="button" class="auth-switch-link" data-action="go-signup">Crea uno aquí</button></p>
    <p class="login-footnote login-fade delay-5">Tu cuenta y tus datos viven en la nube (Supabase): puedes entrar desde cualquier dispositivo.</p>
  `;
}

function renderSignupForm() {
  const step = state.ui.signupStep;
  const err = state.ui.signupError;
  const submitting = state.ui.signupSubmitting;
  const s = state.ui.signup;
  return `
    <div class="step-dots login-fade delay-2">
      <span class="step-dot ${step >= 1 ? "active" : ""}"></span>
      <span class="step-dot ${step >= 2 ? "active" : ""}"></span>
    </div>
    <form id="signup-form" style="width:100%;overflow:hidden">
      <div class="signup-steps" data-step="${step}">
        <div class="signup-step signup-step-1">
          <div class="login-field login-fade delay-3">
            ${icon("mail", 15, "var(--muted-2)")}
            <input id="su-name" class="login-input" placeholder="Tu nombre" value="${esc(s.name)}" ${submitting ? "disabled" : ""} />
          </div>
          <div class="login-field login-fade delay-3">
            ${icon("mail", 15, "var(--muted-2)")}
            <input id="su-email" type="email" class="login-input" placeholder="tú@ejemplo.com" value="${esc(s.email)}" ${submitting ? "disabled" : ""} />
          </div>
          <div class="login-field login-fade delay-4">
            ${icon("lock", 15, "var(--muted-2)")}
            <input id="su-password" type="password" class="login-input" placeholder="Contraseña" ${submitting ? "disabled" : ""} />
          </div>
          <div class="login-field login-fade delay-4">
            ${icon("lock", 15, "var(--muted-2)")}
            <input id="su-confirm" type="password" class="login-input" placeholder="Confirma tu contraseña" ${submitting ? "disabled" : ""} />
          </div>
          ${step === 1 && err ? `<p class="error-text shake" style="text-align:center">${esc(err)}</p>` : ""}
          <button type="button" class="btn-primary login-fade delay-5" style="margin-top:4px" data-action="signup-next">Continuar</button>
        </div>
        <div class="signup-step signup-step-2">
          <p class="signup-step-label">Cuéntanos de tu cuerpo para arrancar tu progreso</p>
          <div class="login-field login-fade delay-1">
            ${icon("scale", 15, "var(--muted-2)")}
            <input id="su-weight" type="number" class="login-input" placeholder="Peso actual" value="${esc(s.weight)}" ${submitting ? "disabled" : ""} />
            <select id="su-unit" class="signup-unit-select" ${submitting ? "disabled" : ""}>
              <option value="kg" ${s.unit === "kg" ? "selected" : ""}>kg</option>
              <option value="lb" ${s.unit === "lb" ? "selected" : ""}>lb</option>
            </select>
          </div>
          <div class="login-field login-fade delay-2" style="margin-top:10px">
            ${icon("trending", 15, "var(--muted-2)")}
            <input id="su-height" type="number" class="login-input" placeholder="Estatura (cm)" value="${esc(s.height)}" ${submitting ? "disabled" : ""} />
          </div>
          <div class="login-field login-fade delay-3" style="margin-top:10px">
            ${icon("trophy", 15, "var(--muted-2)")}
            <input id="su-goal" type="number" class="login-input" placeholder="Peso meta (opcional)" value="${esc(s.goalWeight)}" ${submitting ? "disabled" : ""} />
          </div>
          ${step === 2 && err ? `<p class="error-text shake" style="text-align:center">${esc(err)}</p>` : ""}
          <div style="display:flex;gap:8px;margin-top:14px">
            <button type="button" class="btn-ghost" style="flex:0 0 auto" data-action="signup-back" ${submitting ? "disabled" : ""}>${icon("swap", 14)}Atrás</button>
            <button type="submit" class="btn-primary ${submitting ? "btn-loading" : ""}" style="flex:1" ${submitting ? "disabled" : ""}>
              ${submitting ? `<span class="spin" style="margin-right:8px;display:flex">${icon("loader", 15, "#fff")}</span>Creando…` : `${icon("checkcircle", 15, "#fff")}Crear mi perfil`}
            </button>
          </div>
        </div>
      </div>
    </form>
    <p class="auth-switch login-fade delay-5">¿Ya tienes cuenta? <button type="button" class="auth-switch-link" data-action="go-login">Inicia sesión</button></p>
  `;
}

function bindLoginEvents() {
  const goSignup = qs('[data-action="go-signup"]');
  if (goSignup) goSignup.addEventListener("click", () => {
    state.ui.authMode = "signup";
    state.ui.signupStep = 1;
    state.ui.signupError = "";
    render();
  });
  const goLogin = qs('[data-action="go-login"]');
  if (goLogin) goLogin.addEventListener("click", () => {
    state.ui.authMode = "login";
    state.ui.loginError = "";
    render();
  });

  const form = qs("#login-form");
  if (form) form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = qs("#login-email").value.trim();
    const password = qs("#login-password").value;
    if (!email || !password) {
      state.ui.loginError = "Ingresa un correo y una contraseña para continuar";
      render();
      return;
    }
    state.ui.loginError = "";
    state.ui.loginInfo = "";
    state.ui.loginSubmitting = true;
    render();

    const { data, error } = await signIn(email, password);
    if (error) {
      state.ui.loginError = translateAuthError(error.message);
      state.ui.loginSubmitting = false;
      render();
      return;
    }
    try {
      await afterAuthSuccess(data.session);
    } catch (err) {
      state.ui.loginError = "No se pudo cargar tu información. Intenta de nuevo.";
      state.ui.loginSubmitting = false;
      render();
      return;
    }
    state.ui.loginSubmitting = false;
    render();
  });

  bindSignupEvents();
}

function captureSignupStep1() {
  const s = state.ui.signup;
  s.name = qs("#su-name")?.value.trim() || "";
  s.email = qs("#su-email")?.value.trim() || "";
}

function bindSignupEvents() {
  const form = qs("#signup-form");
  if (!form) return;

  const nextBtn = qs('[data-action="signup-next"]');
  if (nextBtn) nextBtn.addEventListener("click", () => {
    const name = qs("#su-name").value.trim();
    const email = qs("#su-email").value.trim();
    const password = qs("#su-password").value;
    const confirm = qs("#su-confirm").value;
    if (!name || !email || !password) {
      state.ui.signupError = "Completa tu nombre, correo y contraseña";
      render();
      return;
    }
    if (password.length < 6) {
      state.ui.signupError = "La contraseña debe tener al menos 6 caracteres";
      render();
      return;
    }
    if (password !== confirm) {
      state.ui.signupError = "Las contraseñas no coinciden";
      render();
      return;
    }
    Object.assign(state.ui.signup, { name, email, password, confirm });
    state.ui.signupError = "";
    state.ui.signupStep = 2;
    render();
  });

  const backBtn = qs('[data-action="signup-back"]');
  if (backBtn) backBtn.addEventListener("click", () => {
    captureSignupStep1();
    state.ui.signupError = "";
    state.ui.signupStep = 1;
    render();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.ui.signupStep !== 2) return;
    const s = state.ui.signup;
    const weight = parseFloat(qs("#su-weight").value);
    const unit = qs("#su-unit").value;
    const height = parseFloat(qs("#su-height").value);
    const goalRaw = qs("#su-goal").value;
    const goalWeight = goalRaw ? parseFloat(goalRaw) : NaN;

    if (isNaN(weight) || weight <= 0) {
      state.ui.signupError = "Ingresa tu peso actual para continuar";
      render();
      return;
    }
    if (isNaN(height) || height <= 0) {
      state.ui.signupError = "Ingresa tu estatura en centímetros";
      render();
      return;
    }
    Object.assign(s, { weight: qs("#su-weight").value, unit, height: qs("#su-height").value, goalWeight: goalRaw });
    state.ui.signupError = "";
    state.ui.signupSubmitting = true;
    render();

    const { data, error } = await signUp(s.email, s.password);
    if (error) {
      state.ui.signupError = translateAuthError(error.message);
      state.ui.signupSubmitting = false;
      render();
      return;
    }

    // Sin sesión de vuelta = el proyecto de Supabase exige confirmar el
    // correo antes de poder iniciar sesión.
    if (!data.session) {
      state.ui.signupSubmitting = false;
      state.ui.authMode = "login";
      state.ui.signupStep = 1;
      state.ui.loginInfo = "Te enviamos un correo de confirmación. Confírmalo y luego inicia sesión.";
      state.ui.signup = { name: "", email: "", password: "", confirm: "", weight: "", unit: "kg", height: "", goalWeight: "" };
      render();
      return;
    }

    try {
      await hydrateFromSession(data.session);
      state.data.profile.unit = unit;
      state.data.profile.height = height;
      state.data.profile.displayName = s.name;
      state.data.profile.goalWeight = !isNaN(goalWeight) && goalWeight > 0 ? goalWeight : weight;
      const iso = todayISO();
      const idx = state.data.weightLogs.findIndex((l) => l.date === iso);
      if (idx >= 0) state.data.weightLogs[idx].weight = weight; else state.data.weightLogs.push({ date: iso, weight });
      persist();
      state.view = "today";
      await loadMarketData();
    } catch (err) {
      state.ui.signupError = "Se creó tu cuenta pero no pudimos cargar tus datos. Intenta iniciar sesión.";
      state.ui.signupSubmitting = false;
      render();
      return;
    }

    state.ui.signupSubmitting = false;
    state.ui.authMode = "login";
    state.ui.signupStep = 1;
    state.ui.signup = { name: "", email: "", password: "", confirm: "", weight: "", unit: "kg", height: "", goalWeight: "" };
    render();
  });
}

/* Traduce los mensajes más comunes de Supabase Auth; cualquier otro se
   muestra tal cual llega (en inglés) para no ocultar información útil. */
function translateAuthError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos";
  if (m.includes("user already registered")) return "Ese correo ya tiene una cuenta. Inicia sesión.";
  if (m.includes("password should be at least")) return "La contraseña es demasiado corta";
  if (m.includes("email not confirmed")) return "Confirma tu correo antes de iniciar sesión";
  return message;
}

/* ---------------- encabezado / navegación ---------------- */
function renderHeader() {
  return `
    <header class="app-header">
      <div class="header-inner">
        ${icon("dumbbell", 22, "var(--header-text)")}
        <h1 class="wordmark">FitLife${state.isAdmin ? '<span class="admin-badge">ADMIN</span>' : ""}</h1>
        <span class="header-sub">${state.isAdmin ? "Panel de entrenador" : "tu registro, tus datos"}</span>
      </div>
      <div class="header-rule"></div>
    </header>
  `;
}

export const NAV_ITEMS = [
  { key: "today", label: "Hoy", icon: "home" },
  { key: "plan", label: "Plan", icon: "calendar" },
  { key: "library", label: "Biblioteca", icon: "library" },
  { key: "history", label: "Historial", icon: "history" },
  { key: "market", label: "Market", icon: "cart" },
  { key: "profile", label: "Perfil", icon: "user" },
];

function renderNav() {
  return `
    <nav class="tab-row">
      ${NAV_ITEMS.map((item) => `
        <button class="tab ${state.view === item.key ? "active" : ""}" data-action="set-view" data-view="${item.key}">
          ${icon(item.icon, 15)}${item.label}
        </button>
      `).join("")}
    </nav>
  `;
}

function bindGlobalEvents() {
  qsa('[data-action="set-view"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      state.view = view;
      state.ui.workout = null;
      state.ui.market.selectedProductId = null;
      render();
      // Refresco silencioso de datos compartidos al entrar a la vista.
      if (view === "market") loadMarketData().then(render);
      if (view === "today") {
        if (state.isAdmin) refreshAdminActivity().then(render);
        else refreshMyMessages().then(render);
      }
    });
  });
}

/* Se reutiliza tanto desde el botón del encabezado como desde el
   panel de Perfil, para que cerrar sesión se comporte igual en
   ambos lugares. */
export async function performLogout() {
  await signOut();
  state.authed = false;
  state.isAdmin = false;
  state.userId = null;
  state.userEmail = "";
  state.memberId = "";
  render();
}

function renderView() {
  switch (state.view) {
    case "today": return renderToday();
    case "plan": return renderPlan();
    case "library": return renderLibrary();
    case "history": return renderHistory();
    case "market": return renderMarket();
    case "profile": return renderProfile();
    default: return "";
  }
}

function bindViewEvents() {
  if (state.view === "today") bindTodayEvents();
  else if (state.view === "plan") bindPlanEvents();
  else if (state.view === "library") bindLibraryEvents();
  else if (state.view === "market") bindMarketEvents();
  else if (state.view === "profile") bindProfileEvents();
}

/* ---------------- inicio ---------------- */
render();
init().then(async () => {
  if (state.authed) {
    state.view = state.data.settings?.defaultView || "today";
    if (state.view === "progress") state.view = "profile";
    const tasks = [loadMarketData()];
    if (state.isAdmin) tasks.push(refreshAdminActivity()); else tasks.push(refreshMyMessages());
    await Promise.all(tasks);
  }
  render();
});
