import { useEffect, useRef } from "react";
import L from "leaflet";
import "../services/leafletIconFix";

function iconoAuto() {
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:15px;">🚗</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function iconoEmbarque() {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#e85d2f;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/**
 * Mapa en vivo del Módulo 5: el auto del conductor (posición que llega
 * por polling desde el backend) y el punto de subida del pasajero, con
 * la línea de la ruta real por calles entre ambos (calculada aparte con
 * OSRM y pasada acá ya lista — este componente solo dibuja).
 */
export default function MapaSeguimiento({ conductorLat, conductorLng, embarque, geometria }) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const capasRef = useRef([]);

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
    if (!mapa) return;

    capasRef.current.forEach((c) => mapa.removeLayer(c));
    capasRef.current = [];
    const agregar = (capa) => {
      capa.addTo(mapa);
      capasRef.current.push(capa);
    };

    const puntos = [];

    if (embarque) {
      agregar(L.marker([embarque.lat, embarque.lng], { icon: iconoEmbarque() }).bindPopup(embarque.direccion));
      puntos.push([embarque.lat, embarque.lng]);
    }

    if (conductorLat != null && conductorLng != null) {
      agregar(L.marker([conductorLat, conductorLng], { icon: iconoAuto() }));
      puntos.push([conductorLat, conductorLng]);
    }

    if (geometria?.length) {
      agregar(L.polyline(geometria, { color: "#16a34a", weight: 4, opacity: 0.8, dashArray: "1 8", lineCap: "round" }));
    }

    if (puntos.length === 2) {
      mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 16 });
    } else if (puntos.length === 1) {
      mapa.setView(puntos[0], 15);
    }
  }, [conductorLat, conductorLng, embarque, geometria]);

  return <div ref={contenedorRef} className="w-full h-[220px] rounded-lg border border-gray-300" />;
}
