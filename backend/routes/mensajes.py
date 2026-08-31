"""
Módulo 4: chat interno entre conductor y pasajero, habilitado recién
cuando la solicitud de cupo queda "aceptada" — antes no hay nada que
coordinar.
"""
from typing import List, Tuple

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from deps import get_current_user
from models import Mensaje, Route, Solicitud, User
from schemas import ConductorResumen, ConversacionOut, MensajeCreate, MensajeOut

router = APIRouter(prefix="/requests", tags=["mensajes"])


def _solicitud_y_ruta_del_participante(
    solicitud_id: int, usuario_actual: User, session: Session
) -> Tuple[Solicitud, Route]:
    solicitud = session.get(Solicitud, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    ruta = session.get(Route, solicitud.ruta_id)
    es_pasajero = solicitud.pasajero_id == usuario_actual.id
    es_conductor = ruta and ruta.conductor_id == usuario_actual.id
    if not (es_pasajero or es_conductor):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta conversación")

    return solicitud, ruta


@router.get("/{solicitud_id}/chat", response_model=ConversacionOut)
def datos_conversacion(
    solicitud_id: int,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    solicitud, ruta = _solicitud_y_ruta_del_participante(solicitud_id, usuario_actual, session)

    es_pasajero = solicitud.pasajero_id == usuario_actual.id
    otro_id = ruta.conductor_id if es_pasajero else solicitud.pasajero_id
    otro = session.get(User, otro_id)

    return ConversacionOut(
        solicitud_id=solicitud.id,
        estado=solicitud.estado,
        otra_persona=ConductorResumen(
            id=otro.id,
            nombre=otro.nombre,
            foto_url=otro.foto_url,
            calificacion_promedio=otro.calificacion_promedio,
            total_calificaciones=otro.total_calificaciones,
        ),
    )


@router.get("/{solicitud_id}/mensajes", response_model=List[MensajeOut])
def listar_mensajes(
    solicitud_id: int,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _solicitud_y_ruta_del_participante(solicitud_id, usuario_actual, session)

    mensajes = session.exec(
        select(Mensaje)
        .where(Mensaje.solicitud_id == solicitud_id)
        .order_by(Mensaje.fecha_envio)
    ).all()
    return mensajes


@router.post("/{solicitud_id}/mensajes", response_model=MensajeOut, status_code=201)
def enviar_mensaje(
    solicitud_id: int,
    datos: MensajeCreate,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    solicitud, _ = _solicitud_y_ruta_del_participante(solicitud_id, usuario_actual, session)

    if solicitud.estado != "aceptada":
        raise HTTPException(
            status_code=400,
            detail="El chat solo está disponible para solicitudes aceptadas",
        )

    mensaje = Mensaje(
        solicitud_id=solicitud_id,
        remitente_id=usuario_actual.id,
        texto=datos.texto,
    )
    session.add(mensaje)
    session.commit()
    session.refresh(mensaje)
    return mensaje
