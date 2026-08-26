"""
Módulo 1: Registro y Login.
"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session, select

from database import get_session
from deps import get_current_user
from models import User, VehiculoDocumento
from schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UserOut,
    VehiculoDatosRequest,
    VehiculoDocumentoOut,
)
from storage import guardar_archivo
from utils import generar_token, hash_password, verificar_password

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def registrar(datos: RegisterRequest, session: Session = Depends(get_session)):
    existe_rut = session.exec(select(User).where(User.rut == datos.rut)).first()
    if existe_rut:
        raise HTTPException(status_code=400, detail="Ya existe una cuenta con ese RUT")

    existe_email = session.exec(select(User).where(User.email == datos.email)).first()
    if existe_email:
        raise HTTPException(status_code=400, detail="Ya existe una cuenta con ese email")

    usuario = User(
        rut=datos.rut,
        nombre=datos.nombre,
        telefono=datos.telefono,
        email=datos.email,
        password_hash=hash_password(datos.password),
        es_conductor=datos.es_conductor,
        es_pasajero=datos.es_pasajero,
        genero=datos.genero,
        modo_solo_mujeres=datos.modo_solo_mujeres,
        acepta_terminos=datos.acepta_terminos,
        fecha_aceptacion_terminos=datetime.utcnow(),
        token=generar_token(),
    )
    session.add(usuario)
    session.commit()
    session.refresh(usuario)

    if usuario.es_conductor:
        # Se crea el registro vacío de documentos; el conductor los sube
        # después desde su perfil. No puede publicar rutas hasta subir
        # licencia, revisión técnica y SOAP (se valida en routes/routes.py).
        session.add(VehiculoDocumento(user_id=usuario.id))
        session.commit()

    return AuthResponse(token=usuario.token, usuario=UserOut(**usuario.model_dump()))


@router.post("/login", response_model=AuthResponse)
def iniciar_sesion(datos: LoginRequest, session: Session = Depends(get_session)):
    identificador = datos.rut_o_email.strip()
    usuario = session.exec(
        select(User).where((User.email == identificador) | (User.rut == identificador))
    ).first()

    if not usuario or not verificar_password(datos.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="RUT/email o contraseña incorrectos")

    usuario.token = generar_token()
    session.add(usuario)
    session.commit()
    session.refresh(usuario)

    return AuthResponse(token=usuario.token, usuario=UserOut(**usuario.model_dump()))


@router.get("/users/me", response_model=UserOut)
def mis_datos(usuario_actual: User = Depends(get_current_user)):
    """
    Derecho ARCO de Acceso: el usuario puede ver todos sus datos guardados.
    """
    return UserOut(**usuario_actual.model_dump())


@router.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cuenta(
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Derecho ARCO de Cancelación: el usuario puede solicitar la eliminación
    de su cuenta y datos personales.

    TODO PRODUCCIÓN: en vez de borrar físicamente, evaluar anonimizar
    (mantener historial de viajes/pagos por obligaciones tributarias/legales
    pero sin datos identificables), y agregar un flujo de confirmación
    (ej. reenviar email) antes de ejecutar el borrado.
    """
    doc = session.exec(
        select(VehiculoDocumento).where(VehiculoDocumento.user_id == usuario_actual.id)
    ).first()
    if doc:
        session.delete(doc)
    session.delete(usuario_actual)
    session.commit()


@router.post("/users/me/foto", response_model=UserOut)
async def subir_foto(
    archivo: UploadFile = File(...),
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    url = await guardar_archivo(archivo, "fotos")
    usuario_actual.foto_url = url
    session.add(usuario_actual)
    session.commit()
    session.refresh(usuario_actual)
    return UserOut(**usuario_actual.model_dump())


@router.get("/users/me/vehiculo", response_model=VehiculoDocumentoOut)
def obtener_datos_vehiculo(
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not usuario_actual.es_conductor:
        raise HTTPException(status_code=403, detail="Solo los conductores registran vehículo")

    doc = session.exec(
        select(VehiculoDocumento).where(VehiculoDocumento.user_id == usuario_actual.id)
    ).first()
    if not doc:
        doc = VehiculoDocumento(user_id=usuario_actual.id)
    return VehiculoDocumentoOut(**doc.model_dump())


@router.put("/users/me/vehiculo", response_model=VehiculoDocumentoOut)
def actualizar_datos_vehiculo(
    datos: VehiculoDatosRequest,
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not usuario_actual.es_conductor:
        raise HTTPException(status_code=403, detail="Solo los conductores registran vehículo")

    doc = session.exec(
        select(VehiculoDocumento).where(VehiculoDocumento.user_id == usuario_actual.id)
    ).first()
    if not doc:
        doc = VehiculoDocumento(user_id=usuario_actual.id)

    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(doc, campo, valor)
    doc.fecha_actualizacion = datetime.utcnow()

    session.add(doc)
    session.commit()
    session.refresh(doc)
    return VehiculoDocumentoOut(**doc.model_dump())


@router.post("/users/me/documentos/{tipo}", response_model=VehiculoDocumentoOut)
async def subir_documento_vehiculo(
    tipo: Literal["licencia", "revision_tecnica", "soap"],
    archivo: UploadFile = File(...),
    usuario_actual: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not usuario_actual.es_conductor:
        raise HTTPException(status_code=403, detail="Solo los conductores suben estos documentos")

    doc = session.exec(
        select(VehiculoDocumento).where(VehiculoDocumento.user_id == usuario_actual.id)
    ).first()
    if not doc:
        doc = VehiculoDocumento(user_id=usuario_actual.id)

    url = await guardar_archivo(archivo, f"documentos/{tipo}")
    campo_por_tipo = {
        "licencia": "licencia_conducir_url",
        "revision_tecnica": "revision_tecnica_url",
        "soap": "soap_url",
    }
    setattr(doc, campo_por_tipo[tipo], url)
    doc.fecha_actualizacion = datetime.utcnow()

    session.add(doc)
    session.commit()
    session.refresh(doc)
    return VehiculoDocumentoOut(**doc.model_dump())
