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
