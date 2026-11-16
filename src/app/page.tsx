import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section aria-labelledby="welcome-title" className="welcome">
        <div className="brand" aria-hidden="true">TT</div>
        <p className="eyebrow">TOCH · Versión 1.0</p>
        <h1 id="welcome-title">TT — Tareas TOCH</h1>
        <p className="nickname">Hola, soy Teté.</p>
        <p className="description">
          Un espacio para organizar clientes, proyectos, tareas, colaboración y horas de servicio.
        </p>
        <p className="status"><span aria-hidden="true" />Preparación técnica en curso</p>
        <p className="note">Acceso exclusivo para cuentas previamente autorizadas.</p>
        <Link className="primary-button" href="/ingresar">Ingresar a Teté</Link>
      </section>
    </main>
  );
}
