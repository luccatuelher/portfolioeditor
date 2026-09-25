import { describe, expect, it } from 'vitest';
import { avisoDeArmazenamento, DIAS_SEM_BACKUP, protegerRascunho } from '../src/editor/armazenamento';

/** Um StorageManager de mentira: o que o navegador responderia. */
function navegador(o: { persistido?: boolean; concede?: boolean; uso?: number; cota?: number; falha?: boolean }) {
  const chamadas: string[] = [];
  return {
    chamadas,
    storage: {
      persisted: async () => {
        chamadas.push('persisted');
        if (o.falha) throw new Error('bloqueado');
        return !!o.persistido;
      },
      persist: async () => {
        chamadas.push('persist');
        return !!o.concede;
      },
      estimate: async () => ({ usage: o.uso ?? 0, quota: o.cota ?? 1000 }),
    },
  };
}

const DIA = 86_400_000;
const agora = Date.UTC(2026, 8, 25);

describe('protegerRascunho', () => {
  it('pede espaço persistente quando ainda não tem', async () => {
    const n = navegador({ persistido: false, concede: true, uso: 100, cota: 1000 });
    expect(await protegerRascunho(n.storage)).toEqual({ persistente: true, uso: 0.1 });
    expect(n.chamadas).toEqual(['persisted', 'persist']);
  });

  it('já persistente: não pede de novo', async () => {
    const n = navegador({ persistido: true });
    expect((await protegerRascunho(n.storage)).persistente).toBe(true);
    expect(n.chamadas).toEqual(['persisted']);
  });

  it('navegador nega: diz que não é persistente', async () => {
    expect((await protegerRascunho(navegador({ concede: false }).storage)).persistente).toBe(false);
  });

  it('sem a API, ou com ela bloqueada: "não dá para saber", sem lançar', async () => {
    expect(await protegerRascunho(undefined)).toEqual({ persistente: null, uso: null });
    expect((await protegerRascunho(navegador({ falha: true }).storage)).persistente).toBeNull();
  });
});

describe('avisoDeArmazenamento', () => {
  const negado = { persistente: false, uso: 0.01 };

  it('pode ser apagado e nunca teve backup: avisa', () => {
    expect(avisoDeArmazenamento(negado, null, agora)).toMatch(/pode apagar o rascunho.*ainda não baixou nenhum backup/);
  });

  it('pode ser apagado, mas o backup é recente: não incomoda', () => {
    expect(avisoDeArmazenamento(negado, agora - 2 * DIA, agora)).toBeNull();
    expect(avisoDeArmazenamento(negado, agora - (DIAS_SEM_BACKUP - 1) * DIA, agora)).toBeNull();
  });

  it('backup antigo: avisa dizendo há quantos dias', () => {
    expect(avisoDeArmazenamento(negado, agora - 12 * DIA, agora)).toMatch(/último backup foi há 12 dias/);
  });

  it('persistente ou desconhecido: nada a dizer', () => {
    expect(avisoDeArmazenamento({ persistente: true, uso: 0.1 }, null, agora)).toBeNull();
    expect(avisoDeArmazenamento({ persistente: null, uso: null }, null, agora)).toBeNull();
  });

  it('espaço quase cheio avisa mesmo com backup recente e espaço persistente', () => {
    expect(avisoDeArmazenamento({ persistente: true, uso: 0.93 }, agora - DIA, agora)).toMatch(/93% cheio/);
    expect(avisoDeArmazenamento({ persistente: true, uso: 1.2 }, agora, agora)).toMatch(/99% cheio/);
  });
});
