import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "../services/leafletIconFix";

const CENTRO_INICIAL = [-33.53, -70.8];

const iconoOrigen = L.divIcon({
  className: "",
  html: '<div style="background:#16a34a;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 3px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14],
});
const iconoDestino = L.divIcon({
  className: "",
  html: '<div style="background:#e85d2f;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 3px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14],
});

// Clusters de color distinto para origen (verde) y destino (naranja), para
// que se sigan distinguiendo aunque el mapa tenga muchos pines agrupados.
function grupoCluster(colorHex) {
  return L.markerClusterGroup({
    iconCreateFunction: (cluster) =>
      L.divIcon({
        html: `<div style="background:${colorHex};color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border:2px solid white;box-shadow:0 0 3px rgba(0,0,0,.4)">${cluster.getChildCount()}</div>`,
        className: "",
        iconSize: [32, 32],
      }),
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    maxClusterRadius: 50,
  });
}

/**
 * Mapa de búsqueda del pasajero: dibuja todas las rutas candidatas (línea +
 * marcador de origen/destino, agrupados en clusters por color cuando hay
 * muchos puntos cercanos). Si el pasajero marcó un punto propio de origen,
 * dibuja el círculo de tolerancia caminable alrededor de él. Si escribió
 * una dirección de destino (`centrarEn`), hace zoom ahí en vez de encuadrar
 * todo — el destino no tiene radio, solo explorar el mapa.
 */
export default function MapaBusqueda({ rutas, circuloOrigen, centrarEn, ladoActivo, onClickMapa }) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const capasRef = useRef([]);
  const onClickRef = useRef(onClickMapa);
  onClickRef.current = onClickMapa;

  useEffect(() => {
    const mapa = L.map(contenedorRef.current).setView(CENTRO_INICIAL, 11);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    }).addTo(mapa);

    mapa.on("click", (e) => onClickRef.current?.(e.latlng.lat, e.latlng.lng));

    mapaRef.current = mapa;
    return () => mapa.remove();
  }, []);

  // Redibuja rutas + círculos cada vez que cambian
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    capasRef.current.forEach((c) => mapa.removeLayer(c));
    capasRef.current = [];

    const agregar = (capa) => {
      capa.addTo(mapa);
      capasRef.current.push(capa);
    };

    const clusterOrigen = grupoCluster("#16a34a");
    const clusterDestino = grupoCluster("#e85d2f");

    (rutas || []).forEach((r) => {
      if (r.geometria?.length) {
        agregar(L.polyline(r.geometria, { color: "#94a3b8", weight: 4, opacity: 0.8 }));
      }
      clusterOrigen.addLayer(
        L.marker([r.origen_lat, r.origen_lng], { icon: iconoOrigen }).bindPopup(
          `<b>${r.conductor.nombre}</b><br/>Origen: ${r.origen_direccion}<br/>${r.cupos_disponibles} cupos disponibles<br/><a href="/rutas/${r.id}">Ver detalle →</a>`
        )
      );
      clusterDestino.addLayer(
        L.marker([r.destino_lat, r.destino_lng], { icon: iconoDestino }).bindPopup(
          `<b>${r.conductor.nombre}</b><br/>Destino: ${r.destino_direccion}<br/>${r.cupos_disponibles} cupos disponibles<br/><a href="/rutas/${r.id}">Ver detalle →</a>`
        )
      );
    });

    agregar(clusterOrigen);
    agregar(clusterDestino);

    if (circuloOrigen) {
      agregar(
        L.circle([circuloOrigen.lat, circuloOrigen.lng], {
          radius: circuloOrigen.radioM,
          color: "#16a34a",
          fillOpacity: 0.1,
        })
      );
    }
    if (centrarEn) {
      // El pasajero escribió una dirección de destino: hacemos zoom ahí en
      // vez de encuadrar todos los resultados — el punto es que explore esa
      // zona acercándose/alejándose (clustering), no que le acotemos nada.
      // animate:false porque el salto de zoom puede ser grande (ej. de la
      // vista general del corredor a una calle específica) y la animación
      // de Leaflet no siempre completa bien saltos así de grandes.
      mapa.setView([centrarEn.lat, centrarEn.lng], 15, { animate: false });
    } else {
      const puntos = [
        ...(rutas || []).flatMap((r) => [
          [r.origen_lat, r.origen_lng],
          [r.destino_lat, r.destino_lng],
        ]),
        ...(circuloOrigen ? [[circuloOrigen.lat, circuloOrigen.lng]] : []),
      ];
      if (puntos.length > 0) {
        mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 14 });
      }
    }
  }, [rutas, circuloOrigen, centrarEn]);

  return (
    <div>
      {ladoActivo && (
        <p className="text-xs text-white bg-gray-800 inline-block px-2 py-1 rounded mb-1">
          Haz clic en el mapa para marcar tu {ladoActivo === "origen" ? "origen" : "destino"}
        </p>
      )}
      <div ref={contenedorRef} className="w-full h-[420px] rounded-lg border border-gray-300" />
    </div>
  );
}
