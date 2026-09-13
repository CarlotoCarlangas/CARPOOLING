import { useEffect, useRef } from "react";
import L from "leaflet";
import "../services/leafletIconFix";
import { agregarCapaBase } from "../services/basemap";

const COLOR_RUTA = "#2563EB";
const COLOR_PARADA = "#F59E0B";

function pin(texto, color) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;
      box-shadow:0 1px 5px rgba(0,0,0,.45);border:2px solid #fff;">${texto}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/**
 * Mapa de solo edición de PARADAS sobre una ruta ya trazada: muestra la
 * línea de la ruta (fija) y las paradas como pines numerados. Un clic en el
 * mapa agrega una parada (el padre la reverso-geocodifica). El origen y el
 * destino de la ruta NO se editan acá.
 */
export default function MapaEditarParadas({ geometria, paradas, onClickMapa }) {
  const contenedorRef = useRef(null);
  const mapRef = useRef(null);
  const capaRutaRef = useRef(null);
  const marcadoresRef = useRef([]);

  useEffect(() => {
    const mapa = L.map(contenedorRef.current).setView([-33.53, -70.8], 11);
    agregarCapaBase(mapa);
    mapRef.current = mapa;
    return () => mapa.remove();
  }, []);

  // Clic en el mapa -> agregar parada
  useEffect(() => {
    const mapa = mapRef.current;
    if (!mapa) return;
    const alClic = (e) => onClickMapa(e.latlng.lat, e.latlng.lng);
    mapa.on("click", alClic);
    return () => mapa.off("click", alClic);
  }, [onClickMapa]);

  // Dibujar la ruta (una vez que hay geometría)
  useEffect(() => {
    const mapa = mapRef.current;
    if (!mapa) return;
    if (capaRutaRef.current) mapa.removeLayer(capaRutaRef.current);
    if (geometria?.length) {
      capaRutaRef.current = L.polyline(geometria, { color: COLOR_RUTA, weight: 5, opacity: 0.7 }).addTo(mapa);
      mapa.fitBounds(capaRutaRef.current.getBounds(), { padding: [30, 30] });
    }
  }, [geometria]);

  // Dibujar las paradas
  useEffect(() => {
    const mapa = mapRef.current;
    if (!mapa) return;
    marcadoresRef.current.forEach((m) => mapa.removeLayer(m));
    marcadoresRef.current = [];
    (paradas || []).forEach((p, i) => {
      const m = L.marker([p.lat, p.lng], { icon: pin(String(i + 1), COLOR_PARADA) })
        .addTo(mapa)
        .bindTooltip(`Parada ${i + 1}: ${p.direccion || ""}`);
      marcadoresRef.current.push(m);
    });
  }, [paradas]);

  return <div ref={contenedorRef} className="w-full h-[300px] rounded-lg border border-gray-300" />;
}
