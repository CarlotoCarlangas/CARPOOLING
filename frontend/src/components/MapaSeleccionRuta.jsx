import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "../services/leafletIconFix";
import { agregarCapaBase } from "../services/basemap";
import { calcularRuta } from "../services/osrm";
import { direccionDesdeCoordenadas } from "../services/geocoding";

const CENTRO_INICIAL = [-33.53, -70.8]; // entre Peñaflor y Santiago

// Pin redondo con una letra/número dentro (divIcon = control total del estilo).
function pin(texto, color) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;
      box-shadow:0 1px 5px rgba(0,0,0,.45);border:2px solid #fff;">${texto}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const COLOR_ORIGEN = "#059669";  // verde
const COLOR_DESTINO = "#dc2626"; // rojo
const COLOR_PARADA = "#F59E0B";  // ámbar
const COLOR_RUTA = "#2563EB";    // azul

// Índice del vértice de la geometría más cercano a un punto — sirve para
// ordenar las paradas a lo largo del recorrido (origen -> ... -> destino),
// para que la secuencia tenga sentido y el buscador del pasajero no ofrezca
// viajes "hacia atrás".
function indiceEnRuta(punto, geometria) {
  if (!geometria || geometria.length === 0) return 0;
  let mejor = 0;
  let mejorD = Infinity;
  for (let i = 0; i < geometria.length; i++) {
    const dLat = geometria[i][0] - punto.lat;
    const dLng = geometria[i][1] - punto.lng;
    const d = dLat * dLat + dLng * dLng; // distancia² (basta para comparar)
    if (d < mejorD) {
      mejorD = d;
      mejor = i;
    }
  }
  return mejor;
}

/**
 * Mapa para que el conductor arme su ruta en DOS etapas separadas:
 *
 *  Etapa 1 — "ruta": hace clics y la línea se va trazando pegada a la red
 *  vial (OSRM), no en línea recta. El primer clic es el origen y el último
 *  el destino; los clics del medio solo moldean por dónde va el trazado.
 *  Botón "Terminar ruta".
 *
 *  Etapa 2 — "paradas": con la ruta ya fija, marca puntos aparte que son
 *  las paradas donde está dispuesto a recoger/dejar pasajeros. Origen y
 *  destino NO se tocan (vienen de la etapa 1). Botón "Confirmar".
 *
 * Al confirmar entrega al padre (`onRutaLista`) el mismo objeto de siempre
 * { origen, destino, paradas, geometria, distanciaKm, duracionMin }, así
 * que el backend no cambia.
 */
