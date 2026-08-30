import { useEffect, useRef } from "react";
import L from "leaflet";
import "../services/leafletIconFix";

const CENTRO_RM = [-33.53, -70.8];

/**
 * Mapa simple de un solo clic: el usuario marca un punto y se lo pasamos
 * a quien nos use (ya reverso-geocodificado). Es el respaldo para cuando
 * la búsqueda de direcciones por texto no encuentra nada — pasa seguido
 * en calles residenciales de comunas periurbanas, donde OpenStreetMap
 * todavía no tiene todo mapeado con nombre y numeración.
 */
export default function MapaPunto({ onElegir }) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const marcadorRef = useRef(null);
  const onElegirRef = useRef(onElegir);
  onElegirRef.current = onElegir;

  useEffect(() => {
    const mapa = L.map(contenedorRef.current).setView(CENTRO_RM, 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; colaboradores de OpenStreetMap",
      maxZoom: 19,
    }).addTo(mapa);

    mapa.on("click", (e) => {
      const { lat, lng } = e.latlng;
      if (marcadorRef.current) mapa.removeLayer(marcadorRef.current);
      marcadorRef.current = L.marker([lat, lng]).addTo(mapa);
      onElegirRef.current?.(lat, lng);
    });

    mapaRef.current = mapa;
    return () => mapa.remove();
  }, []);

  return (
    <div>
      <div ref={contenedorRef} className="w-full h-[220px] rounded-lg border border-gray-300" />
      <p className="text-xs text-gray-500 mt-1.5">Haz clic en el mapa para marcar el punto exacto.</p>
    </div>
  );
}
