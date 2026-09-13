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
    es_admin: bool = False
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
    comuna: Optional[str] = None


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


class RouteEditRequest(BaseModel):
    """Edición de una ruta ya publicada (Módulo "Mis Viajes"). Todos los
    campos son opcionales: se actualiza solo lo que venga. El origen y el
    destino NO se editan acá (se mantienen fijos, como pidió el usuario)."""
    apodo: Optional[str] = None
    cupos_totales: Optional[int] = None
    precio_sugerido: Optional[int] = None
    hora_salida: Optional[str] = None
    dias_recurrencia: Optional[List[str]] = None
    modo_solo_mujeres: Optional[bool] = None
    paradas: Optional[List[PuntoRuta]] = None
    activa: Optional[bool] = None

    @field_validator("cupos_totales")
    @classmethod
    def cupos_validos(cls, v):
        if v is not None and (v < 1 or v > 8):
            raise ValueError("Los cupos deben ser entre 1 y 8")
        return v

    @field_validator("precio_sugerido")
    @classmethod
    def precio_valido(cls, v):
        if v is not None and v < 0:
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
    apodo: Optional[str] = None
    conductor: ConductorResumen
    origen_lat: float
    origen_lng: float
    origen_direccion: str
    origen_comuna: Optional[str]
    destino_lat: float
    destino_lng: float
    destino_direccion: str
    destino_comuna: Optional[str]
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
    en_curso: bool


# ---------- Solicitudes (reserva del pasajero) ----------

class SolicitudCreate(BaseModel):
    ruta_id: int
    embarque: PuntoRuta


class PasajeroResumen(BaseModel):
    id: int
    nombre: str
    # PRIVACIDAD: se muestra al conductor solo una vez que existe una
    # solicitud sobre su ruta, para que pueda coordinar la recogida
    # (ej. avisar un atraso). No se expone en ningún otro listado.
    telefono: str
    foto_url: Optional[str] = None
    calificacion_promedio: Optional[float] = None
    total_calificaciones: int


class RutaResumen(BaseModel):
    id: int
    conductor: ConductorResumen
    origen_direccion: str
    destino_direccion: str
    hora_salida: str
    precio_pasajero: int


class SolicitudOut(BaseModel):
    id: int
    ruta: RutaResumen
    pasajero: PasajeroResumen
    embarque_lat: float
    embarque_lng: float
    embarque_direccion: str
    estado: str
    motivo_rechazo: Optional[str] = None
    viaje_finalizado: bool = False
    fecha_solicitud: datetime


class SolicitudPasajeroOut(BaseModel):
    id: int
    ruta: RutaResumen
    embarque_direccion: str
    estado: str
    motivo_rechazo: Optional[str] = None
    viaje_finalizado: bool = False
    fecha_solicitud: datetime


class RechazoRequest(BaseModel):
    """Motivo con que el conductor rechaza una solicitud (respuesta rápida
    predefinida o texto libre). Opcional para no romper llamadas antiguas."""
    motivo: Optional[str] = None


# ---------- Notificaciones / avisos ----------

class NotificacionOut(BaseModel):
    """Un aviso para el usuario. `id` es string para poder unificar avisos
    guardados (evento) con los recordatorios calculados al vuelo (que no
    tienen fila en la BD). `minutos_restantes` solo viene en recordatorios."""
    id: str
    tipo: str  # "viaje_iniciado" | "recordatorio"
    titulo: str
    mensaje: str
    ruta_id: Optional[int] = None
    solicitud_id: Optional[int] = None
    leida: bool = False
    minutos_restantes: Optional[int] = None
    fecha: datetime


# ---------- Evaluación mutua (Módulo 7) ----------

