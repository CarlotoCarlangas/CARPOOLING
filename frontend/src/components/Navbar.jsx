import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { usuario, estaAutenticado, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const salir = () => {
    cerrarSesion();
    navigate("/login");
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <Link to="/" className="font-bold text-xl text-taco">
        TACO
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link to="/rutas" className="hover:text-taco">Ver rutas</Link>
        {estaAutenticado && usuario?.es_conductor && (
          <Link to="/crear-ruta" className="hover:text-taco">Publicar ruta</Link>
        )}
        {estaAutenticado ? (
          <>
            <Link to="/perfil" className="hover:text-taco">{usuario?.nombre}</Link>
            <button onClick={salir} className="text-gray-500 hover:text-red-600">
              Salir
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:text-taco">Ingresar</Link>
            <Link
              to="/registro"
              className="bg-taco text-white px-3 py-1.5 rounded-lg hover:bg-taco-dark"
            >
              Crear cuenta
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
