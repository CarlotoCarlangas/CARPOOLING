/**
 * Ubicación del dispositivo del pasajero (GPS del celular o del navegador),
 * usada para sugerir automáticamente el punto de origen.
 *
 * PRIVACIDAD (dato sensible - geolocalización): solo se pide al llegar al
 * paso de elegir origen, con el permiso estándar del navegador (el usuario
 * puede rechazarlo y seguir usando la app eligiendo su comuna a mano). No
 * se guarda un historial de ubicaciones, solo se usa la posición actual
 * para centrar el mapa y sugerir un punto.
 */
export function obtenerUbicacionActual() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este navegador no soporta geolocalización"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}
