import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

/** Pasajeros que el conductor ha bloqueado, con opción de desbloquear (#8). */
export default function Bloqueados() {
  const { token } = useAuth();
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [quitando, setQuitando] = useState(null);

  useEffect(() => {
    api
      .pasajerosBloqueados(token)
      .then(setLista)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [token]);

  const desbloquear = async (pasajeroId) => {
    setQuitando(pasajeroId);
    try {
      await api.desbloquearPasajero(pasajeroId, token);
      setLista((prev) => prev.filter((b) => b.pasajero_id !== pasajeroId));
    } catch {
      /* ignorar */
    } finally {
      setQuitando(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 my-6">
      <Link to="/perfil" className="text-sm text-taco underline">← Volver a mi perfil</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Pasajeros bloqueados</h1>
      <p className="text-sm text-gray-600 mb-4">
        No ven tus viajes ni pueden pedirte cupo. Puedes desbloquearlos cuando quieras.
      </p>

      {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
      {!cargando && lista.length === 0 && (
        <p className="text-gray-500 text-sm">No tienes pasajeros bloqueados.</p>
      )}

      <div className="space-y-3">
        {lista.map((b) => (
          <div key={b.pasajero_id} className="bg-white rounded-2xl shadow-card p-4 border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">🧑</div>
            <p className="flex-1 min-w-0 text-sm font-semibold truncate">{b.nombre}</p>
            <button
              onClick={() => desbloquear(b.pasajero_id)}
              disabled={quitando === b.pasajero_id}
              className="text-sm bg-white border border-taco text-taco rounded-lg px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              {quitando === b.pasajero_id ? "..." : "Desbloquear"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
