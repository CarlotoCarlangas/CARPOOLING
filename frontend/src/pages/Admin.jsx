import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

/**
 * Panel de administración — SOLO para el dueño de la plataforma (es_admin).
 * Vista de SOLO LECTURA: el admin observa el estado del sistema (usuarios,
 * rutas y un resumen), no edita ni borra datos de otras personas desde acá.
 * El backend igual valida es_admin en cada endpoint (responde 403 si no lo
 * es); esta guardia del frontend es solo para no mostrar la pantalla en vano.
 */

function formatearFecha(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// Etiqueta pequeña de color para roles/estados.
function Chip({ children, tono = "slate" }) {
  const tonos = {
    slate: "bg-slate-100 text-slate-600",
    azul: "bg-blue-100 text-blue-700",
    verde: "bg-emerald-100 text-emerald-700",
    ambar: "bg-amber-100 text-amber-700",
    rojo: "bg-red-100 text-red-700",
    morado: "bg-violet-100 text-violet-700",
  };
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${tonos[tono]}`}>
      {children}
    </span>
  );
}

// ---------- Pestaña: Resumen ----------
function TarjetaDato({ valor, etiqueta, tono = "azul" }) {
  const tonos = {
    azul: "text-blue-700",
    verde: "text-emerald-700",
    ambar: "text-amber-700",
    slate: "text-slate-700",
  };
  return (
    <div className="bg-white rounded-2xl shadow-card p-4 border border-slate-100">
      <p className={`text-3xl font-black leading-none ${tonos[tono]}`}>{valor}</p>
      <p className="text-xs text-slate-500 mt-1.5 leading-tight">{etiqueta}</p>
    </div>
  );
}

function Resumen({ datos }) {
  if (!datos) return null;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Personas</p>
        <div className="grid grid-cols-2 gap-3">
          <TarjetaDato valor={datos.total_usuarios} etiqueta="Usuarios registrados" tono="azul" />
          <TarjetaDato valor={datos.total_conductores} etiqueta="Con perfil de conductor" tono="verde" />
          <TarjetaDato valor={datos.total_pasajeros} etiqueta="Con perfil de pasajero" tono="azul" />
          <TarjetaDato valor={datos.total_admins} etiqueta="Administradores" tono="slate" />
        </div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Rutas</p>
        <div className="grid grid-cols-2 gap-3">
          <TarjetaDato valor={datos.total_rutas} etiqueta="Rutas publicadas" tono="azul" />
          <TarjetaDato valor={datos.rutas_activas} etiqueta="Rutas activas" tono="verde" />
          <TarjetaDato valor={datos.rutas_en_curso} etiqueta="Viajes en curso ahora" tono="ambar" />
        </div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Reservas</p>
        <div className="grid grid-cols-3 gap-3">
          <TarjetaDato valor={datos.solicitudes_pendientes} etiqueta="Pendientes" tono="ambar" />
          <TarjetaDato valor={datos.solicitudes_aceptadas} etiqueta="Aceptadas" tono="verde" />
          <TarjetaDato valor={datos.solicitudes_rechazadas} etiqueta="Rechazadas" tono="slate" />
        </div>
      </div>
    </div>
  );
}

// ---------- Pestaña: Usuarios ----------
function TarjetaUsuario({ u }) {
  const roles = [];
  if (u.es_admin) roles.push(<Chip key="a" tono="morado">Admin</Chip>);
  if (u.es_conductor) roles.push(<Chip key="c" tono="verde">Conductor</Chip>);
  if (u.es_pasajero) roles.push(<Chip key="p" tono="azul">Pasajero</Chip>);
  if (roles.length === 0) roles.push(<Chip key="s">Sin rol</Chip>);

  return (
    <div className="bg-white rounded-2xl shadow-card p-4 border border-slate-100">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 leading-tight truncate">{u.nombre}</p>
          <p className="text-xs text-slate-500 mt-0.5">RUT {u.rut}</p>
        </div>
        <div className="flex flex-wrap gap-1 justify-end shrink-0">{roles}</div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-slate-600">
        <p>📧 {u.email}</p>
        <p>📞 {u.telefono}</p>
        <p className="text-xs text-slate-400">
          Registrado el {formatearFecha(u.fecha_registro)}
          {typeof u.total_calificaciones === "number" && u.total_calificaciones > 0 && (
            <> · ⭐ {Number(u.calificacion_promedio).toFixed(1)} ({u.total_calificaciones})</>
          )}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {u.genero && <Chip>Género: {u.genero}</Chip>}
        {u.modo_solo_mujeres && <Chip tono="morado">Modo solo mujeres</Chip>}
        <Chip tono={u.acepta_terminos ? "verde" : "rojo"}>
          {u.acepta_terminos ? "Aceptó términos" : "Sin términos"}
        </Chip>
      </div>

      {u.es_conductor && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Vehículo y documentos
          </p>
          {u.vehiculo ? (
            <>
              <p className="text-sm text-slate-600">
                {[u.vehiculo.marca, u.vehiculo.modelo, u.vehiculo.color]
                  .filter(Boolean)
                  .join(" · ") || "Sin datos del vehículo"}
                {u.vehiculo.patente ? ` · ${u.vehiculo.patente}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Chip tono={u.vehiculo.licencia_subida ? "verde" : "rojo"}>
                  {u.vehiculo.licencia_subida ? "✓" : "✗"} Licencia
                </Chip>
                <Chip tono={u.vehiculo.revision_tecnica_subida ? "verde" : "rojo"}>
                  {u.vehiculo.revision_tecnica_subida ? "✓" : "✗"} Rev. técnica
                </Chip>
                <Chip tono={u.vehiculo.soap_subido ? "verde" : "rojo"}>
                  {u.vehiculo.soap_subido ? "✓" : "✗"} SOAP
                </Chip>
                <Chip tono={u.vehiculo.verificado ? "verde" : "ambar"}>
                  {u.vehiculo.verificado ? "Verificado" : "Sin verificar"}
                </Chip>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Aún no registra vehículo.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Pestaña: Rutas ----------
function TarjetaRuta({ r }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-4 border border-slate-100">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-slate-900 leading-snug">
          {r.origen_comuna || r.origen_direccion}{" "}
          <span className="text-slate-400">→</span> {r.destino_comuna || r.destino_direccion}
        </h3>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {r.en_curso && <Chip tono="ambar">En curso</Chip>}
          <Chip tono={r.activa ? "verde" : "slate"}>{r.activa ? "Activa" : "Inactiva"}</Chip>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-1">Conductor: {r.conductor_nombre}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
        <span>🕐 {r.hora_salida}</span>
        <span>💺 {r.cupos_disponibles}/{r.cupos_totales} cupos</span>
        <span>💲 {r.precio_sugerido.toLocaleString("es-CL")}</span>
      </div>
      {r.dias_recurrencia?.length > 0 && (
        <p className="text-xs text-slate-400 mt-1 capitalize">{r.dias_recurrencia.join(", ")}</p>
      )}
      {r.modo_solo_mujeres && (
        <div className="mt-2">
          <Chip tono="morado">Solo mujeres</Chip>
        </div>
      )}
    </div>
  );
}

// ---------- Página ----------
export default function Admin() {
  const { usuario, token } = useAuth();
  const [pestana, setPestana] = useState("resumen");
  const [resumen, setResumen] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usuario?.es_admin) return;
    let activo = true;
    setCargando(true);
    Promise.all([
      api.adminResumen(token),
      api.adminUsuarios(token),
      api.adminRutas(token),
    ])
      .then(([res, us, rs]) => {
        if (!activo) return;
        setResumen(res);
        setUsuarios(us);
        setRutas(rs);
      })
      .catch((e) => activo && setError(e.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [usuario, token]);

  // Guardia: si alguien llega acá sin ser admin.
  if (!usuario?.es_admin) {
    return (
      <div className="max-w-2xl mx-auto p-6 my-10 text-center">
        <p className="text-5xl mb-3">🔒</p>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Acceso restringido</h1>
        <p className="text-slate-500 text-sm mb-5">
          Este panel es solo para el administrador de la plataforma.
        </p>
        <Link to="/" className="inline-block bg-taco text-white px-5 py-2.5 rounded-xl font-semibold">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const PESTANAS = [
    { id: "resumen", label: "Resumen" },
    { id: "usuarios", label: `Usuarios${usuarios.length ? ` (${usuarios.length})` : ""}` },
    { id: "rutas", label: `Rutas${rutas.length ? ` (${rutas.length})` : ""}` },
  ];

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Hero oscuro tipo "sala de control" — se distingue de las vistas de
          chofer/pasajero, dejando claro que es el panel del dueño. */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-blue-900 text-white px-6 pt-10 pb-8 rounded-b-[2rem] shadow-xl">
        <div aria-hidden className="absolute -top-16 -right-12 w-52 h-52 rounded-full bg-blue-500/10"></div>
        <div className="relative">
          <p className="text-blue-300/80 text-xs font-bold uppercase tracking-[0.25em] mb-2">
            Administración
          </p>
          <h1 className="text-3xl font-black tracking-tight leading-none">Panel de control</h1>
          <p className="text-white/70 text-sm mt-2">
            {usuario.nombre} · vista general de la plataforma
          </p>
        </div>
      </div>

      <div className="px-4 -mt-5 relative z-10">
        {/* Selector de pestañas */}
        <div className="flex bg-white rounded-2xl p-1 shadow-card border border-slate-100 mb-5">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                pestana === p.id ? "bg-taco text-white shadow-sm" : "text-slate-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">
            {error}
          </div>
        )}
        {cargando && <p className="text-center text-slate-400 text-sm py-8">Cargando datos…</p>}

        {!cargando && !error && (
          <>
            {pestana === "resumen" && <Resumen datos={resumen} />}

            {pestana === "usuarios" && (
              <div className="space-y-3">
                {usuarios.map((u) => (
                  <TarjetaUsuario key={u.id} u={u} />
                ))}
                {usuarios.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-8">No hay usuarios.</p>
                )}
              </div>
            )}

            {pestana === "rutas" && (
              <div className="space-y-3">
                {rutas.map((r) => (
                  <TarjetaRuta key={r.id} r={r} />
                ))}
                {rutas.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-8">No hay rutas.</p>
                )}
              </div>
            )}
          </>
        )}

        <Link
          to="/perfil"
          className="mt-6 block text-center text-slate-400 text-sm underline"
        >
          ← Volver a mi perfil
        </Link>
      </div>
    </div>
  );
}
