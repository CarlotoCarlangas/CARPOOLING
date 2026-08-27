import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { buscarDireccion, direccionDesdeCoordenadas } from "../services/geocoding";
import MapaBusqueda from "../components/MapaBusqueda";

const RADIO_DEFECTO_M = 600;
const RADIO_MAX_M = 3000;

function SelectorLado({ etiqueta, colorClase, comunas, comuna, setComuna, punto, setPunto, activo, activar }) {
  const [texto, setTexto] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (texto.trim().length < 3) {
      setSugerencias([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const resultados = await buscarDireccion(texto, comuna);
      setSugerencias(resultados);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [texto, comuna]);

  const elegirSugerencia = (s) => {
    setPunto(s);
    setTexto(s.direccion);
    setSugerencias([]);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <p className={`text-sm font-semibold mb-2 ${colorClase}`}>{etiqueta}</p>

      <select
        value={comuna}
        onChange={(e) => setComuna(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 mb-2 text-sm"
      >
        <option value="">Comuna...</option>
        {comunas.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <div className="relative">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe una dirección (opcional)"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        {sugerencias.length > 0 && (
          <ul className="absolute z-[1000] bg-white border rounded-lg shadow-md w-full mt-1 max-h-48 overflow-y-auto text-sm">
            {sugerencias.map((s, i) => (
              <li
                key={i}
                onClick={() => elegirSugerencia(s)}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              >
                {s.direccion}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={activar}
        className={`text-xs mt-2 underline ${activo ? "text-taco font-semibold" : "text-gray-500"}`}
      >
        {activo ? "Haciendo clic en el mapa..." : "o marcar en el mapa"}
      </button>

      {punto && (
        <p className="text-xs text-gray-500 mt-1">📍 {punto.direccion}</p>
      )}
    </div>
  );
}

export default function Buscar() {
  const [comunas, setComunas] = useState([]);
  const [comunaOrigen, setComunaOrigen] = useState("");
  const [comunaDestino, setComunaDestino] = useState("");
  const [puntoOrigen, setPuntoOrigen] = useState(null);
  const [puntoDestino, setPuntoDestino] = useState(null);
  const [radioOrigenM, setRadioOrigenM] = useState(RADIO_DEFECTO_M);
  const [radioDestinoM, setRadioDestinoM] = useState(RADIO_DEFECTO_M);
  const [ladoActivo, setLadoActivo] = useState(null);
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.comunasDisponibles().then(setComunas).catch(() => setComunas([]));
  }, []);

  useEffect(() => {
    const hayFiltroOrigen = comunaOrigen || puntoOrigen;
    const hayFiltroDestino = comunaDestino || puntoDestino;
    if (!hayFiltroOrigen || !hayFiltroDestino) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    setError("");
    api
      .buscarRutas({
        comuna_origen: puntoOrigen ? null : comunaOrigen,
        comuna_destino: puntoDestino ? null : comunaDestino,
        origen_lat: puntoOrigen?.lat,
        origen_lng: puntoOrigen?.lng,
        origen_radio_m: puntoOrigen ? radioOrigenM : null,
        destino_lat: puntoDestino?.lat,
        destino_lng: puntoDestino?.lng,
        destino_radio_m: puntoDestino ? radioDestinoM : null,
      })
      .then(setResultados)
      .catch((e) => setError(e.message))
      .finally(() => setBuscando(false));
  }, [comunaOrigen, comunaDestino, puntoOrigen, puntoDestino, radioOrigenM, radioDestinoM]);

  const alClicMapa = async (lat, lng) => {
    if (!ladoActivo) return;
    const { direccion, comuna } = await direccionDesdeCoordenadas(lat, lng);
    const punto = { lat, lng, direccion, comuna };
    if (ladoActivo === "origen") setPuntoOrigen(punto);
    else setPuntoDestino(punto);
    setLadoActivo(null);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 my-6">
      <h1 className="text-2xl font-bold mb-1">Buscar viaje</h1>
      <p className="text-sm text-gray-600 mb-4">
        Elige comuna de origen y destino. Si quieres afinar más, escribe una
        dirección o márcala en el mapa — vas a poder ampliar cuánto estás
        dispuesto/a a caminar.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <SelectorLado
          etiqueta="🟢 Tu origen"
          colorClase="text-green-700"
          comunas={comunas}
          comuna={comunaOrigen}
          setComuna={setComunaOrigen}
          punto={puntoOrigen}
          setPunto={setPuntoOrigen}
          activo={ladoActivo === "origen"}
          activar={() => setLadoActivo(ladoActivo === "origen" ? null : "origen")}
        />
        <SelectorLado
          etiqueta="🟠 Tu destino"
          colorClase="text-taco"
          comunas={comunas}
          comuna={comunaDestino}
          setComuna={setComunaDestino}
          punto={puntoDestino}
          setPunto={setPuntoDestino}
          activo={ladoActivo === "destino"}
          activar={() => setLadoActivo(ladoActivo === "destino" ? null : "destino")}
        />
      </div>

      {puntoOrigen && (
        <div className="bg-white rounded-lg shadow-sm p-3 mb-3 flex items-center gap-3">
          <span className="text-xs text-gray-600 w-56">🟢 Radio caminable en origen: {radioOrigenM} m</span>
          <input
            type="range"
            min={200}
            max={RADIO_MAX_M}
            step={100}
            value={radioOrigenM}
            onChange={(e) => setRadioOrigenM(Number(e.target.value))}
            className="flex-1"
          />
        </div>
      )}
      {puntoDestino && (
        <div className="bg-white rounded-lg shadow-sm p-3 mb-3 flex items-center gap-3">
          <span className="text-xs text-gray-600 w-56">🟠 Radio caminable en destino: {radioDestinoM} m</span>
          <input
            type="range"
            min={200}
            max={RADIO_MAX_M}
            step={100}
            value={radioDestinoM}
            onChange={(e) => setRadioDestinoM(Number(e.target.value))}
            className="flex-1"
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <MapaBusqueda
          rutas={resultados}
          circuloOrigen={puntoOrigen ? { ...puntoOrigen, radioM: radioOrigenM } : null}
          circuloDestino={puntoDestino ? { ...puntoDestino, radioM: radioDestinoM } : null}
          ladoActivo={ladoActivo}
          onClickMapa={alClicMapa}
        />
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {!comunaOrigen && !comunaDestino && !puntoOrigen && !puntoDestino && (
        <p className="text-center text-gray-500 text-sm">
          Elige al menos una comuna de origen y una de destino para ver viajes.
        </p>
      )}

      {buscando && <p className="text-center text-gray-500 text-sm">Buscando...</p>}

      {!buscando && resultados.length === 0 && (comunaOrigen || puntoOrigen) && (comunaDestino || puntoDestino) && (
        <p className="text-center text-gray-500 text-sm">
          No hay viajes que coincidan todavía.{" "}
          {(puntoOrigen || puntoDestino) && "Prueba ampliando el radio caminable arriba."}
        </p>
      )}

      <div className="space-y-2">
        {resultados.map((r) => (
          <Link
            key={r.id}
            to={`/rutas/${r.id}`}
            className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{r.origen_direccion}</p>
                <p className="text-sm text-gray-500">→ {r.destino_direccion}</p>
              </div>
              <span className="text-taco font-bold">${r.precio_pasajero.toLocaleString("es-CL")}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {r.conductor.nombre} — {r.cupos_disponibles} cupos — {r.hora_salida}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
