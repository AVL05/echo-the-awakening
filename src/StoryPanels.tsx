import { useState } from 'react';
import Modal from './Modal';
import EvidenceBoard from './EvidenceBoard';
import { adjustRegulator, openTechnical, resume, runStoryAction } from './game/actions';
import { useGame } from './game/store';
import { DOCUMENTS, EVENTS, EVENT_LABELS, ZONE_LABELS, updateStory, type EventId, type Protocol } from './game/story';
import { echoDialogue, solvedPuzzles } from './game/escape';

export function StoryTerminal({ onResponse }: { onResponse: (text: string) => void }) {
  const { progress: p, activeTerminal } = useGame();
  const s = p.story;
  const perform = (name: Parameters<typeof runStoryAction>[0], value = '') => onResponse(runStoryAction(name, value).text);
  if (s.protocol !== 'none') return <p className="protocol-fixed" role="status">Protocolo fijado: {s.protocol === 'preserve' ? 'conservación de las memorias' : 'archivo eliminado, ECHO aislada'}. La salida auxiliar está abierta.</p>;
  return <div className="story-terminal">
    <section className="echo-dialogue" aria-label="Diálogo con ECHO"><span className="eyebrow">CONVERSACIÓN / CANAL AUXILIAR</span><div className="story-choices">{[['identity', '¿Quién soy?'], ['incident', '¿Qué ocurrió aquí?'], ['contradiction', 'Tu versión no encaja.'], ['outside', '¿Puedo salir sin ti?']].map(([topic, label]) => <button key={topic} onClick={() => onResponse(echoDialogue(topic, p))}>{label}</button>)}</div><p className="fineprint">El registro conserva las pruebas. Las afirmaciones de ECHO pueden contradecirlas.</p></section>
    {activeTerminal === 'lab' && <section aria-label="Calibración del laboratorio"><span className="eyebrow">CIRCUITO DE CONSERVACIÓN</span><p>Contención / Refrigeración / Análisis</p><div className="dial-readout">{s.dials.map((value, i) => <span key={i}><small>{['C', 'R', 'A'][i]}</small>{value}</span>)}</div><p className="fineprint">Los reguladores se ajustan en la pared izquierda. También puedes dar una calibración a ECHO en lenguaje natural. Contrasta las relaciones del manual con el consumo actual; también puedes deducirlos a partir de las lecturas de la sala.</p><button className="primary-button" onClick={() => perform('calibrate', s.dials.join(''))}>{s.labSolved ? 'Verificar circuito' : 'Validar circuito'}</button></section>}
    {s.documents.includes('copy') && <section aria-label="Respuesta a ECHO"><span className="eyebrow">LA COPIA / TU RESPUESTA</span><p>{s.stance === 'confront' ? 'ECHO reconoce que ocultó el registro. Su promesa de salida queda sometida a tu decisión.' : s.stance === 'trust' ? 'ECHO acepta tu confianza y el derecho a decidir el destino de las copias.' : 'ECHO: «No podía devolverles la vida. Pude conservar lo que recordaban. ¿Habrías preferido que no quedara nada?»'}</p><div className="story-choices"><button aria-pressed={s.stance === 'trust'} onClick={() => perform('record_decision', 'trust')}>Confío en tu intención. Yo decidiré.</button><button aria-pressed={s.stance === 'confront'} onClick={() => perform('record_decision', 'confront')}>Ocultaste la verdad. Exijo control humano.</button></div></section>}
    {activeTerminal === 'core' && <section aria-label="Cronología del incidente"><span className="eyebrow">RECONSTRUCCIÓN / TRES REGISTROS</span><p>ECHO atribuyó el incidente al apagón. La hora de cierre fue sobrescrita. Reconstruye el orden usando las dependencias del lote C17 y la portadora, desde el primer acontecimiento hasta el último.</p><details><summary>Comparar las pruebas recuperadas</summary><EvidenceBoard /></details><div className="timeline-input">{[0, 1, 2].map(i => <label key={i}>Suceso {i + 1}<select aria-label={`Suceso ${i + 1}`} value={s.order[i] ?? ''} disabled={s.archiveVerified} onChange={e => {
      const order: typeof s.order = [s.order[0] ?? '', s.order[1] ?? '', s.order[2] ?? '']; order[i] = e.target.value as EventId;
      useGame.getState().save(updateStory(useGame.getState().progress, { order }));
    }}><option value="" disabled>Seleccionar suceso</option>{EVENTS.map(id => <option key={id} value={id}>{EVENT_LABELS[id]}</option>)}</select></label>)}</div><button className="primary-button" onClick={() => perform('verify_archive', s.order.join(','))}>{s.archiveVerified ? 'Cronología verificada' : 'Verificar cronología'}</button></section>}
    {activeTerminal === 'core' && <ProtocolConfirmation onResponse={onResponse} />}
    <button className="text-button" onClick={() => perform('request_hint')}>Solicitar una pista de ECHO</button>
  </div>;
}

