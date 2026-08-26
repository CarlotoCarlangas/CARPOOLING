import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

const DIA_LABEL = {
  lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue",
  viernes: "Vie", sabado: "Sáb", domingo: "Dom",
};

export default function Rutas() {
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listarRutas()
      .then(setRutas)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 my-6">
      <h1 className="text-2xl font-bold mb-1">Rutas publicadas</h1>
      <p className="text-sm text-gray-600 mb-4">
        Vista preliminar de las rutas disponibles. La búsqueda por cercanía y la reserva
        de cupo (módulo 3) se agregan en el próximo paso.
      </p>

      {cargando && <p>Cargando rutas...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!cargando && rutas.length === 0 && (
        <p className="text-gray-500">Todavía no hay rutas publicadas.</p>
      )}

      <div className="space-y-3">
        {rutas.map((r) => (
          <Link
            key={r.id}
            to={`/rutas/${r.id}`}
            className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{r.origen_direccion}</p>
                <p className="text-sm text-gray-500">→ {r.destino_direccion}</p>
              </div>
              <span className="text-taco font-bold">
                ${r.precio_pasajero.toLocaleString("es-CL")}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
              <span>🕐 {r.hora_salida}</span>
              <span>💺 {r.cupos_disponibles}/{r.cupos_totales} cupos</span>
              <span>{r.dias_recurrencia.map((d) => DIA_LABEL[d] || d).join(", ")}</span>
              {r.modo_solo_mujeres && <span>🚺 Solo mujeres</span>}
            </div>
            <p className="text-xs text-gray-400 mt-1">Conductor: {r.conductor.nombre}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
