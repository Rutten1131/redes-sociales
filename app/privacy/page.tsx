import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad — Programador de publicaciones",
  description: "Política de Privacidad y tratamiento de datos de nuestra aplicación para programar publicaciones en redes sociales.",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-[#0B0E14] text-[#E7E9EE]">
      <div className="max-w-3xl mx-auto card p-8 sm:p-12">
        <div className="mb-8 border-b pb-6" style={{ borderColor: "var(--border)" }}>
          <div className="flex gap-1.5 mb-4">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--facebook)" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--instagram)" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--youtube)" }} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Política de Privacidad</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Última actualización: 16 de julio de 2026
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--accent)" }}>
              1. Introducción
            </h2>
            <p>
              Bienvenido a nuestra plataforma de programación de publicaciones (la &quot;Aplicación&quot;). Nos tomamos muy en serio la privacidad y la protección de sus datos. Esta Política de Privacidad describe cómo recopilamos, utilizamos, almacenamos y compartimos su información cuando utiliza nuestros servicios para conectar y publicar en sus redes sociales, incluyendo Facebook, Instagram y YouTube.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--accent)" }}>
              2. Información que recopilamos
            </h2>
            <p className="mb-2">
              Para proporcionar nuestro servicio de programación y publicación automática, recopilamos la siguiente información:
            </p>
            <ul className="list-disc pl-5 space-y-1" style={{ color: "var(--text-muted)" }}>
              <li>
                <strong>Información de cuenta:</strong> Su nombre, dirección de correo electrónico y credenciales de acceso cuando se registra en nuestra plataforma.
              </li>
              <li>
                <strong>Tokens de acceso a redes sociales:</strong> Al conectar sus cuentas de Facebook, Instagram o YouTube a través del protocolo OAuth oficial, recibimos tokens de acceso autorizados. Estos tokens nos permiten realizar publicaciones en su nombre según las instrucciones que usted configure.
              </li>
              <li>
                <strong>Contenido de las publicaciones:</strong> El texto, imágenes, videos, y la fecha/hora de programación de los contenidos que usted decida subir y programar a través de la Aplicación.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--accent)" }}>
              3. Uso de la información
            </h2>
            <p className="mb-2">
              Utilizamos la información recopilada exclusivamente para los siguientes fines:
            </p>
            <ul className="list-disc pl-5 space-y-1" style={{ color: "var(--text-muted)" }}>
              <li>Proporcionar, operar y mantener las funcionalidades de la Aplicación.</li>
              <li>Publicar el contenido programado en las redes sociales conectadas (Facebook, Instagram, YouTube) siguiendo su programación exacta.</li>
              <li>Monitorear el estado de las publicaciones y reportar posibles errores de publicación.</li>
              <li>Enviar alertas sobre el estado de su cuenta, vencimiento de tokens de acceso y soporte técnico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--accent)" }}>
              4. Integraciones de terceros (API de Meta y YouTube)
            </h2>
            <p className="mb-2">
              Nuestra aplicación interactúa directamente con las APIs oficiales de Meta (Facebook e Instagram) y YouTube.
            </p>
            <ul className="list-disc pl-5 space-y-1" style={{ color: "var(--text-muted)" }}>
              <li>
                Cumplimos estrictamente con las Políticas de la Plataforma de Meta y los Términos de Servicio de YouTube.
              </li>
              <li>
                No vendemos ni compartimos sus tokens de acceso ni sus datos personales con anunciantes o terceros no autorizados.
              </li>
              <li>
                Los datos obtenidos de las APIs se usan únicamente para facilitar la publicación y el análisis del estado de su contenido dentro de la Aplicación.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--accent)" }}>
              5. Retención y eliminación de datos (Derecho de Supresión)
            </h2>
            <p className="mb-2">
              Conservamos sus datos solo mientras sea necesario para prestar el servicio o hasta que solicite su eliminación:
            </p>
            <ul className="list-disc pl-5 space-y-1" style={{ color: "var(--text-muted)" }}>
              <li>
                <strong>Desconexión de cuentas:</strong> Puede revocar el acceso a cualquiera de sus redes sociales en cualquier momento desde los ajustes de su panel de control en la Aplicación, lo que eliminará inmediatamente los tokens de acceso correspondientes de nuestras bases de datos.
              </li>
              <li>
                <strong>Eliminación de la cuenta:</strong> Puede solicitar la eliminación definitiva de su cuenta de usuario y de toda la información asociada enviando un correo electrónico a nuestro correo de contacto de soporte:{" "}
                <a href="mailto:objetivo.cesan@gmail.com" className="hover:underline text-white font-medium">
                  objetivo.cesan@gmail.com
                </a>
                .
              </li>
              <li>
                Una vez recibida la solicitud de eliminación de la cuenta, eliminaremos permanentemente todos sus datos de nuestros servidores activos en un plazo máximo de 7 días hábiles.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--accent)" }}>
              6. Seguridad de los datos
            </h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas adecuadas para proteger sus datos personales y tokens de acceso contra el acceso no autorizado, la alteración, la divulgación o la destrucción. Todos los datos sensibles, incluidos los tokens de acceso OAuth, se transmiten a través de conexiones seguras HTTPS y se almacenan de manera encriptada.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--accent)" }}>
              7. Cambios a esta Política de Privacidad
            </h2>
            <p>
              Nos reservamos el derecho de actualizar esta Política de Privacidad en cualquier momento. Si realizamos cambios significativos, le notificaremos mediante un aviso destacado en nuestra aplicación o por correo electrónico antes de que los cambios entren en vigencia.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--accent)" }}>
              8. Contacto
            </h2>
            <p>
              Si tiene preguntas, inquietudes o solicitudes relacionadas con esta Política de Privacidad o el tratamiento de sus datos personales, puede ponerse en contacto con nosotros en:
              <br />
              <strong>Correo electrónico:</strong>{" "}
              <a href="mailto:objetivo.cesan@gmail.com" className="hover:underline text-white font-medium">
                objetivo.cesan@gmail.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t flex justify-between items-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <p>© {new Date().getFullYear()} Programador de publicaciones. Todos los derechos reservados.</p>
          <Link href="/login" className="hover:underline text-white font-medium">
            Volver a inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
