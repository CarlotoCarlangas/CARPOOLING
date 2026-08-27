import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { buscarDireccion, direccionDesdeCoordenadas } from "../services/geocoding";
import MapaBusqueda from "../components/MapaBusqueda";

const RADIO_DEFECTO_M = 600;
const RADIO_MAX_M = 3000;

/**
 * Selector de origen: comuna + opcionalmente dirección o marcar en el mapa
 * (esto último habilita el círculo de radio caminable ajustable).
 */
function SelectorOrigen({ comunas, comuna, setComuna, punto, setPunto, activo, activar }) {
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
      <p className="text-sm font-semibold mb-2 text-green-700">🟢 Tu origen</p>

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

      {punto && <p className="text-xs text-gray-500 mt-1">📍 {punto.direccion}</p>}
    </div>
  );
}

/**
 * Selector de destino: solo comuna. Sin dirección ni radio — al llegar a
 * una comuna urbana bien conectada, el pasajero prefiere ver todos los
 * pines disponibles y elegir directamente el que le convenga. La dirección
 * es solo para que el mapa haga zoom a esa zona (clustering + zoom in/out
 * hacen el resto) — a diferencia del origen, acá NO hay radio caminable:
 * al llegar a una comuna urbana bien conectada, no acotamos con un círculo,
 * el pasajero simplemente elige entre los pines que ve.
 */
function SelectorDestino({ comunas, comuna, setComuna, onEnfocar }) {
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
    setTexto(s.direccion);
    setSugerencias([]);
    onEnfocar(s);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <p className="text-sm font-semibold mb-2 text-taco">🟠 Tu destino</p>
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
          placeholder="Escribe una dirección para hacer zoom (opcional)"
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

      <p className="text-xs text-gray-500 mt-2">
        Vas a ver todos los puntos de esa comuna en el mapa (acércate o aléjate
        para ver más o menos) y eliges el que más te sirva.
      </p>
    </div>
  );
}

export default function Buscar() {
  const [comunas, setComunas] = useState([]);
  const [comunaOrigen, setComunaOrigen] = useState("");
  const [comunaDestino, setComunaDestino] = useState("");
  const [puntoOrigen, setPuntoOrigen] = useState(null);
  const [radioOrigenM, setRadioOrigenM] = useState(RADIO_DEFECTO_M);
  const [enfoqueDestino, setEnfoqueDestino] = useState(null);
  const [ladoActivo, setLadoActivo] = useState(null);
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.comunasDisponibles().then(setComunas).catch(() => setComunas([]));
  }, []);

  useEffect(() => {
    const hayFiltroOrigen = comunaOrigen || puntoOrigen;
    const hayFiltroDestino = comunaDestino;
    // Ya no se exige tener AMBOS lados elegidos: apenas el pasajero marca
    // uno solo (origen o destino), se buscan y muestran las rutas que
    // calzan con ese lado — así puede ir explorando de a poco en vez de
    // completar todo el formulario primero.
    if (!hayFiltroOrigen && !hayFiltroDestino) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    setError("");
    api
      .buscarRutas({
        comuna_origen: puntoOrigen ? null : comunaOrigen,
        comuna_destino: comunaDestino,
        origen_lat: puntoOrigen?.lat,
        origen_lng: puntoOrigen?.lng,
        origen_radio_m: puntoOrigen ? radioOrigenM : null,
      })
      .then(setResultados)
      .catch((e) => setError(e.message))
      .finally(() => setBuscando(false));
  }, [comunaOrigen, comunaDestino, puntoOrigen, radioOrigenM]);

  const alClicMapa = async (lat, lng) => {
    if (ladoActivo !== "origen") return;
    const { direccion, comuna } = await direccionDesdeCoordenadas(lat, lng);
    setPuntoOrigen({ lat, lng, direccion, comuna });
    setLadoActivo(null);
  };

  const hayAlgunFiltro = comunaOrigen || puntoOrigen || comunaDestino;

  return (
    <div className="max-w-6xl mx-auto p-6 my-6">
      <h1 className="text-2xl font-bold mb-1">Buscar viaje</h1>
      <p className="text-sm text-gray-600 mb-4">
        Elige comuna de origen y/o destino — con solo una ya vas a ver opciones
        en el mapa. En el origen puedes afinar más con una dirección o
        marcándola en el mapa; en el destino, simplemente eliges entre los
        puntos disponibles.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <SelectorOrigen
          comunas={comunas}
          comuna={comunaOrigen}
          setComuna={setComunaOrigen}
          punto={puntoOrigen}
          setPunto={setPuntoOrigen}
          activo={ladoActivo === "origen"}
          activar={() => setLadoActivo(ladoActivo === "origen" ? null : "origen")}
        />
        <SelectorDestino
          comunas={comunas}
          comuna={comunaDestino}
          setComuna={setComunaDestino}
          onEnfocar={setEnfoqueDestino}
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

      {!hayAlgunFiltro && (
        <p className="text-center text-gray-500 text-sm mb-3">
          Elige al menos una comuna (origen o destino) para ver viajes en el mapa.
        </p>
      )}

      {/* Mapa y opciones lado a lado: en pantallas angostas se apilan */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <MapaBusqueda
            rutas={resultados}
            circuloOrigen={puntoOrigen ? { ...puntoOrigen, radioM: radioOrigenM } : null}
            centrarEn={enfoqueDestino}
            ladoActivo={ladoActivo}
            onClickMapa={alClicMapa}
          />
        </div>

        <div className="lg:max-h-[420px] lg:overflow-y-auto space-y-2 pr-1">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {buscando && <p className="text-center text-gray-500 text-sm">Buscando...</p>}

          {!buscando && hayAlgunFiltro && resultados.length === 0 && (
            <p className="text-center text-gray-500 text-sm">
              No hay viajes que coincidan todavía.{" "}
              {puntoOrigen && "Prueba ampliando el radio caminable arriba."}
            </p>
          )}

          {resultados.map((r) => (
            <Link
              key={r.id}
              to={`/rutas/${r.id}`}
              className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition border border-gray-100"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{r.origen_direccion}</p>
                  <p className="text-sm text-gray-500">→ {r.destino_direccion}</p>
                </div>
                <span className="text-taco font-bold whitespace-nowrap">
                  ${r.precio_pasajero.toLocaleString("es-CL")}
                </span>
              </div>
              {r.paradas.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {r.paradas.length} parada{r.paradas.length === 1 ? "" : "s"} en el camino
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                🧑 {r.conductor.nombre} · 💺 {r.cupos_disponibles} cupos · 🕐 {r.hora_salida}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
