import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

/**
 * Modo de uso de la app: "chofer" o "pasajero".
 * - Quien tiene UN solo rol: el modo es fijo (su rol) y no hay interruptor.
 * - Quien tiene AMBOS roles: puede alternar; se recuerda su elección.
 * El modo define el color de marca (azul pasajero / verde chofer) y qué
 * pestañas/contenido se muestran — la disposición se mantiene igual.
 */
const ModoContext = createContext(null);
const STORAGE_KEY = "carpooling_modo";

export function ModoProvider({ children }) {
  const { usuario } = useAuth();
  const esDual = !!(usuario?.es_conductor && usuario?.es_pasajero);

  const [modoElegido, setModoElegido] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "pasajero"
  );

  useEffect(() => {
    if (esDual) localStorage.setItem(STORAGE_KEY, modoElegido);
  }, [modoElegido, esDual]);

  let modo;
  if (esDual) modo = modoElegido;
  else if (usuario?.es_conductor) modo = "chofer";
  else modo = "pasajero"; // pasajero-only y también cuando no hay sesión (azul)

  return (
    <ModoContext.Provider value={{ modo, esDual, setModo: setModoElegido }}>
      {children}
    </ModoContext.Provider>
  );
}

export function useModo() {
  const ctx = useContext(ModoContext);
  if (!ctx) throw new Error("useModo debe usarse dentro de <ModoProvider>");
  return ctx;
}
