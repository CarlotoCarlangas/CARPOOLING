# TACO — Carpooling Peñaflor ↔ Santiago

Prototipo funcional de carpooling periurbano. Ver [CLAUDE.md](./CLAUDE.md) para el
resumen completo del proyecto, modelo de negocio y decisiones técnicas.

## Estado actual

✅ **Módulo 1 — Registro y login**: RUT chileno validado, roles conductor/pasajero,
consentimiento de datos (Ley 21.719), documentos de vehículo (licencia, revisión
técnica, SOAP), foto de perfil, modo "solo mujeres" opcional.

✅ **Módulo 2 — Creación de ruta**: mapa interactivo (Leaflet + OpenStreetMap),
clic para origen/paradas/destino, ruteo real por calles vía OSRM, cupos, horario,
recurrencia semanal, precio sugerido.

⬜ Módulos 3 a 7 (búsqueda/reserva, chat, tracking, pagos, evaluaciones): pendientes.

## Requisitos

- Python 3.11+ (en Windows, el lanzador `py` — revisa con `py --version`)
- Node.js 20+

## Cómo levantar el proyecto (primera vez en un PC nuevo)

### 1. Backend

```bash
cd backend
py -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
py -m uvicorn main:app --reload --port 8000
```

Verifica que funciona abriendo http://localhost:8000/docs

### 2. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173

## Probar entre dos dispositivos reales (conductor + pasajero)

Esto es clave para el objetivo del prototipo: dos personas probando desde
computadores/celulares distintos.

1. Levanta el backend y el frontend en **un solo PC** (el que hace de "servidor"),
   siguiendo los pasos de arriba. El frontend ya está configurado para detectar
   automáticamente la IP desde la que se accede (no hay que tocar nada).
2. Anota la IP local de ese PC. Con el frontend corriendo, la terminal de `npm run dev`
   muestra algo como `Network: http://192.168.1.8:5173/` — esa es tu IP.
3. Asegúrate de que el firewall de Windows permita conexiones entrantes a los
   puertos 5173 y 8000 en redes privadas (puede aparecer un aviso la primera vez
   que levantas cada servidor — hay que aceptarlo).
4. Desde el otro dispositivo (celular, notebook), conectado a la **misma red Wi-Fi**,
   abre `http://<esa-ip>:5173` en el navegador.
5. Una persona se registra como conductor, sube sus documentos de vehículo en
   "Mi perfil", y publica una ruta. La otra persona se registra como pasajero y
   la ve en "Ver rutas".

Si algún día se prueba desde redes distintas (no la misma Wi-Fi), hay que exponer
los servidores a internet (ej. con `ngrok` o desplegando en un hosting) — eso no
está configurado todavía en este prototipo.

## Continuar el proyecto en otro computador

```bash
git clone <URL-del-repo>
cd taco-app
```

Y repite los pasos de "Cómo levantar el proyecto" de arriba (crear el venv de
Python e instalar los `node_modules` es necesario en cada PC nuevo — esas carpetas
no se suben a GitHub).

## Estructura

```
taco-app/
├── backend/     # FastAPI + SQLite
├── frontend/    # React + Vite + Leaflet
└── CLAUDE.md    # Contexto del proyecto para retomar el trabajo con Claude Code
```

## Notas importantes para producción

Hay varias decisiones tomadas solo para que el prototipo funcione rápido y que
**no deben usarse tal cual con usuarios reales**. Están marcadas en el código con
`# TODO PRODUCCIÓN:` / `// TODO PRODUCCIÓN:`. Las más importantes:

- **Autenticación**: token simple sin expiración. Cambiar a JWT.
- **Base de datos**: SQLite → PostgreSQL + PostGIS (para búsqueda geográfica real).
- **Archivos subidos**: se guardan en disco local sin control de acceso. Cambiar a
  almacenamiento en la nube con URLs firmadas (los documentos como licencia/SOAP
  son sensibles).
- **Ruteo (OSRM)**: se usa el servidor público gratuito de demostración
  (`router.project-osrm.org`), sin garantía de uptime. Levantar un OSRM propio.
- **Geocodificación**: se usa Nominatim público (límite ~1 req/segundo).
- **CORS**: abierto (`*`) para poder probar desde cualquier IP de la red local.
  Restringir al dominio real.
