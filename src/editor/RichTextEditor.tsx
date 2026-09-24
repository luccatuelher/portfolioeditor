import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { I18n } from '../core/i18n';
import { useEditLang } from './fields';
import { LangFlag } from '../renderer/Flags';
import type { CampoId } from '../core/camposTexto';
import { useFocoDoCampo } from './focoCampo';

function OneEditor({ html, onChange }: { html: string; onChange: (h: string) => void }): React.ReactElement | null {
  const editor = useEditor({
    extensions: [StarterKit],
    content: html || '<p></p>',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'tiptap-input' } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Sincroniza mudanças externas (undo/redo) quando o editor não está focado.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (!editor.isFocused && current !== (html || '<p></p>')) {
      editor.commands.setContent(html || '<p></p>');
    }
  }, [html, editor]);

  if (!editor) return null;
  const btn = (active: boolean, label: React.ReactNode, run: () => void): React.ReactElement => (
    <button type="button" className={active ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {label}
    </button>
  );
  return (
    <div className="tiptap-wrap">
      <div className="tiptap-toolbar">
        {btn(editor.isActive('bold'), <b>B</b>, () => editor.chain().focus().toggleBold().run())}
        {btn(editor.isActive('italic'), <i>I</i>, () => editor.chain().focus().toggleItalic().run())}
        {btn(editor.isActive('bulletList'), '•', () => editor.chain().focus().toggleBulletList().run())}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/** Editor rich (Tiptap) no idioma escolhido no toggle do inspector. */
export function RichI18nInput({ value, onChange, campo }: { value: I18n; onChange: (v: I18n) => void; campo?: CampoId }): React.ReactElement {
  const lang = useEditLang();
  const caixa = useRef<HTMLDivElement>(null);
  useFocoDoCampo(campo, caixa);
  return (
    <div className="insp-i18n-field" ref={caixa} data-campo={campo}>
      <span className="insp-i18n-tag"><LangFlag lang={lang} /></span>
      <OneEditor key={lang} html={value[lang]} onChange={(h) => onChange({ ...value, [lang]: h })} />
    </div>
  );
}
