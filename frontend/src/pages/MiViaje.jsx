import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { calcularRuta } from "../services/osrm";
import MapaConductor from "../components/MapaConductor";

/**
 * Pantalla del CONDUCTOR durante el viaje (mapa-first, igual que el pasajero
 * pero al revés): ve su propia ubicación y los puntos de subida de todos los
 * pasajeros que le reservaron esta ruta, con la distancia/ETA real a cada uno
 * (OSRM), ordenados del más cercano al más lejano.
 */
export default function MiViaje() {
  const { rutaId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [pasajeros, setPasajeros] = useState([]);
  const [pos, setPos] = useState(null);
  const [etas, setEtas] = useState({});
  const [resaltadoId, setResaltadoId] = useState(null);
  const [error, setError] = useState("");
  const [geoError, setGeoError] = useState(false);
  const ultimaPosRef = useRef(null);

  // Pasajeros aceptados de esta ruta.
  useEffect(() => {
    api
      .solicitudesDeRuta(rutaId, token)
      .then((sols) => setPasajeros(sols.filter((s) => s.estado === "aceptada")))
      .catch((e) => setError(e.message));
  }, [rutaId, token]);

  // Ubicación propia del conductor (se actualiza mientras maneja).
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeoError(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ETA real por calles a cada pasajero, recalculada solo cuando el conductor
  // se movió de verdad (para no golpear OSRM en cada actualización de GPS).
  useEffect(() => {
    if (!pos || pasajeros.length === 0) return;
    const clave = `${pos.lat.toFixed(4)},${pos.lng.toFixed(4)}`;
    if (ultimaPosRef.current === clave) return;
    ultimaPosRef.current = clave;
    pasajeros.forEach((s) => {
      calcularRuta([
        { lat: pos.lat, lng: pos.lng },
        { lat: s.embarque_lat, lng: s.embarque_lng },
      ])
        .then((r) => setEtas((prev) => ({ ...prev, [s.id]: { km: r.distanciaKm, min: r.duracionMin } })))
        .catch(() => {});
    });
  }, [pos, pasajeros]);

  const ordenados = [...pasajeros].sort(
    (a, b) => (etas[a.id]?.min ?? Infinity) - (etas[b.id]?.min ?? Infinity)
  );

  const puntosMapa = pasajeros.map((s) => ({
    id: s.id,
    lat: s.embarque_lat,
    lng: s.embarque_lng,
    nombre: s.pasajero.nombre,
    direccion: s.embarque_direccion,
  }));

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-taco underline">Volver</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Mapa a pantalla completa */}
      <div className="flex-1 min-h-0 relative">
        <MapaConductor
          conductorPos={pos}
          pasajeros={puntosMapa}
          resaltadoId={resaltadoId}
          onClickPin={setResaltadoId}
        />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 z-[1000] bg-white shadow-md rounded-full w-10 h-10 flex items-center justify-center text-xl text-gray-700"
          aria-label="Volver"
        >
          ←
        </button>
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-green-600 text-white rounded-full px-4 py-2 text-sm font-semibold shadow-md whitespace-nowrap">
          {pasajeros.length === 0
            ? "Sin pasajeros por recoger"
            : `${pasajeros.length} pasajero${pasajeros.length > 1 ? "s" : ""} por recoger`}
        </div>
      </div>

      {/* Panel inferior: lista de pasajeros por cercanía */}
      <div className="bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.1)] px-4 pt-3 pb-4 flex-shrink-0 max-h-[42%] overflow-y-auto">
        {geoError && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">
            No pudimos acceder a tu ubicación. Activa el permiso de ubicación para ver a cuánto estás de cada pasajero.
          </p>
        )}
        {pasajeros.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Todavía no hay pasajeros con reserva aceptada en este viaje.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Pasajeros por recoger (más cercano primero)
            </p>
            {ordenados.map((s, i) => {
              const eta = etas[s.id];
              const num = pasajeros.findIndex((p) => p.id === s.id) + 1;
              return (
                <div
                  key={s.id}
                  onClick={() => setResaltadoId(s.id)}
                  className={`rounded-xl border p-3 flex items-center gap-3 cursor-pointer transition ${
                    resaltadoId === s.id ? "border-orange-500 bg-orange-50" : "border-gray-200"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {num}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{s.pasajero.nombre}</p>
                    <p className="text-xs text-gray-500 truncate">Sube en: {s.embarque_direccion}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {eta ? (
                      <>
                        <p className="text-sm font-bold text-green-700 leading-none">~{eta.min} min</p>
                        <p className="text-[11px] text-gray-500">{eta.km} km</p>
                      </>
                    ) : (
                      <p className="text-[11px] text-gray-400">{pos ? "calculando…" : "sin ubicación"}</p>
                    )}
                  </div>
                  <Link
                    to={`/chat/${s.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 w-9 h-9 rounded-full bg-taco text-white flex items-center justify-center"
                    aria-label="Chat"
                  >
                    💬
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
