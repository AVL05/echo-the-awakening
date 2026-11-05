import { useState } from 'react';
import Modal from './Modal';
import { ProtocolConfirmation } from './StoryPanels';
import { adjustSupply, resume, runEscapeAction, runStoryAction } from './game/actions';
import { inventory, ITEMS, MECHANISMS, traceBeam, type EscapeOperation, type ItemId, type Mechanism } from './game/escape';
import { useGame } from './game/store';

function Inventory({ mechanism, onResponse }: { mechanism?: Mechanism; onResponse: (text: string) => void }) {
  const p = useGame(s => s.progress);
  const [selected, select] = useState<ItemId | null>(null);
  const items = inventory(p);
  const active = selected && items.includes(selected) ? selected : items[0];
  return <section className="escape-inventory" aria-label="Inventario de objetos">
    <span className="eyebrow">OBJETOS RECUPERADOS · EXAMINA ANTES DE USAR</span>
    {items.length === 0 ? <p>No llevas objetos sueltos. Los componentes instalados permanecen en sus mecanismos.</p> : <>
      <div className="inventory-items">{items.map(id => <button key={id} aria-pressed={id === active} onClick={() => select(id)}>{ITEMS[id].name}</button>)}</div>
      {active && <article><h3>{ITEMS[active].name}</h3><p>{ITEMS[active].detail}</p>{mechanism && p.story.protocol === 'none' && <button className="text-button" onClick={() => onResponse(runEscapeAction('use', `${active}:${mechanism}`).text)}>Usar en {MECHANISMS[mechanism].toLowerCase()}</button>}</article>}
    </>}
    <p className="fineprint">{p.story.escape.cellDocked && 'Celda acoplada. '}{p.story.escape.fuseInstalled && 'Fusible instalado. '}{p.story.escape.lensInstalled && 'Lente en el banco. '}{p.story.escape.waferRead && 'Firma humana verificada.'}</p>
  </section>;
}

