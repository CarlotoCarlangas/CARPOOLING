"""
Panel de administración — SOLO para el administrador de la plataforma.

Da una vista de SOLO LECTURA de todo lo que hay en la app: los usuarios y
su configuración, las rutas publicadas y un resumen general. Sirve para que
el dueño de la plataforma supervise el estado del sistema.

Todos los endpoints cuelgan de get_admin_user (dependencia a nivel de
router), así que nadie que no tenga es_admin=True puede llegar a ellos.

TODO PRODUCCIÓN:
  - Registrar en un log de auditoría cada vez que el admin consulta datos
    personales de terceros (la Ley 21.719 exige trazabilidad del
    tratamiento de datos personales).
  - Asignar el rol admin fuera de la app (no por un endpoint) — hoy se hace
    con el script crear_admin.py.
  - Este panel NO permite editar ni borrar datos de otras personas a
    propósito: el admin observa, no modifica.
"""
from typing import List

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from database import get_session
from deps import get_admin_user
from models import Route, Solicitud, User, VehiculoDocumento
from schemas import (
    AdminResumenOut,
    AdminRutaOut,
    AdminUsuarioOut,
    AdminVehiculoOut,
)

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_admin_user)],
)


@router.get("/resumen", response_model=AdminResumenOut)
def resumen(session: Session = Depends(get_session)):
    """Contadores generales del sistema (portada del panel)."""
    usuarios = session.exec(select(User)).all()
    rutas = session.exec(select(Route)).all()
    solicitudes = session.exec(select(Solicitud)).all()

    return AdminResumenOut(
        total_usuarios=len(usuarios),
        total_conductores=sum(1 for u in usuarios if u.es_conductor),
        total_pasajeros=sum(1 for u in usuarios if u.es_pasajero),
        total_admins=sum(1 for u in usuarios if u.es_admin),
        total_rutas=len(rutas),
        rutas_activas=sum(1 for r in rutas if r.activa),
        rutas_en_curso=sum(1 for r in rutas if r.en_curso),
        solicitudes_pendientes=sum(1 for s in solicitudes if s.estado == "pendiente"),
        solicitudes_aceptadas=sum(1 for s in solicitudes if s.estado == "aceptada"),
        solicitudes_rechazadas=sum(1 for s in solicitudes if s.estado == "rechazada"),
    )


@router.get("/usuarios", response_model=List[AdminUsuarioOut])
def listar_usuarios(session: Session = Depends(get_session)):
    """Todos los usuarios con su configuración. Para los conductores, se
    adjunta el resumen de su vehículo/documentos."""
    usuarios = session.exec(select(User)).all()
    docs = session.exec(select(VehiculoDocumento)).all()
    docs_por_user = {d.user_id: d for d in docs}

    salida = []
    for u in sorted(usuarios, key=lambda x: x.id or 0):
        doc = docs_por_user.get(u.id)
        vehiculo = None
        if doc:
            vehiculo = AdminVehiculoOut(
                patente=doc.patente,
                marca=doc.marca,
                modelo=doc.modelo,
                color=doc.color,
                verificado=doc.verificado,
                licencia_subida=bool(doc.licencia_conducir_url),
                revision_tecnica_subida=bool(doc.revision_tecnica_url),
                soap_subido=bool(doc.soap_url),
            )
        # model_dump trae password_hash y token, pero AdminUsuarioOut no los
        # declara y Pydantic ignora los campos de más — así nunca se filtran.
        salida.append(AdminUsuarioOut(**u.model_dump(), vehiculo=vehiculo))
    return salida


@router.get("/rutas", response_model=List[AdminRutaOut])
def listar_rutas(session: Session = Depends(get_session)):
    """Todas las rutas publicadas, con el nombre del conductor dueño."""
    rutas = session.exec(select(Route)).all()
    nombres = {u.id: u.nombre for u in session.exec(select(User)).all()}

    salida = []
    for r in sorted(rutas, key=lambda x: x.id or 0):
        salida.append(
            AdminRutaOut(
                **r.model_dump(),
                conductor_nombre=nombres.get(r.conductor_id, "—"),
            )
        )
    return salida
