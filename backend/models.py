"""
Modelos de base de datos (tablas SQLite vía SQLModel).

Cada campo que guarda un dato personal tiene un comentario
`# PRIVACIDAD: ...` explicando por qué se recolecta, como exige la
Ley 21.719 (principio de finalidad y minimización de datos).
"""
from datetime import datetime
from typing import List, Optional

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # PRIVACIDAD: el RUT identifica de forma única a la persona en Chile.
    # Se usa para login y para evitar cuentas duplicadas/fraudulentas.
    rut: str = Field(index=True, unique=True)

    # PRIVACIDAD: nombre necesario para que conductor y pasajero se
    # identifiquen entre sí antes y durante el viaje.
    nombre: str

    # PRIVACIDAD: teléfono necesario para coordinar el viaje (ej. avisar
    # atraso) y como canal de contacto de emergencia.
    telefono: str

    # PRIVACIDAD: email usado como identificador de cuenta y para
    # notificaciones (confirmaciones de reserva, recuperación de clave).
    email: str = Field(index=True, unique=True)

    password_hash: str

    # Token simple de sesión para el prototipo.
    # TODO PRODUCCIÓN: reemplazar por JWT firmado con expiración y refresh
    # token; este esquema no expira y es solo para pruebas entre dos personas.
    token: Optional[str] = Field(default=None, index=True)

    # PRIVACIDAD: foto de perfil para que el otro usuario pueda reconocer
    # a la persona al encontrarse (seguridad del encuentro presencial).
    foto_url: Optional[str] = None

    es_conductor: bool = Field(default=False)
    es_pasajero: bool = Field(default=False)

    # Administrador de la plataforma (el dueño). No se pide en el registro:
    # se asigna manualmente con el script crear_admin.py. Da acceso al panel
    # de supervisión (solo lectura) de todos los usuarios y rutas.
    # TODO PRODUCCIÓN: el rol admin debería asignarse fuera de la app y
    # registrar en un log de auditoría cada consulta a datos de terceros
    # (trazabilidad exigida por la Ley 21.719).
    es_admin: bool = Field(default=False)

    # PRIVACIDAD: género es un dato sensible. Es opcional y solo se pide
    # porque habilita la función voluntaria "modo solo mujeres". Si el
    # usuario no la activa, no es necesario entregarlo.
    genero: Optional[str] = None  # "femenino" | "masculino" | "otro" | None

    # Preferencia opcional: si está activo, este usuario solo verá/aceptará
    # viajes marcados como "solo mujeres".
    modo_solo_mujeres: bool = Field(default=False)

    # Consentimiento explícito (Ley 21.719) — obligatorio para poder crear
    # la cuenta. Se guarda cuándo se aceptó para tener trazabilidad.
    acepta_terminos: bool = Field(default=False)
    fecha_aceptacion_terminos: Optional[datetime] = None

    fecha_registro: datetime = Field(default_factory=datetime.utcnow)

    # Promedio de evaluaciones recibidas (módulo 7). Se recalcula al recibir
    # cada review nueva.
    calificacion_promedio: Optional[float] = None
    total_calificaciones: int = Field(default=0)


