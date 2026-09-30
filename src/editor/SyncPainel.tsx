import { useState } from 'react';
import { CAMINHO_PADRAO, gravarConfig, repoValido, type SyncConfig, type SyncStatus } from './githubSync';

export interface SyncProps {
  config: SyncConfig | null;
  status: SyncStatus;
  onConfig: (c: SyncConfig | null) => void;
  enviarAgora: () => void;
}

function textoStatus(s: SyncStatus): string {
  switch (s.tipo) {
    case 'desligado': return 'Desligado.';
    case 'aguardando': return 'Ligado — envia 1 min depois da última edição.';
    case 'enviando': return 'Enviando…';
    case 'ok': return `Enviado às ${s.em}.`;
    case 'erro': return `Falhou: ${s.msg}`;
  }
}

/** Liga/desliga a cópia automática do backup num repositório privado do GitHub. */
export function SyncPainel({ config, status, onConfig, enviarAgora }: SyncProps): React.ReactElement {
  const [repo, setRepo] = useState(config?.repo ?? '');
  const [token, setToken] = useState('');
  const ligar = (): void => {
    const c: SyncConfig = { repo: repo.trim(), token: token.trim() || config?.token || '', path: config?.path ?? CAMINHO_PADRAO };
    if (!repoValido(c.repo) || !c.token) return;
    gravarConfig(c);
    onConfig(c);
    setToken('');
  };
  const desligar = (): void => {
    gravarConfig(null);
    onConfig(null);
  };
  return (
    <div className="sync-github">
      <div className="panel-h">Backup no GitHub</div>
      <p className={`sync-status sync-${status.tipo}`} role="status">{textoStatus(status)}</p>
      <label className="field">
        <span>Repositório (dono/nome, privado)</span>
        <input type="text" value={repo} placeholder="usuario/portfolio-backup" onChange={(e) => setRepo(e.target.value)} />
      </label>
      <label className="field">
        <span>Token {config ? '(já salvo — deixe vazio para manter)' : ''}</span>
        <input type="password" value={token} autoComplete="off" placeholder="github_pat_…" onChange={(e) => setToken(e.target.value)} />
      </label>
      <p className="sync-nota">O token fica só neste navegador; não vai para o site nem para o backup.</p>
      <div className="sync-acoes">
        <button type="button" className="add-block-btn" disabled={!repoValido(repo) || !(token.trim() || config?.token)} onClick={ligar}>{config ? 'Salvar' : 'Ligar'}</button>
        {config ? <button type="button" className="add-block-btn" onClick={enviarAgora}>Enviar agora</button> : null}
        {config ? <button type="button" className="add-block-btn" onClick={desligar}>Desligar</button> : null}
      </div>
    </div>
  );
}
