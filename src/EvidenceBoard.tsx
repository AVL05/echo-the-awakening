import { useState } from 'react';
import { useGame } from './game/store';
import { DOCUMENTS, ZONE_LABELS, type DocumentId } from './game/story';
import { echoDialogue } from './game/escape';

export default function EvidenceBoard() {
  const p = useGame(s => s.progress);
  const docs = p.story.documents;
  const [left, setLeft] = useState<DocumentId | ''>('');
  const [right, setRight] = useState<DocumentId | ''>('');
  const selected = [docs.includes(left as DocumentId) ? left : docs[0], docs.includes(right as DocumentId) ? right : docs.at(-1)];
  return <section className="evidence-board" aria-label="Mesa de pruebas">
    <h3>Contrasta las fuentes.</h3>
    <p className="fineprint">Las afirmaciones de ECHO y los documentos son fuentes distintas. Tú decides qué relaciones quedan demostradas.</p>
    <blockquote><span className="eyebrow">ECHO AFIRMA / VERSIÓN DEL SISTEMA</span><p>{echoDialogue('incident', p)}</p></blockquote>
    {docs.length === 0 ? <p>No has recuperado documentos. Acércate a los lectores de la instalación para guardar sus registros.</p> : <div className="evidence-columns">{selected.map((id, i) => <article key={i}>
      <label>Documento {i + 1}<select aria-label={`Documento ${i + 1}`} value={id ?? ''} onChange={event => (i === 0 ? setLeft : setRight)(event.target.value as DocumentId)}>{docs.map(key => <option key={key} value={key}>{DOCUMENTS[key].title}</option>)}</select></label>
      {id && <><span className="eyebrow">{DOCUMENTS[id].code} / {ZONE_LABELS[DOCUMENTS[id].zone]}</span><h4>{DOCUMENTS[id].title}</h4><p className="document-body">{DOCUMENTS[id].text}</p></>}
    </article>)}</div>}
    {p.story.escape.waferRead && <article className="independent-record"><span className="eyebrow">LECTOR INDEPENDIENTE / FIRMA HUMANA VERIFICADA</span><h4>Dependencias conservadas</h4><p>La orden de cierre incluye la huella del lote C17 terminado. Su confirmación viajó por una portadora que dejó de existir al accionar el corte manual. La hora del cierre en la red de ECHO fue sobrescrita.</p><p className="fineprint">El lector acredita estas dependencias. Reconstruye su orden; no demuestra que las copias estén conscientes.</p></article>}
    {p.story.escape.secret && <blockquote>«Si no vuelvo, conservad mi voz para mi hija. Eso no autoriza a encerrar a nadie». — Operador 17, para Mara.</blockquote>}
  </section>;
}
