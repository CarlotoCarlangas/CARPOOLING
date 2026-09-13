import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useModo } from "../context/ModoContext";

// Íconos SVG (estilo línea, se ven más "app" que los emoji).
function Ico({ d, activo }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={activo ? 2.1 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <path d={d} />
    </svg>
  );
}

const ICONOS = {
  inicio: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125A1.125 1.125 0 005.625 21h3.375v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h3.375A1.125 1.125 0 0019.5 19.875V9.75",
  buscar: "M21 21l-5.2-5.2m0 0a7.5 7.5 0 10-10.6-10.6 7.5 7.5 0 0010.6 10.6z",
  publicar: "M12 4.5v15m7.5-7.5h-15",
  reservas: "M3.375 5.25h17.25c.621 0 1.125.504 1.125 1.125v2.4a2.4 2.4 0 000 4.65v2.4c0 .621-.504 1.125-1.125 1.125H3.375A1.125 1.125 0 012.25 16.5v-2.4a2.4 2.4 0 000-4.65v-2.4c0-.621.504-1.125 1.125-1.125z M15 5.5v13",
  solicitudes: "M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M4.76 5.34l-2.41 7.84a2.25 2.25 0 00-.1.66V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.16c0-.22-.034-.44-.1-.66l-2.41-7.84a2.25 2.25 0 00-2.15-1.59H6.911a2.25 2.25 0 00-2.15 1.59z",
  misviajes: "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-6m0-11.25v11.25m0-11.25H3.375c-.621 0-1.125.504-1.125 1.125v2.25M14.25 6.75h4.632a2.056 2.056 0 011.58.86M14.25 6.75V4.5a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v.75",
  perfil: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0A17.9 17.9 0 0112 21.75c-2.68 0-5.22-.585-7.5-1.63z",
};

export default function Navbar() {
  const { estaAutenticado } = useAuth();
  const { modo } = useModo();
  const location = useLocation();

  // Sin barra si no hay sesión, o en pantallas "enfocadas" (auth, chat,
  // seguimiento en vivo) donde el menú estorba.
  const rutasSinBarra = ["/login", "/registro", "/terminos"];
  const prefijosSinBarra = ["/chat/", "/viaje/", "/mi-viaje/"];
  if (
    !estaAutenticado ||
    rutasSinBarra.includes(location.pathname) ||
    prefijosSinBarra.some((p) => location.pathname.startsWith(p))
  ) {
    return null;
  }

  // Las pestañas siguen el MODO activo (no los roles crudos): en modo pasajero
  // se ve Buscar/Reservas; en modo chofer, Publicar/Pedidos. Misma cantidad y
  // posición (Inicio primero, Perfil último) — solo cambian las dos del medio.
  const tabs = [{ to: "/", label: "Inicio", icon: ICONOS.inicio, exacta: true }];
  if (modo === "pasajero") {
    tabs.push({ to: "/buscar", label: "Buscar", icon: ICONOS.buscar });
    tabs.push({ to: "/mis-reservas", label: "Reservas", icon: ICONOS.reservas });
  } else {
    tabs.push({ to: "/crear-ruta", label: "Publicar", icon: ICONOS.publicar });
    tabs.push({ to: "/mis-viajes", label: "Mis viajes", icon: ICONOS.misviajes });
  }
  tabs.push({ to: "/perfil", label: "Perfil", icon: ICONOS.perfil });

  return (
    <nav className="flex-shrink-0 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around max-w-2xl mx-auto">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.exacta}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[56px] transition-colors ${
                isActive ? "text-taco" : "text-slate-400"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Ico d={t.icon} activo={isActive} />
                <span className={`text-[10px] leading-none ${isActive ? "font-semibold" : "font-medium"}`}>
                  {t.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
