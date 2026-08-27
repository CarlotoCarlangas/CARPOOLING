"""
Borra los conductores y rutas de prueba creados por seed_demo.py
(identificados porque el nombre del conductor termina en "(demo)").

Uso:
    venv\\Scripts\\python.exe borrar_demo.py
"""
from sqlmodel import Session, select

from database import engine
from models import Route, User, VehiculoDocumento


def main():
    with Session(engine) as session:
        conductores_demo = session.exec(
            select(User).where(User.nombre.like("%(demo)%"))
        ).all()
        ids = [c.id for c in conductores_demo]

        rutas = session.exec(select(Route).where(Route.conductor_id.in_(ids))).all() if ids else []
        for r in rutas:
            session.delete(r)

        for c in conductores_demo:
            doc = session.exec(
                select(VehiculoDocumento).where(VehiculoDocumento.user_id == c.id)
            ).first()
            if doc:
                session.delete(doc)
            session.delete(c)

        session.commit()
        print(f"Borrados: {len(conductores_demo)} conductores demo, {len(rutas)} rutas demo.")


if __name__ == "__main__":
    main()
