"""
Punto de entrada de la API de TACO.

Para levantar en desarrollo:
    py -m uvicorn main:app --reload --port 8000

Para probar desde otro dispositivo en la misma red Wi-Fi:
    py -m uvicorn main:app --reload --port 8000 --host 0.0.0.0
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import crear_tablas
from routes.auth import router as auth_router
from routes.mensajes import router as mensajes_router
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


@app.on_event("startup")
def on_startup():
    crear_tablas()


@app.get("/")
def raiz():
    return {"app": "TACO API", "estado": "ok"}
