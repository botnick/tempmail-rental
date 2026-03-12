'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useCallback, useState } from 'react';

/* ─── Toolbar Button ─────────────────────────── */
function TBBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-all cursor-pointer
        ${active ? 'bg-brand/20 text-brand' : 'text-text-muted hover:text-text-primary hover:bg-white/[0.06]'}
        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-white/[0.08] mx-0.5" />;
}

/* ─── Link Modal ─────────────────────────────── */
function LinkModal({
  open, onClose, onSubmit, initialUrl,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
  initialUrl: string;
}) {
  const [url, setUrl] = useState(initialUrl);

  useEffect(() => { setUrl(initialUrl); }, [initialUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-elevated border border-border-subtle rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-zoom-in">
        <div className="p-5 border-b border-border-subtle">
          <h3 className="text-lg font-bold text-text-primary">Insert Link</h3>
        </div>
        <div className="p-5">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 font-mono"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && url) { e.preventDefault(); onSubmit(url); } }}
          />
        </div>
        <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">Cancel</button>
          <button onClick={() => url && onSubmit(url)} disabled={!url}
            className="px-5 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">Insert</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Editor ────────────────────────────── */
interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  minHeight = '200px',
}: RichTextEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-brand underline underline-offset-2' },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none',
        style: `min-height: ${minHeight}`,
      },
    },
  });

  // Sync content from parent
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    setLinkUrl(prev);
    setLinkOpen(true);
  }, [editor]);

  const insertLink = useCallback((url: string) => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
    setLinkOpen(false);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.08] shadow-lg shadow-black/20">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 bg-white/[0.03] border-b border-white/[0.06]">
        {/* Text formatting */}
        <TBBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <strong>B</strong>
        </TBBtn>
        <TBBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <em>I</em>
        </TBBtn>
        <TBBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
          <span className="underline">U</span>
        </TBBtn>
        <TBBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <span className="line-through">S</span>
        </TBBtn>

        <Divider />

        {/* Headings */}
        <TBBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          H2
        </TBBtn>
        <TBBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          H3
        </TBBtn>

        <Divider />

        {/* Lists */}
        <TBBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>
        </TBBtn>
        <TBBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered List">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="1" y="8" fill="currentColor" fontSize="7" fontWeight="bold" stroke="none">1</text><text x="1" y="14" fill="currentColor" fontSize="7" fontWeight="bold" stroke="none">2</text><text x="1" y="20" fill="currentColor" fontSize="7" fontWeight="bold" stroke="none">3</text></svg>
        </TBBtn>

        <Divider />

        {/* Blocks */}
        <TBBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>
        </TBBtn>
        <TBBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code Block">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </TBBtn>
        <TBBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="12" x2="22" y2="12"/></svg>
        </TBBtn>

        <Divider />

        {/* Link */}
        <TBBtn onClick={openLinkDialog} active={editor.isActive('link')} title="Link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </TBBtn>
        {editor.isActive('link') && (
          <TBBtn onClick={() => editor.chain().focus().unsetLink().run()} title="Remove Link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2"/></svg>
          </TBBtn>
        )}

        <Divider />

        {/* Alignment */}
        <TBBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
        </TBBtn>
        <TBBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </TBBtn>
        <TBBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
        </TBBtn>

        <Divider />

        {/* Clear */}
        <TBBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear Formatting">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
        </TBBtn>
      </div>

      {/* Editor Content */}
      <div className="px-4 py-3 bg-black/20" style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.15)' }}>
        <EditorContent editor={editor} />
      </div>

      {/* Link Dialog */}
      <LinkModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onSubmit={insertLink}
        initialUrl={linkUrl}
      />

      {/* Editor styles */}
      <style>{`
        .tiptap {
          color: #fef3e2;
          font-size: 0.875rem;
          line-height: 1.7;
        }
        .tiptap:focus { outline: none; }
        .tiptap p { margin: 0.5em 0; }
        .tiptap h2 { font-size: 1.25rem; font-weight: 700; margin: 1em 0 0.5em; color: white; }
        .tiptap h3 { font-size: 1.1rem; font-weight: 600; margin: 0.8em 0 0.4em; color: white; }
        .tiptap h4 { font-size: 1rem; font-weight: 600; margin: 0.6em 0 0.3em; color: white; }
        .tiptap ul, .tiptap ol { padding-left: 1.5em; margin: 0.5em 0; }
        .tiptap ul { list-style: disc; }
        .tiptap ol { list-style: decimal; }
        .tiptap li { margin: 0.25em 0; }
        .tiptap blockquote {
          border-left: 3px solid rgba(249,115,22,0.4);
          padding-left: 1em;
          margin: 0.75em 0;
          color: rgba(254,243,226,0.7);
          font-style: italic;
        }
        .tiptap code {
          background: rgba(255,255,255,0.06);
          padding: 0.15em 0.4em;
          border-radius: 4px;
          font-size: 0.85em;
          font-family: monospace;
        }
        .tiptap pre {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 0.75rem;
          padding: 0.75em 1em;
          margin: 0.75em 0;
          overflow-x: auto;
        }
        .tiptap pre code {
          background: none;
          padding: 0;
          border-radius: 0;
        }
        .tiptap hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.08);
          margin: 1em 0;
        }
        .tiptap a {
          color: #f97316;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(254,243,226,0.25);
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}
