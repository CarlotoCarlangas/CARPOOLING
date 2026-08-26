import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../services/api";
import MapaVistaRuta from "../components/MapaVistaRuta";

const DIA_LABEL = {
  lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves",
  viernes: "Viernes", sabado: "Sábado", domingo: "Domingo",
};

export default function DetalleRuta() {
  const { id } = useParams();
  const [ruta, setRuta] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.detalleRuta(id).then(setRuta).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-red-600 text-center mt-8">{error}</p>;
  if (!ruta) return <p className="text-center mt-8">Cargando...</p>;

  return (
    <div className="max-w-2xl mx-auto p-6 my-6">
      <Link to="/rutas" className="text-sm text-taco underline">← Volver al listado</Link>

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

        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
          Precio del viaje: <b className="text-taco">${ruta.precio_pasajero.toLocaleString("es-CL")}</b>
          <span className="text-gray-500"> (incluye comisión de plataforma)</span>
        </div>

        <button
          disabled
          title="La reserva se habilita en el próximo módulo"
          className="w-full mt-4 bg-gray-300 text-gray-600 py-2 rounded-lg cursor-not-allowed"
        >
          Reservar cupo (próximamente)
        </button>
      </div>
    </div>
  );
}
