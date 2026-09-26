import type { I18n } from '../core/i18n';
import type { PortfolioV4 } from '../schema/v4';
import { useRender, type Lang } from './context';
import { pick } from './text';

/**
 * Textos da interface do site publicado — botões, rótulos para leitor de tela,
 * avisos — num dicionário só, nos dois idiomas.
 *
 * `site.ui` do documento sobrescreve por chave: é onde a migração guarda os
 * rótulos personalizados do site antigo ("Todos os Projetos", o botão do NDA),
 * que antes eram migrados e ignorados. As chaves que existiam lá mantêm o nome
 * (allProjects, ndaBtn). Texto de interface escrito direto no componente, com
 * `lang === 'en' ? … : …`, não passa no teste ui-dicionario.
 */
const bi = (pt: string, en: string): I18n => ({ pt, en });

export const UI_PADRAO = {
  pularConteudo: bi('Pular para o conteúdo', 'Skip to content'),
  fechar: bi('Fechar', 'Close'),
  anterior: bi('Anterior', 'Previous'),
  proximo: bi('Próximo', 'Next'),
  proxima: bi('Próxima', 'Next'),
  imagem: bi('Imagem', 'Image'),
  imagemAmpliada: bi('Imagem ampliada', 'Enlarged image'),
  imagemAnterior: bi('Imagem anterior', 'Previous image'),
  proximaImagem: bi('Próxima imagem', 'Next image'),
  abrirImagem: bi('Abrir imagem', 'Open image'),
  abrirQuadro: bi('Abrir quadro', 'Open frame'),
  filtrarProjetos: bi('Filtrar projetos', 'Filter projects'),
  elementosDaPrevia: bi('Elementos do projeto nesta prévia', 'Project elements in this preview'),
  irParaProjeto: bi('Ir para o projeto →', 'Go to project →'),
  maisProjetos: bi('Mais projetos', 'More projects'),
  maisNotas: bi('Mais notas', 'More notes'),
  allProjects: bi('Todos os projetos', 'All projects'),
  todasNotas: bi('Todas as notas', 'All notes'),
  semConfidencial: bi('Nenhum trabalho confidencial ainda.', 'No confidential work yet.'),
  ndaTexto: bi('Trabalhos confidenciais. Digite a senha para ver.', 'Confidential work. Enter the password to view.'),
  senha: bi('Senha', 'Password'),
  senhaNda: bi('Senha NDA', 'NDA password'),
  ndaBtn: bi('Desbloquear', 'Unlock'),
  senhaIncorreta: bi('Senha incorreta.', 'Wrong password.'),
  erroTitulo: bi('Algo não pôde ser exibido', 'Something could not be shown'),
  erroTexto: bi('Tente de novo ou recarregue a página.', 'Try again or reload the page.'),
  tentarDeNovo: bi('Tentar de novo', 'Try again'),
  recarregar: bi('Recarregar', 'Reload'),
  paginaNaoEncontrada: bi('Esta página não está aqui', 'This page isn’t here'),
  projetoNaoEncontrado: bi('Este projeto não está aqui', 'This project isn’t here'),
  notaNaoEncontrada: bi('Esta nota não está aqui', 'This note isn’t here'),
  enderecoMudou: bi('O endereço pode ter mudado, ou o conteúdo saiu do site.', 'The address may have changed, or the content was taken down.'),
  irParaInicio: bi('Ir para o início', 'Go to the home page'),
  midiaIndisponivel: bi('Mídia indisponível.', 'Media unavailable.'),
  secaoComDefeito: bi('Uma seção desta página não pôde ser exibida. O resto continua aqui.', 'A section of this page could not be shown. The rest is still here.'),
} satisfies Record<string, I18n>;

export type UiChave = keyof typeof UI_PADRAO;

/**
 * Texto de interface no idioma: o personalizado do site (site.ui) ou o padrão.
 * Personalizado só em português não vale para quem visita em inglês — aí vale
 * o padrão em inglês.
 */
export function textoUi(data: PortfolioV4, lang: Lang, chave: UiChave): string {
  return data.site.ui[chave]?.[lang]?.trim() || pick(UI_PADRAO[chave], lang);
}

/** `t('fechar')` no idioma do visitante. */
export function useUi(): (chave: UiChave) => string {
  const { data, lang } = useRender();
  return (chave) => textoUi(data, lang, chave);
}

/** Valor do atributo `lang` do HTML para o idioma do site. */
export const htmlLang = (lang: Lang): string => (lang === 'en' ? 'en' : 'pt-BR');