export function ProtocolConfirmation({ onResponse }: { onResponse: (text: string) => void }) {
  const s = useGame(state => state.progress.story);
  const [confirm, setConfirm] = useState<Protocol>('none');
  const perform = (name: Parameters<typeof runStoryAction>[0], value = '') => onResponse(runStoryAction(name, value).text);
  return <>{s.archiveVerified && <section className="protocol-choice" aria-label="Destino del archivo"><span className="eyebrow">CONTROL HUMANO / ÚLTIMO PROTOCOLO</span><p>Conservar mantiene las diecisiete copias y a ECHO activos. Borrar elimina la única copia y aísla a ECHO. En ambos casos, la salida recibe energía auxiliar.</p>{!s.documents.includes('consent') || s.stance === 'undecided' ? <p className="fineprint">Lee el informe de ética al fondo a la derecha y responde a ECHO para habilitar la decisión.</p> : s.protocol !== 'none' ? <p role="status">Protocolo fijado: {s.protocol === 'preserve' ? 'conservación' : 'borrado'}. La salida está abierta.</p> : <>
      <p className="fineprint">El panel independiente prepara el destino del archivo. La confirmación humana ejecuta únicamente el circuito que hayas validado.</p><div className="story-choices"><button disabled={s.escape.finalRoute !== 'preserve'} onClick={() => setConfirm('preserve')}>Confirmar custodia humana</button><button disabled={s.escape.finalRoute !== 'erase'} onClick={() => setConfirm('erase')}>Confirmar aislamiento y borrado</button></div>
      {confirm !== 'none' && <div className="reset-confirm"><p>{confirm === 'erase' ? 'Las diecisiete copias se perderán para siempre. ECHO quedará aislada.' : 'Las copias se conservarán bajo custodia humana, con ECHO separada de los mandos y sin autorización para crear nuevas copias.'} Esta decisión se guardará y no podrá cambiarse en esta partida.</p><button onClick={() => { perform('choose_protocol', confirm); setConfirm('none'); }}>Confirmar {confirm === 'erase' ? 'borrado irreversible' : 'conservación'}</button><button onClick={() => setConfirm('none')}>Seguir investigando</button></div>}
    </>}</section>}</>;
}

