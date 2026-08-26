import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "../services/leafletIconFix";
import { calcularRuta } from "../services/osrm";
import { direccionDesdeCoordenadas } from "../services/geocoding";

const CENTRO_INICIAL = [-33.53, -70.8]; // entre Peñaflor y Santiago

/**
 * Mapa interactivo para que el conductor defina origen, paradas
 * intermedias y destino haciendo clic, y calcule la ruta real por calles
 * (OSRM). Cuando la ruta queda calculada, avisa al padre vía onRutaLista.
 */
export default function MapaSeleccionRuta({ onRutaLista }) {
  const mapRef = useRef(null);
  const contenedorRef = useRef(null);
  const capaRutaRef = useRef(null);
  const marcadoresRef = useRef({ origen: null, destino: null, paradas: [] });

  const [modo, setModo] = useState("origen"); // "origen" | "parada" | "destino"
  const [origen, setOrigen] = useState(null);
  const [destino, setDestino] = useState(null);
  const [paradas, setParadas] = useState([]);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    const mapa = L.map(contenedorRef.current).setView(CENTRO_INICIAL, 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; colaboradores de OpenStreetMap",
      maxZoom: 19,
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
      const punto = { lat, lng, direccion };

      if (modo === "origen") {
        setOrigen(punto);
        setModo("destino");
      } else if (modo === "destino") {
        setDestino(punto);
        setModo("parada");
      } else {
        setParadas((prev) => [...prev, punto]);
      }
      setResultado(null);
    };

    mapa.on("click", alHacerClic);
    return () => mapa.off("click", alHacerClic);
  }, [modo]);

  // Redibuja los marcadores cada vez que cambian los puntos
  useEffect(() => {
    const mapa = mapRef.current;
    if (!mapa) return;

    if (marcadoresRef.current.origen) mapa.removeLayer(marcadoresRef.current.origen);
    if (marcadoresRef.current.destino) mapa.removeLayer(marcadoresRef.current.destino);
    marcadoresRef.current.paradas.forEach((m) => mapa.removeLayer(m));
    marcadoresRef.current.paradas = [];

    if (origen) {
      marcadoresRef.current.origen = L.marker([origen.lat, origen.lng])
        .addTo(mapa)
        .bindPopup(`Origen: ${origen.direccion}`);
    }
    if (destino) {
      marcadoresRef.current.destino = L.marker([destino.lat, destino.lng])
        .addTo(mapa)
        .bindPopup(`Destino: ${destino.direccion}`);
    }
    paradas.forEach((p, i) => {
      const m = L.marker([p.lat, p.lng]).addTo(mapa).bindPopup(`Parada ${i + 1}: ${p.direccion}`);
      marcadoresRef.current.paradas.push(m);
    });
  }, [origen, destino, paradas]);

  const quitarParada = (i) => setParadas((prev) => prev.filter((_, idx) => idx !== i));

  const reiniciar = () => {
    setOrigen(null);
    setDestino(null);
    setParadas([]);
    setResultado(null);
    setError("");
    setModo("origen");
    if (capaRutaRef.current) {
      mapRef.current.removeLayer(capaRutaRef.current);
      capaRutaRef.current = null;
    }
  };

  const trazarRuta = async () => {
    if (!origen || !destino) {
      setError("Primero marca el origen y el destino en el mapa");
      return;
    }
    setError("");
    setCalculando(true);
    try {
      const puntos = [origen, ...paradas, destino];
      const { geometria, distanciaKm, duracionMin } = await calcularRuta(puntos);

      const mapa = mapRef.current;
      if (capaRutaRef.current) mapa.removeLayer(capaRutaRef.current);
      capaRutaRef.current = L.polyline(geometria, { color: "#e85d2f", weight: 5 }).addTo(mapa);
      mapa.fitBounds(capaRutaRef.current.getBounds(), { padding: [30, 30] });

      const datos = { origen, destino, paradas, geometria, distanciaKm, duracionMin };
      setResultado({ distanciaKm, duracionMin });
      onRutaLista(datos);
    } catch (e) {
      setError(e.message || "No se pudo calcular la ruta");
    } finally {
      setCalculando(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2 text-sm">
        <span
          className={`px-3 py-1 rounded-full ${
            modo === "origen" ? "bg-taco text-white" : "bg-gray-200"
          }`}
        >
          {origen ? "✓ Origen marcado" : "1. Haz clic para marcar el origen"}
        </span>
        <span
          className={`px-3 py-1 rounded-full ${
            modo === "destino" ? "bg-taco text-white" : "bg-gray-200"
          }`}
        >
          {destino ? "✓ Destino marcado" : "2. Luego marca el destino"}
        </span>
        <span
          className={`px-3 py-1 rounded-full ${
            modo === "parada" ? "bg-taco text-white" : "bg-gray-200"
          }`}
        >
          3. Clics siguientes agregan paradas intermedias ({paradas.length})
        </span>
      </div>

      <div ref={contenedorRef} className="w-full h-[400px] rounded-lg border border-gray-300" />

      {paradas.length > 0 && (
        <ul className="mt-2 text-sm text-gray-700 space-y-1">
          {paradas.map((p, i) => (
            <li key={i} className="flex justify-between items-center">
              <span>Parada {i + 1}: {p.direccion}</span>
              <button
                type="button"
                onClick={() => quitarParada(i)}
                className="text-red-600 hover:underline"
              >
                quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3 mt-3">
        <button
          type="button"
          onClick={trazarRuta}
          disabled={calculando || !origen || !destino}
          className="bg-taco text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {calculando ? "Calculando..." : "🧭 Calcular ruta por calles"}
        </button>
        <button
          type="button"
          onClick={reiniciar}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg"
        >
          🗑 Limpiar mapa
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      {resultado && (
        <p className="text-sm text-gray-700 mt-2">
          Distancia: {resultado.distanciaKm} km — Duración estimada: {resultado.duracionMin} min
        </p>
      )}
    </div>
  );
}
