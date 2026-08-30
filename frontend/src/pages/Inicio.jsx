import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Inicio() {
  const { estaAutenticado, usuario } = useAuth();

  return (
    <div className="max-w-2xl mx-auto p-6 my-10 text-center">
      <h1 className="text-4xl font-bold text-taco mb-2">TACO</h1>
      <p className="text-gray-600 mb-8">
        Comparte tu viaje diario Peñaflor → Santiago y ahorra en el trayecto.
      </p>

      {estaAutenticado ? (
        <div className="flex justify-center gap-3">
          {usuario?.es_conductor && (
            <Link to="/crear-ruta" className="bg-taco text-white px-5 py-2.5 rounded-lg">
              Publicar una ruta
            </Link>
          )}
          <Link to="/buscar" className="bg-gray-800 text-white px-5 py-2.5 rounded-lg">
            Buscar un viaje
          </Link>
        </div>
      ) : (
        <div className="flex justify-center gap-3">
          <Link to="/registro" className="bg-taco text-white px-5 py-2.5 rounded-lg">
            Crear cuenta
          </Link>
          <Link to="/login" className="bg-gray-200 text-gray-800 px-5 py-2.5 rounded-lg">
            Ya tengo cuenta
          </Link>
        </div>
      )}
    </div>
  );
}
