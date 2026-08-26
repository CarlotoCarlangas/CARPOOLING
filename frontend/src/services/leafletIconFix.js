/**
 * Leaflet busca sus íconos de marcador con rutas relativas que no
 * funcionan tal cual con bundlers como Vite. Esto los reemplaza por las
 * versiones que Vite sí puede empaquetar. Se importa una sola vez.
 */
import L from "leaflet";
import icon2x from "leaflet/dist/images/marker-icon-2x.png";
import icon from "leaflet/dist/images/marker-icon.png";
import shadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: icon2x,
  iconUrl: icon,
  shadowUrl: shadow,
});
