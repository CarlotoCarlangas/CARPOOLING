# TACO — Carpooling Periurbano

## Qué es
App de carpooling para commute diario desde comunas periféricas de Chile sin
transporte público integrado. Primer corredor: Peñaflor → Santiago.

**No somos un servicio de transporte.** Somos una plataforma para compartir
gastos de viaje entre un conductor que ya hace el trayecto y pasajeros que
quieren ir al mismo lugar.

## Modelo de negocio
Comisión: 15% al conductor + 10% al pasajero.
Ejemplo: viaje base $2.000 → pasajero paga $2.200, conductor recibe $1.700,
la plataforma se queda con $500.

## Stack técnico
- **Backend**: Python + FastAPI + SQLite (prototipo; producción → PostgreSQL + PostGIS)
- **Frontend**: React + Vite + React Router + Tailwind CSS
- **Mapas**: Leaflet + tiles de OpenStreetMap + OSRM (`api.project-osrm.org`) para
  ruteo real por calles (no líneas rectas)
- **Autenticación**: prototipo simple (sin hash robusto de contraseñas todavía —
  ver TODO PRODUCCIÓN en el código)

## Estructura de carpetas
```
taco-app/
├── backend/
│   ├── main.py           # App FastAPI, monta routers, CORS, crea tablas
│   ├── models.py         # SQLModel: User, Route, RouteStop, Booking, Trip, Review
│   ├── database.py       # Motor SQLite + sesión
│   ├── schemas.py        # Pydantic request/response models
│   ├── routes/
│   │   ├── auth.py       # POST /api/register, /api/login
│   │   ├── routes.py     # POST/GET /api/routes, GET /api/routes/{id}
│   │   ├── requests.py   # POST /api/requests, accept/reject
│   │   ├── trips.py      # GET /api/trips/{user_id}
│   │   └── reviews.py    # POST /api/reviews
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/        # Register, Login, CreateRoute, SearchRoutes, RouteDetail...
│   │   ├── components/   # MapPicker, RouteCard, Navbar...
│   │   ├── context/       # AuthContext (usuario logueado en memoria/localStorage)
│   │   ├── services/      # api.js (fetch al backend), osrm.js (ruteo)
│   │   └── App.jsx
│   └── package.json
└── CLAUDE.md
```

## Módulos (orden de construcción)
1. **Registro y login** — RUT chileno validado, roles conductor/pasajero,
   documentos de vehículo, modo "solo mujeres" opcional.
2. **Creación de ruta (conductor)** — mapa Leaflet + OSRM, cupos, horario,
   recurrencia, precio sugerido.
3. **Búsqueda y reserva (pasajero)** — listado de rutas por cercanía, detalle,
   botón reservar.
4. **Chat interno** — mensajería conductor-pasajero post-reserva.
5. **Tracking en tiempo real** — posición del conductor, ETA, progreso.
6. **Pagos y billetera** — simulación de pago, saldo, historial.
7. **Evaluaciones mutuas** — estrellas + comentario post-viaje.

Se construyen en este orden. No avanzar al siguiente módulo sin validación
del usuario del módulo anterior.

## Cumplimiento legal (Ley 21.719 — Protección de Datos Personales, Chile)
- Consentimiento explícito antes de recopilar cada dato personal.
- Pantalla de Términos y Condiciones + Política de Privacidad en el registro,
  con checkbox obligatorio (no premarcado).
- Cada dato recolectado debe tener una finalidad declarada.
- Minimización: solo se piden los datos estrictamente necesarios para operar.
- Los datos de geolocalización se tratan como **datos sensibles**.
- Debe existir una pantalla/endpoint donde el usuario pueda ejercer sus
  derechos ARCO (Acceso, Rectificación, Cancelación, Oposición).
- En el código, cada campo de dato personal lleva un comentario:
  `// PRIVACIDAD: [razón por la que se recolecta este dato]`
  (en Python se usa `# PRIVACIDAD: ...`)

## Convenciones de código
- Cambios pendientes para producción se marcan con `// TODO PRODUCCIÓN:` o
  `# TODO PRODUCCIÓN:` (nunca implementarlos ahora, solo dejarlos marcados).
- Backend expone la API bajo el prefijo `/api`.
- CORS abierto en desarrollo a `http://localhost:5173` (puerto de Vite).

## Cómo levantar el proyecto

### Backend
```bash
cd taco-app/backend
py -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
py -m uvicorn main:app --reload --port 8000
```
Docs interactivas: http://localhost:8000/docs

### Frontend
```bash
cd taco-app/frontend
npm install
npm run dev
```
App: http://localhost:5173

### Para probar entre dos dispositivos en la misma red
Levantar el backend con `--host 0.0.0.0` y el frontend con `npm run dev -- --host`,
luego usar la IP local del PC (ej. `http://192.168.1.X:5173`) desde el otro dispositivo.
Ver README.md para el detalle.

## Estado del proyecto
Ver README.md para el estado actual de cada módulo (qué está construido,
qué falta, cómo probarlo).

### Sesión 2026-08-25 — resumen para continuar
- Módulos 1 (Registro/Login) y 2 (Creación de ruta) quedaron construidos y
  probados de punta a punta en navegador real: registro con RUT chileno,
  subida de documentos de vehículo, mapa Leaflet con clics para trazar ruta,
  cálculo real por calles vía OSRM, y publicación visible en el listado.
- El usuario (Carlos) ya registró una cuenta real y publicó una ruta real
  (Peñaflor → Providencia) desde su propio navegador — no son solo datos de
  prueba por API.
- Repo en GitHub: https://github.com/CarlotoCarlangas/CARPOOLING (rama `main`).

### ⚠️ Pendiente urgente: acceso entre redes distintas
Hoy probamos el flujo entre dos "dispositivos" asumiendo la **misma red Wi-Fi**
(el backend escucha en `0.0.0.0:8000`, el frontend en `0.0.0.0:5173`, y el
frontend detecta automáticamente la IP del navegador para llamar al backend).
Esto **no sirve** si las dos personas están en comunas/redes distintas, porque
`192.168.x.x` es una IP privada que solo existe dentro de esa red local.

El usuario planea probar mañana con otra persona desde otro PC, otra comuna,
otra red — antes de seguir con el Módulo 3, **hay que resolver el acceso
entre redes distintas**. Opciones a evaluar con el usuario (explicar en
simple, sin asumir que sabe qué es un túnel o un deploy):
1. **Túnel temporal (rápido, gratis, para probar hoy mismo)**: algo como
   `ngrok` o `cloudflared` expone el backend y el frontend con una URL
   pública temporal, sin tocar el código. Ideal para pruebas puntuales pero
   la URL cambia cada vez que se reinicia (a menos que se pague un plan).
2. **Desplegar de verdad (más estable, sirve para las siguientes pruebas)**:
   subir el backend a un hosting gratuito (ej. Railway, Render) y el
   frontend a otro (ej. Vercel, Netlify). Requiere ajustar `VITE_API_URL`
   y las URLs de `CORS`/OSRM ya están pensadas para esto (ver TODO
   PRODUCCIÓN en `main.py`).
- Preguntar al usuario cuál prefiere antes de implementar (la opción 1 es
  más rápida para "probar mañana"; la opción 2 es mejor si van a seguir
  probando varios días).
