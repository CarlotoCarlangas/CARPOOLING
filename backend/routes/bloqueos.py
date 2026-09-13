"""
Veto de pasajeros (Módulo de bloqueos). Un conductor puede bloquear a un
pasajero (ej. por una mala experiencia): el pasajero deja de ver sus rutas en
la búsqueda y no puede pedir cupo. El conductor puede desbloquearlo cuando
quiera.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from deps import get_current_user
from models import Bloqueo, User
from schemas import BloqueoCreate, PasajeroBloqueadoOut

router = APIRouter(prefix="/bloqueos", tags=["bloqueos"])


def esta_bloqueado(session: Session, conductor_id: int, pasajero_id: int) -> bool:
    """True si `conductor_id` tiene bloqueado a `pasajero_id`."""
    return session.exec(
        select(Bloqueo).where(
            Bloqueo.conductor_id == conductor_id,
            Bloqueo.pasajero_id == pasajero_id,
        )
    ).first() is not None


def conductores_que_me_bloquearon(session: Session, pasajero_id: int) -> set[int]:
    """IDs de conductores que bloquearon a este pasajero (para filtrar la
    búsqueda / el rebook)."""
    filas = session.exec(
        select(Bloqueo.conductor_id).where(Bloqueo.pasajero_id == pasajero_id)
    ).all()
    return set(filas)


@router.post("", status_code=201)
def bloquear(
    datos: BloqueoCreate,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not usuario_actual.es_conductor:
        raise HTTPException(status_code=403, detail="Solo los conductores pueden bloquear pasajeros")
    if datos.pasajero_id == usuario_actual.id:
        raise HTTPException(status_code=400, detail="No puedes bloquearte a ti mismo")

    pasajero = session.get(User, datos.pasajero_id)
    if not pasajero:
        raise HTTPException(status_code=404, detail="Pasajero no encontrado")

    if not esta_bloqueado(session, usuario_actual.id, datos.pasajero_id):
        session.add(Bloqueo(conductor_id=usuario_actual.id, pasajero_id=datos.pasajero_id))
        session.commit()
    return {"bloqueado": True, "pasajero_id": datos.pasajero_id}


@router.delete("/{pasajero_id}", status_code=200)
def desbloquear(
    pasajero_id: int,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    bloqueo = session.exec(
        select(Bloqueo).where(
            Bloqueo.conductor_id == usuario_actual.id,
            Bloqueo.pasajero_id == pasajero_id,
        )
    ).first()
    if bloqueo:
        session.delete(bloqueo)
        session.commit()
    return {"bloqueado": False, "pasajero_id": pasajero_id}


@router.get("", response_model=List[PasajeroBloqueadoOut])
def listar_bloqueados(
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    bloqueos = session.exec(
        select(Bloqueo).where(Bloqueo.conductor_id == usuario_actual.id).order_by(Bloqueo.fecha.desc())
    ).all()
    salida = []
    for b in bloqueos:
        p = session.get(User, b.pasajero_id)
        if not p:
            continue
        salida.append(PasajeroBloqueadoOut(pasajero_id=p.id, nombre=p.nombre, foto_url=p.foto_url, fecha=b.fecha))
    return salida
