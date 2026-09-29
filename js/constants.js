/* ============================================================
   Constantes globales y catálogo semilla de ejercicios
   ============================================================ */

export const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const WEEKDAY_FULL = {
  Lun: "Lunes", Mar: "Martes", Mié: "Miércoles", Jue: "Jueves",
  Vie: "Viernes", Sáb: "Sábado", Dom: "Domingo",
};

/* Ya no hay claves de localStorage ni contraseña de admin hardcodeada:
   la sesión vive en Supabase Auth y el rol de admin es la columna real
   `profiles.is_admin` (ver supabase/schema.sql). Para promover a una
   persona a admin, un administrador de la base de datos ejecuta:
     update public.profiles set is_admin = true where email = '...'; */

/* ---------------- tipos de ejercicio ----------------
   Diseñado para ser extensible: agregar un nuevo tipo en el futuro
   (por ejemplo "distancia") solo requiere sumarlo aquí y enseñar a
   workout-logic.js / formatters a manejarlo. */
export const EXERCISE_TYPES = {
  REPS: "reps",   // se registra por series × repeticiones (+ peso opcional)
  TIME: "time",   // se registra por series × duración (segundos o minutos)
};

export const TIME_UNITS = {
  SEG: "seg",
  MIN: "min",
};

/* ---------------- dificultad ----------------
   Cada ejercicio del catálogo declara qué tan exigente es. Sirve para
   que la persona sepa qué esperar antes de empezar (sobre todo si es
   nueva) y para que quien arma el catálogo dosifique la rutina. Se
   guarda como texto simple ("principiante" | "intermedio" | "avanzado")
   para que sea fácil de validar y de mostrar como insignia. */
export const DIFFICULTY_LEVELS = {
  BEGINNER: "principiante",
  INTERMEDIATE: "intermedio",
  ADVANCED: "avanzado",
};

export const DIFFICULTY_META = {
  [DIFFICULTY_LEVELS.BEGINNER]: { label: "Principiante", order: 1, className: "difficulty-beginner" },
  [DIFFICULTY_LEVELS.INTERMEDIATE]: { label: "Intermedio", order: 2, className: "difficulty-intermediate" },
  [DIFFICULTY_LEVELS.ADVANCED]: { label: "Avanzado", order: 3, className: "difficulty-advanced" },
};

export const DIFFICULTY_ORDER = [DIFFICULTY_LEVELS.BEGINNER, DIFFICULTY_LEVELS.INTERMEDIATE, DIFFICULTY_LEVELS.ADVANCED];

/* ---------------- temas de personalización ----------------
   Cada tema activa un bloque body[data-theme="id"] en style.css que
   redefine las variables de color de toda la app (fondo, tarjetas,
   texto, acentos). "swatch" son solo 2-3 colores para pintar la
   vista previa en el selector del Perfil; los colores reales viven
   en el CSS. */
export const THEMES = [
  {
    id: "claro", label: "Claro",
    swatch: { bg: "#ECEAE3", card: "#FBFAF7", accent: "#46654A" },
  },
  {
    id: "oscuro", label: "Oscuro",
    swatch: { bg: "#14161A", card: "#1C1F24", accent: "#6FA37A" },
  },
  {
    id: "naranja-oscuro", label: "Oscuro naranja",
    swatch: { bg: "#14100C", card: "#1C1611", accent: "#E8792B" },
  },
  {
    id: "verde", label: "Verde",
    swatch: { bg: "#EEF1EA", card: "#FAFBF7", accent: "#3F7D4A" },
  },
  {
    id: "azul", label: "Azul",
    swatch: { bg: "#E9EEF3", card: "#FAFBFD", accent: "#3568A8" },
  },
];

export const MUSCLE_GROUPS = ["Pecho", "Espalda", "Piernas", "Hombros", "Brazos", "Core", "Cardio"];
export const EQUIPMENT_TYPES = ["Barra", "Mancuerna", "Polea", "Máquina", "Peso corporal"];

/* ---------------- Market ----------------
   `status` en un producto es un interruptor de visibilidad controlado
   por el administrador (publicado/oculto). La disponibilidad real que
   ve el usuario (disponible / pocas unidades / apartado / sin stock)
   se calcula en market.js a partir de stock y solicitudes pendientes,
   nunca se guarda por separado para no duplicar información. */
export const PRODUCT_STATUS = { ACTIVE: "activo", INACTIVE: "inactivo" };

export const REQUEST_TYPES = { PURCHASE: "compra", RESERVATION: "apartado" };
export const REQUEST_STATUS = {
  PENDING: "pendiente",
  CONFIRMED: "confirmado",
  REJECTED: "rechazado",
  COMPLETED: "completado",
};

export const LOW_STOCK_THRESHOLD = 3;

/* Los productos semilla ahora viven como filas reales en la tabla
   `products` (ver supabase/schema.sql) en vez de copiarse dentro del
   estado local de cada usuario. Se deja esta constante solo como
   referencia de los mismos datos, ya no se usa para inicializar nada. */
export const SEED_PRODUCTS = [
  { id: "band-set", name: "Set de bandas de resistencia", brand: "ProFit", description: "Set de 5 bandas de distintos niveles de resistencia, ideales para movilidad y calentamiento.", price: 89000, image: "", stock: 12, status: PRODUCT_STATUS.ACTIVE },
  { id: "yoga-mat", name: "Mat de yoga antideslizante", brand: "Athlex", description: "Mat de 6mm de grosor, superficie antideslizante en ambos lados.", price: 65000, image: "", stock: 4, status: PRODUCT_STATUS.ACTIVE },
  { id: "adjustable-dumbbell", name: "Mancuerna ajustable 20kg", brand: "IronCore", description: "Mancuerna ajustable de 2 a 20kg, ideal para entrenar en casa.", price: 420000, image: "", stock: 0, status: PRODUCT_STATUS.ACTIVE },
  { id: "shaker-bottle", name: "Shaker 700ml", brand: "ProFit", description: "Shaker con malla mezcladora para batidos de proteína.", price: 25000, image: "", stock: 30, status: PRODUCT_STATUS.ACTIVE },
];

