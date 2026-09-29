/* ============================================================
   Utilidades genéricas: fechas, DOM, estadísticas
   ============================================================ */
import { EXERCISE_TYPES, TIME_UNITS } from "./constants.js";

/* Fecha de "hoy" en la ZONA HORARIA LOCAL del navegador, en formato
   YYYY-MM-DD. OJO: `new Date().toISOString()` da la fecha en UTC, no
   en local — en zonas detrás de UTC (ej. Bogotá, UTC-5) eso hace que
   la fecha "salte" al día siguiente desde ~7pm hora local, mientras
   que el día de la semana (jsWeekdayToKey) sí usa la hora local. Esa
   desincronización es la que permitía marcar un mismo entrenamiento
   como completado dos días seguidos. Por eso esta función arma la
   fecha a mano con los componentes locales en vez de usar toISOString(). */
export function todayISO() { return dateToLocalISO(new Date()); }
export function dateToLocalISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function jsWeekdayToKey(d) { return ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d.getDay()]; }

/* Antes de corregir todayISO() para usar la fecha LOCAL (ver comentario
   arriba), un mismo clic en "Marcar como completado" podía terminar
   registrando dos entradas para el mismo día real: una con la fecha
   local correcta y, si el usuario volvía a intentarlo después de que
   el reloj UTC ya hubiera cruzado la medianoche (pero localmente
   siguiera siendo el mismo día), otra con la fecha adelantada un día.
   Esa segunda entrada queda "desfasada": su `date` no corresponde al
   día de la semana real de esa fecha (`weekday`). Esta función repara
   datos ya guardados con ese desfase, retrocediendo la fecha un día
   cuando no coincide con el día de semana registrado, y luego elimina
   cualquier duplicado exacto que quede tras la corrección. */
export function fixMisdatedPlanCompletions(completions) {
  if (!Array.isArray(completions)) return [];
  const corrected = completions.map((c) => {
    if (!c || !c.date || !c.weekday) return c;
    const actualWeekday = jsWeekdayToKey(new Date(c.date + "T00:00:00"));
    if (actualWeekday === c.weekday) return c;
    const d = new Date(c.date + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return { ...c, date: dateToLocalISO(d) };
  });
  const seen = new Set();
  const deduped = [];
  for (const c of corrected) {
    const key = `${c.date}|${c.weekday}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
  }
  return deduped;
}
export function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { month: "short", day: "numeric" });
}
export function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function qs(sel, root) { return (root || document).querySelector(sel); }
export function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

export function computeStreak(history) {
  if (!history.length) return 0;
  const dates = new Set(history.map((h) => h.date));
  let streak = 0;
  let cursor = new Date();
  for (;;) {
    const iso = dateToLocalISO(cursor);
    if (dates.has(iso)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (iso === todayISO()) {
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function startOfWeekISO() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return dateToLocalISO(d);
}

/* El volumen de carga (peso × reps) solo tiene sentido para series de
   tipo "reps" con peso. Las series de tipo "time" aportan al conteo de
   sesiones pero no al volumen, y se suman aparte como minutos totales. */
export function computeWeekStats(history) {
  const weekStart = startOfWeekISO();
  const sessions = history.filter((h) => h.date >= weekStart);
  let volume = 0;
  let timeSeconds = 0;
  sessions.forEach((s) => s.exercises.forEach((e) => e.sets.forEach((set) => {
    if (set.type === EXERCISE_TYPES.TIME) timeSeconds += set.durationSec || 0;
    else volume += (set.weight || 0) * (set.reps || 0);
  })));
  return { sessions: sessions.length, volume: Math.round(volume), timeMinutes: Math.round(timeSeconds / 60) };
}

/* ---------------- formateo de duraciones ---------------- */
export function secondsFromValue(value, unit) {
  return unit === TIME_UNITS.MIN ? value * 60 : value;
}
export function valueFromSeconds(seconds, unit) {
  return unit === TIME_UNITS.MIN ? Math.round((seconds / 60) * 10) / 10 : seconds;
}
export function fmtDuration(seconds) {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m} min ${s} seg` : `${m} min`;
  }
  return `${seconds} seg`;
}
