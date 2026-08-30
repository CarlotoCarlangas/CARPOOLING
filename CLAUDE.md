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

**Datos de prueba (`backend/seed_demo.py` / `backend/borrar_demo.py`):**
el usuario reportó "no veo puntos al elegir la comuna de destino" — la
causa real era que solo existía 1 ruta real en toda la base (Peñaflor →
Providencia), así que casi ninguna combinación de comunas tenía nada que
mostrar. Se creó `seed_demo.py`, que agrega 4 conductores ficticios
(nombre termina en "(demo)" para poder identificarlos) y 10 rutas, todas
saliendo de Peñaflor: 5 a distintos puntos de Providencia + 5 repartidas
en Ñuñoa/Santiago/Las Condes/Maipú/La Florida. Correr con
`venv\Scripts\python.exe seed_demo.py` desde `backend/`. Para sacarlos
después, `borrar_demo.py`. Estos scripts son solo para desarrollo — nunca
correrlos contra datos reales de producción.

**Cada ruta demo tiene entre 5 y 10 paradas** repartidas entre la comuna
de origen (Peñaflor) y la de destino, a pedido del usuario: quería probar
que las paradas cuenten como puntos de recogida/bajada válidos para el
pasajero, no solo el origen/destino "oficial" de la ruta — esa lógica de
matching ya existía en el backend (`buscar_rutas`), pero **no se veía en
el mapa** porque `MapaBusqueda.jsx` solo dibujaba origen y destino. Se
corrigió para que también dibuje cada parada (agrupada en el cluster
verde u naranja según si su comuna coincide con el origen o el destino
de esa ruta).

**Tile provider — CARTO Voyager se rompió:** se había cambiado el mapa
base a CARTO Voyager (estilo "tipo Uber") pero empezó a mostrar tiles con
la leyenda "API KEY REQUIRED" (dejó de ser gratis sin registro). El
usuario lo detectó probando desde otro dispositivo/red. Se revirtió a
`tile.openstreetmap.org` en los 3 componentes de mapa — es el único
proveedor gratis que se demostró 100% confiable durante toda la sesión.
Si en el futuro se quiere un estilo más pulido, hay que sacar una API key
gratuita con un proveedor serio (MapTiler, Stadia Maps) — no depender de
un endpoint anónimo cuya política puede cambiar sin aviso.

**Búsqueda progresiva + layout lado a lado:** el usuario notó que había
que elegir origen Y destino antes de ver nada en el mapa. Se relajó el
gatillo de búsqueda en `Buscar.jsx` para que dispare con solo UNO de los
dos lados elegido (el backend ya soportaba esto — `buscar_rutas` trata un
filtro ausente como "no restringe"). También se reordenó el layout: el
mapa y la lista de rutas candidatas (conductor, paradas, precio) ahora
van lado a lado (`grid-cols-[3fr_2fr]`, se apila en pantallas angostas)
en vez de la lista abajo del mapa requiriendo scroll.

**Rutas demo con geometría real de OSRM:** las 10 rutas de
`seed_demo.py` originalmente conectaban origen→paradas→destino con líneas
rectas. El usuario notó que en el detalle se veía una sola línea recta en
vez de una ruta real (a diferencia de su propia ruta, creada a mano con
clics + OSRM). Se agregó `calcular_ruta_real()` en `seed_demo.py`, que le
pide a `router.project-osrm.org` la ruta real pasando por todos los
puntos en orden (mismo servidor que usa el conductor real al crear una
ruta a mano) — con respaldo a línea recta si OSRM no responde. De paso
ahora `distancia_km`/`duracion_min` quedan con datos reales en vez de
`None`.

### Sesión 2026-08-27 — rediseño completo de Buscar.jsx: destino primero

Tras varias rondas de mockups (ver artifact publicado — carrusel de 6
pantallas móviles) el usuario definió un flujo **muy distinto** al que
había en la sección anterior, y esta sesión lo implementó de verdad,
reemplazando por completo el `Buscar.jsx` "lado a lado" descrito arriba:

- **Destino primero, no origen.** Argumento del usuario: a diferencia de
  Uber/Cabify (origen fijo = donde estás, solo se elige destino), acá el
  destino es lo que más le importa al pasajero (llegar cerca de su
  trabajo/destino real), así que se decide primero.
