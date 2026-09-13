"""
Dependencias compartidas entre routers (autenticación por token simple).
"""
from fastapi import Depends, Header, HTTPException, status
from sqlmodel import Session, select

from database import get_session
from models import User


def get_current_user(
    authorization: str = Header(default=None),
    session: Session = Depends(get_session),
) -> User:
    """
    Espera el header `Authorization: Bearer <token>`.
    TODO PRODUCCIÓN: cambiar a JWT (ver nota en models.py / utils.py).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")

    token = authorization.removeprefix("Bearer ").strip()
    usuario = session.exec(select(User).where(User.token == token)).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")
    return usuario


def get_admin_user(usuario: User = Depends(get_current_user)) -> User:
    """
    Igual que get_current_user, pero además exige que la persona sea el
    administrador de la plataforma. Protege todos los endpoints del panel
    admin (routes/admin.py).
    """
    if not usuario.es_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso reservado al administrador de la plataforma",
        )
    return usuario
