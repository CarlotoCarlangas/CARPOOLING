import { useEffect, useRef } from "react";
import L from "leaflet";
import "../services/leafletIconFix";

/**
 * Mapa de solo lectura que dibuja una ruta ya calculada (geometría +
 * origen/destino/paradas), usado para mostrarle la ruta al pasajero.
 */
export default function MapaVistaRuta({ ruta, alturaClase = "h-[300px]" }) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);

  useEffect(() => {
    const mapa = L.map(contenedorRef.current, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; colaboradores de OpenStreetMap",
      maxZoom: 19,
    }).addTo(mapa);
    mapaRef.current = mapa;

    return () => mapa.remove();
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !ruta) return;

    L.marker([ruta.origen_lat, ruta.origen_lng]).addTo(mapa).bindPopup(`Origen: ${ruta.origen_direccion}`);
    L.marker([ruta.destino_lat, ruta.destino_lng]).addTo(mapa).bindPopup(`Destino: ${ruta.destino_direccion}`);
    (ruta.paradas || []).forEach((p, i) => {
      L.marker([p.lat, p.lng]).addTo(mapa).bindPopup(`Parada ${i + 1}: ${p.direccion}`);
    });

    if (ruta.geometria?.length) {
      const linea = L.polyline(ruta.geometria, { color: "#e85d2f", weight: 5 }).addTo(mapa);
      mapa.fitBounds(linea.getBounds(), { padding: [30, 30] });
    } else {
      mapa.fitBounds([
        [ruta.origen_lat, ruta.origen_lng],
        [ruta.destino_lat, ruta.destino_lng],
      ]);
    }
  }, [ruta]);

  return <div ref={contenedorRef} className={`w-full ${alturaClase} rounded-lg border border-gray-300`} />;
}