- **Flujo de 4 pasos** en `Buscar.jsx` (state `paso`, 1-4, ya no hay
  selectores de ambos lados en una sola pantalla):
  1. `PasoDestino`: comuna + dirección (obligatoria — sin coordenadas no
     hay centro para el círculo de radio).
  2. `PasoOrigen`: intenta geolocalización del navegador
     (`services/geolocalizacion.js`, `navigator.geolocation`) automática
     al entrar; si falla o se rechaza el permiso, cae a comuna+dirección
     manual. Muestra chip "Detectamos que estás en X" con opción
     "Cambiar".
  3. Resultados: filtra **fino por destino** (`destino_lat/lng/radio_m`,
     slider 100-1000m, default 200m) y **grueso por origen**
     (`comuna_origen`, sin radio todavía — ver nota abajo). Mapa +
     lista horizontal de tarjetas (chofer, cupos, precio) sincronizada:
     tocar una tarjeta O un pin resalta ambos a la vez (pin más grande +
     glow + check). Cada tarjeta seleccionada muestra "Quitar"
     (deseleccionar) y "Elegir" (confirmar → pasa a paso 4).
  4. Resultados-origen: la MISMA lógica pero solo para la ruta elegida,
     mapa centrado en el origen con su propio radio ajustable, mostrando
     el punto de recogida de esa ruta más cercano al origen. Botón "Ver
     detalle del viaje" → navega a `/rutas/:id` (la página de detalle ya
     existente, sin cambios).
- **Por qué el radio de origen NO filtra en el paso 3**: probé primero
  aplicando ambos radios (destino Y origen) desde el inicio, pero con
  datos reales eso devolvía cero resultados casi siempre (dos radios
  finos simultáneos son demasiado estrictos). Releyendo lo que pidió el
  usuario, el radio de origen es una herramienta de **exploración
  dentro de una ruta ya elegida**, no un filtro de la lista inicial — se
  corrigió a: destino con radio (preciso) + origen solo por comuna
  (amplio) para la lista, origen con radio recién en el paso 4.
- `MapaBusqueda.jsx` (mismo archivo, reescrito): ya no usa
  `leaflet.markercluster` (los resultados filtrados por radio son pocos,
  no hace falta agrupar). Props nuevos: `rutas`, `lado`
  (`"origen"|"destino"`), `foco` (centro del círculo), `radioM`,
  `resaltadaId`, `onClickPin`. Por cada ruta dibuja el punto más cercano
  al foco entre {origen/destino "oficial", paradas de esa comuna} — así
  una parada puede ser el pin representante si está más cerca que el
  origen/destino oficial de la ruta.
- Probado de punta a punta con las rutas demo reales (no solo mockup):
  registrar destino "Manuel Montt, Providencia" + origen por comuna
  Peñaflor → aparece la ruta de María Fernández (demo) → seleccionar →
  Elegir → paso 4 con su radio de origen → Ver detalle → llega a
  `/rutas/2` con los datos reales de esa ruta.
- Pendiente: la sección "Búsqueda progresiva + layout lado a lado" de
  más arriba en este archivo describe el diseño ANTERIOR a este —
  quedó obsoleta, se mantiene solo como historial de decisiones.

**Bug encontrado por el usuario — direcciones sin resultados bloqueaban
el flujo:** probando en su celular, el usuario escribió una dirección
real de Peñaflor ("El Roble 925") en el paso de origen y no pasó nada
— sin sugerencias, sin mensaje, botón "Continuar" deshabilitado sin
explicación. Se confirmó con curl directo a Nominatim que la causa es
real y externa: OpenStreetMap no tiene indexada la numeración de esa
calle (pasa seguido en calles residenciales de comunas periurbanas,
zonas con menos mapeo comunitario que el centro de Santiago). No es
arreglable en nuestro código porque depende de la cobertura de datos
del proveedor gratuito. Se mitigó con dos cambios en `CampoDireccion`
(dentro de `Buscar.jsx`) y el nuevo `components/MapaPunto.jsx`:
1. Mensaje explícito "No encontramos esa dirección" cuando la búsqueda
   termina sin resultados (antes quedaba en silencio).
2. Respaldo "marcar en el mapa": un mini-mapa de un solo clic que
   siempre funciona porque no depende de que la calle esté indexada
   por nombre — usa geocodificación inversa (coordenadas → texto), que
   es mucho más tolerante que la búsqueda por texto.

