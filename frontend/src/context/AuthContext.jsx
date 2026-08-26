import { createContext, useContext, useEffect, useState } from "react";
import { api, alRecibirNoAutorizado } from "../services/api";

const AuthContext = createContext(null);

// PRIVACIDAD: se guarda el token y los datos básicos del usuario en
// localStorage solo para mantener la sesión iniciada en este dispositivo.
// No se guarda la contraseña. El usuario puede cerrar sesión para borrar
// estos datos del navegador en cualquier momento.
const STORAGE_KEY = "taco_sesion";

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(() => {
    const guardada = localStorage.getItem(STORAGE_KEY);
    return guardada ? JSON.parse(guardada) : null;
  });

  useEffect(() => {
    if (sesion) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [sesion]);

  useEffect(() => {
    alRecibirNoAutorizado(() => setSesion(null));
  }, []);

  const registrar = async (datos) => {
    const respuesta = await api.register(datos);
    setSesion(respuesta);
    return respuesta;
  };

  const iniciarSesion = async (datos) => {
    const respuesta = await api.login(datos);
    setSesion(respuesta);
    return respuesta;
  };

  const cerrarSesion = () => setSesion(null);

  const refrescarPerfil = async () => {
    if (!sesion) return;
    const usuario = await api.miPerfil(sesion.token);
    setSesion((prev) => ({ ...prev, usuario }));
  };

  return (
    <AuthContext.Provider
      value={{
        usuario: sesion?.usuario ?? null,
        token: sesion?.token ?? null,
        estaAutenticado: !!sesion,
        registrar,
        iniciarSesion,
        cerrarSesion,
        refrescarPerfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
