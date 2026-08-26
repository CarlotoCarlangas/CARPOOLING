"""
Conexión a la base de datos SQLite.

TODO PRODUCCIÓN: migrar de SQLite a PostgreSQL + PostGIS (para hacer búsquedas
geográficas reales tipo "rutas cercanas a mi ubicación"). SQLite no tiene
soporte geoespacial nativo, por eso en el prototipo la búsqueda por cercanía
se hace con una fórmula de distancia simple en Python (ver routes/routes.py).
"""
from sqlmodel import SQLModel, Session, create_engine

DATABASE_URL = "sqlite:///./taco.db"

# check_same_thread=False es necesario porque FastAPI puede atender cada
# request en un hilo distinto, y SQLite por defecto solo permite un hilo.
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


def crear_tablas():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