export default function MapaSeleccionRuta({ onRutaLista }) {
  const mapRef = useRef(null);
  const contenedorRef = useRef(null);
  const capaRutaRef = useRef(null);
  const marcadoresRef = useRef([]);
  const reqIdRef = useRef(0); // para descartar respuestas OSRM viejas

  const [fase, setFase] = useState("ruta"); // "ruta" | "paradas"
  const [vertices, setVertices] = useState([]); // [{lat,lng}] clics de la etapa 1
  const [geo, setGeo] = useState(null); // {geometria, distanciaKm, duracionMin}
  const [origen, setOrigen] = useState(null); // {lat,lng,direccion,comuna}
  const [destino, setDestino] = useState(null);
  const [paradas, setParadas] = useState([]); // [{lat,lng,direccion,comuna}]
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState("");
  const [confirmada, setConfirmada] = useState(false);

  // --- Crear el mapa una sola vez ---
  useEffect(() => {
    const mapa = L.map(contenedorRef.current).setView(CENTRO_INICIAL, 11);
    agregarCapaBase(mapa);
    mapRef.current = mapa;
    return () => mapa.remove();
  }, []);

  // --- Clic en el mapa: según la etapa, agrega vértice de ruta o parada ---
  useEffect(() => {
    const mapa = mapRef.current;
    if (!mapa) return;

    const alHacerClic = async (e) => {
      const { lat, lng } = e.latlng;
      if (fase === "ruta") {
        setVertices((prev) => [...prev, { lat, lng }]);
      } else {
        // Etapa paradas: cada clic es una parada (con su dirección).
        const { direccion, comuna } = await direccionDesdeCoordenadas(lat, lng);
        setParadas((prev) => [...prev, { lat, lng, direccion, comuna }]);
        setConfirmada(false);
        onRutaLista(null);
      }
    };

    mapa.on("click", alHacerClic);
    return () => mapa.off("click", alHacerClic);
  }, [fase]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Etapa 1: recalcular la ruta real por calles cada vez que cambian los
  //     vértices, para que la línea que ve el conductor SIGA las calles. ---
  useEffect(() => {
    if (fase !== "ruta") return;
    if (vertices.length < 2) {
      setGeo(null);
      return;
    }
    const idPeticion = ++reqIdRef.current;
    setCalculando(true);
    setError("");
    calcularRuta(vertices)
      .then((res) => {
        if (idPeticion !== reqIdRef.current) return; // llegó una respuesta vieja
        setGeo(res);
      })
      .catch(() => {
        if (idPeticion !== reqIdRef.current) return;
        // Respaldo: si OSRM falla, al menos unir los puntos con líneas rectas.
        setGeo({
          geometria: vertices.map((v) => [v.lat, v.lng]),
          distanciaKm: null,
          duracionMin: null,
        });
      })
      .finally(() => {
        if (idPeticion === reqIdRef.current) setCalculando(false);
      });
  }, [vertices, fase]);

  // --- Dibujar la polilínea de la ruta cuando cambia la geometría ---
  useEffect(() => {
    const mapa = mapRef.current;
    if (!mapa) return;
    if (capaRutaRef.current) {
      mapa.removeLayer(capaRutaRef.current);
      capaRutaRef.current = null;
    }
    if (geo?.geometria?.length) {
      capaRutaRef.current = L.polyline(geo.geometria, {
        color: COLOR_RUTA,
        weight: 5,
        opacity: fase === "paradas" ? 0.6 : 0.9,
      }).addTo(mapa);
    }
  }, [geo, fase]);

  // --- Dibujar los marcadores (origen/destino/vértices/paradas) ---
  useEffect(() => {
    const mapa = mapRef.current;
    if (!mapa) return;

    marcadoresRef.current.forEach((m) => mapa.removeLayer(m));
    marcadoresRef.current = [];

    if (fase === "ruta") {
      vertices.forEach((v, i) => {
        const esPrimero = i === 0;
        const esUltimo = i === vertices.length - 1 && vertices.length > 1;
        let marcador;
        if (esPrimero) {
          marcador = L.marker([v.lat, v.lng], { icon: pin("A", COLOR_ORIGEN) }).bindTooltip("Inicio (origen)");
        } else if (esUltimo) {
          marcador = L.marker([v.lat, v.lng], { icon: pin("B", COLOR_DESTINO) }).bindTooltip("Fin (destino)");
        } else {
          // Punto que solo moldea el trazado: chico y gris, sin protagonismo.
          marcador = L.circleMarker([v.lat, v.lng], {
            radius: 4,
            color: "#64748b",
            fillColor: "#94a3b8",
            fillOpacity: 1,
            weight: 1,
          });
        }
        marcador.addTo(mapa);
        marcadoresRef.current.push(marcador);
      });
    } else {
      if (origen) {
        const m = L.marker([origen.lat, origen.lng], { icon: pin("A", COLOR_ORIGEN) })
          .addTo(mapa)
          .bindTooltip(`Origen: ${origen.direccion || ""}`);
        marcadoresRef.current.push(m);
      }
      if (destino) {
        const m = L.marker([destino.lat, destino.lng], { icon: pin("B", COLOR_DESTINO) })
          .addTo(mapa)
          .bindTooltip(`Destino: ${destino.direccion || ""}`);
        marcadoresRef.current.push(m);
      }
      paradas.forEach((p, i) => {
        const m = L.marker([p.lat, p.lng], { icon: pin(String(i + 1), COLOR_PARADA) })
          .addTo(mapa)
          .bindTooltip(`Parada ${i + 1}: ${p.direccion || ""}`);
        marcadoresRef.current.push(m);
      });
    }
  }, [vertices, paradas, origen, destino, fase]);

  // --- Acciones etapa 1 ---
  const deshacerVertice = () => {
    setVertices((prev) => prev.slice(0, -1));
  };
  const limpiarRuta = () => {
    setVertices([]);
    setGeo(null);
    setError("");
  };
  const terminarRuta = async () => {
    if (vertices.length < 2) {
      setError("Marca al menos 2 puntos: el inicio y el fin de tu ruta.");
      return;
    }
    setError("");
    setCalculando(true);
    try {
      // Asegurar que la geometría esté calculada (por si terminó justo al 2° clic).
      let g = geo;
      if (!g) {
        try {
          g = await calcularRuta(vertices);
        } catch {
          g = { geometria: vertices.map((v) => [v.lat, v.lng]), distanciaKm: null, duracionMin: null };
        }
        setGeo(g);
      }
      const primero = vertices[0];
      const ultimo = vertices[vertices.length - 1];
      const [o, d] = await Promise.all([
        direccionDesdeCoordenadas(primero.lat, primero.lng),
        direccionDesdeCoordenadas(ultimo.lat, ultimo.lng),
      ]);
      setOrigen({ lat: primero.lat, lng: primero.lng, direccion: o.direccion, comuna: o.comuna });
      setDestino({ lat: ultimo.lat, lng: ultimo.lng, direccion: d.direccion, comuna: d.comuna });
      setFase("paradas");
      onRutaLista(null); // todavía no se confirma; falta marcar paradas
      // Encuadrar la ruta completa ahora que quedó fija.
      const mapa = mapRef.current;
      if (mapa && g?.geometria?.length) {
        mapa.fitBounds(L.latLngBounds(g.geometria), { padding: [40, 40] });
      }
    } finally {
      setCalculando(false);
    }
  };

  // --- Acciones etapa 2 ---
  const quitarParada = (i) => {
    setParadas((prev) => prev.filter((_, idx) => idx !== i));
    setConfirmada(false);
    onRutaLista(null);
  };
  const volverARuta = () => {
    setFase("ruta");
    setConfirmada(false);
    onRutaLista(null);
  };
  const confirmar = () => {
    // Ordenar las paradas según su posición a lo largo del recorrido.
    const ordenadas = [...paradas]
      .sort((a, b) => indiceEnRuta(a, geo.geometria) - indiceEnRuta(b, geo.geometria))
      .map((p) => ({ lat: p.lat, lng: p.lng, direccion: p.direccion, comuna: p.comuna }));
    onRutaLista({
      origen,
      destino,
      paradas: ordenadas,
      geometria: geo.geometria,
      distanciaKm: geo.distanciaKm,
      duracionMin: geo.duracionMin,
    });
    setConfirmada(true);
  };

  return (
    <div>
      {/* Instrucción según la etapa */}
      {fase === "ruta" ? (
        <div className="mb-2">
          <p className="text-sm font-semibold text-gray-800">Paso 1 de 2 · Dibuja tu ruta</p>
          <p className="text-sm text-gray-600">
            Haz clic siguiendo tu recorrido. La línea se traza <b>por las calles</b>. El
            primer punto (<span style={{ color: COLOR_ORIGEN }}>A</span>) es tu origen y el
            último (<span style={{ color: COLOR_DESTINO }}>B</span>) tu destino. Cuando esté
            lista, aprieta <b>Terminar ruta</b>.
          </p>
        </div>
      ) : (
        <div className="mb-2">
          <p className="text-sm font-semibold text-gray-800">Paso 2 de 2 · Marca tus paradas</p>
          <p className="text-sm text-gray-600">
            Haz clic donde estés dispuesto a <b>recoger o dejar pasajeros</b> (pines
            <span style={{ color: COLOR_PARADA }}> ámbar</span>). El origen y el destino ya
            quedaron fijos. Puedes seguir sin paradas si solo llevas de A a B.
          </p>
        </div>
      )}

      <div ref={contenedorRef} className="w-full h-[400px] rounded-lg border border-gray-300" />

      {calculando && <p className="text-sm text-gray-500 mt-2">Calculando la ruta por calles…</p>}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      {/* ===== Controles etapa 1 ===== */}
      {fase === "ruta" && (
        <>
          {geo && (
            <p className="mt-2 text-sm text-gray-700">
              {geo.distanciaKm != null
                ? `Distancia: ${geo.distanciaKm} km · ~${geo.duracionMin} min`
                : "Ruta trazada (sin cálculo de distancia)"}
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-3">
            <button
              type="button"
              onClick={terminarRuta}
              disabled={calculando || vertices.length < 2}
              className="bg-taco text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              ✓ Terminar ruta
            </button>
            <button
              type="button"
              onClick={deshacerVertice}
              disabled={vertices.length === 0}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg disabled:opacity-50"
            >
              ↩️ Deshacer punto
            </button>
            <button
              type="button"
              onClick={limpiarRuta}
              disabled={vertices.length === 0}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg disabled:opacity-50"
            >
              🗑 Limpiar
            </button>
          </div>
        </>
      )}

      {/* ===== Controles etapa 2 ===== */}
      {fase === "paradas" && (
        <>
          {paradas.length > 0 && (
            <ul className="mt-3 text-sm text-gray-700 space-y-1">
              {paradas.map((p, i) => (
                <li key={i} className="flex justify-between items-center gap-2">
                  <span>
                    <b style={{ color: COLOR_PARADA }}>Parada {i + 1}:</b> {p.direccion}
                  </span>
                  <button
                    type="button"
                    onClick={() => quitarParada(i)}
                    className="text-red-600 hover:underline shrink-0"
                  >
                    quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {paradas.length === 0 && (
            <p className="mt-3 text-sm text-gray-500">
              Aún no marcas paradas. Haz clic en el mapa para agregarlas (o confirma sin
              paradas).
            </p>
          )}

          <div className="flex flex-wrap gap-3 mt-3">
            <button
              type="button"
              onClick={confirmar}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              ✅ Confirmar ruta y paradas
            </button>
            <button
              type="button"
              onClick={() => setParadas([])}
              disabled={paradas.length === 0}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg disabled:opacity-50"
            >
              🗑 Quitar paradas
            </button>
            <button
              type="button"
              onClick={volverARuta}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg"
            >
              ← Volver a la ruta
            </button>
          </div>

          {confirmada && (
            <p className="mt-3 text-sm text-green-700">
              ✓ Ruta y paradas confirmadas. Completa cupos, horario y precio abajo. Si
              necesitas cambiar algo, edita y vuelve a confirmar.
            </p>
          )}
        </>
      )}
    </div>
  );
}
