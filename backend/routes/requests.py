"""
Módulo 3: reserva del pasajero. El pasajero solicita un cupo en una ruta
(con el punto de embarque que eligió); el conductor ve las solicitudes de
sus rutas y las acepta o rechaza.
"""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from deps import get_current_user
from models import Route, Solicitud, User
from routes.routes import COMISION_PASAJERO
from schemas import (
    ConductorResumen,
    PasajeroResumen,
    RutaResumen,
    SolicitudCreate,
    SolicitudOut,
    SolicitudPasajeroOut,
    ViajeEnCursoOut,
)

router = APIRouter(prefix="/requests", tags=["requests"])


def _a_pasajero_resumen(pasajero: User) -> PasajeroResumen:
    return PasajeroResumen(
        id=pasajero.id,
        nombre=pasajero.nombre,
        telefono=pasajero.telefono,
        foto_url=pasajero.foto_url,
        calificacion_promedio=pasajero.calificacion_promedio,
        total_calificaciones=pasajero.total_calificaciones,
    )


def _a_ruta_resumen(ruta: Route, conductor: User) -> RutaResumen:
    return RutaResumen(
        id=ruta.id,
        conductor=ConductorResumen(
            id=conductor.id,
            nombre=conductor.nombre,
            foto_url=conductor.foto_url,
            calificacion_promedio=conductor.calificacion_promedio,
            total_calificaciones=conductor.total_calificaciones,
        ),
        origen_direccion=ruta.origen_direccion,
        destino_direccion=ruta.destino_direccion,
        hora_salida=ruta.hora_salida,
        precio_pasajero=round(ruta.precio_sugerido * (1 + COMISION_PASAJERO)),
    )


def _a_solicitud_out(solicitud: Solicitud, ruta: Route, conductor: User, pasajero: User) -> SolicitudOut:
    return SolicitudOut(
        id=solicitud.id,
        ruta=_a_ruta_resumen(ruta, conductor),
        pasajero=_a_pasajero_resumen(pasajero),
        embarque_lat=solicitud.embarque_lat,
        embarque_lng=solicitud.embarque_lng,
        embarque_direccion=solicitud.embarque_direccion,
        estado=solicitud.estado,
        fecha_solicitud=solicitud.fecha_solicitud,
    )


