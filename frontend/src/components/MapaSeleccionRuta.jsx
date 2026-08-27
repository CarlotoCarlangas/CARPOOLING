import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "../services/leafletIconFix";
import { calcularRuta } from "../services/osrm";
import { direccionDesdeCoordenadas } from "../services/geocoding";

const CENTRO_INICIAL = [-33.53, -70.8]; // entre Peñaflor y Santiago

/**
 * Mapa interactivo para que el conductor trace su ruta.
 *
 * Flujo: cada clic agrega un punto en orden. El primer punto es siempre el
 * origen; el último punto agregado se asume como destino (el punto que
 * antes ocupaba ese lugar pasa a ser una parada intermedia). Todo es
 * editable (agregar, quitar puntos) hasta que el conductor confirma que la
 * ruta calculada es correcta.
 */
export default function MapaSeleccionRuta({ onRutaLista }) {
  const mapRef = useRef(null);
  const contenedorRef = useRef(null);
  const capaRutaRef = useRef(null);
  const marcadoresRef = useRef([]);

  const [puntos, setPuntos] = useState([]); // [{lat,lng,direccion}, ...] en orden de clic
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null); // {distanciaKm, duracionMin}
  const [confirmada, setConfirmada] = useState(false);

  useEffect(() => {
    const mapa = L.map(contenedorRef.current).setView(CENTRO_INICIAL, 11);
    // Estilo tipo "app moderna" (parecido a Uber/Google Maps) en vez del
    // tile por defecto de OpenStreetMap, que se ve más técnico. CARTO
    // Voyager es gratis y no requiere llave de API.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    }).addTo(mapa);
    mapRef.current = mapa;

    return () => mapa.remove();
  }, []);

  useEffect(() => {
    const mapa = mapRef.current;
    if (!mapa) return;

    const alHacerClic = async (e) => {
      const { lat, lng } = e.latlng;
      const direccion = await direccionDesdeCoordenadas(lat, lng);
      setPuntos((prev) => [...prev, { lat, lng, direccion }]);
      setConfirmada(false);
      setResultado(null);
    };

    mapa.on("click", alHacerClic);
    return () => mapa.off("click", alHacerClic);
  }, []);

  // Redibuja los marcadores cada vez que cambian los puntos
  useEffect(() => {
    const mapa = mapRef.current;
    if (!mapa) return;

    marcadoresRef.current.forEach((m) => mapa.removeLayer(m));
    marcadoresRef.current = [];

    puntos.forEach((p, i) => {
      const etiqueta = i === 0 ? "Origen" : i === puntos.length - 1 ? "Destino" : `Parada ${i}`;
      const m = L.marker([p.lat, p.lng]).addTo(mapa).bindPopup(`${etiqueta}: ${p.direccion}`);
      marcadoresRef.current.push(m);
    });
  }, [puntos]);

  const quitarPunto = (i) => {
    setPuntos((prev) => prev.filter((_, idx) => idx !== i));
    setConfirmada(false);
    setResultado(null);
  };

  const deshacerUltimo = () => {
    setPuntos((prev) => prev.slice(0, -1));
    setConfirmada(false);
    setResultado(null);
  };

  const reiniciar = () => {
    setPuntos([]);
    setResultado(null);
    setError("");
    setConfirmada(false);
    if (capaRutaRef.current) {
      mapRef.current.removeLayer(capaRutaRef.current);
      capaRutaRef.current = null;
    }
  };

  const trazarRuta = async () => {
    if (puntos.length < 2) {
      setError("Marca al menos 2 puntos en el mapa: origen y destino");
      return;
    }
    setError("");
    setCalculando(true);
    try {
      const { geometria, distanciaKm, duracionMin } = await calcularRuta(puntos);

      const mapa = mapRef.current;
      if (capaRutaRef.current) mapa.removeLayer(capaRutaRef.current);
      capaRutaRef.current = L.polyline(geometria, { color: "#e85d2f", weight: 5 }).addTo(mapa);
      mapa.fitBounds(capaRutaRef.current.getBounds(), { padding: [30, 30] });

      setResultado({ distanciaKm, duracionMin, geometria });
      setConfirmada(false);
    } catch (e) {
      setError(e.message || "No se pudo calcular la ruta");
    } finally {
      setCalculando(false);
    }
  };

  const confirmarRuta = () => {
    const [origen, ...resto] = puntos;
    const destino = resto[resto.length - 1];
    const paradas = resto.slice(0, -1);
    setConfirmada(true);
    onRutaLista({ origen, destino, paradas, geometria: resultado.geometria, distanciaKm: resultado.distanciaKm, duracionMin: resultado.duracionMin });
  };

  return (
    <div>
      <p className="text-sm text-gray-600 mb-2">
        Haz clic en el mapa siguiendo tu recorrido: el primer clic es tu origen, el
        último siempre se toma como destino (si sigues haciendo clic, el destino se
        corre y el punto anterior queda como parada).
      </p>

      <div ref={contenedorRef} className="w-full h-[400px] rounded-lg border border-gray-300" />

      {puntos.length > 0 && (
        <ul className="mt-2 text-sm text-gray-700 space-y-1">
          {puntos.map((p, i) => {
            const etiqueta = i === 0 ? "Origen" : i === puntos.length - 1 ? "Destino" : `Parada ${i}`;
            return (
              <li key={i} className="flex justify-between items-center">
                <span><b>{etiqueta}:</b> {p.direccion}</span>
                <button type="button" onClick={() => quitarPunto(i)} className="text-red-600 hover:underline">
                  quitar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-3 mt-3">
        <button
          type="button"
          onClick={trazarRuta}
          disabled={calculando || puntos.length < 2}
          className="bg-taco text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {calculando ? "Calculando..." : "🧭 Calcular ruta por calles"}
        </button>
        <button
          type="button"
          onClick={deshacerUltimo}
          disabled={puntos.length === 0}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg disabled:opacity-50"
        >
          ↩️ Deshacer último punto
        </button>
        <button type="button" onClick={reiniciar} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
          🗑 Limpiar mapa
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      {resultado && !confirmada && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-gray-800">
            Distancia: {resultado.distanciaKm} km — Duración estimada: {resultado.duracionMin} min
          </p>
          <p className="text-sm font-medium mt-1 mb-2">¿Es correcta tu ruta?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmarRuta}
              className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm"
            >
              ✅ Sí, continuar
            </button>
            <button
              type="button"
              onClick={() => setResultado(null)}
              className="bg-gray-200 text-gray-800 px-4 py-1.5 rounded-lg text-sm"
            >
              ✏️ Seguir editando
            </button>
          </div>
        </div>
      )}

      {confirmada && (
        <p className="mt-3 text-sm text-green-700">
          ✓ Ruta confirmada. Si necesitas cambiarla, edita los puntos arriba y vuelve a calcular.
        </p>
      )}
    </div>
  );
}
