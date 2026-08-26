"""
Módulo 2: Creación de ruta (conductor) + listado básico (usado también
por el módulo 3 de búsqueda, que se construirá después).
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
        destino_lat=ruta.destino_lat,
        destino_lng=ruta.destino_lng,
        destino_direccion=ruta.destino_direccion,
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
    """Distancia en línea recta (haversine). Solo para ordenar resultados
    por cercanía en el prototipo; no reemplaza la ruta real de OSRM.
    TODO PRODUCCIÓN: reemplazar por una consulta geoespacial en PostGIS."""
    r = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * asin(sqrt(a))


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
        destino_lat=datos.destino.lat,
        destino_lng=datos.destino.lng,
        destino_direccion=datos.destino.direccion,
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
    ordenan por cercanía al origen buscado (usado por el módulo 3 de
    búsqueda de pasajeros).
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


@router.get("/{ruta_id}", response_model=RouteOut)
def detalle_ruta(ruta_id: int, session: Session = Depends(get_session)):
    ruta = session.get(Route, ruta_id)
    if not ruta:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    conductor = session.get(User, ruta.conductor_id)
    return _a_route_out(ruta, conductor)
