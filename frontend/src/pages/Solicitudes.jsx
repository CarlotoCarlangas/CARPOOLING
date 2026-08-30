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

export default function Solicitudes() {
  const { token } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [respondiendo, setRespondiendo] = useState(null);

  const cargar = () => {
    setCargando(true);
    api
      .solicitudesRecibidas(token)
      .then(setSolicitudes)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, [token]);

  const responder = async (id, accion) => {
    setRespondiendo(id);
    setError("");
    try {
      const actualizada = accion === "aceptar" ? await api.aceptarSolicitud(id, token) : await api.rechazarSolicitud(id, token);
      setSolicitudes((prev) => prev.map((s) => (s.id === id ? actualizada : s)));
    } catch (e) {
      setError(e.message);
    } finally {
      setRespondiendo(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 my-6">
      <h1 className="text-2xl font-bold mb-1">Solicitudes recibidas</h1>
      <p className="text-sm text-gray-600 mb-4">
        Pasajeros que quieren un cupo en tus viajes publicados.
      </p>

      {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {!cargando && solicitudes.length === 0 && (
        <p className="text-gray-500 text-sm">Todavía no has recibido ninguna solicitud.</p>
      )}

      <div className="space-y-3">
        {solicitudes.map((s) => (
          <div key={s.id} className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <Link to={`/rutas/${s.ruta.id}`} className="font-semibold hover:underline truncate block">
                  {s.ruta.origen_direccion} → {s.ruta.destino_direccion}
                </Link>
                <p className="text-sm text-gray-500">🕐 {s.ruta.hora_salida}</p>
              </div>
              <span
                className={`flex-shrink-0 text-xs font-semibold border rounded-full px-2.5 py-1 ${ESTADO_ESTILO[s.estado]}`}
              >
                {ESTADO_LABEL[s.estado] || s.estado}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3 bg-gray-50 rounded-lg p-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 text-sm">
                🧑
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{s.pasajero.nombre}</p>
                <p className="text-xs text-gray-500 truncate">Sube en: {s.embarque_direccion}</p>
              </div>
              {s.estado !== "pendiente" && (
                <a href={`tel:${s.pasajero.telefono}`} className="text-xs text-taco-dark font-semibold whitespace-nowrap">
                  {s.pasajero.telefono}
                </a>
              )}
            </div>

            {s.estado === "pendiente" && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => responder(s.id, "rechazar")}
                  disabled={respondiendo === s.id}
                  className="flex-1 bg-white border border-gray-300 rounded-lg py-1.5 text-sm font-semibold text-gray-600 disabled:opacity-40"
                >
                  Rechazar
                </button>
                <button
                  onClick={() => responder(s.id, "aceptar")}
                  disabled={respondiendo === s.id}
                  className="flex-[1.4] bg-taco text-white rounded-lg py-1.5 text-sm font-bold disabled:opacity-40"
                >
                  Aceptar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
