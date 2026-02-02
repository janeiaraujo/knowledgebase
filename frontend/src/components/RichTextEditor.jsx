import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import './RichTextEditor.css';
import TurndownService from 'turndown';
import { marked } from 'marked';
import { fileAPI } from '../services/api';

const lowlight = createLowlight(common);

const isProbablyHtml = (value) => {
  if (!value) return false;
  return /<\/?[a-z][\s\S]*>/i.test(String(value));
};

const turndown = new TurndownService({
  codeBlockStyle: 'fenced',
  emDelimiter: '_'
});

// Keep images as markdown image syntax
turndown.addRule('images', {
  filter: 'img',
  replacement: function (content, node) {
    const alt = node.getAttribute('alt') || '';
    const src = node.getAttribute('src') || '';
    if (!src) return '';
    return `![${alt}](${src})`;
  }
});

// Toolbar component
function MenuBar({ editor, onImageUpload, onToggleFullscreen, isFullscreen }) {
  if (!editor) return null;

  const addLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL do link:', previousUrl);
    
    if (url === null) return;
    
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="tiptap-toolbar">
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
          title="Título 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
          title="Título 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
          title="Título 3"
        >
          H3
        </button>
      </div>
      
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
          title="Negrito (Ctrl+B)"
        >
          <i className="bi bi-type-bold"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
          title="Itálico (Ctrl+I)"
        >
          <i className="bi bi-type-italic"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''}
          title="Riscado"
        >
          <i className="bi bi-type-strikethrough"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={editor.isActive('code') ? 'is-active' : ''}
          title="Código inline"
        >
          <i className="bi bi-code"></i>
        </button>
      </div>
      
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''}
          title="Lista com marcadores"
        >
          <i className="bi bi-list-ul"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'is-active' : ''}
          title="Lista numerada"
        >
          <i className="bi bi-list-ol"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'is-active' : ''}
          title="Citação"
        >
          <i className="bi bi-quote"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'is-active' : ''}
          title="Bloco de código"
        >
          <i className="bi bi-file-code"></i>
        </button>
      </div>
      
      <div className="toolbar-group">
        <button
          type="button"
          onClick={addLink}
          className={editor.isActive('link') ? 'is-active' : ''}
          title="Adicionar link"
        >
          <i className="bi bi-link-45deg"></i>
        </button>
        <button
          type="button"
          onClick={onImageUpload}
          title="Inserir imagem"
        >
          <i className="bi bi-image"></i>
        </button>
      </div>
      
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Linha horizontal"
        >
          <i className="bi bi-dash-lg"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          title="Desfazer (Ctrl+Z)"
        >
          <i className="bi bi-arrow-counterclockwise"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          title="Refazer (Ctrl+Y)"
        >
          <i className="bi bi-arrow-clockwise"></i>
        </button>
      </div>
      
      <div className="toolbar-group ms-auto">
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Expandir tela cheia'}
        >
          <i className={`bi ${isFullscreen ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'}`}></i>
        </button>
      </div>
    </div>
  );
}

export default function RichTextEditor({ value, onChange, placeholder = 'Digite aqui...', height = '300px' }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorHeight, setEditorHeight] = useState(parseInt(height));
  const [isResizing, setIsResizing] = useState(false);
  const editorContainerRef = useRef(null);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const isInternalUpdate = useRef(false);

  // Convert incoming markdown/html value to HTML for editor
  const getInitialContent = useCallback(() => {
    const incoming = value || '';
    if (!incoming) return '';
    
    if (isProbablyHtml(incoming)) {
      return incoming;
    }
    
    try {
      return marked.parse(incoming);
    } catch {
      return String(incoming);
    }
  }, [value]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We'll use CodeBlockLowlight instead
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content: getInitialContent(),
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor }) => {
      if (isInternalUpdate.current) return;
      
      const html = editor.getHTML();
      try {
        const md = turndown.turndown(html || '');
        onChange(md);
      } catch {
        onChange(html || '');
      }
    },
  });

  // Handle image upload
  const uploadAndInsertImage = useCallback(async (file) => {
    if (!file || !editor) return;
    try {
      const { data } = await fileAPI.upload(file);
      if (data?.url) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      alert(error.response?.data?.error || 'Falha ao enviar imagem');
    }
  }, [editor]);

  // Handle toolbar image button click
  const handleImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.onchange = async () => {
      const file = input.files && input.files[0];
      await uploadAndInsertImage(file);
    };
    input.click();
  }, [uploadAndInsertImage]);

  // Handle paste events for images
  useEffect(() => {
    if (!editor) return;

    const handlePaste = async (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const imageItem = Array.from(items).find(
        (it) => it.kind === 'file' && typeof it.type === 'string' && it.type.startsWith('image/')
      );

      if (!imageItem) return;

      event.preventDefault();
      const file = imageItem.getAsFile();
      await uploadAndInsertImage(file);
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('paste', handlePaste);

    return () => {
      editorElement.removeEventListener('paste', handlePaste);
    };
  }, [editor, uploadAndInsertImage]);

  // Sync external value changes to editor
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    
    const incoming = value || '';
    let html;
    
    if (isProbablyHtml(incoming)) {
      html = incoming;
    } else {
      try {
        html = marked.parse(incoming);
      } catch {
        html = String(incoming);
      }
    }
    
    // Only update if content actually differs (avoid cursor jumps)
    const currentHtml = editor.getHTML();
    if (currentHtml !== html && turndown.turndown(currentHtml) !== turndown.turndown(html)) {
      isInternalUpdate.current = true;
      editor.commands.setContent(html, false);
      isInternalUpdate.current = false;
    }
  }, [value, editor]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  // Handle resize drag
  const handleMouseDown = (e) => {
    if (isFullscreen) return;
    setIsResizing(true);
    startY.current = e.clientY;
    startHeight.current = editorHeight;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || isFullscreen) return;
      
      const deltaY = e.clientY - startY.current;
      const newHeight = Math.max(200, Math.min(800, startHeight.current + deltaY));
      setEditorHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, isFullscreen]);

  return (
    <div 
      ref={editorContainerRef}
      className={`tiptap-container ${isFullscreen ? 'fullscreen' : ''}`} 
      style={{ height: isFullscreen ? '100vh' : 'auto' }}
    >
      <MenuBar 
        editor={editor} 
        onImageUpload={handleImageUpload}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />
      <div 
        className="editor-wrapper" 
        style={{ height: isFullscreen ? 'calc(100vh - 50px)' : `${editorHeight}px` }}
      >
        <EditorContent editor={editor} />
      </div>
      {!isFullscreen && (
        <div 
          className="resize-handle"
          onMouseDown={handleMouseDown}
          title="Arraste para redimensionar"
        >
          <i className="bi bi-grip-horizontal"></i>
        </div>
      )}
    </div>
  );
}
