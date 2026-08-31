import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

const INTERVALO_POLLING_MS = 3000;

function formatearHora(fechaIso) {
  return new Date(fechaIso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Chat simple entre conductor y pasajero, solo disponible cuando la
 * solicitud está "aceptada" (antes no hay nada que coordinar). No usa
 * WebSockets — pide mensajes nuevos cada pocos segundos mientras la
 * pantalla está abierta. Es suficiente para el prototipo; en producción
 * convendría tiempo real de verdad.
 */
export default function Chat() {
  const { solicitudId } = useParams();
  const { usuario, token } = useAuth();
  const [conversacion, setConversacion] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    api
      .datosConversacion(solicitudId, token)
      .then(setConversacion)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [solicitudId, token]);

  useEffect(() => {
    let activo = true;
    const cargarMensajes = () => {
      api
        .mensajesDeSolicitud(solicitudId, token)
        .then((datos) => {
          if (activo) setMensajes(datos);
        })
        .catch(() => {});
    };
    cargarMensajes();
    const intervalo = setInterval(cargarMensajes, INTERVALO_POLLING_MS);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [solicitudId, token]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const enviar = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setError("");
    try {
      const nuevo = await api.enviarMensaje(solicitudId, texto, token);
      setMensajes((prev) => [...prev, nuevo]);
      setTexto("");
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) return <p className="text-center mt-8">Cargando...</p>;
  if (error && !conversacion) return <p className="text-red-600 text-center mt-8">{error}</p>;

  const puedeEscribir = conversacion?.estado === "aceptada";

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col p-0 sm:p-6">
      <div className="bg-white border-b sm:border sm:rounded-t-lg px-4 py-3 flex items-center gap-3">
        <Link to={usuario?.es_conductor ? "/solicitudes" : "/mis-reservas"} className="text-taco text-xl leading-none">
          ←
        </Link>
        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-sm flex-shrink-0">
          🧑
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{conversacion?.otra_persona.nombre}</p>
          {!puedeEscribir && (
            <p className="text-xs text-gray-500">
              {conversacion?.estado === "rechazada" ? "Solicitud rechazada" : "Chat no disponible"}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 sm:border-x px-4 py-4 space-y-2">
        {mensajes.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-6">
            Todavía no hay mensajes. Escribe para coordinar el viaje.
          </p>
        )}
        {mensajes.map((m) => {
          const esMio = m.remitente_id === usuario?.id;
          return (
            <div key={m.id} className={`flex ${esMio ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  esMio ? "bg-taco text-white rounded-br-sm" : "bg-white text-gray-800 rounded-bl-sm shadow-sm"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                <p className={`text-[10px] mt-1 ${esMio ? "text-white/70" : "text-gray-400"}`}>
                  {formatearHora(m.fecha_envio)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      <form onSubmit={enviar} className="bg-white border-t sm:border sm:rounded-b-lg px-3 py-3 flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={puedeEscribir ? "Escribe un mensaje..." : "Chat no disponible"}
          disabled={!puedeEscribir || enviando}
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={!puedeEscribir || enviando || !texto.trim()}
          className="bg-taco text-white rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center disabled:opacity-40"
        >
          ➤
        </button>
      </form>
      {error && <p className="text-red-600 text-xs text-center mt-1">{error}</p>}
    </div>
  );
}
