"use client";

export default function AccessError({ reset }: { reset: () => void }) {
  return <main><section className="welcome"><h1>No pudimos verificar tu acceso</h1><p className="description">Intentá nuevamente. Si el problema continúa, contactá al Administrador TOCH.</p><button className="primary-button" onClick={reset}>Reintentar</button></section></main>;
}
