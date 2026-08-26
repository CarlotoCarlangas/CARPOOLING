import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import MapaSeleccionRuta from "../components/MapaSeleccionRuta";

const DIAS = [
  { valor: "lunes", label: "Lun" },
  { valor: "martes", label: "Mar" },
  { valor: "miercoles", label: "Mié" },
  { valor: "jueves", label: "Jue" },
  { valor: "viernes", label: "Vie" },
  { valor: "sabado", label: "Sáb" },
  { valor: "domingo", label: "Dom" },
];

export default function CrearRuta() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [rutaGeo, setRutaGeo] = useState(null);
  const [cupos, setCupos] = useState(3);
  const [precio, setPrecio] = useState(2000);
  const [hora, setHora] = useState("08:00");
  const [dias, setDias] = useState(["lunes", "martes", "miercoles", "jueves", "viernes"]);
  const [soloMujeres, setSoloMujeres] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [publicada, setPublicada] = useState(null);

  const alternarDia = (valor) => {
    setDias((prev) => (prev.includes(valor) ? prev.filter((d) => d !== valor) : [...prev, valor]));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");

    if (!rutaGeo) {
      setError("Primero traza la ruta en el mapa (origen, destino y calcula la ruta)");
      return;
    }
    if (dias.length === 0) {
      setError("Selecciona al menos un día de recurrencia");
      return;
    }

    setEnviando(true);
    try {
      const nueva = await api.crearRuta(
        {
          origen: rutaGeo.origen,
          destino: rutaGeo.destino,
          paradas: rutaGeo.paradas,
          geometria: rutaGeo.geometria,
          distancia_km: rutaGeo.distanciaKm,
          duracion_min: rutaGeo.duracionMin,
          cupos_totales: Number(cupos),
          precio_sugerido: Number(precio),
          hora_salida: hora,
          dias_recurrencia: dias,
          modo_solo_mujeres: soloMujeres,
        },
        token
      );
      setPublicada(nueva);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (publicada) {
    return (
      <div className="max-w-xl mx-auto p-6 bg-white rounded-lg shadow-sm my-6 text-center">
        <h1 className="text-2xl font-bold mb-2">¡Ruta publicada! 🎉</h1>
        <p className="text-gray-600 mb-4">
          Tu ruta de {publicada.origen_direccion} a {publicada.destino_direccion} ya está
          visible para pasajeros.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => navigate("/rutas")}
            className="bg-taco text-white px-4 py-2 rounded-lg"
          >
            Ver listado de rutas
          </button>
          <button
            onClick={() => {
              setPublicada(null);
              setRutaGeo(null);
            }}
            className="bg-gray-200 px-4 py-2 rounded-lg"
          >
            Publicar otra ruta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 my-6">
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <h1 className="text-2xl font-bold mb-1">Publicar ruta</h1>
        <p className="text-sm text-gray-600 mb-4">
          Haz clic en el mapa: primero el origen, luego el destino, y si quieres, más
          clics agregan paradas intermedias. Después presiona "Calcular ruta por calles".
        </p>
        <MapaSeleccionRuta onRutaLista={setRutaGeo} />
      </div>

      <form onSubmit={enviar} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Cupos disponibles</label>
            <input
              type="number"
              min={1}
              max={8}
              value={cupos}
              onChange={(e) => setCupos(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Precio sugerido (CLP)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              El pasajero pagará ${Math.round(Number(precio || 0) * 1.1).toLocaleString("es-CL")} (incluye comisión de plataforma).
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Hora de salida</label>
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Días en que haces este viaje</label>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((d) => (
              <button
                key={d.valor}
                type="button"
                onClick={() => alternarDia(d.valor)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  dias.includes(d.valor)
                    ? "bg-taco text-white border-taco"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={soloMujeres}
            onChange={(e) => setSoloMujeres(e.target.checked)}
          />
          Marcar este viaje como "solo mujeres"
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-taco text-white py-2 rounded-lg font-medium hover:bg-taco-dark disabled:opacity-50"
        >
          {enviando ? "Publicando..." : "Publicar ruta"}
        </button>
      </form>
    </div>
  );
}
