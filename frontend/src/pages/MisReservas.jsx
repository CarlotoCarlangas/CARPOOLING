import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

const ESTADO_ESTILO = {
  pendiente: "bg-amber-50 text-amber-700 border-amber-200",
  aceptada: "bg-green-50 text-green-700 border-green-200",
  rechazada: "bg-red-50 text-red-700 border-red-200",
};

const ESTADO_LABEL = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};

export default function MisReservas() {
  const { token } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .misSolicitudes(token)
      .then(setSolicitudes)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  return (
    <div className="max-w-2xl mx-auto p-6 my-6">
      <h1 className="text-2xl font-bold mb-1">Mis reservas</h1>
      <p className="text-sm text-gray-600 mb-4">Solicitudes de cupo que has enviado.</p>

      {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!cargando && solicitudes.length === 0 && (
        <p className="text-gray-500 text-sm">
          Todavía no has reservado ningún viaje.{" "}
          <Link to="/buscar" className="text-taco underline">Buscar un viaje</Link>
        </p>
      )}

      <div className="space-y-3">
        {solicitudes.map((s) => (
          <Link
            key={s.id}
            to={`/rutas/${s.ruta.id}`}
            className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{s.ruta.origen_direccion}</p>
                <p className="text-sm text-gray-500 truncate">→ {s.ruta.destino_direccion}</p>
              </div>
              <span
                className={`flex-shrink-0 text-xs font-semibold border rounded-full px-2.5 py-1 ${ESTADO_ESTILO[s.estado]}`}
              >
                {ESTADO_LABEL[s.estado] || s.estado}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
              <span>🕐 {s.ruta.hora_salida}</span>
              <span>💰 ${s.ruta.precio_pasajero.toLocaleString("es-CL")}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Conductor: {s.ruta.conductor.nombre} · Subes en: {s.embarque_direccion}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
