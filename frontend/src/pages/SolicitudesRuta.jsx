import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import ModalRechazo from "../components/ModalRechazo";
import BotonEvaluar from "../components/BotonEvaluar";

const ESTADO_ESTILO = {
  pendiente: "bg-amber-50 text-amber-700 border-amber-200",
  aceptada: "bg-green-50 text-green-700 border-green-200",
  rechazada: "bg-red-50 text-red-700 border-red-200",
};
const ESTADO_LABEL = { pendiente: "Pendiente", aceptada: "Aceptada", rechazada: "Rechazada" };

/** Solicitudes de UN viaje puntual del conductor (se llega desde Mis viajes). */
export default function SolicitudesRuta() {
  const { id } = useParams();
  const { token } = useAuth();
  const [ruta, setRuta] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [respondiendo, setRespondiendo] = useState(null);
  const [rechazando, setRechazando] = useState(null);

  const cargar = () => {
    setCargando(true);
    Promise.all([api.detalleRuta(id), api.solicitudesDeRuta(id, token)])
      .then(([r, sols]) => {
        setRuta(r);
        setSolicitudes(sols);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, [id, token]);

  const aceptar = async (sid) => {
    setRespondiendo(sid);
    setError("");
    try {
      const act = await api.aceptarSolicitud(sid, token);
      setSolicitudes((prev) => prev.map((s) => (s.id === sid ? act : s)));
    } catch (e) {
      setError(e.message);
    } finally {
      setRespondiendo(null);
    }
  };

  const confirmarRechazo = async (motivo) => {
    if (!rechazando) return;
    const sid = rechazando.id;
    setRespondiendo(sid);
    try {
      const act = await api.rechazarSolicitud(sid, motivo, token);
      setSolicitudes((prev) => prev.map((s) => (s.id === sid ? act : s)));
      setRechazando(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRespondiendo(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 my-6">
      <Link to="/mis-viajes" className="text-sm text-taco underline">← Volver a mis viajes</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Solicitudes del viaje</h1>
      {ruta && (
        <p className="text-sm text-gray-500 mb-4">
          {ruta.apodo ? `${ruta.apodo} · ` : ""}
          {ruta.origen_comuna || ruta.origen_direccion} → {ruta.destino_comuna || ruta.destino_direccion} · 🕐 {ruta.hora_salida}
        </p>
      )}

      {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {!cargando && solicitudes.length === 0 && (
        <p className="text-gray-500 text-sm">Este viaje todavía no tiene solicitudes.</p>
      )}

      <div className="space-y-3">
        {solicitudes.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl shadow-card p-4 border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">🧑</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{s.pasajero.nombre}</p>
                <p className="text-xs text-gray-500 truncate">Sube en: {s.embarque_direccion}</p>
              </div>
              <span className={`flex-shrink-0 text-xs font-semibold border rounded-full px-2.5 py-1 ${ESTADO_ESTILO[s.estado]}`}>
                {ESTADO_LABEL[s.estado] || s.estado}
              </span>
            </div>

            {s.estado !== "pendiente" && (
              <a href={`tel:${s.pasajero.telefono}`} className="text-xs text-taco-dark font-semibold mt-2 inline-block">
                📞 {s.pasajero.telefono}
              </a>
            )}

            {s.estado === "pendiente" && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setRechazando(s)}
                  disabled={respondiendo === s.id}
                  className="flex-1 bg-white border border-gray-300 rounded-lg py-1.5 text-sm font-semibold text-gray-600 disabled:opacity-40"
                >
                  Rechazar
                </button>
                <button
                  onClick={() => aceptar(s.id)}
                  disabled={respondiendo === s.id}
                  className="flex-[1.4] bg-taco text-white rounded-lg py-1.5 text-sm font-bold disabled:opacity-40"
                >
                  Aceptar
                </button>
              </div>
            )}

            {s.estado === "rechazada" && s.motivo_rechazo && (
              <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-semibold text-gray-600">Motivo enviado:</span> {s.motivo_rechazo}
              </p>
            )}

            {s.estado === "aceptada" && (
              <>
                <Link
                  to={`/chat/${s.id}`}
                  className="mt-3 block text-center bg-taco text-white rounded-lg py-2 text-sm font-semibold"
                >
                  💬 Chat con {s.pasajero.nombre}
                </Link>
                <BotonEvaluar solicitudId={s.id} finalizado={s.viaje_finalizado} />
              </>
            )}
          </div>
        ))}
      </div>

      {rechazando && (
        <ModalRechazo
          nombrePasajero={rechazando.pasajero?.nombre}
          enviando={respondiendo === rechazando.id}
          onCancelar={() => setRechazando(null)}
          onConfirmar={confirmarRechazo}
        />
      )}
    </div>
  );
}
