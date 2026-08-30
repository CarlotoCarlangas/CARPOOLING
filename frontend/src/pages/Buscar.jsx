import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { buscarDireccion, direccionDesdeCoordenadas } from "../services/geocoding";
import { obtenerUbicacionActual } from "../services/geolocalizacion";
import MapaBusqueda from "../components/MapaBusqueda";

const RADIO_DEFECTO_M = 200;
const RADIO_PREVISUALIZACION_M = 350;

/**
 * El mapa es la propuesta de valor, así que se lleva la mayor parte de
 * la pantalla — pero como PANTALLA DIVIDIDA (panel arriba, mapa abajo),
 * no como una hoja flotando encima del mapa. Se probó primero con el
 * panel superpuesto (`position: absolute` sobre el mapa) y en la
 * práctica, en varios navegadores/dispositivos reales, terminaba
 * quedando VISUALMENTE detrás del mapa aunque siguiera ahí (clicable
 * mediante coordenadas, invisible para el ojo) — un bug de stacking
 * difícil de reproducir y depurar a ciegas. Dividir la pantalla en dos
 * bloques que no se superponen elimina esa categoría de bug por
 * completo: no hay z-index compitiendo entre el mapa y el panel.
 *
 * El panel va ARRIBA y el mapa ABAJO (y no al revés) porque el panel
 * tiene campos de texto (comuna, dirección) — en celular, al tocar un
 * campo y abrirse el teclado, si el panel estuviera abajo el teclado lo
 * taparía justo cuando el usuario necesita verlo para escribir.
 */
function PantallaConMapa({ mapa, overlayMapa, children }) {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-gray-200">
      <div className="flex-[2] min-h-0 overflow-y-auto bg-white pt-3 pb-5 px-5 shadow-[0_4px_16px_rgba(0,0,0,.1)] relative z-10">
        <div className="w-9 h-1 bg-gray-300 rounded-full mx-auto mb-3"></div>
        {/* max-w-md + mx-auto: en celular ocupa todo el ancho; en
            pantallas anchas (probando desde un PC) se centra en un ancho
            de formulario normal — si no, el <select> se estira de punta
            a punta de la ventana y su desplegable nativo se ve gigante. */}
        <div className="max-w-md mx-auto">{children}</div>
      </div>
      <div className="relative flex-[3] min-h-0">
        {mapa}
        {overlayMapa}
      </div>
    </div>
  );
}

function BotonFlotante({ onClick, children, claseExtra = "" }) {
  return (
    <button
      onClick={onClick}
      className={`absolute z-10 w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-700 ${claseExtra}`}
    >
      {children}
    </button>
  );
}

function FlechaVolver() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/**
 * Campo de dirección con autocompletado.
 *
 * OpenStreetMap (la fuente de datos gratuita que usamos) no siempre tiene
 * la numeración de calles residenciales en comunas periurbanas como
 * Peñaflor — buscar "El Roble 925" puede no devolver nada aunque la
 * dirección exista. Antes esto abría un SEGUNDO mapa embebido como
 * respaldo, pero terminaba viéndose como "el mapa duplicado" (dos mapas
 * en la misma pantalla, uno arriba sin poder tocarlo y otro chico
 * después). Ahora el mapa grande de arriba (el mismo `MapaBusqueda` de
 * fondo) YA es clickeable para marcar el punto — este campo solo avisa
 * que esa alternativa existe, sin duplicar nada.
 */
