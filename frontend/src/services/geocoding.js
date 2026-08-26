/**
 * Geocodificación inversa (coordenadas -> dirección legible) usando el
 * servicio público de Nominatim (OpenStreetMap).
 *
 * TODO PRODUCCIÓN: Nominatim público tiene límite de 1 request/segundo y
 * no da garantías de uptime. En producción conviene un proveedor de
 * geocoding con API key (ej. Mapbox, Google) o un Nominatim propio.
 */
export async function direccionDesdeCoordenadas(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    );
    if (!res.ok) throw new Error("fallo geocoding");
    const data = await res.json();

    // El display_name completo de Nominatim es demasiado largo para la UI
    // (incluye región, código postal, país...). Armamos una versión corta
    // con solo calle + comuna/sector cuando están disponibles.
    const a = data.address || {};
    const calle = a.road || a.pedestrian || a.footway;
    const sector = a.suburb || a.city_district || a.village || a.town || a.city;
    const corta = [calle, sector].filter(Boolean).join(", ");

    return corta || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}
