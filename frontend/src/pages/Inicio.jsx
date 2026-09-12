import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useViaje } from "../context/ViajeContext";
import { api } from "../services/api";

/**
 * Tarjeta grande del viaje del conductor, en la pantalla de Inicio: el chofer
 * ve su ruta y un botón claro para iniciar/finalizar el viaje, sin tener que
 * navegar a la página de detalle a buscarlo.
 */
function TarjetaViajeConductor({ ruta, ocupado, onIniciar, onFinalizar }) {
  const origen = ruta.origen_comuna || ruta.origen_direccion;
  const destino = ruta.destino_comuna || ruta.destino_direccion;
  return (
    <div
      className={`rounded-2xl shadow-sm p-5 mb-3 border-2 ${
        ruta.en_curso ? "border-green-500 bg-green-50" : "border-gray-100 bg-white"
      }`}
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
        Tu viaje
      </p>
      <h2 className="text-lg font-bold leading-snug text-gray-900">
        {origen} <span className="text-gray-400">→</span> {destino}
      </h2>
      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1.5 mb-4">
        <span>🕐 {ruta.hora_salida}</span>
        <span>💺 {ruta.cupos_disponibles}/{ruta.cupos_totales} cupos</span>
      </div>

      {ruta.en_curso ? (
        <>
          <p className="text-sm text-green-700 font-semibold flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-600 animate-pulse"></span>
            Compartiendo tu ubicación en vivo
          </p>
          <button
            onClick={onFinalizar}
            disabled={ocupado}
            className="w-full bg-gray-800 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-40"
          >
            Finalizar viaje
          </button>
          <p className="text-[11px] text-gray-500 mt-2 leading-snug">
            Mantén la app abierta mientras manejas. Tu ubicación se comparte solo durante el
            viaje y se deja de compartir al finalizar.
          </p>
        </>
      ) : (
        <>
          <button
            onClick={onIniciar}
            disabled={ocupado}
            className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold text-lg shadow-sm disabled:opacity-40"
          >
            🚗 Iniciar viaje
          </button>
          <p className="text-[11px] text-gray-500 mt-2 leading-snug">
            Al iniciar, el pasajero podrá ver en el mapa cuánto falta para que llegues a su punto
            de subida.
          </p>
          <Link
            to={`/rutas/${ruta.id}`}
            className="block text-center text-taco text-sm underline mt-2"
          >
            Ver detalle de la ruta
          </Link>
        </>
      )}
    </div>
  );
}

