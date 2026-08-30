import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { buscarDireccion, direccionDesdeCoordenadas } from "../services/geocoding";
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

/**
 * A diferencia del destino, acá NO pedimos un punto exacto ni la
 * ubicación por geolocalización — solo la comuna. El pasajero de todos
 * modos va a tener que caminar hasta una parada del viaje que elija
 * (paso 4), así que pedirle una dirección precisa acá era una fricción
 * de más sin beneficio real: la comuna alcanza para filtrar los viajes,
 * y las paradas concretas se muestran recién cuando ya eligió un viaje.
 */
function PasoOrigen({ comunas, puntoDestino, comunaOrigen, setComunaOrigen, onVolver, onContinuar }) {
  return (
    <PantallaConMapa
      mapa={
        <MapaBusqueda
          rutas={[]}
          lado="destino"
          foco={puntoDestino}
          radioM={puntoDestino ? RADIO_PREVISUALIZACION_M : null}
        />
      }
      overlayMapa={<BotonFlotante onClick={onVolver} claseExtra="left-4 top-4"><FlechaVolver /></BotonFlotante>}
    >
      <p className="text-xs font-bold text-taco uppercase tracking-wide">Paso 2 de 2</p>
      <h1 className="text-xl font-bold mt-1 mb-3">¿Desde qué comuna sales?</h1>

      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 mb-3 text-sm">
        <span className="w-2 h-2 rounded-full bg-taco flex-shrink-0"></span>
        <span className="flex-1 truncate">
          <span className="text-gray-500">Destino: </span>
          {puntoDestino?.direccion}
        </span>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        No necesitas la dirección exacta — de todas formas vas a caminar hasta el punto de
        recogida del conductor. Con tu comuna alcanza para mostrarte los viajes disponibles.
      </p>

      <select
        value={comunaOrigen}
        onChange={(e) => setComunaOrigen(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 mb-4 text-sm"
      >
        <option value="">Comuna de origen...</option>
        {comunas.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <button
        onClick={onContinuar}
        disabled={!comunaOrigen}
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

function TarjetaParada({ punto, seleccionada, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg p-3 cursor-pointer border-2 transition ${
        seleccionada ? "bg-orange-50 border-taco" : "bg-gray-50 border-transparent hover:border-gray-200"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
          seleccionada ? "bg-orange-200" : "bg-gray-200"
        }`}
      >
        📍
      </div>
      <p className="text-sm flex-1 truncate">{punto.direccion}</p>
      {seleccionada && <span className="text-taco text-base font-bold flex-shrink-0">✓</span>}
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

  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [rutaResaltadaId, setRutaResaltadaId] = useState(null);
  const [rutaElegidaId, setRutaElegidaId] = useState(null);
  const [puntoEmbarqueId, setPuntoEmbarqueId] = useState(null);

  useEffect(() => {
    api.comunasDisponibles().then(setComunas).catch(() => setComunas([]));
  }, []);

  useEffect(() => {
    if (paso < 3 || !puntoDestino || !comunaOrigen) return;
    setBuscando(true);
    setError("");
    // El paso 3 filtra fino por destino (radio ajustable) y solo grueso por
    // origen (comuna) — las paradas puntuales dentro de esa comuna recién
    // se muestran en el paso 4, una vez elegido un viaje concreto.
    api
      .buscarRutas({
        destino_lat: puntoDestino.lat,
        destino_lng: puntoDestino.lng,
        destino_radio_m: radioDestinoM,
        comuna_origen: comunaOrigen,
      })
      .then(setResultados)
      .catch((e) => setError(e.message))
      .finally(() => setBuscando(false));
  }, [paso, puntoDestino, radioDestinoM, comunaOrigen]);

  const rutaElegida = resultados.find((r) => r.id === rutaElegidaId);

  // Puntos donde el pasajero puede subirse a ESTE viaje dentro de SU
  // comuna: el punto de partida oficial del conductor (si cae en esa
  // comuna) más las paradas intermedias que también caigan ahí.
  const puntosEmbarque = !rutaElegida
    ? []
    : [
        ...(rutaElegida.origen_comuna === comunaOrigen
          ? [{ id: "origen", lat: rutaElegida.origen_lat, lng: rutaElegida.origen_lng, direccion: rutaElegida.origen_direccion }]
          : []),
        ...(rutaElegida.paradas || [])
          .filter((p) => p.comuna === comunaOrigen)
          .map((p, i) => ({ id: `parada-${i}`, lat: p.lat, lng: p.lng, direccion: p.direccion })),
      ];

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
            puntos={puntosEmbarque}
            geometria={rutaElegida.geometria}
            resaltadaId={puntoEmbarqueId}
            onClickPin={setPuntoEmbarqueId}
            colorPuntos="#16a34a"
          />
        }
        overlayMapa={
          <>
            <BotonFlotante
              onClick={() => {
                setPuntoEmbarqueId(null);
                setPaso(3);
              }}
              claseExtra="left-4 top-4"
            >
              <FlechaVolver />
            </BotonFlotante>
            <div className="absolute left-20 right-4 top-4 max-w-sm z-10">
              <div className="bg-white/95 backdrop-blur rounded-xl px-3.5 py-2.5 shadow-md">
                <p className="text-xs font-bold text-gray-800 truncate">Ruta de {rutaElegida.conductor.nombre} elegida</p>
                <p className="text-[11px] text-gray-500">Elige dónde quieres subir</p>
              </div>
            </div>
          </>
        }
      >
        <p className="text-xs font-semibold text-gray-500 mb-2">
          {puntosEmbarque.length === 0
            ? `Sin paradas registradas en ${comunaOrigen}`
            : `${puntosEmbarque.length} ${puntosEmbarque.length === 1 ? "punto" : "puntos"} de subida en ${comunaOrigen}`}
        </p>

        {puntosEmbarque.length === 0 && (
          <p className="text-sm text-gray-500 mb-4">
            Este viaje no tiene paradas dentro de tu comuna. Vuelve atrás y prueba otro viaje.
          </p>
        )}

        <div className="space-y-2 mb-4">
          {puntosEmbarque.map((p) => (
            <TarjetaParada
              key={p.id}
              punto={p}
              seleccionada={p.id === puntoEmbarqueId}
              onClick={() => setPuntoEmbarqueId(p.id)}
            />
          ))}
        </div>

        <button
          onClick={() => navigate(`/rutas/${rutaElegida.id}`)}
          disabled={!puntoEmbarqueId}
          className="w-full bg-taco text-white py-3 rounded-lg font-semibold disabled:opacity-40"
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
            <ChipDireccion color="bg-green-600" texto={`Desde ${comunaOrigen}`} />
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
                  setPuntoEmbarqueId(null);
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
