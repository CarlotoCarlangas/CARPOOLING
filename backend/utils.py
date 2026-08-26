"""
Funciones de apoyo: validación de RUT chileno, hash de contraseñas y
generación de tokens de sesión simples.
"""
import secrets

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def limpiar_rut(rut: str) -> str:
    return rut.upper().replace(".", "").replace("-", "").strip()


def validar_rut(rut: str) -> bool:
    """
    Valida un RUT chileno usando el algoritmo de dígito verificador
    módulo 11. Acepta formatos con o sin puntos/guión, ej: "12.345.678-5"
    o "123456785".
    """
    rut_limpio = limpiar_rut(rut)
    if len(rut_limpio) < 2:
        return False

    cuerpo, dv = rut_limpio[:-1], rut_limpio[-1]
    if not cuerpo.isdigit():
        return False

    suma = 0
    multiplo = 2
    for digito in reversed(cuerpo):
        suma += int(digito) * multiplo
        multiplo = multiplo + 1 if multiplo < 7 else 2

    resto = 11 - (suma % 11)
    if resto == 11:
        dv_esperado = "0"
    elif resto == 10:
        dv_esperado = "K"
    else:
        dv_esperado = str(resto)

    return dv == dv_esperado


def formatear_rut(rut: str) -> str:
    """Devuelve el RUT limpio en formato NNNNNNNN-DV (sin puntos)."""
    rut_limpio = limpiar_rut(rut)
    return f"{rut_limpio[:-1]}-{rut_limpio[-1]}"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verificar_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def generar_token() -> str:
    # TODO PRODUCCIÓN: reemplazar por JWT con expiración (ver nota en models.py)
    return secrets.token_hex(32)