De paso apareció un bug relacionado: al elegir una dirección (de la
lista o del mapa), el propio texto de la dirección elegida disparaba
una nueva búsqueda automática y el dropdown de sugerencias reaparecía
encima de la selección. Se arregló con un ref `saltarBusquedaRef` que
el `useEffect` del debounce revisa para no re-buscar cuando el cambio
de texto vino de una selección, no de que el usuario tipeó.

**Mapa a pantalla completa (estilo Uber):** el usuario mandó una captura
real de la app de Uber y pidió que el mapa "sea nuestra propuesta de
valor también" — ocupando toda la pantalla, con el resto de la interfaz
flotando encima (chips, botón de volver, hoja inferior con los
controles/resultados), en vez del layout anterior de tarjeta centrada
con el mapa como un elemento más entre otros. Cambios:
- `App.jsx`: el layout raíz pasó a `h-dvh flex flex-col overflow-hidden`
  con el `<Navbar/>` fijo arriba y `<main className="flex-1 min-h-0
  overflow-y-auto">` envolviendo las rutas — así cualquier página puede
  pedir `h-full` para ocupar exactamente el alto que sobra bajo el
  Navbar, sin romper el scroll normal de las páginas que no lo usan
  (se probó que `/rutas` y `/` siguen scrolleando igual que antes).
- `Buscar.jsx`: los 4 pasos ahora usan `PantallaConMapa` (mapa de fondo
  a pantalla completa) + `HojaInferior` (panel blanco que sube desde
  abajo, con scroll propio) + `BotonFlotante`/chips flotando sobre el
  mapa. El mapa ya no es una caja con borde de 420px, es el fondo
  completo de cada pantalla.
- `MapaBusqueda.jsx`: el contenedor pasó a `w-full h-full` (llena a su
  padre en vez de altura fija) y se desactivaron los botones +/- de
  zoom (`zoomControl: false`) — en pantalla completa se hace zoom con
  los dedos, como en Uber; los botones flotantes hubieran chocado con
  el botón de volver.
- Verificado que el mapa efectivamente llena el viewport completo bajo
  el Navbar (medido con getBoundingClientRect) y que no aparece scroll
  de página (`document.documentElement.scrollHeight === window.innerHeight`).

**CORRECCIÓN — se abandonó la "hoja flotante encima del mapa":** la
sección de arriba (`HojaInferior` con `position:absolute` sobre el
mapa) tuvo dos bugs reales en dispositivos/navegadores del usuario que
no se pudieron reproducir en el entorno de prueba:
1. En el celular real, la hoja completa no aparecía (solo se veía el
   mapa) — probablemente por soporte inconsistente de `dvh` en
   versiones viejas de Chrome/Android (se cambió a `h-full`, ver nota
   de abajo, pero no quedó 100% confirmado que eso fuera la única causa).
2. En el PC, con la ventana ancha, el `<select>` de comuna (dentro de la
   hoja) quedaba **visualmente detrás del mapa** aunque seguía existiendo
   en el DOM y era clicable "a ciegas" — un bug de stacking/z-index real
   pero imposible de reproducir en las pruebas automatizadas de esta
   sesión (funcionaba perfecto ahí).

En vez de seguir depurando a ciegas un bug de superposición que no se
podía reproducir, se rediseñó `PantallaConMapa` (mismo nombre, misma
API `mapa`/`children`, pero ahora también recibe `overlayMapa`) para
que **el mapa y el panel sean hermanos en un `flex flex-col`, no uno
encima del otro** — pantalla dividida (map arriba en `flex-[3]`, panel
abajo en `flex-[2]`, "la mayor parte de la pantalla al mapa" como pidió
el usuario) en vez de `position:absolute` + `z-index`. Esto elimina la
categoría de bug por completo: no hay dos elementos compitiendo por el
mismo espacio en pantalla, así que no hay nada que pueda quedar
"detrás". `HojaInferior` ya no existe — el panel es simplemente el
segundo hijo de un flexbox. `BotonFlotante` y los chips SÍ siguen usando
`position:absolute`, pero ahora solo dentro de la caja del mapa (más
chica, `flex-[3]`), no sobre toda la pantalla — si algo volviera a
fallar ahí, el panel del formulario seguiría intacto y usable, que es
lo importante.

Verificado con inspección del DOM (`panel.closest()` desde el `<select>`
no está anidado dentro de la caja del mapa — son hermanos) y con el
flujo completo (paso 1 a 4) funcionando de punta a punta después del
cambio. Sigue pendiente que el usuario confirme en su celular real.

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