class VehiculoDocumento(SQLModel, table=True):
    """
    Documentos habilitantes del vehículo/conductor.
    Un conductor no puede publicar rutas hasta subir estos 3 documentos.

    TODO PRODUCCIÓN: hoy solo se guarda la URL del archivo subido, sin
    validar su contenido. En producción esto debería pasar por revisión
    manual o automática (OCR + verificación de vigencia) antes de marcar
    `verificado = True`.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True, unique=True)

    patente: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None

    # PRIVACIDAD: la licencia de conducir prueba que la persona está
    # habilitada legalmente para conducir. Es obligatoria para operar
    # como conductor en la plataforma.
    licencia_conducir_url: Optional[str] = None

    # PRIVACIDAD: la revisión técnica prueba que el vehículo está en
    # condiciones seguras de circular. Exigida para proteger a los
    # pasajeros.
    revision_tecnica_url: Optional[str] = None

    # PRIVACIDAD: el SOAP (seguro obligatorio de accidentes personales)
    # prueba que el vehículo tiene cobertura mínima en caso de accidente.
    soap_url: Optional[str] = None

    verificado: bool = Field(default=False)
    fecha_actualizacion: datetime = Field(default_factory=datetime.utcnow)


class Route(SQLModel, table=True):
    """
    Ruta publicada por un conductor.

    `paradas` y `geometria` se guardan como JSON:
    - paradas: lista de paradas intermedias [{lat, lng, direccion}, ...]
    - geometria: lista de puntos [[lat, lng], ...] que traza la ruta real
      por calles (viene de OSRM, calculado en el navegador del conductor
      al momento de crear la ruta).
    - dias_recurrencia: lista de días ["lunes", "martes", ...]

    TODO PRODUCCIÓN: normalizar `paradas` en su propia tabla si en el
    futuro se necesita, por ejemplo, que un pasajero reserve solo hasta
    una parada intermedia. Para el prototipo, JSON es suficiente y más
    simple.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    conductor_id: int = Field(foreign_key="user.id", index=True)

    # Apodo/nombre corto que el conductor le pone a la ruta (ej. "Turno
    # mañana", "Vuelta del trabajo") para reconocerla entre varias. Opcional;
    # si no hay, la app muestra las comunas origen→destino.
    apodo: Optional[str] = None

    # PRIVACIDAD (dato sensible - geolocalización): coordenadas de origen.
    # Se recolectan solo para poder trazar la ruta y mostrarla a pasajeros
    # que buscan viajes en ese trayecto.
    origen_lat: float
    origen_lng: float
    origen_direccion: str
    # Comuna del origen (ej. "Peñaflor"), extraída de la geocodificación al
    # crear la ruta. Permite filtrar rutas por comuna en la búsqueda del
    # pasajero sin tener que calcular distancias geográficas para eso.
    origen_comuna: Optional[str] = Field(default=None, index=True)

    # PRIVACIDAD (dato sensible - geolocalización): coordenadas de destino.
    destino_lat: float
    destino_lng: float
    destino_direccion: str
    destino_comuna: Optional[str] = Field(default=None, index=True)

    # PRIVACIDAD (dato sensible - geolocalización): puntos intermedios de
    # la ruta real trazada por calles.
    paradas: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    geometria: List[List[float]] = Field(default_factory=list, sa_column=Column(JSON))

    distancia_km: Optional[float] = None
    duracion_min: Optional[float] = None

    cupos_totales: int
    cupos_disponibles: int

    precio_sugerido: int  # CLP, precio base antes de comisión

    hora_salida: str  # "HH:MM"
    dias_recurrencia: List[str] = Field(default_factory=list, sa_column=Column(JSON))

    modo_solo_mujeres: bool = Field(default=False)
    activa: bool = Field(default=True)

    fecha_creacion: datetime = Field(default_factory=datetime.utcnow)

    # --- Tracking en tiempo real (Módulo 5) ---
    # El conductor "inicia" el viaje de hoy, el navegador le manda su
    # posición cada varios segundos mientras dure, y "finaliza" al llegar.
    # No existe un registro histórico por viaje — solo la posición ACTUAL
    # del recorrido en curso (si hay uno). Alcanza para el prototipo: no
    # hace falta guardar el historial de posiciones para mostrar el mapa
    # en vivo al pasajero.
    en_curso: bool = Field(default=False)
    # PRIVACIDAD (dato sensible - geolocalización): posición en vivo del
    # conductor mientras el viaje está en curso. Se recolecta solo para
    # que los pasajeros con cupo aceptado vean cuánto falta para que
    # llegue a su punto de subida; se deja de compartir al finalizar.
    ubicacion_lat: Optional[float] = None
    ubicacion_lng: Optional[float] = None
    ubicacion_actualizada: Optional[datetime] = None