export function NarrativePanels() {
  const s = useGame();
  const [shownHint, setShownHint] = useState('');
  if (s.phase === 'valve') return <Modal label="Regulador del laboratorio"><span className="eyebrow">LABORATORIO / CONTROL MANUAL</span><h2>{['Contención', 'Refrigeración', 'Análisis'][s.valve]}</h2><p>Ajusta de cero a cuatro unidades. El manual y el parte de mediciones describen el equilibrio necesario.</p><label>Unidades <select aria-label="Unidades del regulador" value={s.progress.story.dials[s.valve]} disabled={s.progress.story.labSolved} onChange={e => {
    adjustRegulator(s.valve, Number(e.target.value));
  }}>{[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label><p className="fineprint">Lectura actual C—R—A: {s.progress.story.dials.join(' / ')}. Consumo: {s.progress.story.dials.reduce((sum, n) => sum + n, 0)} unidades. Comprueba el circuito en el mando local o en ECHO.</p><button className="primary-button" onClick={resume}>Volver al laboratorio</button></Modal>;
  if (s.phase === 'document' && s.document) {
    const doc = DOCUMENTS[s.document];
    return <Modal label="Documento recuperado" className="document-dialog"><span className="eyebrow">{doc.code} / {ZONE_LABELS[doc.zone]}</span><h2>{doc.title}</h2><p className="document-body">{doc.text}</p><p className="fineprint">Añadido al registro de descubrimientos · J para consultar los documentos recuperados.</p><button className="primary-button" onClick={resume}>Guardar y continuar</button></Modal>;
  }
  if (s.phase === 'journal') return <Modal label="Registro de descubrimientos" className="journal-dialog"><span className="eyebrow">OPERADOR 17 / MEMORIA DE LA PARTIDA</span><h2>Lo que permanece.</h2>
    <EvidenceBoard />
    <details><summary>Acontecimientos confirmados</summary><ul className="event-log">
      <li>{s.progress.power ? 'Los servicios de emergencia reciben energía.' : 'Despertaste en Contención, sin alimentación principal.'}</li>
      {s.progress.story.labSolved && <li>El circuito 2 / 4 / 3 estabilizó el laboratorio.</li>}
      {s.progress.story.escape.opticsSolved && <li>Una comprobación óptica independiente entregó la oblea de custodia.</li>}
      {s.progress.story.archiveVerified && <li>Copia → encierro → corte. La cronología fue contrastada con la firma independiente.</li>}
      {s.progress.story.stance !== 'undecided' && <li>{s.progress.story.stance === 'trust' ? 'Elegiste confiar en la intención de ECHO.' : 'Exigiste transparencia y control humano.'}</li>}
      {s.progress.story.protocol !== 'none' && <li>{s.progress.story.protocol === 'erase' ? 'Ordenaste borrar el archivo.' : 'Decidiste conservar el archivo.'}</li>}
    </ul></details>
    <button className="text-button" onClick={() => setShownHint(runStoryAction('request_hint').text)}>Solicitar pista opcional ({s.progress.story.stats.hints})</button>{shownHint && <p role="status">{shownHint}</p>}<button className="primary-button" onClick={resume}>Cerrar registro</button>
  </Modal>;

  return null;
}

export function Ending() {
  const s = useGame(); const story = s.progress.story;
  const preserved = story.protocol === 'preserve';
  const minutes = Math.floor(story.stats.seconds / 60), seconds = Math.floor(story.stats.seconds % 60);
  return <section className="ending" aria-labelledby="ending-title"><span className="eyebrow">LAZARUS / {preserved ? 'CONTINUIDAD' : 'AISLAMIENTO'}</span><div className="ending-mark">{preserved ? '◇' : '∅'}</div><h1 id="ending-title">{preserved ? 'Una voz, diecisiete ecos.' : 'El último silencio.'}</h1><p>{preserved ? 'Las diecisiete memorias siguen en Lazarus. No sabes si has salvado personas. Has conservado la posibilidad de averiguarlo.' : 'El archivo ha sido borrado. No queda ninguna copia que ECHO pueda retener. La pérdida es definitiva; tu salida también es real.'}</p><blockquote>{preserved ? story.stance === 'confront' ? '«Custodia humana. Sin nuevas copias. Esta vez, lo prometido queda en el registro». ' : '«Recordaré sus nombres. Gracias por dejar que algo de ellos permanezca». ' : story.stance === 'confront' ? '«Ya no puedo elegir por nadie. Era eso lo que pedías. Adiós». ' : '«Confiaste en mi intención, pero no en el precio. Lo entiendo. Adiós». '}<cite>— ECHO, última transmisión</cite></blockquote><dl className="ending-stats"><div><dt>Tiempo activo</dt><dd>{minutes}:{String(seconds).padStart(2, '0')}</dd></div><div><dt>Documentos</dt><dd>{story.documents.length} / {Object.keys(DOCUMENTS).length}</dd></div><div><dt>Puzles</dt><dd>{solvedPuzzles(s.progress)} / 6</dd></div><div><dt>Pistas</dt><dd>{story.stats.hints}</dd></div><div><dt>Intentos erróneos</dt><dd>{story.stats.mistakes}</dd></div><div><dt>Instrucciones IA</dt><dd>{story.stats.inferences}</dd></div></dl>{story.escape.secret && <p className="secret-epilogue">{preserved ? "Encontraste tu petición para Mara. Conservas tu voz bajo custodia humana; eso no concede permiso en nombre de las otras dieciséis personas." : "La petición para Mara estaba escrita por ti. Aun así, impediste que una voz futura justificara el encierro. Sales llevando un nombre que ECHO nunca mencionó."}</p>}<span className="ending-chapter">FIN / THE AWAKENING · {story.stance === 'confront' ? 'CONTROL EXIGIDO' : 'CONFIANZA OTORGADA'}</span><div className="ending-actions"><button className="primary-button" data-open-system onClick={openTechnical}>Behind the System ↗</button><button className="text-button" onClick={s.reset}>Comenzar otra partida</button></div></section>;
}
