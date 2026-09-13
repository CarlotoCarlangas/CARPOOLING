import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

const DIA_CORTO = {
  lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue",
  viernes: "Vie", sabado: "Sáb", domingo: "Dom",
};

/**
 * Hub del conductor: sus viajes publicados. Desde cada uno puede EDITAR la
 * ruta o ver sus SOLICITUDES. Reemplaza la antigua bandeja global "Pedidos"
 * (ahora las solicitudes se ven agrupadas por viaje).
 */
export default function MisViajes() {
  const { usuario, token } = useAuth();
  const [rutas, setRutas] = useState([]);
  const [pendientesPorRuta, setPendientesPorRuta] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usuario?.id) return;
    let activo = true;
    setCargando(true);
    Promise.all([api.rutasDeConductor(usuario.id), api.solicitudesRecibidas(token)])
      .then(([rs, sols]) => {
        if (!activo) return;
        setRutas(rs);
        const conteo = {};
        (sols || []).forEach((s) => {
          if (s.estado === "pendiente") conteo[s.ruta.id] = (conteo[s.ruta.id] || 0) + 1;
        });
        setPendientesPorRuta(conteo);
      })
      .catch((e) => activo && setError(e.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [usuario?.id, token]);

  return (
    <div className="max-w-2xl mx-auto p-6 my-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Mis viajes</h1>
        <Link to="/crear-ruta" className="text-sm bg-taco text-white px-3 py-1.5 rounded-lg font-semibold">
          + Publicar
        </Link>
      </div>

      {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!cargando && rutas.length === 0 && (
        <div className="bg-white rounded-2xl shadow-card p-6 text-center border border-slate-100">
          <p className="text-gray-600 text-sm mb-3">Todavía no has publicado ningún viaje.</p>
          <Link to="/crear-ruta" className="inline-block bg-taco text-white px-5 py-2.5 rounded-lg font-semibold">
            Publicar mi primera ruta
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {rutas.map((r) => {
          const pendientes = pendientesPorRuta[r.id] || 0;
          return (
            <div
              key={r.id}
              className={`bg-white rounded-2xl shadow-card p-4 border ${
                r.en_curso ? "border-green-400" : "border-slate-100"
              }`}
            >
              {r.apodo && <p className="text-sm font-bold text-taco">{r.apodo}</p>}
              <h2 className="text-lg font-bold leading-snug text-gray-900">
                {r.origen_comuna || r.origen_direccion} <span className="text-gray-400">→</span>{" "}
                {r.destino_comuna || r.destino_direccion}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                <span>🕐 {r.hora_salida}</span>
                <span>💺 {r.cupos_disponibles}/{r.cupos_totales}</span>
                <span>💲 {r.precio_sugerido.toLocaleString("es-CL")}</span>
              </div>
              {r.dias_recurrencia?.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {r.dias_recurrencia.map((d) => DIA_CORTO[d] || d).join(" · ")}
                </p>
              )}
              {r.en_curso && (
                <p className="text-xs text-green-700 font-semibold mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span> Viaje en curso
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 mt-3">
                <Link
                  to={`/mis-viajes/${r.id}/editar`}
                  className="text-center bg-white border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-semibold"
                >
                  ✏️ Editar
                </Link>
                <Link
                  to={`/mis-viajes/${r.id}/solicitudes`}
                  className="relative text-center bg-taco text-white rounded-lg py-2 text-sm font-semibold"
                >
                  📨 Solicitudes
                  {pendientes > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {pendientes}
                    </span>
                  )}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
