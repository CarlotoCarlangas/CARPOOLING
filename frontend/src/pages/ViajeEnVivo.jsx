import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { calcularRuta } from "../services/osrm";
import MapaSeguimiento from "../components/MapaSeguimiento";

const INTERVALO_TRACKING_MS = 8000;

/**
 * Pantalla "viaje en vivo" del pasajero, con el mapa como protagonista (a
 * pantalla completa, estilo Uber/Rappi): el auto del conductor moviéndose
 * hacia su punto de subida, el ETA grande arriba y una tarjeta abajo con el
 * conductor y el acceso al chat. Se actualiza sola por polling.
 */
export default function ViajeEnVivo() {
  const { solicitudId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [conversacion, setConversacion] = useState(null);
  const [viaje, setViaje] = useState(null);
  const [rutaOsrm, setRutaOsrm] = useState(null);
  const [error, setError] = useState("");
  const ultimaPosicionRef = useRef(null);

  useEffect(() => {
    api
      .datosConversacion(solicitudId, token)
      .then(setConversacion)
      .catch((e) => setError(e.message));
  }, [solicitudId, token]);

  // Posición del conductor por polling (cada pocos segundos).
  useEffect(() => {
    let activo = true;
    const cargar = () =>
      api
        .viajeDeSolicitud(solicitudId, token)
        .then((d) => {
          if (activo) setViaje(d);
        })
        .catch(() => {});
    cargar();
    const intervalo = setInterval(cargar, INTERVALO_TRACKING_MS);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [solicitudId, token]);

  // Recalcular la ruta real por calles (OSRM) solo cuando la posición del
  // conductor cambió de verdad — así no golpeamos de más el servicio gratuito.
  useEffect(() => {
    if (!viaje?.en_curso || viaje.conductor_lat == null || viaje.conductor_lng == null) return;
    const clave = `${viaje.conductor_lat.toFixed(5)},${viaje.conductor_lng.toFixed(5)}`;
    if (ultimaPosicionRef.current === clave) return;
    ultimaPosicionRef.current = clave;
    calcularRuta([
      { lat: viaje.conductor_lat, lng: viaje.conductor_lng },
      { lat: viaje.embarque_lat, lng: viaje.embarque_lng },
    ])
      .then(setRutaOsrm)
      .catch(() => {});
  }, [viaje]);

  const enCurso = viaje?.en_curso;
  const esperandoUbicacion = enCurso && viaje?.conductor_lat == null;
  const otra = conversacion?.otra_persona;

  let etaTexto;
  if (!enCurso) etaTexto = "El conductor aún no inició el viaje";
  else if (esperandoUbicacion) etaTexto = "Esperando la ubicación del conductor…";
  else if (rutaOsrm) etaTexto = `🚗 Llega en ~${rutaOsrm.duracionMin} min`;
  else etaTexto = "Calculando…";

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-taco underline">
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Mapa a pantalla completa */}
      <div className="flex-1 min-h-0 relative">
        <MapaSeguimiento
          fill
          conductorLat={viaje?.conductor_lat}
          conductorLng={viaje?.conductor_lng}
          embarque={
            viaje
              ? { lat: viaje.embarque_lat, lng: viaje.embarque_lng, direccion: viaje.embarque_direccion }
              : null
          }
          geometria={rutaOsrm?.geometria}
        />

        {/* Botón volver flotante */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 z-[1000] bg-white shadow-md rounded-full w-10 h-10 flex items-center justify-center text-xl text-gray-700"
          aria-label="Volver"
        >
          ←
        </button>

        {/* ETA grande arriba */}
        <div
          className={`absolute top-3 left-1/2 -translate-x-1/2 z-[1000] rounded-full px-4 py-2 text-sm font-semibold shadow-md whitespace-nowrap ${
            enCurso ? "bg-green-600 text-white" : "bg-white text-gray-700"
          }`}
        >
          {enCurso && <span className="inline-block w-2 h-2 rounded-full bg-white/90 animate-pulse mr-2 align-middle"></span>}
          {etaTexto}
        </div>
      </div>

      {/* Tarjeta inferior con el conductor y acciones */}
      <div className="bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.1)] px-4 pt-4 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center text-lg flex-shrink-0">
            🧑
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{otra?.nombre || "Tu conductor"}</p>
            {viaje?.embarque_direccion && (
              <p className="text-xs text-gray-500 truncate">Subes en: {viaje.embarque_direccion}</p>
            )}
          </div>
          {enCurso && rutaOsrm && (
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-bold text-green-700 leading-none">~{rutaOsrm.duracionMin} min</p>
              <p className="text-[11px] text-gray-500">{rutaOsrm.distanciaKm} km</p>
            </div>
          )}
        </div>

        <Link
          to={`/chat/${solicitudId}`}
          className="mt-4 block text-center bg-taco text-white rounded-xl py-3 font-semibold"
        >
          💬 Enviar mensaje
        </Link>

        {!enCurso && (
          <p className="text-[11px] text-gray-500 text-center mt-2 leading-snug">
            Cuando el conductor inicie el viaje, aquí verás su auto acercándose en el mapa y cuánto
            falta para que llegue a tu punto de subida.
          </p>
        )}
      </div>
    </div>
  );
}
