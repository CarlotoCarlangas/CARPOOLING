import L from "leaflet";

/**
 * Capa base (teselas) del mapa, centralizada en un solo lugar para todos los
 * componentes de mapa.
 *
 * - Si hay token de Mapbox (VITE_MAPBOX_TOKEN en un archivo .env), usa Mapbox
 *   (mejor experiencia visual).
 * - Si NO hay token, usa OpenStreetMap.
 * - Si Mapbox falla al cargar (token inválido, sin cuota, etc.), cae
 *   AUTOMÁTICAMENTE a OpenStreetMap — así el mapa nunca queda en blanco.
 *
 * Cambiar de proveedor = tocar solo este archivo. OSM queda siempre como
 * respaldo, como pidió el usuario ("si no funciona Mapbox, volvemos").
 */
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
// Estilo Mapbox. Para una app de movilidad "navigation-day-v1" resalta las
// calles; "streets-v12" es más general. Configurable por .env.
const ESTILO = import.meta.env.VITE_MAPBOX_STYLE || "mapbox/streets-v12";

function capaOSM() {
  return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; colaboradores de OpenStreetMap",
    maxZoom: 19,
  });
}

export function agregarCapaBase(mapa) {
  if (!TOKEN) return capaOSM().addTo(mapa);

  const mapbox = L.tileLayer(
    `https://api.mapbox.com/styles/v1/${ESTILO}/tiles/512/{z}/{x}/{y}@2x?access_token=${TOKEN}`,
    {
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; colaboradores de OpenStreetMap',
    }
  );

  // Respaldo automático: si Mapbox no carga, volvemos a OSM (una sola vez).
  let respaldoHecho = false;
  mapbox.on("tileerror", () => {
    if (respaldoHecho) return;
    respaldoHecho = true;
    console.warn("Mapbox no cargó las teselas; volviendo a OpenStreetMap.");
    mapa.removeLayer(mapbox);
    capaOSM().addTo(mapa);
  });

  return mapbox.addTo(mapa);
}
