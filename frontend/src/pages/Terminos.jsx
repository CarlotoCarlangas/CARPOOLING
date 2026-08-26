export default function Terminos() {
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-sm my-6 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold mb-4">Términos y Política de Privacidad de TACO</h1>

      <h2 className="font-semibold mt-4 mb-1">1. Qué es TACO</h2>
      <p>
        TACO es una plataforma para compartir gastos de viaje entre personas que hacen
        el mismo trayecto (carpooling). TACO no es una empresa de transporte ni presta
        servicios de transporte remunerado: pone en contacto a un conductor que ya
        realiza el viaje con pasajeros que quieren compartirlo, y cobra una comisión
        por usar la plataforma (15% al conductor, 10% al pasajero).
      </p>

      <h2 className="font-semibold mt-4 mb-1">2. Datos personales que recolectamos y para qué</h2>
      <p>De acuerdo a la Ley 21.719 sobre Protección de Datos Personales, cada dato que pedimos tiene una finalidad específica:</p>
      <ul className="list-disc pl-6 mt-2 space-y-1">
        <li><b>RUT:</b> identificarte de forma única y evitar cuentas duplicadas.</li>
        <li><b>Nombre y foto:</b> que la otra persona (conductor o pasajero) pueda reconocerte al encontrarse.</li>
        <li><b>Teléfono:</b> coordinar el viaje y contacto en caso de emergencia.</li>
        <li><b>Email:</b> identificar tu cuenta y enviarte notificaciones importantes.</li>
        <li><b>Ubicación de origen/destino de tus viajes:</b> mostrar y trazar tus rutas. Este es un dato sensible y solo se usa para el funcionamiento del servicio.</li>
        <li><b>Documentos del vehículo (licencia, revisión técnica, SOAP):</b> verificar que el conductor y el vehículo cumplen los requisitos mínimos de seguridad.</li>
        <li><b>Género (opcional):</b> solo se pide si quieres activar la función voluntaria "modo solo mujeres".</li>
      </ul>
      <p className="mt-2">No pedimos ni almacenamos más datos de los necesarios para operar el servicio (principio de minimización).</p>

      <h2 className="font-semibold mt-4 mb-1">3. Tus derechos (ARCO)</h2>
      <p>
        Puedes ejercer en cualquier momento tus derechos de <b>A</b>cceso, <b>R</b>ectificación,
        <b> C</b>ancelación (eliminación de tus datos) y <b>O</b>posición al tratamiento de tus
        datos. Desde tu perfil puedes ver y eliminar tu cuenta y datos asociados en cualquier
        momento. Para otras solicitudes, escribe a{" "}
        {/* TODO PRODUCCIÓN: reemplazar por el correo de contacto real de la empresa */}
        <b>privacidad@taco.cl</b>.
      </p>

      <h2 className="font-semibold mt-4 mb-1">4. Consentimiento</h2>
      <p>
        Al marcar la casilla de aceptación en el registro, das tu consentimiento explícito
        e informado para el tratamiento de tus datos personales según lo descrito aquí.
        Puedes retirar tu consentimiento eliminando tu cuenta.
      </p>

      <p className="mt-6 text-xs text-gray-500">
        Este documento es un resumen para el prototipo. {/* TODO PRODUCCIÓN: */}
        antes de operar con usuarios reales, este texto debe ser revisado por un abogado
        y publicado junto con la Política de Privacidad definitiva.
      </p>
    </div>
  );
}
