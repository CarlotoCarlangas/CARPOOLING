/**
 * Ruteo real por calles usando el servidor público de demostración de OSRM.
 *
 * TODO PRODUCCIÓN: el servidor público (router.project-osrm.org) es
 * gratuito pero sin garantías de uptime ni límite de uso — sirve para
 * prototipo y demo, no para producción. En producción hay que levantar
 * un servidor OSRM propio (Docker) o contratar un proveedor de ruteo.
 */
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

/**
 * @param {{lat:number, lng:number}[]} puntos - en orden: origen, paradas, destino (mínimo 2)
 * @returns {Promise<{geometria:[number,number][], distanciaKm:number, duracionMin:number}>}
 */
export async function calcularRuta(puntos) {
  if (puntos.length < 2) {
    throw new Error("Se necesitan al menos 2 puntos (origen y destino) para trazar la ruta");
  }

  const coords = puntos.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("No se pudo calcular la ruta por calles. Intenta de nuevo.");
  }
  const data = await res.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("No se encontró una ruta por calles entre esos puntos.");
  }

  const ruta = data.routes[0];
  // OSRM devuelve [lng, lat]; Leaflet espera [lat, lng].
  const geometria = ruta.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

  return {
    geometria,
    distanciaKm: Math.round((ruta.distance / 1000) * 10) / 10,
    duracionMin: Math.round(ruta.duration / 60),
  };
}
