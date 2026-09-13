"""
Avisos / notificaciones del usuario.

Devuelve DOS tipos de avisos juntos:
  1. Eventos ya ocurridos, guardados en la tabla Notificacion (ej. "el viaje
     inició"). Los crea quien corresponda (ej. routes.py al iniciar el viaje).
  2. Recordatorios PREVIOS a la salida (faltan 30/10/5 min), calculados al
     vuelo según la hora de salida de la ruta y el día de hoy. No se guardan
     porque dependen del reloj; además se ocultan solos si el viaje ya partió
     (en_curso) — justo lo que pidió el usuario ("si ya inició, el conteo ya
     no aparece").

TODO PRODUCCIÓN: el envío PUSH real al celular necesita la app móvil (o una
PWA con web-push) + un servicio tipo FCM/APNs y un worker programado que
dispare los recordatorios en las marcas 30/10/5. Hoy los avisos se muestran
dentro de la app (el frontend consulta este endpoint). La lógica de generación
ya queda lista para que ese worker la reutilice.
"""
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from deps import get_current_user
from models import Notificacion, Route, Solicitud, User
from schemas import NotificacionOut

router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])

# Días como se guardan en dias_recurrencia (sin tildes), en orden weekday()
# de Python (lunes=0 ... domingo=6).
DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

# Ventana en la que se muestra el recordatorio previo a la salida (minutos).
VENTANA_RECORDATORIO_MIN = 30

try:
    from zoneinfo import ZoneInfo
    _TZ_CHILE = ZoneInfo("America/Santiago")
except Exception:  # pragma: no cover - si falta la base de zonas horarias
    _TZ_CHILE = None


def _ahora_chile() -> datetime:
    """Hora local de Chile. Necesaria porque hora_salida ('HH:MM') está en
    hora local, pero el servidor trabaja en UTC.
    TODO PRODUCCIÓN: asegurar la base de zonas (paquete tzdata) en el server;
    el respaldo fijo UTC-3 no maneja el cambio de horario de verano/invierno."""
    if _TZ_CHILE:
        return datetime.now(_TZ_CHILE)
    return datetime.now(timezone.utc) + timedelta(hours=-3)


def _minutos_hasta_salida(hora_salida: str, ahora: datetime) -> float | None:
    try:
        h, m = (int(x) for x in hora_salida.split(":"))
    except (ValueError, AttributeError):
        return None
    salida = ahora.replace(hour=h, minute=m, second=0, microsecond=0)
    return (salida - ahora).total_seconds() / 60


def _recordatorio(minutos: float, titulo: str, mensaje_base: str, rid: str, ruta_id: int, solicitud_id=None) -> NotificacionOut:
    n = int(round(minutos))
    return NotificacionOut(
        id=rid,
        tipo="recordatorio",
        titulo=titulo,
        mensaje=f"{mensaje_base} Sale en ~{n} min.",
        ruta_id=ruta_id,
        solicitud_id=solicitud_id,
        leida=False,
        minutos_restantes=n,
        fecha=datetime.utcnow(),
    )


def _calcular_recordatorios(usuario: User, session: Session) -> List[NotificacionOut]:
    ahora = _ahora_chile()
    hoy = DIAS_SEMANA[ahora.weekday()]
    avisos: List[NotificacionOut] = []

    def aplica(ruta: Route) -> float | None:
        # Solo rutas activas, no partidas todavía, que circulan hoy y cuya
        # salida cae dentro de la ventana previa.
        if not ruta.activa or ruta.en_curso:
            return None
        if hoy not in (ruta.dias_recurrencia or []):
            return None
        mins = _minutos_hasta_salida(ruta.hora_salida, ahora)
        if mins is None or mins <= 0 or mins > VENTANA_RECORDATORIO_MIN:
            return None
        return mins

    # Como conductor: sus propias rutas.
    if usuario.es_conductor:
        rutas = session.exec(select(Route).where(Route.conductor_id == usuario.id)).all()
        for ruta in rutas:
            mins = aplica(ruta)
            if mins is not None:
                destino = ruta.destino_comuna or ruta.destino_direccion
                avisos.append(_recordatorio(
                    mins,
                    "Tu viaje está por salir",
                    f"Prepárate para salir hacia {destino}.",
                    rid=f"rec-ruta-{ruta.id}",
                    ruta_id=ruta.id,
                ))

    # Como pasajero: viajes con cupo aceptado.
    if usuario.es_pasajero:
        solicitudes = session.exec(
            select(Solicitud).where(
                Solicitud.pasajero_id == usuario.id,
                Solicitud.estado == "aceptada",
            )
        ).all()
        for sol in solicitudes:
            ruta = session.get(Route, sol.ruta_id)
            if not ruta:
                continue
            mins = aplica(ruta)
            if mins is not None:
                conductor = session.get(User, ruta.conductor_id)
                nombre = conductor.nombre if conductor else "el conductor"
                avisos.append(_recordatorio(
                    mins,
                    "Tu viaje está por salir",
                    f"El viaje con {nombre} está por partir. Ve llegando a tu punto de subida ({sol.embarque_direccion}).",
                    rid=f"rec-sol-{sol.id}",
                    ruta_id=ruta.id,
                    solicitud_id=sol.id,
                ))

    return avisos


@router.get("", response_model=List[NotificacionOut])
def listar_notificaciones(
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Avisos del usuario: recordatorios de salida (calculados) primero, y
    luego los eventos guardados (viaje iniciado, etc.), del más nuevo al más
    viejo."""
    recordatorios = _calcular_recordatorios(usuario_actual, session)

    guardadas = session.exec(
        select(Notificacion)
        .where(Notificacion.user_id == usuario_actual.id)
        .order_by(Notificacion.fecha_creacion.desc())
    ).all()
    eventos = [
        NotificacionOut(
            id=str(n.id),
            tipo=n.tipo,
            titulo=n.titulo,
            mensaje=n.mensaje,
            ruta_id=n.ruta_id,
            solicitud_id=n.solicitud_id,
            leida=n.leida,
            minutos_restantes=None,
            fecha=n.fecha_creacion,
        )
        for n in guardadas
    ]
    # Recordatorios arriba (más urgentes), luego los eventos recientes.
    return recordatorios + eventos


@router.put("/{notificacion_id}/leida", response_model=NotificacionOut)
def marcar_leida(
    notificacion_id: int,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Marca como leído un aviso GUARDADO (los recordatorios calculados no se
    guardan, así que no se marcan)."""
    n = session.get(Notificacion, notificacion_id)
    if not n or n.user_id != usuario_actual.id:
        raise HTTPException(status_code=404, detail="Aviso no encontrado")
    n.leida = True
    session.add(n)
    session.commit()
    session.refresh(n)
    return NotificacionOut(
        id=str(n.id), tipo=n.tipo, titulo=n.titulo, mensaje=n.mensaje,
        ruta_id=n.ruta_id, solicitud_id=n.solicitud_id, leida=n.leida,
        minutos_restantes=None, fecha=n.fecha_creacion,
    )
