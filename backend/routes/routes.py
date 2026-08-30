"""
Módulo 2: Creación de ruta (conductor).
Módulo 3: descubrimiento/búsqueda de rutas (pasajero) — /comunas y /buscar.
"""
from math import asin, cos, radians, sin, sqrt
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from database import get_session
from deps import get_current_user
from models import Route, User, VehiculoDocumento
from schemas import ConductorResumen, PuntoRuta, RouteCreate, RouteOut

router = APIRouter(prefix="/routes", tags=["routes"])

COMISION_PASAJERO = 0.10  # el pasajero paga 10% extra sobre el precio sugerido


def _a_route_out(ruta: Route, conductor: User) -> RouteOut:
    return RouteOut(
        id=ruta.id,
        conductor=ConductorResumen(
            id=conductor.id,
            nombre=conductor.nombre,
            foto_url=conductor.foto_url,
            calificacion_promedio=conductor.calificacion_promedio,
            total_calificaciones=conductor.total_calificaciones,
        ),
        origen_lat=ruta.origen_lat,
        origen_lng=ruta.origen_lng,
        origen_direccion=ruta.origen_direccion,
        origen_comuna=ruta.origen_comuna,
        destino_lat=ruta.destino_lat,
        destino_lng=ruta.destino_lng,
        destino_direccion=ruta.destino_direccion,
        destino_comuna=ruta.destino_comuna,
        paradas=ruta.paradas,
        geometria=ruta.geometria,
        distancia_km=ruta.distancia_km,
        duracion_min=ruta.duracion_min,
        cupos_totales=ruta.cupos_totales,
        cupos_disponibles=ruta.cupos_disponibles,
        precio_sugerido=ruta.precio_sugerido,
        precio_pasajero=round(ruta.precio_sugerido * (1 + COMISION_PASAJERO)),
        hora_salida=ruta.hora_salida,
        dias_recurrencia=ruta.dias_recurrencia,
        modo_solo_mujeres=ruta.modo_solo_mujeres,
        activa=ruta.activa,
        fecha_creacion=ruta.fecha_creacion,
    )


