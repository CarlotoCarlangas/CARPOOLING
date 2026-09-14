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
from models import Calificacion, Notificacion, Route, Solicitud, User
from routes.bloqueos import conductores_que_me_bloquearon, esta_bloqueado
from routes.routes import COMISION_PASAJERO, _a_route_out
from schemas import (
    ConductorResumen,
    EvaluacionCreate,
    EvaluacionEstado,
    PasajeroResumen,
    RebookOut,
    RechazoRequest,
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
        motivo_rechazo=solicitud.motivo_rechazo,
        motivo_cancelacion=solicitud.motivo_cancelacion,
        con_costo=solicitud.con_costo,
        viaje_finalizado=solicitud.viaje_finalizado,
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

    # Veto: si el conductor bloqueó a este pasajero, no puede pedir cupo.
    # Mensaje neutro a propósito (no se le informa del bloqueo).
    if esta_bloqueado(session, ruta.conductor_id, usuario_actual.id):
        raise HTTPException(status_code=403, detail="No puedes reservar en este viaje")

    if ruta.cupos_disponibles <= 0:
        raise HTTPException(status_code=400, detail="Este viaje ya no tiene cupos disponibles")

    # Bloquea duplicados solo si hay una solicitud VIGENTE (pendiente, o
    # aceptada aún no realizada). Un viaje ya finalizado NO bloquea: así el
    # pasajero puede "volver a tomar" el mismo viaje otro día (rebook, #7).
    ya_existe = session.exec(
        select(Solicitud).where(
            Solicitud.ruta_id == ruta.id,
            Solicitud.pasajero_id == usuario_actual.id,
            Solicitud.estado.in_(["pendiente", "aceptada"]),
            Solicitud.viaje_finalizado == False,  # noqa: E712
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
                motivo_rechazo=s.motivo_rechazo,
                motivo_cancelacion=s.motivo_cancelacion,
                con_costo=s.con_costo,
                viaje_finalizado=s.viaje_finalizado,
                fecha_solicitud=s.fecha_solicitud,
            )
        )
    return resultado


@router.get("/rebook", response_model=List[RebookOut])
def rebook_disponibles(
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """"Volver a tomar un viaje" (#7): viajes que el pasajero ya tomó antes
    (solicitud aceptada) y que HOY siguen disponibles — activos, con cupo, sin
    que el conductor lo haya bloqueado, y sin que ya tenga una solicitud
    vigente para esa ruta. Devuelve el punto de subida que usó la última vez
    para poder re-pedir con un toque."""
    bloqueadores = conductores_que_me_bloquearon(session, usuario_actual.id)

    # Rutas donde YA tiene una solicitud vigente (no re-ofrecer esas).
    vigentes = session.exec(
        select(Solicitud).where(
            Solicitud.pasajero_id == usuario_actual.id,
            Solicitud.estado.in_(["pendiente", "aceptada"]),
            Solicitud.viaje_finalizado == False,  # noqa: E712
        )
    ).all()
    rutas_vigentes = {s.ruta_id for s in vigentes}

    # Historial de viajes tomados (aceptados), del más reciente al más viejo.
    aceptadas = session.exec(
        select(Solicitud)
        .where(Solicitud.pasajero_id == usuario_actual.id, Solicitud.estado == "aceptada")
        .order_by(Solicitud.fecha_solicitud.desc())
    ).all()

    salida = []
    vistas = set()
    for s in aceptadas:
        if s.ruta_id in vistas:
            continue  # una entrada por ruta (la subida más reciente)
        vistas.add(s.ruta_id)
        if s.ruta_id in rutas_vigentes:
            continue  # ya tiene una solicitud vigente para esa ruta
        ruta = session.get(Route, s.ruta_id)
        if not ruta or not ruta.activa or ruta.cupos_disponibles <= 0:
            continue
        if ruta.conductor_id in bloqueadores:
            continue  # el conductor lo bloqueó (#8) -> no se le ofrece
        conductor = session.get(User, ruta.conductor_id)
        salida.append(
            RebookOut(
                ruta=_a_route_out(ruta, conductor),
                embarque_lat=s.embarque_lat,
                embarque_lng=s.embarque_lng,
                embarque_direccion=s.embarque_direccion,
            )
        )
    return salida


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


def _responder_solicitud(
    solicitud_id: int,
    nuevo_estado: str,
    usuario_actual: User,
    session: Session,
    motivo: str | None = None,
) -> tuple[Solicitud, Route]:
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
    if nuevo_estado == "rechazada":
        # Se guarda el motivo (respuesta rápida o texto libre) para mostrárselo
        # al pasajero. Se recorta por si viene un texto libre muy largo.
        solicitud.motivo_rechazo = (motivo or "").strip()[:300] or None
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
    datos: RechazoRequest = RechazoRequest(),
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    solicitud, ruta = _responder_solicitud(
        solicitud_id, "rechazada", usuario_actual, session, motivo=datos.motivo
    )
    pasajero = session.get(User, solicitud.pasajero_id)
    return _a_solicitud_out(solicitud, ruta, usuario_actual, pasajero)


@router.put("/{solicitud_id}/cancelar", response_model=SolicitudPasajeroOut)
def cancelar_solicitud(
    solicitud_id: int,
    datos: RechazoRequest = RechazoRequest(),
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """El PASAJERO cancela su propia solicitud, con un motivo (respuesta rápida
    o texto libre). Si estaba CONFIRMADA (aceptada) o el viaje ya INICIÓ, se
    marca con_costo=True (se asumen costos).
    TODO PRODUCCIÓN: el cobro real lo hará el módulo de pagos (Módulo 6)."""
    solicitud = session.get(Solicitud, solicitud_id)
    if not solicitud or solicitud.pasajero_id != usuario_actual.id:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if solicitud.estado not in ("pendiente", "aceptada") or solicitud.viaje_finalizado:
        raise HTTPException(status_code=400, detail="Esta solicitud ya no se puede cancelar")

    ruta = session.get(Route, solicitud.ruta_id)
    era_confirmada = solicitud.estado == "aceptada"
    viaje_iniciado = bool(ruta and ruta.en_curso)

    solicitud.estado = "cancelada"
    solicitud.motivo_cancelacion = (datos.motivo or "").strip()[:300] or None
    solicitud.con_costo = era_confirmada or viaje_iniciado
    solicitud.fecha_respuesta = datetime.utcnow()
    session.add(solicitud)

    # Si estaba aceptada, se libera el cupo para otro pasajero.
    if era_confirmada and ruta:
        ruta.cupos_disponibles += 1
        session.add(ruta)

    # Avisar al conductor.
    if ruta:
        session.add(Notificacion(
            user_id=ruta.conductor_id,
            tipo="solicitud_cancelada",
            titulo="Un pasajero canceló",
            mensaje=f"{usuario_actual.nombre} canceló su cupo"
                    + (f": {solicitud.motivo_cancelacion}" if solicitud.motivo_cancelacion else ".")
                    + (" (con costo)" if solicitud.con_costo else ""),
            ruta_id=ruta.id,
            solicitud_id=solicitud.id,
        ))

    session.commit()
    session.refresh(solicitud)
    conductor = session.get(User, ruta.conductor_id) if ruta else None
    return SolicitudPasajeroOut(
        id=solicitud.id,
        ruta=_a_ruta_resumen(ruta, conductor),
        embarque_direccion=solicitud.embarque_direccion,
        estado=solicitud.estado,
        motivo_rechazo=solicitud.motivo_rechazo,
        motivo_cancelacion=solicitud.motivo_cancelacion,
        con_costo=solicitud.con_costo,
        viaje_finalizado=solicitud.viaje_finalizado,
        fecha_solicitud=solicitud.fecha_solicitud,
    )


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


# ---------- Evaluación mutua (Módulo 7) ----------

def _partes_de_solicitud(solicitud: Solicitud, usuario: User, session: Session):
    """Devuelve (ruta, conductor, pasajero, es_conductor). Verifica que el
    usuario sea parte de esta solicitud (conductor o pasajero)."""
    ruta = session.get(Route, solicitud.ruta_id)
    if not ruta:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    conductor = session.get(User, ruta.conductor_id)
    pasajero = session.get(User, solicitud.pasajero_id)
    if usuario.id == conductor.id:
        return ruta, conductor, pasajero, True
    if usuario.id == pasajero.id:
        return ruta, conductor, pasajero, False
    raise HTTPException(status_code=403, detail="No participaste en este viaje")


@router.get("/{solicitud_id}/evaluacion", response_model=EvaluacionEstado)
def estado_evaluacion(
    solicitud_id: int,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    solicitud = session.get(Solicitud, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    _, conductor, pasajero, es_conductor = _partes_de_solicitud(solicitud, usuario_actual, session)
    otra = pasajero if es_conductor else conductor

    mia = session.exec(
        select(Calificacion).where(
            Calificacion.solicitud_id == solicitud_id,
            Calificacion.autor_id == usuario_actual.id,
        )
    ).first()

    return EvaluacionEstado(
        viaje_finalizado=solicitud.viaje_finalizado,
        ya_evaluado=mia is not None,
        otra_persona_nombre=otra.nombre,
        otra_persona_foto=otra.foto_url,
        estrellas_previas=mia.estrellas if mia else None,
        comentario_previo=mia.comentario if mia else None,
    )


@router.post("/{solicitud_id}/evaluar", response_model=EvaluacionEstado, status_code=201)
def evaluar_viaje(
    solicitud_id: int,
    datos: EvaluacionCreate,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Conductor y pasajero se califican mutuamente, una vez, recién
    terminado el viaje (solicitud aceptada y viaje_finalizado)."""
    solicitud = session.get(Solicitud, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    ruta, conductor, pasajero, es_conductor = _partes_de_solicitud(solicitud, usuario_actual, session)

    if solicitud.estado != "aceptada" or not solicitud.viaje_finalizado:
        raise HTTPException(status_code=400, detail="Solo puedes evaluar un viaje ya realizado")

    evaluado = pasajero if es_conductor else conductor

    ya = session.exec(
        select(Calificacion).where(
            Calificacion.solicitud_id == solicitud_id,
            Calificacion.autor_id == usuario_actual.id,
        )
    ).first()
    if ya:
        raise HTTPException(status_code=400, detail="Ya evaluaste este viaje")

    comentario = (datos.comentario or "").strip()[:500] or None
    session.add(Calificacion(
        solicitud_id=solicitud_id,
        autor_id=usuario_actual.id,
        evaluado_id=evaluado.id,
        estrellas=datos.estrellas,
        comentario=comentario,
    ))

    # Recalcular el promedio del evaluado.
    total_anterior = evaluado.total_calificaciones or 0
    prom_anterior = evaluado.calificacion_promedio or 0
    nuevo_total = total_anterior + 1
    evaluado.calificacion_promedio = round(
        (prom_anterior * total_anterior + datos.estrellas) / nuevo_total, 2
    )
    evaluado.total_calificaciones = nuevo_total
    session.add(evaluado)
    session.commit()

    return EvaluacionEstado(
        viaje_finalizado=True,
        ya_evaluado=True,
        otra_persona_nombre=evaluado.nombre,
        otra_persona_foto=evaluado.foto_url,
        estrellas_previas=datos.estrellas,
        comentario_previo=comentario,
    )
