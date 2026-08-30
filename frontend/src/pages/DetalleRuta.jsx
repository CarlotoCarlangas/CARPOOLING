import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import MapaVistaRuta from "../components/MapaVistaRuta";

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

  // El punto de embarque viene del paso 4 del buscador (elegido entre las
  // paradas reales del viaje). Si no está — porque se llegó acá por otra
  // vía, ej. el link de "mi ruta publicada" del conductor — no hay cómo
  // reservar desde esta pantalla.
  const embarque = location.state?.embarque;

  useEffect(() => {
    api.detalleRuta(id).then(setRuta).catch((e) => setError(e.message));
  }, [id]);

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
          <Link
            to="/solicitudes"
            className="block w-full mt-4 bg-gray-800 text-white text-center py-2 rounded-lg"
          >
            Ver solicitudes de este viaje
          </Link>
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