def _distancia_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia en línea recta (haversine). Solo para ordenar/filtrar
    resultados en el prototipo; no reemplaza la ruta real de OSRM.
    TODO PRODUCCIÓN: reemplazar por una consulta geoespacial en PostGIS."""
    r = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _puntos_ordenados(ruta: Route) -> list[dict]:
    """Todos los puntos de la ruta en el orden real del recorrido:
    origen, paradas intermedias, destino."""
    inicio = {
        "lat": ruta.origen_lat,
        "lng": ruta.origen_lng,
        "direccion": ruta.origen_direccion,
        "comuna": ruta.origen_comuna,
    }
    fin = {
        "lat": ruta.destino_lat,
        "lng": ruta.destino_lng,
        "direccion": ruta.destino_direccion,
        "comuna": ruta.destino_comuna,
    }
    return [inicio, *ruta.paradas, fin]


def _primer_punto_que_coincide(
    puntos: list[dict],
    comuna: Optional[str],
    lat: Optional[float],
    lng: Optional[float],
    radio_km: Optional[float],
    desde_indice: int = 0,
) -> Optional[int]:
    """Recorre los puntos desde `desde_indice` y devuelve el índice del
    primero que coincide con el filtro (por comuna, o por círculo
    lat/lng+radio). Si no hay ningún filtro definido, no restringe."""
    if not comuna and lat is None:
        return desde_indice

    for i in range(desde_indice, len(puntos)):
        p = puntos[i]
        if comuna and p.get("comuna") == comuna:
            return i
        if lat is not None and lng is not None:
            if _distancia_km(lat, lng, p["lat"], p["lng"]) <= (radio_km or 0):
                return i
    return None


@router.post("", response_model=RouteOut, status_code=201)
def crear_ruta(
    datos: RouteCreate,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not usuario_actual.es_conductor:
        raise HTTPException(status_code=403, detail="Solo los conductores pueden publicar rutas")

    doc = session.exec(
        select(VehiculoDocumento).where(VehiculoDocumento.user_id == usuario_actual.id)
    ).first()
    if not doc or not (doc.licencia_conducir_url and doc.revision_tecnica_url and doc.soap_url):
        raise HTTPException(
            status_code=403,
            detail="Debes subir licencia de conducir, revisión técnica y SOAP antes de publicar una ruta",
        )

    ruta = Route(
        conductor_id=usuario_actual.id,
        origen_lat=datos.origen.lat,
        origen_lng=datos.origen.lng,
        origen_direccion=datos.origen.direccion,
        origen_comuna=datos.origen.comuna,
        destino_lat=datos.destino.lat,
        destino_lng=datos.destino.lng,
        destino_direccion=datos.destino.direccion,
        destino_comuna=datos.destino.comuna,
        paradas=[p.model_dump() for p in datos.paradas],
        geometria=datos.geometria,
        distancia_km=datos.distancia_km,
        duracion_min=datos.duracion_min,
        cupos_totales=datos.cupos_totales,
        cupos_disponibles=datos.cupos_totales,
        precio_sugerido=datos.precio_sugerido,
        hora_salida=datos.hora_salida,
        dias_recurrencia=datos.dias_recurrencia,
        modo_solo_mujeres=datos.modo_solo_mujeres,
    )
    session.add(ruta)
    session.commit()
    session.refresh(ruta)

    return _a_route_out(ruta, usuario_actual)


@router.get("", response_model=List[RouteOut])
def listar_rutas(
    conductor_id: Optional[int] = None,
    origen_lat: Optional[float] = Query(default=None),
    origen_lng: Optional[float] = Query(default=None),
    radio_km: float = Query(default=5.0),
    session: Session = Depends(get_session),
):
    """
    Lista rutas activas. Si se pasan origen_lat/origen_lng, se filtran y
    ordenan por cercanía al origen buscado.
    """
    query = select(Route).where(Route.activa == True)  # noqa: E712
    if conductor_id is not None:
        query = query.where(Route.conductor_id == conductor_id)

    rutas = session.exec(query).all()

    resultado = []
    for ruta in rutas:
        if origen_lat is not None and origen_lng is not None:
            dist = _distancia_km(origen_lat, origen_lng, ruta.origen_lat, ruta.origen_lng)
            if dist > radio_km:
                continue
        conductor = session.get(User, ruta.conductor_id)
        resultado.append(_a_route_out(ruta, conductor))

    return resultado


@router.get("/comunas", response_model=List[str])
def listar_comunas(session: Session = Depends(get_session)):
    """
    Comunas disponibles para los selectores de búsqueda del pasajero (se
    usa la misma lista para "comuna de origen" y "comuna de destino": la
    dirección del viaje no está fija, así que no tiene sentido separar la
    lista en "comunas de origen" vs "de destino").
    """
    rutas = session.exec(select(Route).where(Route.activa == True)).all()  # noqa: E712
    comunas = set()
    for ruta in rutas:
        if ruta.origen_comuna:
            comunas.add(ruta.origen_comuna)
        if ruta.destino_comuna:
            comunas.add(ruta.destino_comuna)
        for p in ruta.paradas:
            if p.get("comuna"):
                comunas.add(p["comuna"])
    return sorted(comunas)


@router.get("/buscar", response_model=List[RouteOut])
def buscar_rutas(
    comuna_origen: Optional[str] = None,
    comuna_destino: Optional[str] = None,
    origen_lat: Optional[float] = None,
    origen_lng: Optional[float] = None,
    origen_radio_m: Optional[float] = None,
    destino_lat: Optional[float] = None,
    destino_lng: Optional[float] = None,
    destino_radio_m: Optional[float] = None,
    session: Session = Depends(get_session),
):
    """
    Búsqueda para el pasajero (Módulo 3). Una ruta califica si tiene un
    punto (origen, parada o destino) que coincide con el criterio de
    origen, y — más adelante en el mismo recorrido — otro punto que
    coincide con el criterio de destino. "Más adelante" es clave: evita
    ofrecer viajes donde el pasajero tendría que ir "hacia atrás" en el
    trayecto del conductor.

    Cada lado (origen/destino) se puede filtrar por comuna exacta (modo
    "explorar por comuna", sin coordenadas) o por un círculo lat/lng +
    radio en metros (modo "dibujé un área en el mapa"). Si no se manda
    ningún filtro para un lado, ese lado no restringe la búsqueda.
    """
    origen_radio_km = (origen_radio_m / 1000) if origen_radio_m else None
    destino_radio_km = (destino_radio_m / 1000) if destino_radio_m else None

    rutas = session.exec(
        select(Route).where(Route.activa == True, Route.cupos_disponibles > 0)  # noqa: E712
    ).all()

    resultado = []
    for ruta in rutas:
        puntos = _puntos_ordenados(ruta)

        idx_origen = _primer_punto_que_coincide(
            puntos, comuna_origen, origen_lat, origen_lng, origen_radio_km, desde_indice=0
        )
        if idx_origen is None:
            continue

        idx_destino = _primer_punto_que_coincide(
            puntos, comuna_destino, destino_lat, destino_lng, destino_radio_km,
            desde_indice=idx_origen + 1,
        )
        if idx_destino is None:
            continue

        conductor = session.get(User, ruta.conductor_id)
        resultado.append(_a_route_out(ruta, conductor))

    return resultado


@router.get("/{ruta_id}", response_model=RouteOut)
def detalle_ruta(ruta_id: int, session: Session = Depends(get_session)):
    ruta = session.get(Route, ruta_id)
    if not ruta:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    conductor = session.get(User, ruta.conductor_id)
    return _a_route_out(ruta, conductor)
