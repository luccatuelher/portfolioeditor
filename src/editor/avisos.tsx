import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PortfolioV4 } from '../schema/v4';
import { useDialog } from './useDialog';
import { LinkPicker } from './choices';

/**
 * Avisos e perguntas do editor, num lugar só e no visual do editor — no lugar
 * de alert(), confirm() e prompt() do navegador (cinzas, fora do visual,
 * travam a página e não aceitam ação como "Desfazer").
 *
 * - avisar: faixa embaixo, que some sozinha (info) ou fica até fechar (erro);
 *   pode ter uma ação ("Desfazer").
 * - confirmar: diálogo com título, texto e os dois botões; devolve true/false.
 * - pedirLink: diálogo com a mesma escolha de destino do botão (páginas,
 *   projetos ou endereço digitado); devolve o href, '' para tirar o link, ou
 *   null se desistiu.
 */
export interface AcaoDoAviso {
  rotulo: string;
  fazer: () => void;
}
interface Aviso {
  id: number;
  texto: string;
  tipo: 'info' | 'erro';
  acao?: AcaoDoAviso;
}
export interface Confirmacao {
  titulo: string;
  texto: string;
  confirmar: string;
  cancelar?: string;
  /** Ação que troca o que está aberto: o foco começa em "Cancelar". */
  perigo?: boolean;
}

export interface AvisosApi {
  avisar(texto: string, opts?: { tipo?: 'info' | 'erro'; acao?: AcaoDoAviso; duracaoMs?: number }): number;
  fecharAviso(id: number): void;
  confirmar(c: Confirmacao): Promise<boolean>;
  pedirLink(atual: string): Promise<string | null>;
}

/** Fora do editor (componente testado sozinho): registra no console e segue. */
const SEM_EDITOR: AvisosApi = {
  avisar: (texto) => { console.warn('[editor]', texto); return 0; },
  fecharAviso: () => {},
  confirmar: () => Promise.resolve(false),
  pedirLink: () => Promise.resolve(null),
};

export const AvisosContext = createContext<AvisosApi>(SEM_EDITOR);

export function useAvisos(): AvisosApi {
  return useContext(AvisosContext);
}

/**
 * Estado dos avisos, para o Editor (que é quem os mostra e os oferece aos
 * filhos pelo AvisosContext). Devolve a API e o que desenhar.
 */
export function useAvisosDoEditor(doc: PortfolioV4): { api: AvisosApi; ui: React.ReactElement } {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [pergunta, setPergunta] = useState<(Confirmacao & { responder: (ok: boolean) => void }) | null>(null);
  const [link, setLink] = useState<{ atual: string; responder: (href: string | null) => void } | null>(null);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const fecharAviso = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setAvisos((a) => a.filter((x) => x.id !== id));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const api = useMemo<AvisosApi>(() => ({
    avisar(texto, opts = {}) {
      const id = ++seq.current;
      const tipo = opts.tipo ?? 'info';
      setAvisos((a) => [...a.slice(-2), { id, texto, tipo, acao: opts.acao }]);
      // Erro fica até a pessoa fechar: é o que ela precisa ler.
      if (tipo === 'info') timers.current.set(id, setTimeout(() => fecharAviso(id), opts.duracaoMs ?? 6000));
      return id;
    },
    fecharAviso,
    confirmar: (c) => new Promise<boolean>((responder) => setPergunta({ ...c, responder })),
    pedirLink: (atual) => new Promise<string | null>((responder) => setLink({ atual, responder })),
  }), [fecharAviso]);

  const ui = (
    <>
      {avisos.length ? (
        <div className="avisos">
          {avisos.map((a) => (
            <div key={a.id} className={`aviso aviso-${a.tipo}`} role={a.tipo === 'erro' ? 'alert' : 'status'}>
              <span>{a.texto}</span>
              {a.acao ? (
                <button type="button" className="aviso-acao" onClick={() => { a.acao!.fazer(); fecharAviso(a.id); }}>{a.acao.rotulo}</button>
              ) : null}
              <button type="button" className="aviso-fechar" aria-label="Fechar aviso" onClick={() => fecharAviso(a.id)}>✕</button>
            </div>
          ))}
        </div>
      ) : null}
      {pergunta ? (
        <DialogoConfirmar c={pergunta} onFim={(ok) => { pergunta.responder(ok); setPergunta(null); }} />
      ) : null}
      {link ? (
        <DialogoLink doc={doc} atual={link.atual} onFim={(href) => { link.responder(href); setLink(null); }} />
      ) : null}
    </>
  );
  return { api, ui };
}

function DialogoConfirmar({ c, onFim }: { c: Confirmacao; onFim: (ok: boolean) => void }): React.ReactElement {
  const dialogo = useDialog<HTMLDivElement>(() => onFim(false));
  const titulo = useId();
  return (
    <div className="modal-backdrop camada-avisos" onClick={() => onFim(false)}>
      <div className="modal dialogo-confirmar" role="alertdialog" aria-modal="true" aria-labelledby={titulo} ref={dialogo} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id={titulo}>{c.titulo}</h2>
        </div>
        <p className="dialogo-texto">{c.texto}</p>
        <div className="dialogo-acoes">
          <button type="button" className="tb-btn" autoFocus={c.perigo} onClick={() => onFim(false)}>{c.cancelar ?? 'Cancelar'}</button>
          <button type="button" className="tb-btn primary" autoFocus={!c.perigo} onClick={() => onFim(true)}>{c.confirmar}</button>
        </div>
      </div>
    </div>
  );
}

function DialogoLink({ doc, atual, onFim }: { doc: PortfolioV4; atual: string; onFim: (href: string | null) => void }): React.ReactElement {
  const [href, setHref] = useState(atual);
  const dialogo = useDialog<HTMLDivElement>(() => onFim(null));
  const titulo = useId();
  return (
    <div className="modal-backdrop camada-avisos" onClick={() => onFim(null)}>
      <div className="modal dialogo-link" role="dialog" aria-modal="true" aria-labelledby={titulo} ref={dialogo} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id={titulo}>Link no texto</h2>
          <button type="button" onClick={() => onFim(null)} aria-label="Fechar">✕</button>
        </div>
        <div className="dialogo-corpo">
          <LinkPicker doc={doc} href={href} onChange={setHref} />
        </div>
        <div className="dialogo-acoes">
          {atual ? <button type="button" className="tb-btn" onClick={() => onFim('')}>Tirar o link</button> : null}
          <button type="button" className="tb-btn primary" disabled={!href.trim() || href.trim() === '#'} onClick={() => onFim(href.trim())}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}
