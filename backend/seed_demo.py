"""
Genera datos de prueba (conductores + rutas ficticias) para poder probar
el buscador del pasajero con variedad real de comunas y puntos en el mapa.

SOLO PARA DESARROLLO/DEMO — nunca correr esto contra una base de datos con
usuarios reales en producción. Los conductores y rutas que crea están
claramente marcados como "(demo)" en el nombre para poder identificarlos
y borrarlos después con `borrar_demo.py`.

Uso:
    venv\\Scripts\\python.exe seed_demo.py
"""
import json
from datetime import datetime

from sqlmodel import Session, select

from database import engine
from models import Route, User
from utils import generar_token, hash_password

CONDUCTORES_DEMO = [
    {"rut": "20111222-9", "nombre": "María Fernández (demo)", "email": "maria.demo@taco.cl"},
    {"rut": "20222333-7", "nombre": "Pedro Soto (demo)", "email": "pedro.demo@taco.cl"},
    {"rut": "20333444-5", "nombre": "Ana Silva (demo)", "email": "ana.demo@taco.cl"},
    {"rut": "20444555-3", "nombre": "Diego Rojas (demo)", "email": "diego.demo@taco.cl"},
]

# Puntos de origen variados dentro de Peñaflor (todas las rutas parten de ahí)
ORIGENES_PENAFLOR = [
    (-33.6056, -70.8810, "Plaza de Peñaflor, Peñaflor"),
    (-33.6100, -70.8750, "Pajaritos, Peñaflor"),
    (-33.6020, -70.8850, "Estación Peñaflor, Peñaflor"),
    (-33.6080, -70.8700, "Malloco, Peñaflor"),
    (-33.5980, -70.8900, "Los Cerrillos, Peñaflor"),
    (-33.6150, -70.8650, "Ruta 78, Peñaflor"),
    (-33.6000, -70.8950, "El Rosario, Peñaflor"),
    (-33.6120, -70.8600, "Bernardo O'Higgins, Peñaflor"),
    (-33.5950, -70.8850, "Padre Hurtado, Peñaflor"),
    (-33.6070, -70.8780, "Centro, Peñaflor"),
]

# 5 destinos en Providencia + 5 repartidos por otras comunas de la RM
DESTINOS = [
    (-33.4270, -70.6190, "Manuel Montt, Providencia", "Providencia"),
    (-33.4260, -70.6050, "Los Leones, Providencia", "Providencia"),
    (-33.4310, -70.6110, "Pedro de Valdivia, Providencia", "Providencia"),
    (-33.4180, -70.5970, "Tobalaba, Providencia", "Providencia"),
    (-33.4372, -70.6333, "Plaza Italia, Providencia", "Providencia"),
    (-33.4558, -70.5990, "Plaza Ñuñoa, Ñuñoa", "Ñuñoa"),
    (-33.4372, -70.6506, "Plaza de Armas, Santiago", "Santiago"),
    (-33.4089, -70.5693, "Apoquindo, Las Condes", "Las Condes"),
    (-33.5100, -70.7580, "Plaza de Maipú, Maipú", "Maipú"),
    (-33.5228, -70.5893, "Plaza La Florida, La Florida", "La Florida"),
]

HORARIOS = ["07:30", "08:00", "08:15", "08:30", "09:00"]
DIAS = [
    ["lunes", "martes", "miercoles", "jueves", "viernes"],
    ["lunes", "miercoles", "viernes"],
    ["martes", "jueves"],
]


def main():
    with Session(engine) as session:
        conductores = []
        for datos in CONDUCTORES_DEMO:
            existente = session.exec(select(User).where(User.rut == datos["rut"])).first()
            if existente:
                conductores.append(existente)
                continue
            u = User(
                rut=datos["rut"],
                nombre=datos["nombre"],
                telefono="+56900000000",
                email=datos["email"],
                password_hash=hash_password("demo12345"),
                es_conductor=True,
                es_pasajero=False,
                acepta_terminos=True,
                fecha_aceptacion_terminos=datetime.utcnow(),
                token=generar_token(),
            )
            session.add(u)
            session.commit()
            session.refresh(u)
            conductores.append(u)

        creadas = 0
        for i, (destino_lat, destino_lng, destino_direccion, destino_comuna) in enumerate(DESTINOS):
            origen_lat, origen_lng, origen_direccion = ORIGENES_PENAFLOR[i]
            conductor = conductores[i % len(conductores)]

            ruta = Route(
                conductor_id=conductor.id,
                origen_lat=origen_lat,
                origen_lng=origen_lng,
                origen_direccion=origen_direccion,
                origen_comuna="Peñaflor",
                destino_lat=destino_lat,
                destino_lng=destino_lng,
                destino_direccion=destino_direccion,
                destino_comuna=destino_comuna,
                paradas=[],
                # Línea recta simplificada (no OSRM real) — suficiente para
                # ver un pin y una línea en el mapa de búsqueda; no se usa
                # para nada que dependa de la geometría exacta.
                geometria=[[origen_lat, origen_lng], [destino_lat, destino_lng]],
                distancia_km=None,
                duracion_min=None,
                cupos_totales=(i % 4) + 1,
                cupos_disponibles=(i % 4) + 1,
                precio_sugerido=1500 + (i * 150),
                hora_salida=HORARIOS[i % len(HORARIOS)],
                dias_recurrencia=DIAS[i % len(DIAS)],
                modo_solo_mujeres=False,
                activa=True,
            )
            session.add(ruta)
            creadas += 1

        session.commit()
        print(f"Listo: {len(conductores)} conductores demo, {creadas} rutas demo creadas.")


if __name__ == "__main__":
    main()