/* Cada ejercicio declara su tipo y, si es de tiempo, su unidad y
   duración objetivo por defecto. Los ejercicios de tipo "reps" pueden
   o no requerir peso (peso corporal = sin barra/mancuerna). */
export const SEED_EXERCISES = [
  { id: "bench-press", name: "Press de banca con barra", muscle: "Pecho", equipment: "Barra", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.INTERMEDIATE },
  { id: "incline-db-press", name: "Press inclinado con mancuernas", muscle: "Pecho", equipment: "Mancuerna", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.INTERMEDIATE },
  { id: "push-up", name: "Flexión de brazos", muscle: "Pecho", equipment: "Peso corporal", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "cable-fly", name: "Aperturas en polea", muscle: "Pecho", equipment: "Polea", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "dip", name: "Fondos", muscle: "Pecho", equipment: "Peso corporal", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.ADVANCED },
  { id: "deadlift", name: "Peso muerto", muscle: "Espalda", equipment: "Barra", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.ADVANCED },
  { id: "pull-up", name: "Dominadas", muscle: "Espalda", equipment: "Peso corporal", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.ADVANCED },
  { id: "barbell-row", name: "Remo con barra", muscle: "Espalda", equipment: "Barra", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.INTERMEDIATE },
  { id: "lat-pulldown", name: "Jalón al pecho", muscle: "Espalda", equipment: "Polea", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "seated-row", name: "Remo sentado en polea", muscle: "Espalda", equipment: "Polea", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "back-squat", name: "Sentadilla con barra", muscle: "Piernas", equipment: "Barra", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.ADVANCED },
  { id: "rdl", name: "Peso muerto rumano", muscle: "Piernas", equipment: "Barra", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.INTERMEDIATE },
  { id: "leg-press", name: "Prensa de piernas", muscle: "Piernas", equipment: "Máquina", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "walking-lunge", name: "Zancada caminando", muscle: "Piernas", equipment: "Mancuerna", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.INTERMEDIATE },
  { id: "leg-curl", name: "Curl de piernas", muscle: "Piernas", equipment: "Máquina", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "calf-raise", name: "Elevación de talones de pie", muscle: "Piernas", equipment: "Máquina", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "ohp", name: "Press militar", muscle: "Hombros", equipment: "Barra", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.ADVANCED },
  { id: "lateral-raise", name: "Elevaciones laterales", muscle: "Hombros", equipment: "Mancuerna", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "face-pull", name: "Face pull", muscle: "Hombros", equipment: "Polea", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "rear-delt-fly", name: "Aperturas posteriores", muscle: "Hombros", equipment: "Mancuerna", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.INTERMEDIATE },
  { id: "barbell-curl", name: "Curl de bíceps con barra", muscle: "Brazos", equipment: "Barra", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "hammer-curl", name: "Curl martillo", muscle: "Brazos", equipment: "Mancuerna", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "tricep-pushdown", name: "Extensión de tríceps en polea", muscle: "Brazos", equipment: "Polea", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "skull-crusher", name: "Press francés", muscle: "Brazos", equipment: "Barra", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.INTERMEDIATE },
  { id: "close-grip-bench", name: "Press de banca agarre cerrado", muscle: "Brazos", equipment: "Barra", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.INTERMEDIATE },
  { id: "plank", name: "Plancha", muscle: "Core", equipment: "Peso corporal", type: EXERCISE_TYPES.TIME, defaultUnit: TIME_UNITS.SEG, defaultTarget: 30, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "hanging-leg-raise", name: "Elevación de piernas colgado", muscle: "Core", equipment: "Peso corporal", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.ADVANCED },
  { id: "cable-crunch", name: "Crunch en polea", muscle: "Core", equipment: "Polea", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "russian-twist", name: "Giro ruso", muscle: "Core", equipment: "Peso corporal", type: EXERCISE_TYPES.REPS, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "treadmill", name: "Correr en cinta", muscle: "Cardio", equipment: "Máquina", type: EXERCISE_TYPES.TIME, defaultUnit: TIME_UNITS.MIN, defaultTarget: 20, difficulty: DIFFICULTY_LEVELS.BEGINNER },
  { id: "rower", name: "Máquina de remo", muscle: "Cardio", equipment: "Máquina", type: EXERCISE_TYPES.TIME, defaultUnit: TIME_UNITS.MIN, defaultTarget: 15, difficulty: DIFFICULTY_LEVELS.INTERMEDIATE },
  { id: "assault-bike", name: "Bicicleta assault", muscle: "Cardio", equipment: "Máquina", type: EXERCISE_TYPES.TIME, defaultUnit: TIME_UNITS.MIN, defaultTarget: 10, difficulty: DIFFICULTY_LEVELS.ADVANCED },
  { id: "jump-rope", name: "Saltar la cuerda", muscle: "Cardio", equipment: "Peso corporal", type: EXERCISE_TYPES.TIME, defaultUnit: TIME_UNITS.MIN, defaultTarget: 5, difficulty: DIFFICULTY_LEVELS.INTERMEDIATE },
];
