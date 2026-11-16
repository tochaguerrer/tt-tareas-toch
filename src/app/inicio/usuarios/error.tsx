"use client";

export default function UsersError({ reset }: { reset: () => void }) {
  return <main><section className="welcome"><h1>No pudimos cargar la administración</h1><p className="description">Intentá nuevamente. Si el problema continúa, revisá la conexión con el responsable técnico.</p><button className="primary-button" onClick={reset}>Reintentar</button></section></main>;
}
