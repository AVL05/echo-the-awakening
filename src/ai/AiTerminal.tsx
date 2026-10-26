import { useEffect, useState } from 'react';
import { aiIsBusy, echoAi, useEchoAi, type Interpretation } from './controller';
import { DOWNLOAD_ESTIMATE_MB, MAX_INPUT_CHARS, MODEL_ID } from './model';
import type { Action } from './actions';
import { checkCapabilities, useCapabilities } from './capabilities';
import { useGame } from '../game/store';

function proposalLabel(action: Action) {
  return ({ activate: 'Activar alimentación', deactivate: 'Desactivar alimentación', transfer_energy: 'Transferir energía al circuito', open_door: 'Abrir la compuerta', inspect: 'Inspeccionar', query_status: 'Consultar estado', calibrate: 'Calibrar laboratorio', verify_archive: 'Verificar cronología', record_decision: 'Responder a ECHO', choose_protocol: 'Fijar protocolo irreversible', request_hint: 'Solicitar pista' })[action.name];
}

export default function AiTerminal() {
  const ai = useEchoAi();
  const isolated = useGame(s => s.progress.story.protocol === 'erase');
  const [input, setInput] = useState('');
  const [reply, setReply] = useState<Interpretation | null>(null);
  const [outcome, setOutcome] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const caps = useCapabilities();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { if (['off', 'error', 'loading'].includes(ai.status)) { setReply(null); setOutcome(''); } }, [ai.status]);
  useEffect(() => { if (caps.status === 'unchecked') void checkCapabilities(); }, [caps.status]);
  useEffect(() => { setSeconds(0); if (!['generating', 'loading'].includes(ai.status)) return; const started = performance.now(); const timer = setInterval(() => setSeconds(Math.floor((performance.now() - started) / 1000)), 1000); return () => clearInterval(timer); }, [ai.status]);
  const busy = aiIsBusy(ai);
  const compatible = caps.status === 'available';
  const real = ai.status === 'ready' || ai.status === 'generating';
  return <section className="ai-terminal" id="echo-local-ai" tabIndex={-1} aria-label="Conversación con ECHO" data-ai-status={ai.status}>
    <div className="ai-heading"><span>HABLAR CON ECHO</span><b>{real ? 'MODELO LOCAL' : 'DETERMINISTA · SIN LLM'}</b></div>
    {!isolated && !real && !busy && <div className="ai-brief"><h3>Tu intención se convierte en una acción.</h3><p>La partida completa funciona con reglas locales. Si activas el modelo, ECHO interpretará tus instrucciones en este dispositivo. Tú confirmas cada cambio.</p><dl><div><dt>Descarga voluntaria</dt><dd>≈300 MB · se conserva en caché</dd></div><div><dt>Requisitos</dt><dd>WebGPU + f16 · margen estimado de 1–1,5 GB</dd></div><div><dt>Tiempo de respuesta</dt><dd>Varios segundos; hasta un minuto por petición</dd></div></dl></div>}
    {!isolated && <form onSubmit={async event => {
      event.preventDefault(); setError(''); setOutcome(''); setReply(null);
      try { const result = await echoAi.interpret(input); if (result) { setReply(result); setInput(''); } }
      catch (error) { setError(error instanceof Error ? error.message : 'No se pudo interpretar la instrucción.'); }
    }}>
      <label htmlFor="echo-instruction">Tu instrucción</label>
      <div className="ai-input-row"><input id="echo-instruction" name="instruction" value={input} onChange={event => setInput(event.target.value)} maxLength={MAX_INPUT_CHARS} autoComplete="off" placeholder="Pide una pista, calibra el circuito o reconstruye la cronología" disabled={busy} required /><button type="submit" disabled={busy}>Enviar</button></div>
    </form>}
    {busy && <div className="ai-processing" role="status"><span className="processing-orbit" aria-hidden="true" /><span>{ai.status === 'generating' ? 'Instrucción recibida. Interpretando en tu dispositivo…' : ai.message} <b aria-hidden="true">{seconds} s</b><small>Puedes cancelar. La partida y sus controles se conservan.</small></span><button onClick={() => echoAi.stop()}>Cancelar petición</button></div>}
    {reply && <div className="ai-answer" aria-live="polite"><small>{reply.origin === 'llm' ? 'INFERENCIA LOCAL REAL' : 'REGLAS LOCALES · NO ES UNA RESPUESTA DE LLM'}</small><p>{reply.plan.reply}</p>{!reply.proposal && reply.result && <p className={reply.result.ok ? 'action-result' : 'action-result rejected'}>Juego: {reply.result.text}</p>}
      {reply.proposal && !outcome && <div className="ai-proposal"><strong>{proposalLabel(reply.proposal)}</strong><span>El juego volverá a comprobar los requisitos al confirmar. {reply.proposal.value && `Valor interpretado: ${reply.proposal.value}.`} {reply.proposal.name === 'choose_protocol' && (reply.proposal.value === 'erase' ? 'Borrado irreversible de las diecisiete memorias y aislamiento de ECHO.' : 'Conservación permanente de las memorias y de ECHO.')}</span><div><button onClick={() => {
        try { const result = echoAi.confirm(reply.proposal!); setOutcome(`${result.ok ? 'Juego' : 'Acción rechazada'}: ${result.text}`); }
        catch (error) { setError(error instanceof Error ? error.message : 'La acción no se pudo ejecutar.'); }
      }}>Confirmar acción</button><button onClick={() => { echoAi.discard(); setOutcome('Propuesta descartada. No se ejecutó ninguna acción.'); }}>Descartar</button></div></div>}
      {outcome && <p className="action-result">{outcome}</p>}
    </div>}
    {error && <p className="ai-error" role="alert">{error}</p>}
    <div className="ai-model-controls">
      <p className="ai-state" role="status">{isolated ? 'ECHO aislada. Archivo eliminado. La salida auxiliar sigue operativa.' : !compatible ? caps.reason : ai.message}</p>
      {ai.status === 'loading' && <label className="ai-progress">Carga de archivos: {Math.round(ai.progress * 100)} %<progress max={1} value={ai.progress} /></label>}
      {!compatible && caps.status !== 'checking' && <button onClick={() => void checkCapabilities()}>Comprobar requisitos de IA</button>}
      {compatible && !isolated && !real && !busy && <button className="ai-load" onClick={() => { setDeleting(false); void echoAi.load(); }}>{ai.cached ? 'Cargar modelo desde caché' : `Descargar y activar IA local (≈${DOWNLOAD_ESTIMATE_MB} MB)`}</button>}
      {(real || busy) && <button className="ai-stop" onClick={() => echoAi.stop()}>{busy ? 'Cancelar IA y usar reglas locales' : 'Liberar IA y usar reglas locales'}</button>}
      <details className="ai-model-info"><summary>Modelo, privacidad y caché</summary><p>Qwen2.5‑0.5B‑Instruct, 4 bits, licencia Apache‑2.0. Descarga voluntaria de unos 300 MB desde Hugging Face y el runtime de MLC. Sin claves, pagos ni servidor de inferencia.</p><p>Las conversaciones solo viven en esta pestaña. Los acontecimientos y decisiones se guardan localmente con la partida. La activación prepara la GPU y el esquema con un token descartado, sin acciones ni conversación. El modelo usa aproximadamente 1 GB de memoria adicional; se recomienda margen de 1–1,5 GB. Se libera al cerrar el terminal. El navegador conserva los archivos en caché si dispone de espacio.</p><p>Los cambios de energía necesitan una celda instalada físicamente. La IA no puede saltarse el puzle.</p><a href="/QWEN-LICENSE.txt" target="_blank" rel="noreferrer">Consultar licencia del modelo</a>
        <button disabled={busy} className="ai-delete" onClick={() => { if (deleting) { setDeleting(false); void echoAi.clearCache(); } else setDeleting(true); }}>{deleting ? 'Confirmar borrado de la caché del modelo' : 'Eliminar modelo de la caché'}</button>
      </details>
    </div>
    <details className="ai-diagnostics"><summary>Diagnóstico técnico de IA (opcional)</summary><pre>{JSON.stringify({ model: MODEL_ID, status: ai.status, pesosEnCache: ai.cached, turnosEnMemoria: ai.history.length, operations: ai.diagnostics.map(d => ({ origin: d.origin, input: d.input, actions: d.actions, outcome: d.outcome, elapsedMs: d.elapsedMs, tokens: d.tokens })) }, null, 2)}</pre></details>
  </section>;
}
