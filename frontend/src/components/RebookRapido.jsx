import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

/**
 * "Volver a tomar un viaje" (#7): acceso rápido a los viajes que el pasajero
 * ya tomó antes y que HOY siguen disponibles (activos, con cupo, sin que el
 * conductor lo haya bloqueado). Un toque vuelve a pedir el cupo en el mismo
 * punto de subida — sin buscar de nuevo. Se auto-oculta si no hay ninguno.
 */
export default function RebookRapido() {
  const { token } = useAuth();
  const [opciones, setOpciones] = useState([]);
  const [pidiendo, setPidiendo] = useState(null);
  const [hechos, setHechos] = useState({}); // ruta_id -> true cuando se re-pidió

  useEffect(() => {
    if (!token) return;
    api.rebookDisponibles(token).then(setOpciones).catch(() => {});
  }, [token]);

  const volverAPedir = async (op) => {
    setPidiendo(op.ruta.id);
    try {
      await api.crearSolicitud(
        {
          ruta_id: op.ruta.id,
          embarque: { lat: op.embarque_lat, lng: op.embarque_lng, direccion: op.embarque_direccion },
        },
        token
      );
      setHechos((prev) => ({ ...prev, [op.ruta.id]: true }));
    } catch (e) {
      alert(e.message);
    } finally {
      setPidiendo(null);
    }
  };

  if (opciones.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
        Volver a tomar un viaje
      </p>
      <div className="space-y-2">
        {opciones.map((op) => {
          const r = op.ruta;
          const yaPedido = hechos[r.id];
          return (
            <div key={r.id} className="bg-white rounded-2xl shadow-card p-3.5 border border-slate-100">
              <p className="font-bold text-gray-900 leading-snug">
                {r.origen_comuna || r.origen_direccion} <span className="text-gray-400">→</span>{" "}
                {r.destino_comuna || r.destino_direccion}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {r.conductor.nombre} · 🕐 {r.hora_salida} · 💲 {r.precio_pasajero.toLocaleString("es-CL")}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">Subes en: {op.embarque_direccion}</p>
              {yaPedido ? (
                <p className="mt-2 text-sm text-green-700 font-semibold">✅ Pedido enviado — pendiente del conductor</p>
              ) : (
                <button
                  onClick={() => volverAPedir(op)}
                  disabled={pidiendo === r.id}
                  className="mt-2 w-full bg-taco text-white rounded-lg py-2 text-sm font-bold disabled:opacity-40"
                >
                  {pidiendo === r.id ? "Enviando..." : "🔁 Pedir cupo de nuevo"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