class EvaluacionCreate(BaseModel):
    estrellas: int
    comentario: Optional[str] = None

    @field_validator("estrellas")
    @classmethod
    def estrellas_validas(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("Las estrellas deben ser entre 1 y 5")
        return v

    @field_validator("comentario")
    @classmethod
    def comentario_corto(cls, v):
        if v and len(v) > 500:
            raise ValueError("El comentario es demasiado largo")
        return v


class EvaluacionEstado(BaseModel):
    """Lo que el frontend necesita para saber si mostrar el formulario de
    evaluación de un viaje puntual, y a quién se evalúa."""
    viaje_finalizado: bool
    ya_evaluado: bool               # ¿el usuario actual ya calificó?
    otra_persona_nombre: str        # a quién le toca evaluar
    otra_persona_foto: Optional[str] = None
    estrellas_previas: Optional[int] = None
    comentario_previo: Optional[str] = None


# ---------- Bloqueo de pasajeros (veto del conductor) ----------

class BloqueoCreate(BaseModel):
    pasajero_id: int


class PasajeroBloqueadoOut(BaseModel):
    pasajero_id: int
    nombre: str
    foto_url: Optional[str] = None
    fecha: datetime


# ---------- Volver a tomar un viaje (rebook) ----------

class RebookOut(BaseModel):
    """Un viaje que el pasajero ya tomó antes y que sigue disponible para
    volver a pedirlo con un toque (mismo punto de subida)."""
    ruta: RouteOut
    embarque_lat: float
    embarque_lng: float
    embarque_direccion: str


# ---------- Chat (Módulo 4) ----------

class MensajeCreate(BaseModel):
    texto: str

    @field_validator("texto")
    @classmethod
    def texto_no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El mensaje no puede estar vacío")
        if len(v) > 2000:
            raise ValueError("El mensaje es demasiado largo")
        return v


class MensajeOut(BaseModel):
    id: int
    solicitud_id: int
    remitente_id: int
    texto: str
    fecha_envio: datetime


class ConversacionOut(BaseModel):
    """Datos de cabecera del chat: quién es la otra persona y el estado
    de la solicitud (para poder avisar si ya no se puede escribir, ej.
    porque el conductor rechazó la solicitud)."""
    solicitud_id: int
    estado: str
    otra_persona: ConductorResumen  # se reutiliza el mismo resumen para ambos roles


# ---------- Tracking en tiempo real (Módulo 5) ----------

class UbicacionUpdate(BaseModel):
    lat: float
    lng: float


class ViajeEnCursoOut(BaseModel):
    """Lo que necesita el pasajero para dibujar el mapa en vivo: dónde
    está el conductor ahora mismo (si compartió su ubicación) y cuál es
    SU punto de subida (para que el navegador calcule la distancia/ETA
    real por calles con OSRM — el cálculo no se hace en el backend para
    no depender de un cliente HTTP nuevo, siguiendo el mismo patrón que
    ya usa la app: OSRM se llama desde el navegador)."""
    en_curso: bool
    conductor_lat: Optional[float] = None
    conductor_lng: Optional[float] = None
    ubicacion_actualizada: Optional[datetime] = None
    embarque_lat: float
    embarque_lng: float
    embarque_direccion: str


# ---------- Panel de administración (solo el dueño de la plataforma) ----------
# Estos esquemas son de SOLO LECTURA: el admin observa el estado del sistema.
# Se listan los campos de forma explícita (whitelist) a propósito, para NO
# exponer nunca `password_hash` ni `token` de otras personas.

class AdminVehiculoOut(BaseModel):
    """Resumen del vehículo/documentos de un conductor, sin las URLs de los
    archivos (basta saber si cada documento fue subido y si está verificado)."""
    patente: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None
    verificado: bool = False
    licencia_subida: bool = False
    revision_tecnica_subida: bool = False
    soap_subido: bool = False


class AdminUsuarioOut(BaseModel):
    """Ficha completa de un usuario tal como la ve el administrador: sus
    datos, roles y configuración. Nunca incluye contraseña ni token."""
    id: int
    rut: str
    nombre: str
    telefono: str
    email: str
    foto_url: Optional[str] = None
    es_conductor: bool
    es_pasajero: bool
    es_admin: bool
    genero: Optional[str] = None
    modo_solo_mujeres: bool
    acepta_terminos: bool
    fecha_aceptacion_terminos: Optional[datetime] = None
    fecha_registro: datetime
    calificacion_promedio: Optional[float] = None
    total_calificaciones: int
    vehiculo: Optional[AdminVehiculoOut] = None


class AdminRutaOut(BaseModel):
    """Ficha de una ruta para el panel admin (sin la geometría completa, que
    no aporta a la supervisión y es pesada)."""
    id: int
    conductor_id: int
    conductor_nombre: str
    origen_comuna: Optional[str] = None
    origen_direccion: str
    destino_comuna: Optional[str] = None
    destino_direccion: str
    hora_salida: str
    dias_recurrencia: List[str]
    cupos_totales: int
    cupos_disponibles: int
    precio_sugerido: int
    modo_solo_mujeres: bool
    activa: bool
    en_curso: bool
    fecha_creacion: datetime


class AdminResumenOut(BaseModel):
    """Contadores generales del sistema para la portada del panel."""
    total_usuarios: int
    total_conductores: int
    total_pasajeros: int
    total_admins: int
    total_rutas: int
    rutas_activas: int
    rutas_en_curso: int
    solicitudes_pendientes: int
    solicitudes_aceptadas: int
    solicitudes_rechazadas: int
