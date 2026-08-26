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
