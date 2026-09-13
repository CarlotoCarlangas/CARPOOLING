"""
Punto de entrada de la API de TACO.

Para levantar en desarrollo:
    py -m uvicorn main:app --reload --port 8000

Para probar desde otro dispositivo en la misma red Wi-Fi:
    py -m uvicorn main:app --reload --port 8000 --host 0.0.0.0
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import crear_tablas
from routes.admin import router as admin_router
from routes.auth import router as auth_router
from routes.mensajes import router as mensajes_router
from routes.notificaciones import router as notificaciones_router
from routes.requests import router as requests_router
from routes.routes import router as routes_router
from storage import UPLOADS_DIR

app = FastAPI(title="TACO API", version="0.1.0")

# TODO PRODUCCIÓN: restringir allow_origins al dominio real del frontend.
# En desarrollo se deja abierto porque se prueba desde distintos
# dispositivos/IPs de la red local (celular, notebook, etc).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(auth_router, prefix="/api")
app.include_router(routes_router, prefix="/api")
app.include_router(requests_router, prefix="/api")
app.include_router(mensajes_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(notificaciones_router, prefix="/api")


@app.on_event("startup")
def on_startup():
    crear_tablas()


@app.get("/api/health")
def health():
    return {"app": "TACO API", "estado": "ok"}


# ─── Servir el frontend compilado (túnel / deploy de un solo origen) ───
# En desarrollo se usa el servidor de Vite (npm run dev, puerto 5173) y este
# bloque no interviene. Cuando el frontend está compilado (frontend/dist),
# FastAPI sirve la app React y la API (/api) desde el MISMO origen — así basta
# un solo link/túnel y no hay problemas de CORS ni de "host no permitido".
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if (FRONTEND_DIST / "assets").is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIST / "assets")),
        name="assets",
    )


@app.get("/{ruta_spa:path}")
def servir_frontend(ruta_spa: str):
    # Esta ruta va al final: la API (/api) y /uploads ya se resolvieron antes.
    index = FRONTEND_DIST / "index.html"
    if not index.is_file():
        # Frontend no compilado: comportarse como API pura.
        return {"app": "TACO API", "estado": "ok"}
    # Servir un archivo real del build si existe (favicon, imágenes, etc.).
    if ruta_spa:
        archivo = FRONTEND_DIST / ruta_spa
        if archivo.is_file():
            return FileResponse(str(archivo))
    # Cualquier otra ruta -> index.html (React Router resuelve en el navegador).
    return FileResponse(str(index))
