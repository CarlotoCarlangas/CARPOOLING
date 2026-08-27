"""
Genera datos de prueba (conductores + rutas ficticias) para poder probar
el buscador del pasajero con variedad real de comunas y puntos en el mapa.

Cada ruta tiene entre 5 y 10 paradas intermedias, repartidas entre la
comuna de origen (Peñaflor) y la comuna de destino: la idea es que al
buscar, un pasajero vea no solo el origen/destino "oficial" de la ruta
sino también esas paradas como posibles puntos de recogida o bajada
cercanos a él — así se prueba de verdad la lógica de "cualquier punto de
la ruta cuenta" que ya existe en `GET /api/routes/buscar`.

SOLO PARA DESARROLLO/DEMO — nunca correr esto contra una base de datos con
usuarios reales en producción. Los conductores y rutas que crea están
claramente marcados como "(demo)" en el nombre para poder identificarlos
y borrarlos después con `borrar_demo.py`.

Uso:
    venv\\Scripts\\python.exe seed_demo.py
"""
import json
import time
import urllib.request
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

# Nombres de calle para variar las paradas dentro de cada comuna.
CALLES_PENAFLOR = [
    "Bernardo O'Higgins", "Balmaceda", "Portales", "Freire", "Independencia",
    "Camino a Melipilla", "Santa Filomena", "Manuel Rodríguez", "Prat", "Los Aromos",
]
CALLES_POR_COMUNA = {
    "Providencia": ["Providencia", "Suecia", "Holanda", "Bilbao", "Nueva de Lyon", "Ricardo Lyon", "Los Leones", "Antonio Varas"],
    "Ñuñoa": ["Irarrázaval", "Grecia", "Sucre", "Diagonal Oriente", "Simón Bolívar"],
    "Santiago": ["Alameda", "San Diego", "Cumming", "Huérfanos", "Estado"],
    "Las Condes": ["Kennedy", "El Bosque", "Apoquindo", "Isidora Goyenechea", "Manquehue"],
    "Maipú": ["5 de Abril", "Pajaritos", "Camino a Rinconada", "Los Pensamientos"],
    "La Florida": ["Vicuña Mackenna", "Walker Martínez", "Departamental", "Rojas Magallanes"],
}

HORARIOS = ["07:30", "08:00", "08:15", "08:30", "09:00"]
DIAS = [
    ["lunes", "martes", "miercoles", "jueves", "viernes"],
    ["lunes", "miercoles", "viernes"],
    ["martes", "jueves"],
]


def generar_paradas(lat_base, lng_base, comuna, calles, cantidad, semilla):
    """Puntos cercanos a (lat_base, lng_base), dentro de la misma comuna,
    con nombres de calle variados. El "jitter" es determinístico (no
    aleatorio) para que el script sea reproducible."""
    paradas = []
    for j in range(cantidad):
        offset_lat = ((semilla + j * 2) % 7 - 3) * 0.006
        offset_lng = ((semilla + j * 3) % 5 - 2) * 0.007
        calle = calles[(semilla + j) % len(calles)]
        paradas.append({
            "lat": round(lat_base + offset_lat, 6),
            "lng": round(lng_base + offset_lng, 6),
            "direccion": f"{calle}, {comuna}",
            "comuna": comuna,
        })
    return paradas


def calcular_ruta_real(puntos):
    """Llama al mismo servidor OSRM público que usa el conductor real al
    trazar su ruta, para que las rutas demo también sigan calles de verdad
    en vez de una línea recta. `puntos` es una lista ordenada de
    {lat, lng}. Si OSRM falla por lo que sea, devuelve None y quien llama
    debe usar la línea recta como respaldo (mejor eso que romper el seed)."""
    coords = ";".join(f"{p['lng']},{p['lat']}" for p in puntos)
    url = f"https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read())
        if data.get("code") != "Ok" or not data.get("routes"):
            return None
        ruta = data["routes"][0]
        geometria = [[lat, lng] for lng, lat in ruta["geometry"]["coordinates"]]
        return {
            "geometria": geometria,
            "distancia_km": round(ruta["distance"] / 1000, 1),
            "duracion_min": round(ruta["duration"] / 60),
        }
    except Exception as e:
        print(f"  (aviso: OSRM falló para esta ruta, uso línea recta — {e})")
        return None


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
        total_paradas = 0
        for i, (destino_lat, destino_lng, destino_direccion, destino_comuna) in enumerate(DESTINOS):
            origen_lat, origen_lng, origen_direccion = ORIGENES_PENAFLOR[i]
            conductor = conductores[i % len(conductores)]

            total_paradas_ruta = 5 + (i % 6)  # entre 5 y 10
            n_origen = total_paradas_ruta // 2
            n_destino = total_paradas_ruta - n_origen

            paradas = (
                generar_paradas(origen_lat, origen_lng, "Peñaflor", CALLES_PENAFLOR, n_origen, semilla=i)
                + generar_paradas(
                    destino_lat, destino_lng, destino_comuna,
                    CALLES_POR_COMUNA[destino_comuna], n_destino, semilla=i + 100,
                )
            )
            total_paradas += len(paradas)

            puntos_ordenados = (
                [{"lat": origen_lat, "lng": origen_lng}]
                + [{"lat": p["lat"], "lng": p["lng"]} for p in paradas]
                + [{"lat": destino_lat, "lng": destino_lng}]
            )
            print(f"  calculando ruta real por calles {i + 1}/10 ({destino_comuna})...")
            real = calcular_ruta_real(puntos_ordenados)
            time.sleep(0.5)  # no saturar el servidor público de OSRM

            if real:
                geometria = real["geometria"]
                distancia_km = real["distancia_km"]
                duracion_min = real["duracion_min"]
            else:
                # Respaldo si OSRM no responde: línea recta entre los puntos.
                geometria = [[p["lat"], p["lng"]] for p in puntos_ordenados]
                distancia_km = None
                duracion_min = None

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
                paradas=paradas,
                geometria=geometria,
                distancia_km=distancia_km,
                duracion_min=duracion_min,
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
        print(
            f"Listo: {len(conductores)} conductores demo, {creadas} rutas demo "
            f"creadas ({total_paradas} paradas en total, entre 5 y 10 por ruta)."
        )


if __name__ == "__main__":
    main()
