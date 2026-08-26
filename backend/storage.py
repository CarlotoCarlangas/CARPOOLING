"""
Guardado simple de archivos subidos (fotos de perfil, documentos del
vehículo) en disco local.

TODO PRODUCCIÓN: usar almacenamiento en la nube (ej. S3 / Cloud Storage)
con URLs firmadas y expiración, en vez de servir archivos estáticos
directamente desde el servidor. Los documentos como licencia/SOAP son
sensibles y no deberían quedar accesibles públicamente sin control.
"""
import uuid
from pathlib import Path

from fastapi import UploadFile

UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


async def guardar_archivo(archivo: UploadFile, subcarpeta: str) -> str:
    carpeta = UPLOADS_DIR / subcarpeta
    carpeta.mkdir(parents=True, exist_ok=True)

    extension = Path(archivo.filename or "").suffix
    nombre_unico = f"{uuid.uuid4().hex}{extension}"
    destino = carpeta / nombre_unico

    contenido = await archivo.read()
    destino.write_bytes(contenido)

    return f"/uploads/{subcarpeta}/{nombre_unico}"
