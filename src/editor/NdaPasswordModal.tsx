import { useId, useState } from 'react';
import { useDialog } from './useDialog';
import { medirForca, sugerirSenha, TAMANHO_MINIMO } from '../publish/passwordStrength';

/**
 * Senha da área NDA: pedida no primeiro "Baixar site" (modo `publicar`) e
 * trocada no painel Dados (modo `trocar`). Depois de escolhida, fica guardada
 * neste navegador e o site sai direto (senhaNda.ts).
 *
 * Substitui o `prompt()` do navegador por um diálogo que mostra a força da
 * senha, sugere uma forte e avisa do que ninguém lembra na hora: essa senha
 * não tem recuperação — ela cifra o conteúdo dentro do próprio arquivo.
 */
export function NdaPasswordModal({ quantidade = 0, modo = 'publicar', onConfirm, onCancel }: { quantidade?: number; modo?: 'publicar' | 'trocar'; onConfirm: (senha: string | undefined) => void; onCancel: () => void }): React.ReactElement {
  const [senha, setSenha] = useState('');
  const [vendo, setVendo] = useState(false);
  const forca = medirForca(senha);
  const vazia = !senha.trim();
  const dialogo = useDialog<HTMLDivElement>(onCancel);
  const titulo = useId();

  const confirmar = (): void => {
    if (vazia) return;
    if (!forca.aceitavel) return;
    onConfirm(senha.trim());
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal nda-modal" role="dialog" aria-modal="true" aria-labelledby={titulo} ref={dialogo} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id={titulo}>{modo === 'trocar' ? 'Nova senha da área NDA' : 'Senha da área NDA'}</h2>
          <button type="button" onClick={onCancel} aria-label="Fechar">✕</button>
        </div>

        <p className="nda-modal-lead">
          {modo === 'trocar'
            ? 'Vale a partir do próximo “Baixar site”: quem usava a senha antiga vai precisar da nova.'
            : `${quantidade === 1 ? 'Há 1 item confidencial' : `Há ${quantidade} itens confidenciais`} para cifrar dentro do site.`}{' '}
          Quem tiver o arquivo pode tentar senhas à vontade, no computador dele — por isso o tamanho importa mais que os símbolos.
        </p>

        <div className="nda-modal-row">
          <input
            type={vendo ? 'text' : 'password'}
            value={senha}
            autoFocus
            placeholder={`Pelo menos ${TAMANHO_MINIMO} caracteres`}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => void (e.key === 'Enter' && confirmar())}
          />
          <button type="button" className="tb-btn" onClick={() => setVendo((v) => !v)} title={vendo ? 'Esconder' : 'Mostrar'}>
            {vendo ? '🙈' : '👁'}
          </button>
          <button type="button" className="tb-btn" onClick={() => { setSenha(sugerirSenha()); setVendo(true); }} title="Gerar uma senha forte e legível">
            Sugerir
          </button>
        </div>

        {senha ? (
          <div className={`nda-forca nivel-${forca.nivel}`}>
            <span className="nda-forca-barra"><i style={{ width: `${forca.nivel * 25}%` }} /></span>
            <b>{forca.rotulo}</b>
            {forca.problemas.length ? <span>{forca.problemas[0]}</span> : null}
          </div>
        ) : null}

        <p className="nda-modal-aviso">
          ⚠ Guarde a senha: ela cifra o conteúdo dentro do arquivo e <b>não tem como recuperar</b>. Sem ela, nem você reabre.
          {' '}Este navegador lembra dela: nas próximas vezes o site sai direto. Para trocar ou esquecer, vá em Dados › Senha do NDA.
        </p>

        <div className="nda-modal-acoes">
          {modo === 'publicar' ? (
            <button type="button" className="tb-btn" onClick={() => onConfirm(undefined)} title="Gera o site sem os itens confidenciais">
              Publicar sem os itens NDA
            </button>
          ) : (
            <button type="button" className="tb-btn" onClick={onCancel}>Cancelar</button>
          )}
          <button type="button" className="tb-btn primary" disabled={vazia || !forca.aceitavel} onClick={confirmar}>
            {modo === 'trocar' ? 'Salvar senha' : 'Cifrar e gerar o site'}
          </button>
        </div>
      </div>
    </div>
  );
}
