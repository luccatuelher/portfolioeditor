import { useState } from 'react';
import { NdaPasswordModal } from './NdaPasswordModal';
import { gravarSenhaNda, useTemSenhaNda } from './senhaNda';

/** Painel Dados › Senha do NDA: definir, trocar ou esquecer a senha guardada neste navegador. */
export function SenhaNdaPainel(): React.ReactElement {
  const tem = useTemSenhaNda();
  const [trocando, setTrocando] = useState(false);
  return (
    <div className="sync-github senha-nda">
      <div className="panel-h">Senha do NDA</div>
      <p className="sync-status" role="status">
        {tem ? 'Guardada neste navegador: o “Baixar site” cifra a área NDA com ela, sem perguntar.' : 'Ainda não escolhida: é pedida no primeiro “Baixar site” com itens NDA.'}
      </p>
      <p className="sync-nota">Fica só neste navegador; não vai para o site nem para o backup.</p>
      <div className="sync-acoes">
        <button type="button" className="add-block-btn" onClick={() => setTrocando(true)}>{tem ? 'Trocar senha' : 'Escolher senha'}</button>
        {tem ? <button type="button" className="add-block-btn" onClick={() => gravarSenhaNda(null)}>Esquecer</button> : null}
      </div>
      {trocando ? (
        <NdaPasswordModal
          modo="trocar"
          onCancel={() => setTrocando(false)}
          onConfirm={(senha) => {
            setTrocando(false);
            if (senha) gravarSenhaNda(senha);
          }}
        />
      ) : null}
    </div>
  );
}
