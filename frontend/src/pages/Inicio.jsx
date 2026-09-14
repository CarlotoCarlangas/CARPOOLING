import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useViaje } from "../context/ViajeContext";
import { useModo } from "../context/ModoContext";
import { api } from "../services/api";
import Avisos from "../components/Avisos";
import RebookRapido from "../components/RebookRapido";
import Copi from "../components/Copi";

// getDay(): 0 = domingo ... 6 = sábado. El navegador usa la hora local del
// dispositivo, que para el usuario ES hora de Chile — no hace falta convertir.
const DIAS_JS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

/**
 * Minutos hasta la PRÓXIMA salida de un viaje (recurrente), según su hora y
 * sus días. Sirve para ordenar los viajes en el inicio: el más próximo a
 * iniciar, primero. Si no se conocen los días, se usa solo la hora.
 */
function proximidadMin(horaSalida, dias) {
  if (!horaSalida) return Infinity;
  const [h, m] = horaSalida.split(":").map(Number);
  const ahora = new Date();
  for (let d = 0; d < 7; d++) {
    const f = new Date(ahora);
    f.setDate(ahora.getDate() + d);
    f.setHours(h, m, 0, 0);
    const dia = DIAS_JS[f.getDay()];
    if ((!dias || dias.length === 0 || dias.includes(dia)) && f > ahora) {
      return (f - ahora) / 60000;
    }
  }
  return Infinity;
}

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
      className={`rounded-2xl shadow-lg p-5 mb-3 border ${
        ruta.en_curso ? "border-green-500 bg-green-50" : "border-slate-100 bg-white"
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
            className="w-full bg-taco text-white py-3.5 rounded-xl font-bold text-lg shadow-sm disabled:opacity-40"
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

      <Link
        to={`/mi-viaje/${ruta.id}`}
        className="mt-3 block text-center bg-white border-2 border-taco text-taco rounded-xl py-2.5 font-semibold text-sm"
      >
        📍 Ver a mis pasajeros en el mapa
      </Link>
    </div>
  );
}

export default function Inicio() {
  const { estaAutenticado, usuario, token } = useAuth();
  const { rutaEnCursoId, iniciar, reanudar, finalizar } = useViaje();
  const { modo, esDual, setModo } = useModo();
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
        // En curso primero; luego por cercanía a la próxima salida.
        conEstado.sort(
          (a, b) =>
            Number(b.enCurso) - Number(a.enCurso) ||
            proximidadMin(a.solicitud.ruta.hora_salida) - proximidadMin(b.solicitud.ruta.hora_salida)
        );
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
    <div className="max-w-2xl mx-auto pb-6">
      {/* HERO inmersivo: el color de marca (azul pasajero / verde chofer) manda
          fuerte — degradado grande + tipografía enorme + círculos de profundidad.
          El contenido flota encima en tarjetas (se sube con -mt-12). */}
      <div className="relative overflow-hidden bg-gradient-to-b from-taco via-taco to-taco-deep text-white px-6 pt-12 pb-20 rounded-b-[2.5rem] shadow-xl">
        <div aria-hidden className="absolute -top-20 -right-16 w-60 h-60 rounded-full bg-white/10"></div>
        <div aria-hidden className="absolute top-8 -left-24 w-56 h-56 rounded-full bg-white/5"></div>
        <div className="relative">
          <p className="text-white/75 text-xs font-bold uppercase tracking-[0.25em] mb-3">
            Vecinos rumbo al trabajo
          </p>
          <h1 className="text-5xl font-black tracking-tight leading-none">Carpooling</h1>
          <p className="text-white/90 text-base mt-4 leading-snug max-w-sm">
            Comparte tu viaje al trabajo. Menos gasto, menos autos, más comunidad.
          </p>
        </div>
      </div>

      <div className="px-5 -mt-12 relative z-10">
      {!estaAutenticado ? (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-5 space-y-3">
          <Link
            to="/registro"
            className="block text-center bg-taco text-white px-5 py-3.5 rounded-xl font-bold text-base shadow-sm"
          >
            Crear cuenta
          </Link>
          <Link
            to="/login"
            className="block text-center bg-slate-100 text-slate-800 px-5 py-3 rounded-xl font-semibold"
          >
            Ya tengo cuenta
          </Link>
        </div>
      ) : (
        <>
          {/* Centro de avisos: recordatorios de salida (30/10/5 min) y aviso
              de "viaje iniciado". Solo aparece si hay algo activo. */}
          <Avisos />

          {/* Acceso directo al panel de administración — solo para el dueño
              (es_admin). Va arriba de todo para que lo tenga a mano. */}
          {usuario?.es_admin && (
            <Link
              to="/admin"
              className="block bg-gradient-to-br from-slate-900 to-blue-900 text-white rounded-2xl p-4 mb-5 shadow-flotante"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-blue-300/80">Administración</p>
              <p className="text-lg font-bold leading-tight mt-0.5">Panel de control 🛠️</p>
              <p className="text-white/70 text-sm mt-1">
                Todos los usuarios, rutas y el estado de la plataforma.
              </p>
            </Link>
          )}

          {/* Interruptor Chofer/Pasajero — solo para quien tiene ambos roles.
              Cambia el color de marca (azul↔verde) y el contenido; la
              disposición se mantiene. */}
          {esDual && (
            <div className="flex bg-slate-100 rounded-2xl p-1 mb-5">
              <button
                onClick={() => setModo("pasajero")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                  modo === "pasajero" ? "bg-white text-taco shadow-sm" : "text-slate-500"
                }`}
              >
                🧍 Pasajero
              </button>
              <button
                onClick={() => setModo("chofer")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                  modo === "chofer" ? "bg-white text-taco shadow-sm" : "text-slate-500"
                }`}
              >
                🚗 Chofer
              </button>
            </div>
          )}

          {/* CONDUCTOR: su viaje con inicio/fin */}
          {esConductor && modo === "chofer" && (
            <div className="mb-6">
              {cargando && misRutas.length === 0 && (
                <p className="text-sm text-gray-500 text-center">Cargando tu viaje...</p>
              )}
              {!cargando && misRutas.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-6 text-center border-2 border-gray-100">
                  <Copi pose="duerme" size={92} className="mx-auto mb-1" />
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
              {[...misRutas]
                .sort(
                  (a, b) =>
                    (b.en_curso ? 1 : 0) - (a.en_curso ? 1 : 0) ||
                    proximidadMin(a.hora_salida, a.dias_recurrencia) -
                      proximidadMin(b.hora_salida, b.dias_recurrencia)
                )
                .map((ruta) => (
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
          {esPasajero && modo === "pasajero" && misViajes.length > 0 && (
            <div className="mb-6 space-y-3">
              {misViajes.map(({ solicitud: s, enCurso }) => (
                <Link
                  key={s.id}
                  to={`/viaje/${s.id}`}
                  className={`block rounded-2xl p-5 shadow-lg border transition ${
                    enCurso ? "border-green-500 bg-green-50" : "border-slate-100 bg-white"
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
                  <span className="mt-3 inline-block bg-taco text-white rounded-xl px-4 py-2 text-sm font-semibold">
                    📍 Ver en vivo en el mapa
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* #7 · Volver a tomar un viaje ya tomado (se auto-oculta si no hay). */}
          {modo === "pasajero" && <RebookRapido />}

          {/* La navegación general está en la barra inferior; acá solo el CTA
              central del modo pasajero (su acción principal: buscar viaje). */}
          {modo === "pasajero" && (
            <Link
              to="/buscar"
              className="block text-center bg-taco text-white px-5 py-3.5 rounded-xl font-semibold shadow-sm"
            >
              🔍 Buscar un viaje
            </Link>
          )}
        </>
      )}
      </div>
    </div>
  );
}
