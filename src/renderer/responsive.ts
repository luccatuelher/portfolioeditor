/**
 * Sistema de largura por dispositivo.
 *
 * Desenhado a partir de como os editores conhecidos resolvem isso:
 *
 * - **Webflow / Framer — cascata de breakpoints.** O valor do computador vale
 *   para todos; ao mexer no tablet, o valor desce para o celular também, a menos
 *   que o celular tenha um valor próprio. É isso que evita ter de reajustar a
 *   mesma coisa três vezes. Aqui: `mobile ?? tablet ?? desktop`.
 * - **Squarespace (Fluid Engine) / Wix — grade própria do celular.** Em vez de
 *   espremer a grade do computador, eles garantem um tamanho mínimo utilizável.
 *   Aqui isso é o PISO FLUIDO: uma largura herdada nunca pode render menos que
 *   um mínimo confortável em pixels naquela tela.
 * - **Editores em geral — o explícito nunca é mexido.** Se você arrastou a alça
 *   com aquela tela selecionada, o valor é seu: não sofre piso nem ajuste.
 *
 * A diferença entre "arranjo deliberado" e "grade automática" importa: uma fila
 * de cinco logos montada à mão deve continuar com cinco no celular (o dono quis
 * assim), enquanto uma galeria de miniaturas não deve virar selos de 80px.
 * Por isso o piso só se aplica a `kind: 'media' | 'card'` (itens de coleção e
 * quadros), nunca a blocos posicionados à mão na seção.
 */

export type Device = 'desktop' | 'tablet' | 'mobile';

/** Larguras por dispositivo de um elemento, em 12 avos. */
export interface DeviceSpans {
  desktop: number;
  tablet?: number;
  mobile?: number;
}

/** O que o elemento é, para saber o mínimo confortável. */
export type SpanKind =
  | 'block' // bloco posicionado na seção: respeita o arranjo feito à mão
  | 'media' // miniatura de galeria, sketch, quadro de storyboard
  | 'card' // card com título/descrição: precisa de largura para o texto
  | 'header'; // elemento do cabeçalho

/** Largura de referência da tela de cada dispositivo (a mesma da prévia do editor). */
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1440, tablet: 768, mobile: 390 };

/** Mínimo confortável, em px, por tipo. 0 = sem piso. */
export const MIN_WIDTH: Record<SpanKind, number> = { block: 0, media: 150, card: 200, header: 0 };

/** No celular o cabeçalho empilha por padrão: nome, menu e idiomas em linhas. */
export const HEADER_MOBILE_DEFAULT = 12;

const COLS = 12;
/** Divisores de 12: uma fila sempre fecha certo (12, 6, 4, 3, 2, 1 por linha). */
const SNAP = [1, 2, 3, 4, 6, 12];

const clamp = (n: number): number => Math.max(1, Math.min(COLS, Math.round(n)));

/** Arredonda para cima até o próximo divisor de 12 (4,2 → 6, e não 5). */
export function snapUp(span: number): number {
  return SNAP.find((s) => s >= span) ?? COLS;
}

/** Largura útil de uma coluna, em px, na tela do dispositivo (já sem as margens). */
export function columnWidth(device: Device): number {
  const margem = device === 'mobile' ? 32 : device === 'tablet' ? 0.08 * DEVICE_WIDTH[device] : 160;
  return (DEVICE_WIDTH[device] - margem) / COLS;
}

/** Menor largura (em 12 avos) que ainda dá um elemento confortável naquela tela. */
export function minSpanFor(kind: SpanKind, device: Device): number {
  const min = MIN_WIDTH[kind];
  if (!min || device === 'desktop') return 1;
  return snapUp(Math.min(COLS, min / columnWidth(device)));
}

export interface ResolvedSpan {
  /** Largura final em 12 avos. */
  span: number;
  /** true = valor escolhido à mão para ESTE dispositivo. */
  own: boolean;
  /** De onde veio, quando não é próprio. */
  from: Device;
  /** true = o piso fluido aumentou a largura herdada. */
  floored: boolean;
}

/**
 * Resolve a largura de um elemento num dispositivo: cascata → piso fluido.
 * O explícito daquele dispositivo passa intacto.
 */
export function resolveSpan(spans: DeviceSpans, device: Device, kind: SpanKind = 'block'): ResolvedSpan {
  const desktop = clamp(spans.desktop);
  if (device === 'desktop') return { span: desktop, own: true, from: 'desktop', floored: false };

  const proprio = device === 'tablet' ? spans.tablet : spans.mobile;
  if (proprio) return { span: clamp(proprio), own: true, from: device, floored: false };

  // Cascata: o celular herda do tablet quando o tablet foi ajustado.
  const herdado = device === 'mobile' && spans.tablet ? clamp(spans.tablet) : desktop;
  const from: Device = device === 'mobile' && spans.tablet ? 'tablet' : 'desktop';

  const piso = minSpanFor(kind, device);
  const span = Math.max(herdado, piso);
  return { span: clamp(span), own: false, from, floored: span > herdado };
}

/** As três larguras de um elemento como variáveis CSS da grade. */
export function spanVars(spans: DeviceSpans, kind: SpanKind = 'block'): Record<string, string | number | undefined> {
  return {
    '--span': clamp(spans.desktop),
    '--gc-t': `span ${resolveSpan(spans, 'tablet', kind).span}`,
    '--gc-m': `span ${resolveSpan(spans, 'mobile', kind).span}`,
  };
}