function CampoDireccion({ placeholder, comuna, valor, onElegir }) {
  const debounceRef = useRef(null);
  const saltarBusquedaRef = useRef(false);
  const [texto, setTexto] = useState(valor?.direccion || "");
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [buscoAlMenosUnaVez, setBuscoAlMenosUnaVez] = useState(false);

  // Si el punto se elige tocando el mapa grande de arriba (en vez de
  // escribiendo), `valor` cambia desde afuera — sin esto el campo de
  // texto se quedaría vacío aunque el punto ya esté guardado.
  useEffect(() => {
    if (valor?.direccion && valor.direccion !== texto) {
      saltarBusquedaRef.current = true;
      setTexto(valor.direccion);
      setSugerencias([]);
      setBuscoAlMenosUnaVez(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Cuando el texto cambia porque el usuario ACABA de elegir una
    // dirección (de la lista o del mapa), no hay que volver a buscar —
    // si no, el propio texto de la dirección elegida dispara una nueva
    // búsqueda y el dropdown reaparece encima de la selección.
    if (saltarBusquedaRef.current) {
      saltarBusquedaRef.current = false;
      return;
    }
    if (texto.trim().length < 3) {
      setSugerencias([]);
      setBuscoAlMenosUnaVez(false);
      return;
    }
    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      const resultado = await buscarDireccion(texto, comuna);
      setSugerencias(resultado);
      setBuscando(false);
      setBuscoAlMenosUnaVez(true);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [texto, comuna]);

  const elegir = (s) => {
    saltarBusquedaRef.current = true;
    setTexto(s.direccion);
    setSugerencias([]);
    setBuscoAlMenosUnaVez(false);
    onElegir(s);
  };

  const sinResultados = buscoAlMenosUnaVez && !buscando && sugerencias.length === 0;

  return (
    <div>
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

      {sinResultados && (
        <p className="text-xs text-amber-700 mt-1.5">
          No encontramos esa dirección. Puedes tocar directamente el punto en el mapa de arriba.
        </p>
      )}
      {!sinResultados && (
        <p className="text-xs text-gray-400 mt-1.5">o toca el punto directamente en el mapa de arriba</p>
      )}
    </div>
  );
}

function PasoDestino({ comunas, comunaDestino, setComunaDestino, puntoDestino, setPuntoDestino, onContinuar }) {
  const elegirEnMapa = async (lat, lng) => {
    const { direccion, comuna } = await direccionDesdeCoordenadas(lat, lng);
    setPuntoDestino({ lat, lng, direccion, comuna });
    if (comuna) setComunaDestino(comuna);
  };

  return (
    <PantallaConMapa
      mapa={
        <MapaBusqueda
          rutas={[]}
          lado="destino"
          foco={puntoDestino}
          radioM={puntoDestino ? RADIO_PREVISUALIZACION_M : null}
          onClickMapa={elegirEnMapa}
        />
      }
    >
      <p className="text-xs font-bold text-taco uppercase tracking-wide">Paso 1 de 2</p>
      <h1 className="text-xl font-bold mt-1 mb-4">¿A dónde quieres llegar?</h1>

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
        onElegir={(s) => {
          setPuntoDestino(s);
          if (s.comuna) setComunaDestino(s.comuna);
        }}
      />

      <button
        onClick={onContinuar}
        disabled={!puntoDestino}
        className="w-full bg-taco text-white py-3 rounded-lg font-semibold mt-4 disabled:opacity-40"
      >
        Continuar · Elegir origen
      </button>
    </PantallaConMapa>
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

  const elegirEnMapa = async (lat, lng) => {
    const { direccion, comuna } = await direccionDesdeCoordenadas(lat, lng);
    setPuntoOrigen({ lat, lng, direccion, comuna });
    if (comuna) setComunaOrigen(comuna);
    setGeoEstado("ok");
    setManual(true);
  };

  return (
    <PantallaConMapa
      mapa={
        <MapaBusqueda
          rutas={[]}
          lado="origen"
          foco={puntoOrigen}
          radioM={puntoOrigen ? RADIO_PREVISUALIZACION_M : null}
          onClickMapa={elegirEnMapa}
        />
      }
      overlayMapa={<BotonFlotante onClick={onVolver} claseExtra="left-4 top-4"><FlechaVolver /></BotonFlotante>}
    >
      <p className="text-xs font-bold text-taco uppercase tracking-wide">Paso 2 de 2</p>
      <h1 className="text-xl font-bold mt-1 mb-3">¿Desde dónde sales?</h1>

      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 mb-3 text-sm">
        <span className="w-2 h-2 rounded-full bg-taco flex-shrink-0"></span>
        <span className="flex-1 truncate">
          <span className="text-gray-500">Destino: </span>
          {puntoDestino?.direccion}
        </span>
      </div>

      {!manual && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4 flex items-center gap-3">
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
    </PantallaConMapa>
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
    <div className="bg-gray-50 rounded-lg p-3 mb-3">
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

function ChipDireccion({ color, texto, claseExtra }) {
  return (
    <div className={`flex-1 flex items-center gap-1.5 bg-white/95 backdrop-blur rounded-full px-3 py-2 shadow-md text-xs ${claseExtra}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`}></span>
      <span className="truncate text-gray-700">{texto}</span>
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
      <PantallaConMapa
        mapa={
          <MapaBusqueda
            rutas={[rutaElegida]}
            lado="origen"
            foco={puntoOrigen}
            radioM={radioOrigenM}
            resaltadaId={rutaElegida.id}
          />
        }
        overlayMapa={
          <>
            <BotonFlotante onClick={() => setPaso(3)} claseExtra="left-4 top-4"><FlechaVolver /></BotonFlotante>
            <div className="absolute left-20 right-4 top-4 max-w-sm z-10">
              <div className="bg-white/95 backdrop-blur rounded-xl px-3.5 py-2.5 shadow-md">
                <p className="text-xs font-bold text-gray-800 truncate">Ruta de {rutaElegida.conductor.nombre} elegida</p>
                <p className="text-[11px] text-gray-500">Elige tu punto de recogida cerca de tu origen</p>
              </div>
            </div>
          </>
        }
      >
        <RadioSlider etiqueta="Radio desde tu origen" valor={radioOrigenM} setValor={setRadioOrigenM} colorClase="text-green-700" />
        <button
          onClick={() => navigate(`/rutas/${rutaElegida.id}`)}
          className="w-full bg-taco text-white py-3 rounded-lg font-semibold"
        >
          Ver detalle del viaje
        </button>
      </PantallaConMapa>
    );
  }

  // paso === 3
  return (
    <PantallaConMapa
      mapa={
        <MapaBusqueda
          rutas={resultados}
          lado="destino"
          foco={puntoDestino}
          radioM={radioDestinoM}
          resaltadaId={rutaResaltadaId}
          onClickPin={setRutaResaltadaId}
        />
      }
      overlayMapa={
        <>
          <BotonFlotante onClick={() => setPaso(2)} claseExtra="left-4 top-4"><FlechaVolver /></BotonFlotante>
          <div className="absolute left-20 right-4 top-4 max-w-lg flex gap-2 z-10">
            <ChipDireccion color="bg-green-600" texto={puntoOrigen?.direccion} />
            <ChipDireccion color="bg-taco" texto={puntoDestino?.direccion} claseExtra="text-taco-dark font-medium" />
          </div>
        </>
      }
    >
      <RadioSlider etiqueta="Radio desde tu destino" valor={radioDestinoM} setValor={setRadioDestinoM} colorClase="text-taco" />

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {buscando && <p className="text-center text-sm text-gray-500">Buscando...</p>}
      {!buscando && resultados.length === 0 && (
        <p className="text-center text-sm text-gray-500">
          No hay viajes dentro de este radio. Prueba ampliándolo arriba.
        </p>
      )}

      {resultados.length > 0 && (
        <div>
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
    </PantallaConMapa>
  );
}
