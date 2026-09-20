/**
 * Força da senha do NDA.
 *
 * O caso aqui é incomum: o site publicado é um arquivo único que a pessoa
 * baixa. Quem quiser abrir o conteúdo confidencial tem o arquivo inteiro na
 * mão e pode tentar senhas à vontade, offline, sem ninguém para barrar. Os
 * 210.000 passos do PBKDF2 deixam cada tentativa cara, mas não salvam uma
 * senha curta: quem protege de verdade é o tamanho.
 */

export interface Forca {
  /** 0 a 4 — 0 não publica, 2 publica com aviso, 4 é confortável. */
  nivel: 0 | 1 | 2 | 3 | 4;
  rotulo: string;
  /** O que está faltando, em linguagem direta. */
  problemas: string[];
  /** false = curta ou óbvia demais para proteger o arquivo. */
  aceitavel: boolean;
}

/** Senhas que qualquer lista de ataque tenta nos primeiros segundos. */
const OBVIAS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'senha123', '12341234',
  'qwertyui', 'abcd1234', 'portfolio', 'storyboard', 'adminadmin', 'iloveyou',
]);

export const TAMANHO_MINIMO = 8;
export const TAMANHO_CONFORTAVEL = 14;

export function medirForca(senha: string): Forca {
  const s = senha.trim();
  const problemas: string[] = [];

  if (s.length < TAMANHO_MINIMO) problemas.push(`Curta demais: use pelo menos ${TAMANHO_MINIMO} caracteres.`);
  if (OBVIAS.has(s.toLowerCase())) problemas.push('É uma das senhas mais tentadas que existem.');
  if (s.length >= TAMANHO_MINIMO && /^\d+$/.test(s)) problemas.push('Só números é rápido de quebrar — misture letras.');
  if (s.length >= TAMANHO_MINIMO && /^(.)\1+$/.test(s)) problemas.push('Um caractere repetido não protege nada.');

  const variedade = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((re) => re.test(s)).length;
  if (s.length < TAMANHO_CONFORTAVEL && variedade < 2 && !problemas.length) {
    problemas.push('Misture maiúsculas, números ou símbolos — ou use uma frase mais longa.');
  }

  const aceitavel = s.length >= TAMANHO_MINIMO && !OBVIAS.has(s.toLowerCase()) && !/^(.)\1+$/.test(s);

  let nivel: Forca['nivel'] = 0;
  if (aceitavel) {
    // Tamanho pesa mais que variedade: uma frase longa vence uma senha curta cheia de símbolos.
    const pontos = Math.min(3, Math.floor(s.length / 6)) + (variedade >= 3 ? 1 : 0) + (s.length >= 20 ? 1 : 0);
    nivel = Math.max(1, Math.min(4, pontos)) as Forca['nivel'];
    if (/^\d+$/.test(s)) nivel = Math.min(nivel, 1) as Forca['nivel'];
  }

  const rotulos = ['não serve', 'fraca', 'razoável', 'boa', 'forte'] as const;
  return { nivel, rotulo: rotulos[nivel]!, problemas, aceitavel };
}

/** Sugestão legível e forte: quatro palavras + um número (estilo "diceware"). */
export function sugerirSenha(): string {
  const palavras = [
    'quadro', 'cena', 'traco', 'luz', 'sombra', 'plano', 'corte', 'camera', 'roteiro', 'gesto',
    'vento', 'chuva', 'fogo', 'pedra', 'rio', 'mar', 'monte', 'campo', 'noite', 'aurora',
    'tinta', 'papel', 'lapis', 'pincel', 'folha', 'linha', 'curva', 'ponto', 'ritmo', 'pausa',
  ];
  const aleatorio = (n: number): number => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]! % n;
  };
  const escolhidas = Array.from({ length: 4 }, () => palavras[aleatorio(palavras.length)]!);
  return `${escolhidas.join('-')}-${10 + aleatorio(90)}`;
}
