import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { buscarDireccion, direccionDesdeCoordenadas } from "../services/geocoding";
import { obtenerUbicacionActual } from "../services/geolocalizacion";
import MapaBusqueda from "../components/MapaBusqueda";

const RADIO_DEFECTO_M = 200;

function CampoDireccion({ placeholder, comuna, valor, setValor, sugerencias, setSugerencias, onElegir }) {
  const debounceRef = useRef(null);
  const [texto, setTexto] = useState(valor?.direccion || "");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (texto.trim().length < 3) {
      setSugerencias([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSugerencias(await buscarDireccion(texto, comuna));
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [texto, comuna]);

  const elegir = (s) => {
    setTexto(s.direccion);
    setSugerencias([]);
    onElegir(s);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-lg px-3 py-2.5 text-sm ${valor ? "border-taco" : "border-gray-300"}`}
      />
      {sugerencias.length > 0 && (
        <ul className="absolute z-20 bg-white border rounded-lg shadow-md w-full mt-1 max-h-48 overflow-y-auto text-sm">
          {sugerencias.map((s, i) => (
            <li key={i} onClick={() => elegir(s)} className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
              {s.direccion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PasoDestino({ comunas, comunaDestino, setComunaDestino, puntoDestino, setPuntoDestino, onContinuar }) {
  const [sugerencias, setSugerencias] = useState([]);

  return (
    <div className="max-w-md mx-auto p-6">
      <p className="text-xs font-bold text-taco uppercase tracking-wide">Paso 1 de 2</p>
      <h1 className="text-2xl font-bold mt-1 mb-5">¿A dónde quieres llegar?</h1>

      <select
        value={comunaDestino}
        onChange={(e) => setComunaDestino(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 mb-3 text-sm"
      >
        <option value="">Comuna de destino...</option>
        {comunas.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <CampoDireccion
        placeholder="Escribe tu dirección de destino"
        comuna={comunaDestino}
        valor={puntoDestino}
        sugerencias={sugerencias}
        setSugerencias={setSugerencias}
        onElegir={(s) => {
          setPuntoDestino(s);
          if (s.comuna) setComunaDestino(s.comuna);
        }}
      />

      <button
        onClick={onContinuar}
        disabled={!puntoDestino}
        className="w-full bg-taco text-white py-3 rounded-lg font-semibold mt-5 disabled:opacity-40"
      >
        Continuar · Elegir origen
      </button>
    </div>
  );
}

function PasoOrigen({
  comunas,
  puntoDestino,
  comunaOrigen,
  setComunaOrigen,
  puntoOrigen,
  setPuntoOrigen,
  onVolver,
  onContinuar,
}) {
  const [geoEstado, setGeoEstado] = useState(puntoOrigen ? "ok" : "buscando");
  const [manual, setManual] = useState(false);
  const [sugerencias, setSugerencias] = useState([]);

  useEffect(() => {
    if (puntoOrigen) return;
    obtenerUbicacionActual()
      .then(async ({ lat, lng }) => {
        const { direccion, comuna } = await direccionDesdeCoordenadas(lat, lng);
        setPuntoOrigen({ lat, lng, direccion, comuna });
        if (comuna) setComunaOrigen(comuna);
        setGeoEstado("ok");
      })
      .catch(() => {
        setGeoEstado("error");
        setManual(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onVolver} className="text-gray-500 text-lg" aria-label="Volver">←</button>
        <div>
          <p className="text-xs font-bold text-taco uppercase tracking-wide">Paso 2 de 2</p>
          <h1 className="text-xl font-bold">¿Desde dónde sales?</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm px-3 py-2.5 mb-4 text-sm">
        <span className="w-2 h-2 rounded-full bg-taco flex-shrink-0"></span>
        <span className="flex-1 truncate">
          <span className="text-gray-500">Destino: </span>
          {puntoDestino?.direccion}
        </span>
      </div>

      {!manual && (
        <div className="bg-white rounded-lg shadow-sm p-3 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 text-green-700">📍</div>
          <div className="flex-1 min-w-0">
            {geoEstado === "buscando" && <p className="text-sm text-gray-500">Buscando tu ubicación...</p>}
            {geoEstado === "ok" && (
              <>
                <p className="text-sm font-semibold truncate">Detectamos que estás en {comunaOrigen || "tu ubicación"}</p>
                <p className="text-xs text-gray-400 truncate">{puntoOrigen?.direccion}</p>
              </>
            )}
            {geoEstado === "error" && <p className="text-sm text-gray-500">No pudimos acceder a tu ubicación</p>}
          </div>
          <button onClick={() => setManual(true)} className="text-xs text-taco-dark font-semibold whitespace-nowrap">
            Cambiar
          </button>
        </div>
      )}

      {manual && (
        <div className="mb-4 space-y-2">
          <select
            value={comunaOrigen}
            onChange={(e) => setComunaOrigen(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
          >
            <option value="">Comuna de origen...</option>
            {comunas.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <CampoDireccion
            placeholder="Escribe tu dirección de origen"
            comuna={comunaOrigen}
            valor={puntoOrigen}
            sugerencias={sugerencias}
            setSugerencias={setSugerencias}
            onElegir={(s) => {
              setPuntoOrigen(s);
              if (s.comuna) setComunaOrigen(s.comuna);
            }}
          />
        </div>
      )}

      <button
        onClick={onContinuar}
        disabled={!puntoOrigen}
        className="w-full bg-taco text-white py-3 rounded-lg font-semibold disabled:opacity-40"
      >
        Ver viajes disponibles
      </button>
    </div>
  );
}

function TarjetaRuta({ ruta, seleccionada, onClick, onQuitar, onElegir }) {
  return (
    <div
      onClick={onClick}
      className={`flex-shrink-0 w-40 rounded-xl p-2.5 cursor-pointer border-2 transition ${
        seleccionada ? "bg-orange-50 border-taco" : "bg-gray-50 border-transparent hover:border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
            seleccionada ? "bg-orange-200" : "bg-gray-200"
          }`}
        >
          🧑
        </div>
        <p className="text-xs font-bold truncate">{ruta.conductor.nombre}</p>
      </div>
      <p className="text-[11px] text-gray-500 mt-1">
        ⭐ {ruta.conductor.calificacion_promedio ?? "—"} · {ruta.cupos_disponibles} cupos
      </p>
      <p className={`text-sm font-extrabold mt-1.5 ${seleccionada ? "text-taco" : "text-gray-800"}`}>
        ${ruta.precio_pasajero.toLocaleString("es-CL")}
      </p>
      {seleccionada && (
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuitar();
            }}
            className="flex-1 bg-white border border-gray-300 rounded-lg py-1 text-[11px] font-semibold text-gray-600"
          >
            Quitar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onElegir();
            }}
            className="flex-[1.4] bg-taco text-white rounded-lg py-1 text-[11px] font-bold"
          >
            Elegir
          </button>
        </div>
      )}
    </div>
  );
}

function RadioSlider({ etiqueta, valor, setValor, colorClase }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-3 mb-3">
      <div className="flex justify-between items-baseline text-xs mb-1">
        <span className="font-semibold text-gray-700">{etiqueta}</span>
        <span className={`font-bold ${colorClase}`}>{valor} m</span>
      </div>
      <input
        type="range"
        min={100}
        max={1000}
        step={50}
        value={valor}
        onChange={(e) => setValor(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default function Buscar() {
  const navigate = useNavigate();
  const [comunas, setComunas] = useState([]);
  const [paso, setPaso] = useState(1);

  const [comunaDestino, setComunaDestino] = useState("");
  const [puntoDestino, setPuntoDestino] = useState(null);
  const [radioDestinoM, setRadioDestinoM] = useState(RADIO_DEFECTO_M);

  const [comunaOrigen, setComunaOrigen] = useState("");
  const [puntoOrigen, setPuntoOrigen] = useState(null);
  const [radioOrigenM, setRadioOrigenM] = useState(RADIO_DEFECTO_M);

  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [rutaResaltadaId, setRutaResaltadaId] = useState(null);
  const [rutaElegidaId, setRutaElegidaId] = useState(null);

  useEffect(() => {
    api.comunasDisponibles().then(setComunas).catch(() => setComunas([]));
  }, []);

  useEffect(() => {
    if (paso < 3 || !puntoDestino || !puntoOrigen) return;
    setBuscando(true);
    setError("");
    // El paso 3 filtra fino por destino (radio ajustable) y solo grueso por
    // origen (comuna) — el radio de origen recién importa en el paso 4,
    // una vez elegida una ruta puntual, para ubicar el punto de recogida.
    api
      .buscarRutas({
        destino_lat: puntoDestino.lat,
        destino_lng: puntoDestino.lng,
        destino_radio_m: radioDestinoM,
        comuna_origen: comunaOrigen || undefined,
      })
      .then(setResultados)
      .catch((e) => setError(e.message))
      .finally(() => setBuscando(false));
  }, [paso, puntoDestino, radioDestinoM, puntoOrigen, comunaOrigen]);

  const rutaElegida = resultados.find((r) => r.id === rutaElegidaId);

  if (paso === 1) {
    return (
      <PasoDestino
        comunas={comunas}
        comunaDestino={comunaDestino}
        setComunaDestino={setComunaDestino}
        puntoDestino={puntoDestino}
        setPuntoDestino={setPuntoDestino}
        onContinuar={() => setPaso(2)}
      />
    );
  }

  if (paso === 2) {
    return (
      <PasoOrigen
        comunas={comunas}
        puntoDestino={puntoDestino}
        comunaOrigen={comunaOrigen}
        setComunaOrigen={setComunaOrigen}
        puntoOrigen={puntoOrigen}
        setPuntoOrigen={setPuntoOrigen}
        onVolver={() => setPaso(1)}
        onContinuar={() => setPaso(3)}
      />
    );
  }

  if (paso === 4 && rutaElegida) {
    return (
      <div className="max-w-md mx-auto p-6">
        <button onClick={() => setPaso(3)} className="text-sm text-gray-500 mb-3">← Volver a los viajes</button>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
          <p className="text-sm font-bold text-gray-800">Ruta de {rutaElegida.conductor.nombre} seleccionada</p>
          <p className="text-xs text-orange-800 mt-0.5">Ahora elige dónde te recoge cerca de tu origen</p>
        </div>

        <RadioSlider etiqueta="Radio desde tu origen" valor={radioOrigenM} setValor={setRadioOrigenM} colorClase="text-green-700" />

        <MapaBusqueda
          rutas={[rutaElegida]}
          lado="origen"
          foco={puntoOrigen}
          radioM={radioOrigenM}
          resaltadaId={rutaElegida.id}
        />

        <p className="text-center text-xs text-gray-500 mt-3">Elige tu punto de recogida en este viaje</p>

        <button
          onClick={() => navigate(`/rutas/${rutaElegida.id}`)}
          className="w-full bg-taco text-white py-3 rounded-lg font-semibold mt-4"
        >
          Ver detalle del viaje
        </button>
      </div>
    );
  }

  // paso === 3
  return (
    <div className="max-w-md mx-auto p-6">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setPaso(2)} className="text-gray-500 text-lg" aria-label="Volver">←</button>
        <h1 className="text-lg font-bold text-gray-800">Viajes disponibles</h1>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex items-center gap-1.5 bg-gray-100 rounded-lg px-2.5 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-600 flex-shrink-0"></span>
          <span className="text-xs text-gray-700 truncate">{puntoOrigen?.direccion}</span>
        </div>
        <div className="flex-1 flex items-center gap-1.5 bg-orange-50 rounded-lg px-2.5 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-taco flex-shrink-0"></span>
          <span className="text-xs text-taco-dark font-medium truncate">{puntoDestino?.direccion}</span>
        </div>
      </div>

      <RadioSlider etiqueta="Radio desde tu destino" valor={radioDestinoM} setValor={setRadioDestinoM} colorClase="text-taco" />

      <MapaBusqueda
        rutas={resultados}
        lado="destino"
        foco={puntoDestino}
        radioM={radioDestinoM}
        resaltadaId={rutaResaltadaId}
        onClickPin={setRutaResaltadaId}
      />

      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      {buscando && <p className="text-center text-sm text-gray-500 mt-3">Buscando...</p>}
      {!buscando && resultados.length === 0 && (
        <p className="text-center text-sm text-gray-500 mt-3">
          No hay viajes dentro de este radio. Prueba ampliándolo arriba.
        </p>
      )}

      {resultados.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">{resultados.length} viajes dentro del radio</p>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {resultados.map((r) => (
              <TarjetaRuta
                key={r.id}
                ruta={r}
                seleccionada={r.id === rutaResaltadaId}
                onClick={() => setRutaResaltadaId(r.id)}
                onQuitar={() => setRutaResaltadaId(null)}
                onElegir={() => {
                  setRutaElegidaId(r.id);
                  setPaso(4);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