export default function Inicio() {
  const { estaAutenticado, usuario, token } = useAuth();
  const { rutaEnCursoId, iniciar, reanudar, finalizar } = useViaje();
  const [misRutas, setMisRutas] = useState([]);
  const [misViajes, setMisViajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  const esConductor = estaAutenticado && usuario?.es_conductor;
  const esPasajero = estaAutenticado && usuario?.es_pasajero;

  const cargarRutas = useCallback(() => {
    if (!esConductor) return;
    setCargando(true);
    api
      .rutasDeConductor(usuario.id)
      .then(setMisRutas)
      .catch(() => setMisRutas([]))
      .finally(() => setCargando(false));
  }, [esConductor, usuario?.id]);

  useEffect(() => {
    cargarRutas();
  }, [cargarRutas]);

  // Si el servidor dice que una ruta está en curso pero este navegador no está
  // compartiendo ubicación (ej. el chofer recargó la página), retomar el envío.
  useEffect(() => {
    const activa = misRutas.find((r) => r.en_curso);
    if (activa && rutaEnCursoId !== activa.id) reanudar(activa.id);
  }, [misRutas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pasajero: sus viajes aceptados + si el conductor ya va en camino, para
  // mostrar el acceso prominente "ver en vivo" apenas entra a la app.
  useEffect(() => {
    if (!esPasajero) return;
    let activo = true;
    api
      .misSolicitudes(token)
      .then(async (sols) => {
        const aceptadas = (sols || []).filter((s) => s.estado === "aceptada");
        const conEstado = await Promise.all(
          aceptadas.map((s) =>
            api
              .viajeDeSolicitud(s.id, token)
              .then((v) => ({ solicitud: s, enCurso: !!v.en_curso }))
              .catch(() => ({ solicitud: s, enCurso: false }))
          )
        );
        conEstado.sort((a, b) => Number(b.enCurso) - Number(a.enCurso));
        if (activo) setMisViajes(conEstado);
      })
      .catch(() => {
        if (activo) setMisViajes([]);
      });
    return () => {
      activo = false;
    };
  }, [esPasajero, token]);

  const accion = async (fn, rutaId) => {
    setOcupado(true);
    setError("");
    try {
      await fn(rutaId);
      cargarRutas();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 my-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-taco mb-1">Carpooling</h1>
        <p className="text-gray-600 text-sm">
          Comparte tu viaje diario Peñaflor → Santiago y ahorra en el trayecto.
        </p>
      </div>

      {!estaAutenticado ? (
        <div className="flex justify-center gap-3">
          <Link to="/registro" className="bg-taco text-white px-5 py-2.5 rounded-lg">
            Crear cuenta
          </Link>
          <Link to="/login" className="bg-gray-200 text-gray-800 px-5 py-2.5 rounded-lg">
            Ya tengo cuenta
          </Link>
        </div>
      ) : (
        <>
          {/* CONDUCTOR: su viaje con inicio/fin */}
          {esConductor && (
            <div className="mb-6">
              {cargando && misRutas.length === 0 && (
                <p className="text-sm text-gray-500 text-center">Cargando tu viaje...</p>
              )}
              {!cargando && misRutas.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-6 text-center border-2 border-gray-100">
                  <p className="text-gray-600 text-sm mb-3">
                    Todavía no has publicado una ruta.
                  </p>
                  <Link
                    to="/crear-ruta"
                    className="inline-block bg-taco text-white px-5 py-2.5 rounded-lg font-semibold"
                  >
                    Publicar mi ruta
                  </Link>
                </div>
              )}
              {misRutas.map((ruta) => (
                <TarjetaViajeConductor
                  key={ruta.id}
                  ruta={ruta}
                  ocupado={ocupado}
                  onIniciar={() => accion(iniciar, ruta.id)}
                  onFinalizar={() => accion(finalizar, ruta.id)}
                />
              ))}
              {error && <p className="text-red-600 text-sm mt-2 text-center">{error}</p>}
            </div>
          )}

          {/* PASAJERO: viaje aceptado / en camino — acceso directo al mapa en vivo */}
          {esPasajero && misViajes.length > 0 && (
            <div className="mb-6 space-y-3">
              {misViajes.map(({ solicitud: s, enCurso }) => (
                <Link
                  key={s.id}
                  to={`/viaje/${s.id}`}
                  className={`block rounded-2xl p-5 shadow-sm border-2 transition ${
                    enCurso ? "border-green-500 bg-green-50" : "border-gray-100 bg-white"
                  }`}
                >
                  {enCurso ? (
                    <p className="text-sm font-semibold text-green-700 flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-600 animate-pulse"></span>
                      Tu conductor va en camino
                    </p>
                  ) : (
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      Tu próximo viaje
                    </p>
                  )}
                  <h2 className="text-lg font-bold leading-snug text-gray-900">
                    {s.ruta.origen_direccion} <span className="text-gray-400">→</span>{" "}
                    {s.ruta.destino_direccion}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Conductor: {s.ruta.conductor.nombre} · 🕐 {s.ruta.hora_salida}
                  </p>
                  <span className="mt-3 inline-block bg-green-600 text-white rounded-xl px-4 py-2 text-sm font-semibold">
                    📍 Ver en vivo en el mapa
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Accesos rápidos según el rol */}
          <div className="flex flex-wrap justify-center gap-3">
            {esConductor && (
              <Link
                to="/crear-ruta"
                className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm"
              >
                Publicar otra ruta
              </Link>
            )}
            {esConductor && (
              <Link
                to="/solicitudes"
                className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm"
              >
                Ver solicitudes
              </Link>
            )}
            {esPasajero && (
              <Link to="/buscar" className="bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm">
                Buscar un viaje
              </Link>
            )}
            {esPasajero && (
              <Link
                to="/mis-reservas"
                className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm"
              >
                Mis reservas
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