class Solicitud(SQLModel, table=True):
    """
    Solicitud de un pasajero para reservar un cupo en una ruta (Módulo 3).

    Estados: "pendiente" (recién creada) -> "aceptada" o "rechazada" (el
    conductor responde). Al aceptar, se descuenta un cupo de la ruta.

    TODO PRODUCCIÓN: agregar un estado "cancelada" para que el pasajero
    pueda desistir antes de que el conductor responda, y devolver el cupo
    si cancela después de ser aceptado. Se dejó fuera de este incremento
    para no hacer un cambio gigante de una sola vez.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    ruta_id: int = Field(foreign_key="route.id", index=True)
    pasajero_id: int = Field(foreign_key="user.id", index=True)

    # PRIVACIDAD (dato sensible - geolocalización): punto donde el
    # pasajero eligió subir, entre las paradas que definió el conductor.
    # Se recolecta solo para que el conductor sepa dónde recogerlo.
    embarque_lat: float
    embarque_lng: float
    embarque_direccion: str

    estado: str = Field(default="pendiente", index=True)  # pendiente | aceptada | rechazada

    # Motivo que el conductor elige (respuesta rápida predefinida o texto
    # libre) al rechazar la solicitud. Se le muestra al pasajero para que
    # sepa por qué no fue aceptado. Null mientras no haya rechazo.
    motivo_rechazo: Optional[str] = None

    # Se marca True cuando el conductor finaliza el viaje de esta ruta. Habilita
    # la evaluación mutua (Módulo 7): recién terminado el viaje, conductor y
    # pasajero pueden calificarse.
    viaje_finalizado: bool = Field(default=False)

    fecha_solicitud: datetime = Field(default_factory=datetime.utcnow)
    fecha_respuesta: Optional[datetime] = None


class Mensaje(SQLModel, table=True):
    """
    Chat interno entre conductor y pasajero (Módulo 4). Un mensaje siempre
    pertenece a una `Solicitud` — la conversación se habilita recién
    cuando esa solicitud queda "aceptada" (antes no tiene sentido
    coordinar un viaje que no va a pasar).

    TODO PRODUCCIÓN: hoy el frontend consulta por polling (pide mensajes
    nuevos cada pocos segundos). Para mensajería en tiempo real de verdad
    habría que agregar WebSockets; se deja fuera de este incremento
    porque el polling ya resuelve la necesidad del prototipo sin
    infraestructura nueva.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    solicitud_id: int = Field(foreign_key="solicitud.id", index=True)
    remitente_id: int = Field(foreign_key="user.id", index=True)

    # PRIVACIDAD: contenido de la conversación entre conductor y
    # pasajero. Se recolecta solo para coordinar el viaje reservado; no
    # se usa con ningún otro fin.
    texto: str

    fecha_envio: datetime = Field(default_factory=datetime.utcnow)


class Notificacion(SQLModel, table=True):
    """
    Aviso operativo para un usuario (Módulo de notificaciones).

    Guarda los avisos de EVENTO ya ocurridos (ej. "el viaje inició"), que
    son los que un futuro push al celular entregaría. Los RECORDATORIOS
    previos (faltan 30/10/5 min para salir) NO se guardan acá: se calculan
    al vuelo según la hora de salida de la ruta (ver routes/notificaciones.py),
    porque dependen del reloj y de que el viaje no haya partido todavía.

    TODO PRODUCCIÓN: el envío push real (a la app móvil / web push vía FCM o
    APNs) todavía no existe — hoy estos avisos se muestran dentro de la app.
    Cuando exista la app, un worker programado dispara los recordatorios en
    las marcas 30/10/5 min y entrega tanto estos como los de evento por push.
    """
    id: Optional[int] = Field(default=None, primary_key=True)

    # PRIVACIDAD: destinatario del aviso. Se usa solo para entregarle
    # información operativa de un viaje en el que participa.
    user_id: int = Field(foreign_key="user.id", index=True)

    tipo: str  # "viaje_iniciado" | "recordatorio"
    titulo: str
    mensaje: str

    ruta_id: Optional[int] = Field(default=None, foreign_key="route.id")
    solicitud_id: Optional[int] = Field(default=None, foreign_key="solicitud.id")

    leida: bool = Field(default=False)
    fecha_creacion: datetime = Field(default_factory=datetime.utcnow)


class Calificacion(SQLModel, table=True):
    """
    Evaluación mutua post-viaje (Módulo 7). Cuelga de una `Solicitud` (la
    unidad que une a un conductor con un pasajero en un viaje). Cada persona
    califica UNA vez a la otra por esa solicitud: hay como máximo dos
    calificaciones por solicitud (la del conductor al pasajero y viceversa).

    Al guardar una calificación se recalcula el promedio del evaluado
    (User.calificacion_promedio / total_calificaciones).
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    solicitud_id: int = Field(foreign_key="solicitud.id", index=True)
    autor_id: int = Field(foreign_key="user.id", index=True)      # quién califica
    evaluado_id: int = Field(foreign_key="user.id", index=True)   # a quién califican

    estrellas: int  # 1 a 5

    # PRIVACIDAD: comentario opcional sobre la experiencia del viaje. Se
    # recolecta solo para la reputación mutua dentro de la plataforma.
    comentario: Optional[str] = None

    fecha: datetime = Field(default_factory=datetime.utcnow)
