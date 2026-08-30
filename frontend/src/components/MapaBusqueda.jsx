import { useEffect, useRef } from "react";
import L from "leaflet";
import "../services/leafletIconFix";

function distanciaM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** El punto de la ruta (origen/destino "oficial" o alguna parada de esa
 * comuna) más cercano al punto que el pasajero marcó — es el que se
 * dibuja como pin representante de la ruta en este lado del mapa. */
function puntoRelevante(ruta, foco, lado) {
  const comunaLado = lado === "destino" ? ruta.destino_comuna : ruta.origen_comuna;
  const oficial =
    lado === "destino"
      ? { lat: ruta.destino_lat, lng: ruta.destino_lng, direccion: ruta.destino_direccion }
      : { lat: ruta.origen_lat, lng: ruta.origen_lng, direccion: ruta.origen_direccion };
  const candidatos = [oficial, ...(ruta.paradas || []).filter((p) => p.comuna === comunaLado)];
  if (!foco) return candidatos[0];
  return candidatos.reduce((mejor, p) =>
    distanciaM(foco.lat, foco.lng, p.lat, p.lng) < distanciaM(foco.lat, foco.lng, mejor.lat, mejor.lng)
      ? p
      : mejor
  );
}

function iconoPin({ color, resaltado }) {
  const size = resaltado ? 40 : 28;
  const check = resaltado
    ? `<div style="position:absolute;top:-3px;right:-3px;width:15px;height:15px;border-radius:50%;background:${color};border:2px solid #fff;display:flex;align-items:center;justify-content:center;">
         <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
       </div>`
    : "";
  const glow = resaltado
    ? `<div style="position:absolute;left:50%;bottom:2px;transform:translate(-50%,0);width:${size + 14}px;height:${size + 14}px;border-radius:50%;background:${color}38;"></div>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      ${glow}
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="position:relative;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3));opacity:${resaltado ? 1 : 0.8}">
        <path d="M12 22s-7.5-7.4-7.5-12.7a7.5 7.5 0 0 1 15 0C19.5 14.6 12 22 12 22z" fill="${color}"/>
        <circle cx="12" cy="9.3" r="3.2" fill="#fff"/>
      </svg>
      ${check}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

/**
 * Mapa de resultados del pasajero. Tiene dos modos, según qué props se
 * pasen:
 *
 * - Modo RUTAS (`rutas`): dibuja varias rutas completas (línea + el
 *   punto más cercano al foco elegido) y un círculo de radio caminable
 *   ajustable alrededor de ese foco (destino u origen, según `lado`).
 *   Se usa en los pasos 1, 2 y 3 (elegir destino/origen y ver los
 *   viajes disponibles).
 * - Modo PUNTOS (`puntos`): dibuja los puntos de UNA sola ruta ya
 *   elegida (sus paradas dentro de la comuna de origen del pasajero,
 *   más su punto de partida si corresponde) para que el pasajero
 *   elija dónde subir — sin círculo de radio, porque son paradas
 *   concretas del conductor, no una zona a explorar. Se usa en el
 *   paso 4.
 *
 * En ambos modos, el elemento con id === `resaltadaId` se dibuja
 * destacado (pin grande, con glow y check) — pensado para
 * sincronizarse con una lista de tarjetas fuera del mapa.
 */
export default function MapaBusqueda({ rutas, lado, foco, radioM, resaltadaId, onClickPin, onClickMapa, puntos, geometria, colorPuntos }) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const capasRef = useRef([]);
  const onClickPinRef = useRef(onClickPin);
  onClickPinRef.current = onClickPin;
  const onClickMapaRef = useRef(onClickMapa);
  onClickMapaRef.current = onClickMapa;

  useEffect(() => {
    // Sin botones de +/- : el mapa ocupa toda la pantalla (estilo Uber) y
    // se hace zoom con los dedos (pinch) o la rueda del mouse, no con
    // controles flotantes que competirían con el resto de la interfaz.
    const mapa = L.map(contenedorRef.current, { zoomControl: false }).setView([-33.53, -70.8], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; colaboradores de OpenStreetMap",
      maxZoom: 19,
    }).addTo(mapa);
    // Clic directo en el mapa (no en un pin): usado en los pasos de
    // elegir origen/destino para marcar el punto ahí mismo, sin necesitar
    // un segundo mapa embebido aparte.
    mapa.on("click", (e) => onClickMapaRef.current?.(e.latlng.lat, e.latlng.lng));
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

    const color = colorPuntos || (lado === "destino" ? "#e85d2f" : "#16a34a");

    if (puntos) {
      if (geometria?.length) {
        agregar(L.polyline(geometria, { color: "#94a3b8", weight: 4, opacity: 0.7 }));
      }
      puntos.forEach((p) => {
        const destacado = p.id === resaltadaId;
        const marcador = L.marker([p.lat, p.lng], { icon: iconoPin({ color, resaltado: destacado }) })
          .bindPopup(p.direccion)
          .on("click", () => onClickPinRef.current?.(p.id));
        agregar(marcador);
      });
      if (puntos.length) {
        mapa.fitBounds(
          puntos.map((p) => [p.lat, p.lng]),
          { padding: [40, 40], maxZoom: 16 }
        );
      }
      return;
    }

    (rutas || []).forEach((r) => {
      const destacada = r.id === resaltadaId;
      if (r.geometria?.length) {
        agregar(
          L.polyline(r.geometria, {
            color: destacada ? color : "#94a3b8",
            weight: destacada ? 5 : 3.5,
            opacity: destacada ? 0.95 : 0.75,
          })
        );
      }
      const punto = puntoRelevante(r, foco, lado);
      const marcador = L.marker([punto.lat, punto.lng], { icon: iconoPin({ color, resaltado: destacada }) })
        .bindPopup(
          `<b>${r.conductor.nombre}</b><br/>${punto.direccion}<br/>$${r.precio_pasajero.toLocaleString("es-CL")} · ${r.cupos_disponibles} cupos`
        )
        .on("click", () => onClickPinRef.current?.(r.id));
      agregar(marcador);
    });

    let circulo = null;
    if (foco && radioM) {
      circulo = L.circle([foco.lat, foco.lng], {
        radius: radioM,
        color,
        weight: 2,
        dashArray: "6 5",
        fillOpacity: 0.06,
      });
      agregar(circulo);
      agregar(
        L.circleMarker([foco.lat, foco.lng], { radius: 5, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 })
      );
    }

    if (circulo) {
      mapa.fitBounds(circulo.getBounds(), { padding: [30, 30], maxZoom: 16 });
    } else if (rutas?.length) {
      const centros = rutas.map((r) => {
        const p = puntoRelevante(r, foco, lado);
        return [p.lat, p.lng];
      });
      mapa.fitBounds(centros, { padding: [40, 40], maxZoom: 14 });
    }
  }, [rutas, lado, foco, radioM, resaltadaId, puntos, geometria, colorPuntos]);

  return <div ref={contenedorRef} className="w-full h-full" />;
}
