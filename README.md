<div align="center">

# FITLIFE

### Registro de entrenamientos, plan semanal y tienda deportiva

**Aplicación web de seguimiento de entrenamientos construida con JavaScript puro y respaldada por Supabase.**

<br/>

<img src="https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript"/>
<img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5"/>
<img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3"/>
<img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase"/>

<img src="https://img.shields.io/badge/Roles-Usuario%20%7C%20Admin-6c63ff?style=for-the-badge&labelColor=0d1117" alt="Roles"/>

<br/>

[Sobre el proyecto](#sobre-el-proyecto) ·
[Funcionalidades](#funcionalidades) ·
[Ejecución](#ejecución) ·
[Arquitectura](#arquitectura) ·
[Modelo de datos](#modelo-de-datos) ·
[Limitaciones](#limitaciones)

</div>

---

## Sobre el proyecto

**FitLife** es una aplicación de registro de entrenamientos desarrollada con **JavaScript vanilla (módulos ES), HTML y CSS**, sin bundler ni framework en el cliente. Los datos se almacenan en **Supabase**, que actúa como backend de la aplicación.

Contempla dos perfiles con experiencias distintas:

- **Usuario**: planifica y registra sus entrenamientos, sigue su peso corporal y compra o aparta productos deportivos.
- **Administrador**: gestiona el catálogo de ejercicios, arma las rutinas, administra la tienda y supervisa la actividad de los usuarios.

## Funcionalidades

### Perfil de usuario

| Módulo | Qué permite |
|---|---|
| **Hoy** | Ver el plan del día (el real o uno reprogramado), iniciar un entrenamiento guiado ejercicio por ejercicio con temporizador de descanso, registrar el peso corporal y consultar la racha de días y el volumen semanal. |
| **Plan** | Consultar la rutina por día de la semana junto con la recomendación del entrenador, y marcar el plan del día como completado. |
| **Progreso** | Registrar el peso y ver un gráfico de evolución frente a la meta. |
| **Biblioteca** | Buscar ejercicios por nombre, músculo o equipo, y agregar ejercicios personalizados. |
| **Historial** | Revisar sesiones pasadas (ejercicio por ejercicio, serie por serie) y el historial de cumplimiento del plan. |
| **Market** | Buscar y filtrar productos por marca y precio, ver su detalle (imagen, marca, descripción, precio, stock y estado), y **comprar** o **apartar** unidades. Consultar el estado de las propias solicitudes: pendiente, confirmado, rechazado o completado. |

### Perfil de administrador

| Módulo | Qué permite |
|---|---|
| **Hoy** | Ver un directorio de los usuarios que han iniciado sesión y, por cada uno, el detalle serie por serie de lo registrado en cada ejercicio asignado. |
| **Plan** | Armar la rutina de cada día a partir del catálogo y escribir la recomendación del entrenador. |
| **Biblioteca** | Crear, editar y eliminar cualquier ejercicio del catálogo, ya sea por repeticiones o por tiempo. |
| **Market** | Crear, editar, ocultar, publicar y eliminar productos; revisar todas las solicitudes y confirmarlas, rechazarlas o marcarlas como completadas. |

> El administrador no ve el flujo de entrenamiento: esa experiencia es exclusiva del perfil de usuario.

## Ejecución

Al usar módulos ES nativos (`<script type="module">`), `index.html` no puede abrirse directamente con `file://`, porque los navegadores bloquean los imports por CORS. Basta con servir la carpeta con cualquier servidor estático.

**Con Node.js**

```bash
npx serve .
```

**Con Python**

```bash
python3 -m http.server 8080
```

Después, abre en el navegador la URL que indique el servidor.

### Requisitos

- Un navegador moderno con soporte de módulos ES.
- Node.js o Python, únicamente para servir los archivos estáticos.
- Un proyecto de [Supabase](https://supabase.com/) con las tablas de la aplicación creadas.

No hay dependencias que instalar ni paso de compilación.

### Configuración de Supabase

La aplicación necesita la **URL** y la **clave pública (anon key)** de tu proyecto de Supabase, que se obtienen en *Project Settings → API*. Colócalas en el archivo de configuración del cliente de Supabase.

> Usa únicamente la clave `anon`. La clave `service_role` nunca debe incluirse en el código del cliente ni subirse al repositorio.

## Arquitectura

```
index.html
style.css
js/
├── app.js            # Render raíz, login, navegación y shell de la aplicación
├── state.js          # Estado global en memoria (state.data, state.ui)
├── storage.js        # Capa de persistencia de datos con Supabase
├── constants.js      # Enums, catálogo semilla y constantes globales
├── utils.js          # Helpers de fecha, DOM y estadísticas
├── icons.js          # Set de íconos SVG en línea
├── exercises.js      # Catálogo de ejercicios: lectura, formato y CRUD (admin)
├── market.js         # Lógica de Market: productos, solicitudes, stock y disponibilidad
└── views/
    ├── today.js      # Pestaña "Hoy" (flujo de usuario y actividad de admin)
    ├── plan.js       # Pestaña "Plan" (rutina semanal por día)
    ├── progress.js   # Pestaña "Progreso" (peso corporal y gráfico)
    ├── library.js    # Pestaña "Biblioteca" (catálogo de ejercicios)
    ├── history.js    # Pestaña "Historial" (sesiones pasadas y cumplimiento)
    ├── market.js     # Pestaña "Market" (catálogo y panel de administración)
    └── workout.js    # Entrenamiento guiado paso a paso (usado desde "Hoy")
```

### Principios de diseño

- **Patrón consistente en cada vista**: `render*()` devuelve el HTML como string y `bind*Events()` conecta los listeners una vez inyectado en el DOM.
- **Lógica fuera de las vistas**: la lógica de datos y de negocio vive en `exercises.js`, `market.js` y `storage.js`, y nunca se duplica entre pantallas.
- **Estado único en memoria**: la información cargada se mantiene en un solo objeto, `state.data`, y los cambios se sincronizan con Supabase de forma centralizada.

## Modelo de datos

La información de la aplicación se organiza en las siguientes entidades, almacenadas en Supabase:

| Entidad | Descripción |
|---|---|
| `profile`, `weightLogs` | Perfil y registro de peso corporal. |
| `exercises` | Catálogo único (semilla y personalizados), con `type`: `"reps"` o `"time"`. |
| `weeklyPlan[día]` | Ítems con la forma `{ exerciseId, sets, target, unit }`. |
| `dayRecommendations[día]`, `dayOverrides[iso]` | Recomendaciones del entrenador y reprogramaciones puntuales. |
| `history[]` | Sesiones registradas: `{ date, weekday, userId, exercises: [{ exerciseId, sets: [...] }] }`. |
| `planCompletions[]` | Registro de cumplimiento del plan por día. |
| `products[]` | `{ id, name, brand, description, price, image, stock, status, createdAt, updatedAt }`. |
| `marketRequests[]` | Solicitudes, separadas de los productos: `{ id, userId, productId, quantity, type, status, createdAt, updatedAt }`. |
| `registeredUsers[]` | `{ email, isAdmin, firstLogin, lastLogin }`: directorio de usuarios que han iniciado sesión. |

### Regla de stock

La lógica de stock está centralizada en `market.js`:

1. El `stock` real de un producto **solo se descuenta cuando una solicitud se confirma**.
2. Mientras una solicitud está en estado *pendiente*, su cantidad queda **retenida**. Ese valor se calcula al vuelo y no se duplica en el producto.
3. Así, dos usuarios no pueden reservar más unidades de las que existen.

Ciclo de vida de una solicitud:

```
pendiente  ──►  confirmado  ──►  completado
    └────────►  rechazado
```

## Limitaciones

- **Sin pagos reales**: el Market gestiona solicitudes de compra y apartado, pero no procesa pagos.
- **Seguridad en el cliente**: al ser una aplicación sin servidor propio, la protección de los datos depende de las políticas de acceso (*Row Level Security*) configuradas en Supabase. Deben estar activas en todas las tablas.
- **Regla de stock en el cliente**: la validación de disponibilidad se calcula en la aplicación; para un entorno de producción conviene reforzarla en la base de datos.



## Autor

**King1962774**
GitHub: [@King1962774](https://github.com/King1962774)

---

<div align="center">

**FitLife** · *Entrena, registra, progresa*

</div>