import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

/**
 * Centro de avisos dentro de la app: muestra los recordatorios de salida
 * (faltan ~N min) y los eventos guardados (ej. "el viaje ya inició").
 * Se refresca cada 30 s para que el recordatorio vaya bajando y aparezca
 * el aviso de inicio apenas el conductor parte.
 *
 * TODO PRODUCCIÓN: cuando exista la app móvil, estos mismos avisos llegarán
 * además como push al celular (hoy solo se ven acá, con la app abierta).
 */
export default function Avisos() {
  const { token, estaAutenticado } = useAuth();
  const [avisos, setAvisos] = useState([]);

  const cargar = useCallback(() => {
    if (!token) return;
    api.notificaciones(token).then(setAvisos).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!estaAutenticado) return;
    cargar();
    const t = setInterval(cargar, 30000); // refresca cada 30 s
    return () => clearInterval(t);
  }, [estaAutenticado, cargar]);

  const descartar = async (id) => {
    setAvisos((prev) => prev.filter((a) => a.id !== id));
    try {
      await api.marcarAvisoLeido(id, token); // solo aplica a eventos guardados
    } catch {
      /* los recordatorios calculados no se guardan; ignorar */
    }
  };

  // Recordatorios siempre; eventos solo si no están leídos.
  const visibles = avisos.filter((a) => a.tipo === "recordatorio" || !a.leida);
  if (visibles.length === 0) return null;

  return (
    <div className="space-y-2 mb-5">
      {visibles.map((a) => {
        const esInicio = a.tipo === "viaje_iniciado";
        return (
          <div
            key={a.id}
            className={`rounded-2xl p-3.5 shadow-card border flex items-start gap-3 ${
              esInicio ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
            }`}
          >
            <span className="text-xl leading-none mt-0.5">{esInicio ? "🚗" : "⏰"}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${esInicio ? "text-green-800" : "text-amber-800"}`}>
                {a.titulo}
              </p>
              <p className="text-xs text-gray-600 mt-0.5 leading-snug">{a.mensaje}</p>
              {esInicio && a.solicitud_id && (
                <Link
                  to={`/viaje/${a.solicitud_id}`}
                  className="inline-block mt-2 bg-green-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                >
                  📍 Ver en vivo
                </Link>
              )}
            </div>
            {esInicio && (
              <button
                onClick={() => descartar(a.id)}
                aria-label="Descartar aviso"
                className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
