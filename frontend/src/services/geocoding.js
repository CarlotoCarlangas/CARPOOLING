/**
 * Geocodificación (dirección <-> coordenadas) usando el servicio público
 * de Nominatim (OpenStreetMap).
 *
 * TODO PRODUCCIÓN: Nominatim público tiene límite de 1 request/segundo y
 * no da garantías de uptime. En producción conviene un proveedor de
 * geocoding con API key (ej. Mapbox, Google) o un Nominatim propio.
 */

function extraerDireccionYComuna(data) {
  const a = data.address || {};
  const calle = a.road || a.pedestrian || a.footway;
  const sector = a.suburb || a.city_district || a.village || a.town || a.city;
  // La "comuna" chilena corresponde casi siempre a lo que Nominatim
  // etiqueta como city/town/municipality — es más amplia que "suburb"
  // (que suele ser un barrio dentro de la comuna).
  const comuna = a.city || a.town || a.municipality || a.county || sector || null;
  const direccion = [calle, sector].filter(Boolean).join(", ") || data.display_name;
  return { direccion, comuna };
}

/** Coordenadas -> dirección legible + comuna. Usado al hacer clic en el mapa. */
export async function direccionDesdeCoordenadas(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    );
    if (!res.ok) throw new Error("fallo geocoding");
    const data = await res.json();
    const { direccion, comuna } = extraerDireccionYComuna(data);
    return { direccion: direccion || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, comuna };
  } catch {
    return { direccion: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, comuna: null };
  }
}

/**
 * Texto de dirección -> lista de coincidencias con coordenadas. Usado en
 * el buscador del pasajero ("escribe tu dirección"). `comuna` es opcional
 * y ayuda a Nominatim a acotar la búsqueda.
 */
export async function buscarDireccion(texto, comuna) {
  if (!texto || texto.trim().length < 3) return [];
  const consulta = [texto, comuna, "Chile"].filter(Boolean).join(", ");
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(consulta)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item) => {
      const { direccion, comuna: comunaEncontrada } = extraerDireccionYComuna(item);
      return {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        direccion: direccion || item.display_name,
        comuna: comunaEncontrada,
      };
    });
  } catch {
    return [];
  }
}
