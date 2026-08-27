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
  Este tema quedó pendiente sin resolver — el usuario pasó directo a
  debatir el diseño del Módulo 3 en la sesión siguiente. Retomarlo si
  menciona que quiere probar con alguien fuera de su red Wi-Fi.

### Sesión 2026-08-26 — Módulo 3 (búsqueda del pasajero): diseño y v1 construida

El usuario insistió mucho en que **el mapa es la propuesta de valor** ("en lo
territorial está mi propuesta") — de ahí que la búsqueda no sea un buscador
de texto clásico, sino exploración visual sobre el mapa. Diseño acordado
tras varias rondas de debate:

1. El pasajero elige **comuna de origen y comuna de destino** (sin esto no
   se busca nada — evita mostrar todas las rutas del sistema sin filtro).
2. Opcionalmente escribe una **dirección** (autocompletado vía Nominatim) o
   hace **clic en el mapa** para marcar un punto más preciso que la comuna.
3. Si marca un punto, aparece un **slider de "radio caminable"** (círculo
   dibujado sobre el mapa) que puede ampliar si no ve viajes que le sirvan.
   Se decidió slider en vez de arrastrar el borde del círculo a mano —
   más simple de construir, mismo resultado para el usuario.
4. El radio de origen y el de destino son **independientes** (no simétricos)
   — surgió de notar que en el sentido Peñaflor→Santiago el origen necesita
   radio estricto (periurbano, mal servido) y el destino puede ser más
   amplio (llega a zona urbana con más transporte para el último tramo). Se
   decidió NO hardcodear esa asimetría por geografía (se rompe en el viaje
   de vuelta Santiago→Peñaflor) — en cambio, cada lado tiene su propio
   slider y el usuario decide.
5. Una ruta "califica" si tiene un punto (origen/parada/destino) dentro del
   filtro de origen, Y **más adelante en la secuencia real del recorrido**
   otro punto dentro del filtro de destino — importante para no ofrecer
   viajes donde el pasajero iría "hacia atrás". Implementado en
   `backend/routes/routes.py` (`buscar_rutas`, `_primer_punto_que_coincide`).

**Lo que quedó construido y probado (backend + navegador real):**
- `Route` ahora guarda `origen_comuna` / `destino_comuna` (extraídos de
  Nominatim al crear la ruta). Los `paradas` (JSON) también llevan `comuna`
  por punto vía el schema `PuntoRuta`.
- `GET /api/routes/comunas`: lista de comunas con rutas activas (misma
  lista sirve para el selector de origen y el de destino — el viaje no
  tiene una dirección fija).
- `GET /api/routes/buscar`: acepta `comuna_origen`/`comuna_destino` (modo
  explorar) y/o `origen_lat`/`origen_lng`/`origen_radio_m` (+ el equivalente
  para destino) para el modo círculo. Ambos modos comparten la misma lógica
  de orden-en-la-secuencia.
- Frontend: `pages/Buscar.jsx` + `components/MapaBusqueda.jsx` (dibuja
  las rutas candidatas + los círculos). Nueva ruta `/buscar`, link "Buscar
  viaje" en el Navbar.
- `services/geocoding.js` ahora expone `buscarDireccion()` (texto ->
  coordenadas, geocodificación directa) además de la inversa que ya existía.

**Ajuste posterior en la misma sesión — el destino NO tiene radio:** tras
seguir probando, el usuario decidió que el círculo de radio caminable solo
tiene sentido en el origen (periurbano). En el destino (zona urbana) se
sacó el radio por completo: solo queda el selector de comuna + una
dirección opcional que únicamente hace zoom visual en el mapa (`centrarEn`
en `MapaBusqueda.jsx`, con `setView(..., 15, {animate:false})` — el
`animate:false` es importante, sin eso el zoom se quedaba pegado en el
nivel anterior cuando el salto era grande). El pasajero explora con
zoom/clustering y elige el pin que le sirva, sin que el backend filtre por
distancia en ese lado. También se agregó `leaflet.markercluster` para
agrupar pines cercanos (colores distintos para origen/destino), pensando
en que con más rutas activas el mapa no se sature de pines sueltos.

**Lo que falta (siguiente paso, aún no construido):** la reserva en sí —
que el pasajero pida un cupo (`POST /api/requests`), el conductor lo vea y
acepte/rechace. Se dejó fuera a propósito de este incremento para no hacer
un cambio gigante de una sola vez (ver endpoints mínimos en la sección de
arriba: `POST /api/requests`, `GET /api/requests/{route_id}`,
`PUT /api/requests/{id}/accept`, `PUT /api/requests/{id}/reject`).

**Nota de migración:** al agregar `origen_comuna`/`destino_comuna` a un
`taco.db` que ya existía, hubo que correr un `ALTER TABLE` manual (SQLModel
`create_all()` no migra columnas nuevas en tablas existentes). Si en el
futuro se agregan más columnas a modelos existentes, recordar que hace
falta el mismo tipo de migración manual — no hay Alembic configurado.
TODO PRODUCCIÓN: configurar Alembic antes de que esto pase en producción.