@router.post("", response_model=SolicitudOut, status_code=201)
def crear_solicitud(
    datos: SolicitudCreate,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not usuario_actual.es_pasajero:
        raise HTTPException(status_code=403, detail="Solo los pasajeros pueden reservar cupos")

    ruta = session.get(Route, datos.ruta_id)
    if not ruta or not ruta.activa:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")

    if ruta.conductor_id == usuario_actual.id:
        raise HTTPException(status_code=400, detail="No puedes reservar un cupo en tu propia ruta")

    if ruta.cupos_disponibles <= 0:
        raise HTTPException(status_code=400, detail="Este viaje ya no tiene cupos disponibles")

    ya_existe = session.exec(
        select(Solicitud).where(
            Solicitud.ruta_id == ruta.id,
            Solicitud.pasajero_id == usuario_actual.id,
            Solicitud.estado.in_(["pendiente", "aceptada"]),
        )
    ).first()
    if ya_existe:
        raise HTTPException(status_code=400, detail="Ya tienes una solicitud para este viaje")

    solicitud = Solicitud(
        ruta_id=ruta.id,
        pasajero_id=usuario_actual.id,
        embarque_lat=datos.embarque.lat,
        embarque_lng=datos.embarque.lng,
        embarque_direccion=datos.embarque.direccion,
    )
    session.add(solicitud)
    session.commit()
    session.refresh(solicitud)

    conductor = session.get(User, ruta.conductor_id)
    return _a_solicitud_out(solicitud, ruta, conductor, usuario_actual)


@router.get("/mias", response_model=List[SolicitudPasajeroOut])
def mis_solicitudes(
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    solicitudes = session.exec(
        select(Solicitud)
        .where(Solicitud.pasajero_id == usuario_actual.id)
        .order_by(Solicitud.fecha_solicitud.desc())
    ).all()

    resultado = []
    for s in solicitudes:
        ruta = session.get(Route, s.ruta_id)
        if not ruta:
            continue
        conductor = session.get(User, ruta.conductor_id)
        resultado.append(
            SolicitudPasajeroOut(
                id=s.id,
                ruta=_a_ruta_resumen(ruta, conductor),
                embarque_direccion=s.embarque_direccion,
                estado=s.estado,
                fecha_solicitud=s.fecha_solicitud,
            )
        )
    return resultado


@router.get("/recibidas", response_model=List[SolicitudOut])
def solicitudes_recibidas(
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Todas las solicitudes recibidas en cualquiera de las rutas del
    conductor autenticado, sin tener que consultar ruta por ruta."""
    rutas = session.exec(select(Route).where(Route.conductor_id == usuario_actual.id)).all()
    rutas_por_id = {r.id: r for r in rutas}
    if not rutas_por_id:
        return []

    solicitudes = session.exec(
        select(Solicitud)
        .where(Solicitud.ruta_id.in_(rutas_por_id.keys()))
        .order_by(Solicitud.fecha_solicitud.desc())
    ).all()

    resultado = []
    for s in solicitudes:
        ruta = rutas_por_id[s.ruta_id]
        pasajero = session.get(User, s.pasajero_id)
        resultado.append(_a_solicitud_out(s, ruta, usuario_actual, pasajero))
    return resultado


@router.get("/ruta/{ruta_id}", response_model=List[SolicitudOut])
def solicitudes_de_ruta(
    ruta_id: int,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    ruta = session.get(Route, ruta_id)
    if not ruta:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    if ruta.conductor_id != usuario_actual.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a las solicitudes de esta ruta")

    solicitudes = session.exec(
        select(Solicitud)
        .where(Solicitud.ruta_id == ruta_id)
        .order_by(Solicitud.fecha_solicitud.desc())
    ).all()

    resultado = []
    for s in solicitudes:
        pasajero = session.get(User, s.pasajero_id)
        resultado.append(_a_solicitud_out(s, ruta, usuario_actual, pasajero))
    return resultado


def _responder_solicitud(solicitud_id: int, nuevo_estado: str, usuario_actual: User, session: Session) -> tuple[Solicitud, Route]:
    solicitud = session.get(Solicitud, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    ruta = session.get(Route, solicitud.ruta_id)
    if not ruta or ruta.conductor_id != usuario_actual.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta solicitud")

    if solicitud.estado != "pendiente":
        raise HTTPException(status_code=400, detail="Esta solicitud ya fue respondida")

    if nuevo_estado == "aceptada":
        if ruta.cupos_disponibles <= 0:
            raise HTTPException(status_code=400, detail="Este viaje ya no tiene cupos disponibles")
        ruta.cupos_disponibles -= 1
        session.add(ruta)

    solicitud.estado = nuevo_estado
    solicitud.fecha_respuesta = datetime.utcnow()
    session.add(solicitud)
    session.commit()
    session.refresh(solicitud)
    session.refresh(ruta)
    return solicitud, ruta


@router.put("/{solicitud_id}/aceptar", response_model=SolicitudOut)
def aceptar_solicitud(
    solicitud_id: int,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    solicitud, ruta = _responder_solicitud(solicitud_id, "aceptada", usuario_actual, session)
    pasajero = session.get(User, solicitud.pasajero_id)
    return _a_solicitud_out(solicitud, ruta, usuario_actual, pasajero)


@router.put("/{solicitud_id}/rechazar", response_model=SolicitudOut)
def rechazar_solicitud(
    solicitud_id: int,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    solicitud, ruta = _responder_solicitud(solicitud_id, "rechazada", usuario_actual, session)
    pasajero = session.get(User, solicitud.pasajero_id)
    return _a_solicitud_out(solicitud, ruta, usuario_actual, pasajero)


@router.get("/{solicitud_id}/viaje", response_model=ViajeEnCursoOut)
def viaje_en_curso(
    solicitud_id: int,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Módulo 5: posición en vivo del conductor + el punto de subida de
    ESTE pasajero, para que el navegador dibuje el mapa y calcule la
    distancia/ETA real por calles con OSRM."""
    solicitud = session.get(Solicitud, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    ruta = session.get(Route, solicitud.ruta_id)
    es_pasajero = solicitud.pasajero_id == usuario_actual.id
    es_conductor = ruta and ruta.conductor_id == usuario_actual.id
    if not (es_pasajero or es_conductor):
        raise HTTPException(status_code=403, detail="No tienes acceso a este viaje")

    return ViajeEnCursoOut(
        en_curso=ruta.en_curso,
        conductor_lat=ruta.ubicacion_lat,
        conductor_lng=ruta.ubicacion_lng,
        ubicacion_actualizada=ruta.ubicacion_actualizada,
        embarque_lat=solicitud.embarque_lat,
        embarque_lng=solicitud.embarque_lng,
        embarque_direccion=solicitud.embarque_direccion,
    )
