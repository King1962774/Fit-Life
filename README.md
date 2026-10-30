# FitLife


App de registro de entrenamientos hecha en **vanilla JS (módulos ES) + HTML + CSS**, sin bundler ni framework. Todos los datos se guardan en el `localStorage` del navegador — es un build de demostración, no tiene backend.

## Cómo ejecutarlo

Al ser módulos ES nativos (`<script type="module">`), no se puede abrir `index.html` directo con `file://` (los navegadores bloquean los imports por CORS). Hay que servirlo con cualquier servidor estático, por ejemplo:

```bash
npx serve .
# o
python3 -m http.server 8080
```

y luego abrir la URL que indique en el navegador.


## Estructura del proyecto

```
index.html
style.css
js/
  app.js          → render raíz, login, navegación, shell de la app
  state.js        → estado global en memoria (state.data, state.ui)
  storage.js      → persistencia en localStorage + migraciones de datos viejos
  constants.js    → enums, catálogo semilla, constantes globales
  utils.js        → helpers de fecha/DOM/estadísticas
  icons.js        → set de íconos SVG en línea
  exercises.js    → catálogo de ejercicios: lectura, formato, CRUD (admin)
  market.js       → lógica de Market: productos, solicitudes, stock/disponibilidad
  views/
    today.js      → pestaña "Hoy" (flujo de usuario + actividad de admin)
    plan.js       → pestaña "Plan" (rutina semanal por día)
    progress.js   → pestaña "Progreso" (peso corporal + gráfico)
    library.js    → pestaña "Biblioteca" (catálogo de ejercicios)
    history.js    → pestaña "Historial" (sesiones pasadas + cumplimiento de plan)
    market.js     → pestaña "Market" (catálogo + panel admin)
    workout.js    → entrenamiento guiado paso a paso (usado desde "Hoy")
```

Patrón consistente en cada vista: `render*()` devuelve el HTML como string y `bind*Events()` conecta los listeners después de inyectarlo al DOM. La lógica de datos/negocio vive fuera de las vistas (`exercises.js`, `market.js`, `storage.js`), nunca duplicada entre pantallas.

## Funcionalidades actuales

### Usuario
- **Hoy**: ve el plan del día (según el día real o uno reprogramado), inicia un entrenamiento guiado ejercicio por ejercicio con temporizador de descanso, registra peso corporal, ve racha de días y volumen semanal.
- **Plan**: consulta su rutina por día de la semana y la recomendación del entrenador para ese día; puede marcar el plan del día como completado.
- **Progreso**: registra su peso y ve un gráfico de evolución contra su meta.
- **Biblioteca**: busca ejercicios por nombre/músculo/equipo; puede agregar ejercicios personalizados.
- **Historial**: ve sus sesiones pasadas (ejercicio por ejercicio, serie por serie) y su historial de cumplimiento de plan.
- **Market**: busca y filtra productos deportivos por marca/precio, ve el detalle de cada uno (imagen, marca, descripción, precio, stock, estado), y puede **comprar** o **apartar** unidades. Ve el estado de sus propias solicitudes (pendiente/confirmado/rechazado/completado).

### Administrador
- **Hoy**: ya no ve el flujo de entrenamiento (eso es solo de usuarios). En su lugar ve un directorio de los correos que han iniciado sesión en el navegador y, por cada uno, el detalle serie por serie de lo que registró en cada ejercicio asignado. *(Nota visible en la propia UI: es un registro local de logins, no una base de usuarios real — ver limitaciones abajo.)*
- **Plan**: arma la rutina de cada día del catálogo de ejercicios y escribe la recomendación del entrenador.
- **Biblioteca**: crea, edita y elimina cualquier ejercicio del catálogo (tipo por reps o por tiempo).
- **Market**: crea, edita, oculta/publica y elimina productos; revisa todas las solicitudes de compra/apartado y las confirma, rechaza o marca como completadas.

## Modelo de datos (resumen)

Todo vive en un único objeto `state.data`, persistido en `localStorage` bajo la key `opengym-data`:

- `profile`, `weightLogs` — perfil y registro de peso corporal.
- `exercises` — catálogo único (semilla + personalizados), con `type` ("reps" | "time").
- `weeklyPlan[día]` — items `{ exerciseId, sets, target, unit }`.
- `dayRecommendations[día]`, `dayOverrides[iso]` — recomendaciones y reprogramaciones puntuales.
- `history[]` — sesiones registradas: `{ date, weekday, userId, exercises: [{ exerciseId, sets: [...] }] }`.
- `planCompletions[]` — registro de cumplimiento de plan por día.
- `products[]` — `{ id, name, brand, description, price, image, stock, status, createdAt, updatedAt }`.
- `marketRequests[]` — separadas de los productos: `{ id, userId, productId, quantity, type, status, createdAt, updatedAt }`.
- `registeredUsers[]` — `{ email, isAdmin, firstLogin, lastLogin }`, directorio mínimo de logins.

**Regla de stock centralizada** (en `market.js`): el `stock` real de un producto solo se descuenta cuando una solicitud se **confirma**. Mientras está "pendiente", su cantidad queda retenida (calculada al vuelo, no duplicada en el producto) para que dos usuarios no puedan reservar más unidades de las que existen.



