import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { direccionDesdeCoordenadas } from "../services/geocoding";
import MapaEditarParadas from "../components/MapaEditarParadas";

const DIAS = [
  { valor: "lunes", label: "Lun" },
  { valor: "martes", label: "Mar" },
  { valor: "miercoles", label: "Mié" },
  { valor: "jueves", label: "Jue" },
  { valor: "viernes", label: "Vie" },
  { valor: "sabado", label: "Sáb" },
  { valor: "domingo", label: "Dom" },
];

export default function EditarRuta() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario, token } = useAuth();

  const [ruta, setRuta] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Campos editables
  const [apodo, setApodo] = useState("");
  const [cupos, setCupos] = useState(3);
  const [precio, setPrecio] = useState(2000);
  const [hora, setHora] = useState("08:00");
  const [dias, setDias] = useState([]);
  const [soloMujeres, setSoloMujeres] = useState(false);
  const [paradas, setParadas] = useState([]);

  useEffect(() => {
    api
      .detalleRuta(id)
      .then((r) => {
        setRuta(r);
        setApodo(r.apodo || "");
        setCupos(r.cupos_totales);
        setPrecio(r.precio_sugerido);
        setHora(r.hora_salida);
        setDias(r.dias_recurrencia || []);
        setSoloMujeres(r.modo_solo_mujeres);
        setParadas((r.paradas || []).map((p) => ({ lat: p.lat, lng: p.lng, direccion: p.direccion, comuna: p.comuna })));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-red-600 text-center mt-8">{error}</p>;
  if (!ruta) return <p className="text-center mt-8">Cargando...</p>;

  if (usuario?.id !== ruta.conductor.id) {
    return (
      <div className="max-w-2xl mx-auto p-6 my-10 text-center">
        <p className="text-gray-600">Esta ruta no es tuya, no puedes editarla.</p>
        <Link to="/mis-viajes" className="text-taco underline mt-3 inline-block">← Volver a mis viajes</Link>
      </div>
    );
  }

  const alternarDia = (v) =>
    setDias((prev) => (prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v]));

  const agregarParada = async (lat, lng) => {
    const { direccion, comuna } = await direccionDesdeCoordenadas(lat, lng);
    setParadas((prev) => [...prev, { lat, lng, direccion, comuna }]);
  };

  const quitarParada = (i) => setParadas((prev) => prev.filter((_, idx) => idx !== i));

  const guardar = async (e) => {
    e.preventDefault();
    setError("");
    if (dias.length === 0) {
      setError("Selecciona al menos un día.");
      return;
    }
    setGuardando(true);
    try {
      await api.editarRuta(
        id,
        {
          apodo,
          cupos_totales: Number(cupos),
          precio_sugerido: Number(precio),
          hora_salida: hora,
          dias_recurrencia: dias,
          modo_solo_mujeres: soloMujeres,
          paradas,
        },
        token
      );
      navigate("/mis-viajes");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 my-6">
      <Link to="/mis-viajes" className="text-sm text-taco underline">← Volver a mis viajes</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Editar viaje</h1>

      {/* Origen y destino FIJOS — no se editan, pero se muestran siempre. */}
      <div className="bg-slate-50 rounded-xl p-3 my-3 text-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Recorrido (fijo)</p>
        <p className="font-semibold text-gray-800">
          {ruta.origen_comuna || ruta.origen_direccion} <span className="text-gray-400">→</span>{" "}
          {ruta.destino_comuna || ruta.destino_direccion}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          El origen y el destino no se cambian acá. Si tu recorrido cambió, publica una ruta nueva.
        </p>
      </div>

      <form onSubmit={guardar} className="bg-white rounded-2xl shadow-card p-5 space-y-4 border border-slate-100">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre del viaje (apodo)</label>
          <input
            value={apodo}
            onChange={(e) => setApodo(e.target.value)}
            placeholder='Ej. "Turno mañana", "Vuelta del trabajo"'
            maxLength={60}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Opcional. Te ayuda a distinguir entre tus viajes.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Cupos</label>
            <input
              type="number" min={1} max={8} value={cupos}
              onChange={(e) => setCupos(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Precio (CLP)</label>
            <input
              type="number" min={0} step={100} value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Pasajero paga ${Math.round(Number(precio || 0) * 1.1).toLocaleString("es-CL")}.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Hora de salida</label>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Días</label>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((d) => (
              <button
                key={d.valor} type="button" onClick={() => alternarDia(d.valor)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  dias.includes(d.valor) ? "bg-taco text-white border-taco" : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soloMujeres} onChange={(e) => setSoloMujeres(e.target.checked)} />
          Viaje "solo mujeres"
        </label>

        {/* Paradas */}
        <div>
          <label className="block text-sm font-medium mb-1">Paradas ({paradas.length})</label>
          <p className="text-xs text-gray-500 mb-2">Toca el mapa para agregar una parada. La ruta se muestra en azul.</p>
          <MapaEditarParadas geometria={ruta.geometria} paradas={paradas} onClickMapa={agregarParada} />
          {paradas.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {paradas.map((p, i) => (
                <li key={i} className="flex justify-between items-center gap-2">
                  <span className="truncate"><b className="text-ambar">Parada {i + 1}:</b> {p.direccion}</span>
                  <button type="button" onClick={() => quitarParada(i)} className="text-red-600 hover:underline shrink-0">
                    quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={guardando}
          className="w-full bg-taco text-white py-3 rounded-xl font-bold disabled:opacity-40"
        >
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
