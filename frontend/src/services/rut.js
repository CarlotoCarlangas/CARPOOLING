/**
 * Validación de RUT chileno en el frontend (mismo algoritmo que el
 * backend en utils.py) para dar feedback inmediato antes de enviar el
 * formulario.
 */
export function limpiarRut(rut) {
  return rut.toUpperCase().replace(/\./g, "").replace(/-/g, "").trim();
}

export function validarRut(rut) {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;

  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);

  return dv === dvEsperado;
}

export function formatearRut(rut) {
  const limpio = limpiarRut(rut);
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const cuerpoConPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoConPuntos}-${dv}`;
}
