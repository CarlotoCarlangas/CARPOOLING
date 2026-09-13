import { useEffect, useRef } from "react";
import L from "leaflet";
import { agregarCapaBase } from "../services/basemap";
import "../services/leafletIconFix";

function iconoAuto() {
  return L.divIcon({
    className: "",
    html: `<div style="width:32px;height:32px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:16px;">🚗</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function iconoPasajero(n, resaltado) {
  const tam = resaltado ? 30 : 24;
  return L.divIcon({
    className: "",
    html: `<div style="width:${tam}px;height:${tam}px;border-radius:50%;background:#e85d2f;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${resaltado ? 14 : 12}px;">${n}</div>`,
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
  });
}

/**
 * Mapa del CONDUCTOR durante el viaje: su propio auto (su geolocalización) y
 * los puntos de subida de cada pasajero que reservó, numerados. Le sirve para
 * ver a cuánto está de cada uno y en qué orden conviene recogerlos.
 */
export default function MapaConductor({ conductorPos, pasajeros = [], resaltadoId, onClickPin }) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const capasRef = useRef([]);

  useEffect(() => {
    const mapa = L.map(contenedorRef.current, { scrollWheelZoom: false, zoomControl: false });
    agregarCapaBase(mapa);
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

    pasajeros.forEach((p, i) => {
      const m = L.marker([p.lat, p.lng], { icon: iconoPasajero(i + 1, p.id === resaltadoId) })
        .bindPopup(`<b>${i + 1}. ${p.nombre}</b><br>${p.direccion || ""}`);
      if (onClickPin) m.on("click", () => onClickPin(p.id));
      agregar(m);
      puntos.push([p.lat, p.lng]);
    });

    if (conductorPos) {
      agregar(L.marker([conductorPos.lat, conductorPos.lng], { icon: iconoAuto() }).bindPopup("Tú (conductor)"));
      puntos.push([conductorPos.lat, conductorPos.lng]);
    }

    if (puntos.length >= 2) {
      mapa.fitBounds(puntos, { padding: [50, 50], maxZoom: 16 });
    } else if (puntos.length === 1) {
      mapa.setView(puntos[0], 14);
    }
  }, [conductorPos, pasajeros, resaltadoId, onClickPin]);

  return <div ref={contenedorRef} className="w-full h-full" />;
}