function MechanismPanel({ mechanism }: { mechanism: Mechanism }) {
  const p = useGame(s => s.progress), e = p.story.escape;
  const fixed = p.story.protocol !== 'none';
  const [feedback, setFeedback] = useState('');
  const [code, setCode] = useState('');
  const lines = useGame(s => s.powerLines);
  const [route, setRoute] = useState(() => e.finalRoute === 'preserve' ? ['aux', 'human', 'aux'] : e.finalRoute === 'erase' ? ['off', 'none', 'aux'] : ['main', 'echo', 'main']);
  const perform = (name: EscapeOperation, value = '') => setFeedback(runEscapeAction(name, value).text);
  const beam = traceBeam(e.mirrors);
  return <Modal label={MECHANISMS[mechanism]} className="escape-dialog">
    <span className="eyebrow">LAZARUS / MANDO LOCAL</span><h2>{MECHANISMS[mechanism]}</h2>
    {mechanism === 'clock' && <><div className="stopped-clock" aria-label="Reloj detenido a las cuatro y diecisiete">04<span>:</span>17</div><p>El mecanismo está parado. En el cristal: «El corte lo hizo una mano. Conserva la hora; no la versión del sistema».</p></>}
    {mechanism === 'locker' && <><p>La placa pide <strong>turno / hora</strong>. La ventana deja ver una celda y una protección cerámica.</p><form onSubmit={event => { event.preventDefault(); perform('locker', code); }}><label>Clave de cuatro cifras<input value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" required disabled={e.locker} /></label><button className="primary-button" disabled={e.locker}>{e.locker ? 'Taquilla abierta' : 'Comprobar cierre'}</button></form></>}
    {mechanism === 'relay' && <><p>Arranque auxiliar. Tres líneas, un fusible. La placa exige <strong>soporte vital y refrigeración</strong>; el archivo usa otro circuito. Estos mandos también pueden manipularse directamente en la instalación.</p><dl className="mechanism-state"><div><dt>Celda</dt><dd>{e.cellDocked || p.installed ? 'ACOPLADA' : 'VACÍO'}</dd></div><div><dt>Protección</dt><dd>{e.fuseInstalled ? 'INSTALADA' : 'SIN FUSIBLE'}</dd></div></dl><div className="circuit-lines">{['Soporte vital', 'Archivo', 'Refrigeración'].map((label, i) => <label key={label}><input type="checkbox" checked={e.powerRouted ? i !== 1 : lines[i] === '1'} disabled={e.powerRouted} onChange={() => adjustSupply(i)} />{label}<span aria-hidden="true">{(e.powerRouted ? i !== 1 : lines[i] === '1') ? '●' : '○'}</span></label>)}</div><button className="primary-button" disabled={e.powerRouted} onClick={() => perform('power', lines)}>{e.powerRouted ? 'Arranque validado' : 'Validar y energizar'}</button></>}
    {mechanism === 'cabinet' && <><p>El cierre eléctrico está muerto. Un eje hexagonal permite abrirlo a mano. Dentro hay una lente y un aviso: «La luz debe llegar a una persona antes que al sistema».</p>{e.cabinetOpen && <p role="status">Cierre manual abierto. La lente fue recuperada.</p>}</>}
    {mechanism === 'optics' && <><p>Desvía el rayo hacia el receptor <strong>HUMANO</strong>. Los espejos cambian su dirección; las salidas laterales no verifican la custodia.</p>
      <svg className="optical-board" viewBox="0 0 320 280" role="img" aria-label={!e.lensInstalled ? 'Banco sin lente' : `Recorrido del rayo: ${beam.human ? 'llega al receptor humano' : 'no llega al receptor humano'}`}>
        <rect x="50" y="20" width="180" height="180" fill="none" stroke="currentColor" opacity=".4" />
        {[110, 170].map(value => <g key={value} opacity=".2"><path d={`M${value} 20V200`} stroke="currentColor" /><path d={`M50 ${value - 30}H230`} stroke="currentColor" /></g>)}
        {e.lensInstalled && <polyline points={beam.path.map(([x, y]) => `${50 + (x + .5) * 60},${20 + (y + .5) * 60}`).join(' ')} fill="none" stroke={beam.human ? '#a6d9c6' : '#d5b185'} strokeWidth="3" />}
        {[[140, 110], [140, 50], [200, 50]].map(([x, y], i) => <g key={i}><line x1={x - 16} x2={x + 16} y1={e.mirrors[i] === '0' ? y + 16 : y - 16} y2={e.mirrors[i] === '0' ? y - 16 : y + 16} stroke="#eeeee5" strokeWidth="5" /><text x={x - 24} y={y - 21} fill="currentColor">{'ABC'[i]}</text></g>)}
        <text x="6" y="95" fill="currentColor" fontSize="11">LENTE</text><circle cx="140" cy="230" r="7" fill="#8b5c4f" /><text x="140" y="260" textAnchor="middle" fill="currentColor" fontSize="11">ECHO</text><circle cx="200" cy="230" r="7" fill="#a6d9c6" /><text x="230" y="260" textAnchor="middle" fill="currentColor" fontSize="11">HUMANO</text>
      </svg>
      <div className="story-choices">{['A', 'B', 'C'].map((label, i) => <button key={label} disabled={!e.lensInstalled || e.opticsSolved} onClick={() => perform('mirrors', [...e.mirrors].map((value, index) => index === i ? value === '0' ? '1' : '0' : value).join(''))}>Girar espejo {label} · {e.mirrors[i] === '0' ? '/' : '\\'}</button>)}</div><button className="primary-button" disabled={!e.lensInstalled || e.opticsSolved} onClick={() => perform('optics')}>{e.opticsSolved ? 'Oblea recuperada' : 'Verificar receptor'}</button></>}
    {mechanism === 'reader' && <><p>Un lector aislado de la red de ECHO. La ranura exige una oblea física; ninguna orden de voz puede suplantarla.</p>{e.waferRead && <p className="action-result">Firma aceptada. La cronología puede contrastarse en el terminal del núcleo.</p>}</>}
    {mechanism === 'secret' && <><p>{e.lensInstalled ? 'La luz de comprobación atraviesa capas de pintura. Una nota termina con una firma que parece tuya.' : 'Hay trazos bajo la pintura. La luz ambiental no permite leerlos.'}</p><button className="primary-button" disabled={!e.lensInstalled} onClick={() => perform('secret')}>Examinar inscripción</button>{e.secret && <blockquote>«Si no vuelvo, conservad mi voz para mi hija. Eso no autoriza a encerrar a nadie». — Operador 17. Para Mara.</blockquote>}</>}
    {mechanism === 'continuity' && <><p>Dos unidades auxiliares: una puede alimentar el archivo y otra la salida. La custodia humana separa a ECHO de los mandos; el aislamiento apaga el archivo y desconecta su autoridad.</p><div className="continuity-controls">{[
      { label: 'Alimentación del archivo', options: [['main', 'Red principal'], ['aux', 'Auxiliar'], ['off', 'Apagado']] },
      { label: 'Autoridad de custodia', options: [['echo', 'ECHO'], ['human', 'Humana'], ['none', 'Aislada']] },
      { label: 'Alimentación de salida', options: [['main', 'Red principal'], ['aux', 'Auxiliar'], ['off', 'Apagada']] },
    ].map((control, i) => <label key={control.label}>{control.label}<select aria-label={control.label} value={route[i]} disabled={e.finalRoute !== 'none'} onChange={event => setRoute(route.map((value, index) => index === i ? event.target.value : value))}>{control.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}</div><p className="fineprint">{fixed ? 'Decisión ejecutada. La salida auxiliar permanece abierta.' : 'Los mandos se fijan al validar. El protocolo irreversible necesita una confirmación humana separada.'}</p>{e.finalRoute === 'none' ? <button className="primary-button" onClick={() => perform('continuity', route.join(':'))}>Validar independencia</button> : <><p className="action-result">Ruta de {e.finalRoute === 'preserve' ? 'custodia humana' : 'aislamiento'} {fixed ? 'confirmada.' : 'preparada. Revisa las consecuencias antes de confirmar.'}</p>{!fixed && <button className="text-button" onClick={() => perform('continuity', 'reset')}>Reconfigurar antes de confirmar</button>}</>}</>}
    {mechanism === 'continuity' && e.finalRoute !== 'none' && <ProtocolConfirmation onResponse={setFeedback} />}
    {feedback && <p className="mechanism-feedback" role="status">{feedback}</p>}
    <Inventory mechanism={mechanism} onResponse={setFeedback} />
    <div className="escape-panel-actions"><button className="text-button" disabled={fixed} onClick={() => setFeedback(runStoryAction('request_hint', ({ locker: 'locker', clock: 'locker', relay: 'power', cabinet: 'optics', optics: 'optics', secret: 'optics', reader: 'archive', continuity: 'continuity' } as const)[mechanism]).text)}>Pedir orientación a ECHO</button><button className="primary-button" onClick={resume}>Volver a la instalación</button></div>
  </Modal>;
}

export default function EscapePanels() {
  const phase = useGame(s => s.phase), mechanism = useGame(s => s.mechanism);
  const [feedback, setFeedback] = useState('');
  if (phase === 'inventory') return <Modal label="Inventario" className="escape-dialog"><span className="eyebrow">OPERADOR 17 / EQUIPO</span><h2>Lo que llevas contigo.</h2><Inventory onResponse={setFeedback} />{feedback && <p role="status">{feedback}</p>}<p className="fineprint">Para usar un objeto, acércate a un mecanismo y abre su panel. Un intento incompatible nunca consume objetos.</p><button className="primary-button" onClick={resume}>Cerrar inventario</button></Modal>;
  return phase === 'mechanism' && mechanism ? <MechanismPanel key={mechanism} mechanism={mechanism} /> : null;
}
