/**
 * Cliente HTTP hacia el backend de TACO.
 *
 * Detecta automáticamente la URL del backend usando el mismo host desde el
 * que se abrió la página. Así, si el conductor abre el frontend en
 * http://192.168.1.5:5173 desde su celular, este archivo apunta solo a
 * http://192.168.1.5:8000/api sin tener que configurar nada a mano.
 *
 * Se puede forzar otra URL definiendo VITE_API_URL en un archivo .env.
 */
const API_URL =
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`;

class ApiError extends Error {
  constructor(message, status, detalle) {
    super(message);
    this.status = status;
    this.detalle = detalle;
  }
}

function extraerMensajeError(detalle) {
  if (!detalle) return "Ocurrió un error inesperado";
  if (typeof detalle === "string") return detalle;
  if (Array.isArray(detalle)) {
    return detalle.map((e) => e.msg).join(". ");
  }
  return "Ocurrió un error inesperado";
}

// Permite que AuthContext se entere cuando el backend rechaza el token
// (ej. sesión cerrada desde otro dispositivo) para cerrar sesión localmente
// en vez de dejar la pantalla mostrando datos vacíos o inconsistentes.
let manejadorNoAutorizado = null;
export function alRecibirNoAutorizado(fn) {
  manejadorNoAutorizado = fn;
}

async function request(path, { method = "GET", body, token, isFormData = false } = {}) {
  const headers = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && token) {
    manejadorNoAutorizado?.();
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(extraerMensajeError(data?.detail), res.status, data?.detail);
  }
  return data;
}

export const api = {
  register: (datos) => request("/register", { method: "POST", body: datos }),
  login: (datos) => request("/login", { method: "POST", body: datos }),
  miPerfil: (token) => request("/users/me", { token }),

  subirFoto: (archivo, token) => {
    const form = new FormData();
    form.append("archivo", archivo);
    return request("/users/me/foto", { method: "POST", body: form, token, isFormData: true });
  },

  obtenerVehiculo: (token) => request("/users/me/vehiculo", { token }),
  actualizarVehiculo: (datos, token) =>
    request("/users/me/vehiculo", { method: "PUT", body: datos, token }),

  subirDocumento: (tipo, archivo, token) => {
    const form = new FormData();
    form.append("archivo", archivo);
    return request(`/users/me/documentos/${tipo}`, {
      method: "POST",
      body: form,
      token,
      isFormData: true,
    });
  },

  crearRuta: (datos, token) => request("/routes", { method: "POST", body: datos, token }),
  listarRutas: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/routes${query ? `?${query}` : ""}`);
  },
  detalleRuta: (id) => request(`/routes/${id}`),
};

export { API_URL, ApiError };
