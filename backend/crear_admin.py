"""
Crea (o promueve) la cuenta de ADMINISTRADOR de la plataforma.

Qué hace:
  1. Agrega la columna `es_admin` a la tabla `user` si todavía no existe.
     (SQLModel create_all NO migra columnas nuevas en tablas ya creadas —
     misma situación ya documentada en CLAUDE.md para otras columnas.)
  2. Marca como administrador al usuario con el RUT indicado. Si ese
     usuario ya existe (ej. Carlos ya se registró), conserva su contraseña
     y solo le activa el rol admin. Si no existe, crea la cuenta con una
     contraseña inicial.

Cómo correrlo (desde la carpeta backend):
    venv\\Scripts\\python.exe crear_admin.py

Es seguro correrlo varias veces: no duplica nada.
"""
from datetime import datetime

from sqlalchemy import text
from sqlmodel import Session, select

from database import crear_tablas, engine
from models import User
from utils import formatear_rut, generar_token, hash_password

# --- Datos del administrador (el dueño de la plataforma) ---
RUT_ADMIN = "18.960.171-9"
PASSWORD_INICIAL = "admin12345"          # solo si la cuenta NO existía aún
NOMBRE_ADMIN = "Administrador"
EMAIL_ADMIN = "admin@carpooling.cl"
TELEFONO_ADMIN = "000000000"


def agregar_columna_es_admin():
    """Agrega la columna es_admin a la tabla user si falta (migración manual)."""
    with engine.connect() as conn:
        columnas = conn.execute(text("PRAGMA table_info(user)")).fetchall()
        # PRAGMA table_info devuelve filas (cid, name, type, notnull, dflt, pk)
        nombres = {fila[1] for fila in columnas}
        if "es_admin" not in nombres:
            conn.execute(
                text("ALTER TABLE user ADD COLUMN es_admin BOOLEAN NOT NULL DEFAULT 0")
            )
            conn.commit()
            print("[OK] Columna 'es_admin' agregada a la tabla user.")
        else:
            print("[..] La columna 'es_admin' ya existia (no se toca).")


def promover_o_crear_admin():
    rut = formatear_rut(RUT_ADMIN)  # -> "18960171-9"
    with Session(engine) as session:
        usuario = session.exec(select(User).where(User.rut == rut)).first()

        if usuario:
            if usuario.es_admin:
                print(f"[..] {usuario.nombre} ({rut}) ya era administrador.")
            else:
                usuario.es_admin = True
                session.add(usuario)
                session.commit()
                print(f"[OK] {usuario.nombre} ({rut}) ahora es ADMINISTRADOR.")
            print(f"     Entra con tu RUT ({rut}) o tu email, y tu contrasena de siempre.")
        else:
            usuario = User(
                rut=rut,
                nombre=NOMBRE_ADMIN,
                telefono=TELEFONO_ADMIN,
                email=EMAIL_ADMIN,
                password_hash=hash_password(PASSWORD_INICIAL),
                es_conductor=False,
                es_pasajero=False,
                es_admin=True,
                acepta_terminos=True,
                fecha_aceptacion_terminos=datetime.utcnow(),
                token=generar_token(),
            )
            session.add(usuario)
            session.commit()
            print(f"[OK] Cuenta ADMIN creada.")
            print(f"     RUT:   {rut}")
            print(f"     Email: {EMAIL_ADMIN}")
            print(f"     Clave: {PASSWORD_INICIAL}   (cambiala apenas entres)")


if __name__ == "__main__":
    crear_tablas()
    agregar_columna_es_admin()
    promover_o_crear_admin()
    print("Listo.")
