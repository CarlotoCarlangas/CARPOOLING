import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";

/**
 * Maneja el "viaje en curso" del CONDUCTOR a nivel de toda la app, no de una
 * sola pantalla. Así, una vez que el chofer aprieta "Iniciar viaje", su
 * ubicación se sigue enviando aunque navegue a otra pantalla (antes el envío
 * estaba atado a la página de detalle y se cortaba al salir de ahí).
 *
 * Límite conocido (igual que antes): si el chofer CIERRA la app/pestaña o el
 * teléfono se bloquea, el navegador suspende el JavaScript y el envío se
 * detiene. Para compartir en segundo plano de verdad haría falta una app
 * nativa o un Service Worker con permisos especiales.
 * TODO PRODUCCIÓN: compartir ubicación en segundo plano.
 */
const ViajeContext = createContext(null);

// Cada cuánto el navegador del conductor manda su posición mientras maneja.
const INTERVALO_UBICACION_MS = 8000;

export function ViajeProvider({ children }) {
  const { token } = useAuth();
  // Id de la ruta cuyo viaje está compartiendo ubicación desde ESTE navegador.
  const [rutaEnCursoId, setRutaEnCursoId] = useState(null);
  const intervaloRef = useRef(null);

  const mandarUbicacion = (rutaId) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // PRIVACIDAD: la ubicación del conductor solo se envía mientras el
        // viaje está en curso, y se usa únicamente para mostrarle al pasajero
        // cuánto falta. Se borra en el backend al finalizar el viaje.
        api
          .actualizarUbicacion(rutaId, pos.coords.latitude, pos.coords.longitude, token)
          .catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const arrancarEnvio = (rutaId) => {
    if (intervaloRef.current) clearInterval(intervaloRef.current);
    mandarUbicacion(rutaId); // manda una de inmediato, sin esperar el intervalo
    intervaloRef.current = setInterval(() => mandarUbicacion(rutaId), INTERVALO_UBICACION_MS);
  };

  const detenerEnvio = () => {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  };

  // El chofer aprieta "Iniciar viaje". Devuelve la ruta actualizada.
  const iniciar = async (rutaId) => {
    const ruta = await api.iniciarViaje(rutaId, token);
    setRutaEnCursoId(rutaId);
    arrancarEnvio(rutaId);
    return ruta;
  };

  // El servidor ya dice que la ruta está en_curso (ej. el chofer recargó la
  // página): retomar el envío de ubicación sin volver a "iniciar".
  const reanudar = (rutaId) => {
    if (rutaEnCursoId === rutaId && intervaloRef.current) return; // ya se está enviando
    setRutaEnCursoId(rutaId);
    arrancarEnvio(rutaId);
  };

  // El chofer aprieta "Finalizar viaje". Devuelve la ruta actualizada.
  const finalizar = async (rutaId) => {
    detenerEnvio();
    setRutaEnCursoId(null);
    return await api.finalizarViaje(rutaId, token);
  };

  // Si se desmonta el provider (cierre de app), cortar el intervalo.
  useEffect(() => () => detenerEnvio(), []);

  return (
    <ViajeContext.Provider value={{ rutaEnCursoId, iniciar, reanudar, finalizar }}>
      {children}
    </ViajeContext.Provider>
  );
}

export function useViaje() {
  const ctx = useContext(ViajeContext);
  if (!ctx) throw new Error("useViaje debe usarse dentro de <ViajeProvider>");
  return ctx;
}
