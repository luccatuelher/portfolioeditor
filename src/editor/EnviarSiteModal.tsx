import { useId, useState } from 'react';
import { useDialog } from './useDialog';
import { validarConfigSite, type SiteConfig } from './githubSite';

/**
 * Onde o "Enviar ao portfólio" grava: repositório do site e token do GitHub.
 * Pedido na primeira vez (ou quando o GitHub recusa o token) e guardado só
 * neste navegador, como o do backup.
 */
export function EnviarSiteModal({ inicial, erro, onConfirm, onCancel }: { inicial: SiteConfig; erro?: string; onConfirm: (c: SiteConfig) => void; onCancel: () => void }): React.ReactElement {
  const [repo, setRepo] = useState(inicial.repo);
  const [token, setToken] = useState('');
  const [vendo, setVendo] = useState(false);
  const dialogo = useDialog<HTMLDivElement>(onCancel);
  const titulo = useId();
  const problema = validarConfigSite({ repo, token });

  const confirmar = (): void => {
    if (problema) return;
    onConfirm({ repo: repo.trim(), token: token.trim(), branch: inicial.branch });
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal nda-modal" role="dialog" aria-modal="true" aria-labelledby={titulo} ref={dialogo} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id={titulo}>Enviar ao portfólio</h2>
          <button type="button" onClick={onCancel} aria-label="Fechar">✕</button>
        </div>
        <p className="nda-modal-lead">
          O editor grava o <b>index.html</b> (e a imagem de compartilhar) direto no repositório do site, sem baixar e subir à mão. Para isso precisa de um token do GitHub com permissão de escrita <b>nesse repositório</b> (Contents: Read and write).
        </p>
        {erro ? <p className="nda-modal-aviso" role="alert">{erro}</p> : null}
        <label className="field sync-campo">
          <span>Repositório do site (dono/nome)</span>
          <input type="text" value={repo} placeholder="usuario/portfolio" onChange={(e) => setRepo(e.target.value)} />
        </label>
        <div className="nda-modal-row">
          <input
            type={vendo ? 'text' : 'password'}
            value={token}
            autoFocus
            autoComplete="off"
            aria-label="Token do GitHub"
            placeholder="github_pat_…"
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => void (e.key === 'Enter' && confirmar())}
          />
          <button type="button" className="tb-btn" onClick={() => setVendo((v) => !v)} title={vendo ? 'Esconder' : 'Mostrar'}>
            {vendo ? '🙈' : '👁'}
          </button>
        </div>
        <p className="nda-modal-lead">O token fica só neste navegador; não vai para o site nem para o backup.</p>
        <div className="nda-modal-acoes">
          <button type="button" className="tb-btn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="tb-btn primary" disabled={!!problema} title={problema ?? undefined} onClick={confirmar}>Salvar e enviar</button>
        </div>
      </div>
    </div>
  );
}
