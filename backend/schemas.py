"""
Esquemas Pydantic para requests y responses de la API.
Se mantienen separados de los modelos de tabla (models.py) para no exponer
campos internos como `password_hash` o `token` por accidente.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator

from utils import validar_rut, formatear_rut


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    rut: str
    nombre: str
    telefono: str
    email: EmailStr
    password: str
    es_conductor: bool = False
    es_pasajero: bool = False
    genero: Optional[str] = None
    modo_solo_mujeres: bool = False
    # Debe llegar en True: es el checkbox de Términos y Condiciones +
    # Política de Privacidad. El backend lo vuelve a validar por si el
    # frontend fuera manipulado.
    acepta_terminos: bool = False

    @field_validator("rut")
    @classmethod
    def rut_valido(cls, v: str) -> str:
        if not validar_rut(v):
            raise ValueError("El RUT ingresado no es válido")
        return formatear_rut(v)

    @field_validator("password")
    @classmethod
    def password_minima(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("La contraseña debe tener al menos 6 caracteres")
        return v

    @field_validator("acepta_terminos")
    @classmethod
    def terminos_obligatorios(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Debes aceptar los Términos y la Política de Privacidad para registrarte")
        return v

    @field_validator("es_pasajero")
    @classmethod
    def algun_rol(cls, v: bool, info) -> bool:
        if not v and not info.data.get("es_conductor"):
            raise ValueError("Debes ser al menos conductor o pasajero")
        return v


class LoginRequest(BaseModel):
    rut_o_email: str
    password: str


class UserOut(BaseModel):
    id: int
    rut: str
    nombre: str
    telefono: str
    email: str
    foto_url: Optional[str] = None
    es_conductor: bool
    es_pasajero: bool
    modo_solo_mujeres: bool
    calificacion_promedio: Optional[float] = None
    total_calificaciones: int


class AuthResponse(BaseModel):
    token: str
    usuario: UserOut


class VehiculoDocumentoOut(BaseModel):
    patente: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None
    licencia_conducir_url: Optional[str] = None
    revision_tecnica_url: Optional[str] = None
    soap_url: Optional[str] = None
    verificado: bool


class VehiculoDatosRequest(BaseModel):
    patente: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None


# ---------- Rutas ----------

class PuntoRuta(BaseModel):
    lat: float
    lng: float
    direccion: str


class RouteCreate(BaseModel):
    origen: PuntoRuta
    destino: PuntoRuta
    paradas: List[PuntoRuta] = []
    geometria: List[List[float]] = []  # [[lat, lng], ...] calculado por OSRM en el navegador
    distancia_km: Optional[float] = None
    duracion_min: Optional[float] = None
    cupos_totales: int
    precio_sugerido: int
    hora_salida: str
    dias_recurrencia: List[str] = []
    modo_solo_mujeres: bool = False

    @field_validator("cupos_totales")
    @classmethod
    def cupos_validos(cls, v: int) -> int:
        if v < 1 or v > 8:
            raise ValueError("Los cupos deben ser entre 1 y 8")
        return v

    @field_validator("precio_sugerido")
    @classmethod
    def precio_valido(cls, v: int) -> int:
        if v < 0:
            raise ValueError("El precio no puede ser negativo")
        return v


class ConductorResumen(BaseModel):
    id: int
    nombre: str
    foto_url: Optional[str] = None
    calificacion_promedio: Optional[float] = None
    total_calificaciones: int


class RouteOut(BaseModel):
    id: int
    conductor: ConductorResumen
    origen_lat: float
    origen_lng: float
    origen_direccion: str
    destino_lat: float
    destino_lng: float
    destino_direccion: str
    paradas: List[dict]
    geometria: List[List[float]]
    distancia_km: Optional[float]
    duracion_min: Optional[float]
    cupos_totales: int
    cupos_disponibles: int
    precio_sugerido: int
    precio_pasajero: int  # precio_sugerido + comisión 10%
    hora_salida: str
    dias_recurrencia: List[str]
    modo_solo_mujeres: bool
    activa: bool
    fecha_creacion: datetime
