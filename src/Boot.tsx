import { Component, useEffect, useState, type ReactNode } from 'react';
import { useGame } from './game/store';

export function reloadCompatible() { const url = new URL(location.href); url.searchParams.set('renderer', 'webgl'); location.assign(url); }
export class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="graphics-error" role="alert"><h2>No se pudo cargar la experiencia.</h2><p>Comprueba la conexión y recarga. El progreso guardado permanece en este navegador.</p><button onClick={() => location.reload()}>Recargar y recuperar partida</button><button onClick={reloadCompatible}>Probar modo WebGL 2</button></div>;
    return this.props.children;
  }
}
export function LoadingStatus() {
  const ready = useGame(s => s.ready), backend = useGame(s => s.backend);
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (ready) return; const timer = setTimeout(() => setSlow(true), 15000); return () => clearTimeout(timer); }, [ready]);
  if (ready) return null;
  return <section className="loading-status" aria-label="Carga de la experiencia"><div role="status"><span className="processing-orbit" aria-hidden="true" />{backend === 'INICIALIZANDO' ? 'Descargando el motor y comprobando el renderer…' : `Preparando la escena · ${backend}`}<progress aria-label="Preparando experiencia 3D" /></div><small>La IA no se descarga al iniciar el juego.</small>{slow && <><p>La preparación está tardando más de lo habitual.</p><button onClick={() => location.reload()}>Reintentar carga</button><button onClick={reloadCompatible}>Probar WebGL 2</button></>}</section>;
}
