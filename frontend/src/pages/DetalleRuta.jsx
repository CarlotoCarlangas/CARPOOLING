import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import MapaVistaRuta from "../components/MapaVistaRuta";

// Cada cuántos milisegundos el navegador del conductor manda su posición
// mientras el viaje está en curso. Un intervalo corto da un mapa más fluido
// para el pasajero, pero gasta más batería y datos — 8s es un compromiso
// razonable para el prototipo.
const INTERVALO_UBICACION_MS = 8000;

const DIA_LABEL = {
  lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves",
  viernes: "Viernes", sabado: "Sábado", domingo: "Domingo",
};

export default function DetalleRuta() {
  const { id } = useParams();
  const location = useLocation();
  const { usuario, token, estaAutenticado } = useAuth();
  const [ruta, setRuta] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorReserva, setErrorReserva] = useState("");
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [cambiandoViaje, setCambiandoViaje] = useState(false);
  const [errorViaje, setErrorViaje] = useState("");
  const intervaloUbicacionRef = useRef(null);

  // El punto de embarque viene del paso 4 del buscador (elegido entre las
  // paradas reales del viaje). Si no está — porque se llegó acá por otra
  // vía, ej. el link de "mi ruta publicada" del conductor — no hay cómo
  // reservar desde esta pantalla.
  const embarque = location.state?.embarque;

  useEffect(() => {
    api.detalleRuta(id).then(setRuta).catch((e) => setError(e.message));
  }, [id]);

  // Si el conductor cierra esta pantalla con el viaje en curso, hay que
  // dejar de mandar ubicación desde ESTE navegador (no tiene sentido
  // seguir el setInterval si ya no está viendo la pantalla) — el viaje
  // sigue "en_curso" en el servidor hasta que vuelva y lo finalice.
  useEffect(() => {
    return () => {
      if (intervaloUbicacionRef.current) clearInterval(intervaloUbicacionRef.current);
    };
  }, []);

  if (error) return <p className="text-red-600 text-center mt-8">{error}</p>;
  if (!ruta) return <p className="text-center mt-8">Cargando...</p>;

  const esMiPropiaRuta = usuario?.id === ruta.conductor.id;

  const reservar = async () => {
    setEnviando(true);
    setErrorReserva("");
    try {
      await api.crearSolicitud({ ruta_id: ruta.id, embarque }, token);
      setSolicitudEnviada(true);
    } catch (e) {
      setErrorReserva(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const mandarUbicacionActual = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        api.actualizarUbicacion(ruta.id, pos.coords.latitude, pos.coords.longitude, token).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const iniciarViaje = async () => {
    setCambiandoViaje(true);
    setErrorViaje("");
    try {
      const actualizada = await api.iniciarViaje(ruta.id, token);
      setRuta(actualizada);
      mandarUbicacionActual();
      intervaloUbicacionRef.current = setInterval(mandarUbicacionActual, INTERVALO_UBICACION_MS);
    } catch (e) {
      setErrorViaje(e.message);
    } finally {
      setCambiandoViaje(false);
    }
  };

  const finalizarViaje = async () => {
    setCambiandoViaje(true);
    setErrorViaje("");
    try {
      if (intervaloUbicacionRef.current) clearInterval(intervaloUbicacionRef.current);
      intervaloUbicacionRef.current = null;
      const actualizada = await api.finalizarViaje(ruta.id, token);
      setRuta(actualizada);
    } catch (e) {
      setErrorViaje(e.message);
    } finally {
      setCambiandoViaje(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 my-6">
      <Link to="/buscar" className="text-sm text-taco underline">← Volver a la búsqueda</Link>

      <div className="bg-white rounded-lg shadow-sm p-6 mt-3">
        <h1 className="text-2xl font-bold mb-1">
          {ruta.origen_direccion} → {ruta.destino_direccion}
        </h1>
        <p className="text-gray-500 text-sm mb-4">Conductor: {ruta.conductor.nombre}</p>

        <MapaVistaRuta ruta={ruta} />

        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <p><b>Salida:</b> {ruta.hora_salida}</p>
          <p><b>Cupos:</b> {ruta.cupos_disponibles} / {ruta.cupos_totales}</p>
          <p><b>Días:</b> {ruta.dias_recurrencia.map((d) => DIA_LABEL[d] || d).join(", ")}</p>
          {ruta.distancia_km && <p><b>Distancia:</b> {ruta.distancia_km} km</p>}
          {ruta.duracion_min && <p><b>Duración:</b> ~{ruta.duracion_min} min</p>}
          {ruta.modo_solo_mujeres && <p className="col-span-2">🚺 Viaje marcado como solo mujeres</p>}
        </div>

        {embarque && (
          <div className="mt-4 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-600 flex-shrink-0"></span>
            <span className="truncate"><span className="text-gray-500">Subes en: </span>{embarque.direccion}</span>
          </div>
        )}

        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
          Precio del viaje: <b className="text-taco">${ruta.precio_pasajero.toLocaleString("es-CL")}</b>
          <span className="text-gray-500"> (incluye comisión de plataforma)</span>
        </div>

        {esMiPropiaRuta ? (
          <>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              {ruta.en_curso ? (
                <>
                  <p className="text-sm text-green-700 font-semibold flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
                    Compartiendo tu ubicación en vivo
                  </p>
                  <button
                    onClick={finalizarViaje}
                    disabled={cambiandoViaje}
                    className="w-full bg-gray-800 text-white py-2 rounded-lg font-semibold disabled:opacity-40"
                  >
                    Finalizar viaje
                  </button>
                </>
              ) : (
                <button
                  onClick={iniciarViaje}
                  disabled={cambiandoViaje}
                  className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold disabled:opacity-40"
                >
                  🚗 Iniciar viaje
                </button>
              )}
              {errorViaje && <p className="text-red-600 text-xs mt-2">{errorViaje}</p>}
              <p className="text-[11px] text-gray-400 mt-2">
                Mantén esta pantalla abierta mientras manejas: tu ubicación se comparte solo mientras
                el navegador esté activo acá.
              </p>
            </div>
            <Link
              to="/solicitudes"
              className="block w-full mt-3 bg-white border border-gray-300 text-gray-700 text-center py-2 rounded-lg font-semibold"
            >
              Ver solicitudes de este viaje
            </Link>
          </>
        ) : solicitudEnviada ? (
          <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3 py-2.5 text-center">
            Solicitud enviada — pendiente de que el conductor la acepte.{" "}
            <Link to="/mis-reservas" className="underline font-semibold">Ver mis reservas</Link>
          </div>
        ) : !estaAutenticado ? (
          <Link
            to="/login"
            className="block w-full mt-4 bg-taco text-white text-center py-2 rounded-lg"
          >
            Inicia sesión para reservar
          </Link>
        ) : !embarque ? (
          <p className="mt-4 text-center text-sm text-gray-500">
            Para reservar, elige este viaje desde{" "}
            <Link to="/buscar" className="text-taco underline">el buscador</Link> — ahí eliges dónde subir.
          </p>
        ) : (
          <>
            <button
              onClick={reservar}
              disabled={enviando || ruta.cupos_disponibles <= 0}
              className="w-full mt-4 bg-taco text-white py-2 rounded-lg font-semibold disabled:opacity-40"
            >
              {ruta.cupos_disponibles <= 0
                ? "Sin cupos disponibles"
                : enviando
                ? "Enviando..."
                : "Reservar cupo"}
            </button>
            {errorReserva && <p className="text-red-600 text-sm mt-2">{errorReserva}</p>}
          </>
        )}
      </div>
    </div>
  );
}
