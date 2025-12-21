import { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './RichTextEditor.css';

export default function RichTextEditor({ value, onChange, placeholder = 'Digite aqui...', height = '300px' }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorHeight, setEditorHeight] = useState(parseInt(height));
  const [isResizing, setIsResizing] = useState(false);
  const editorRef = useRef(null);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link', 'image', 'video'],
      ['blockquote', 'code-block'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'link', 'image', 'video',
    'blockquote', 'code-block'
  ];

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

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
      ref={editorRef}
      className={`summernote-editor ${isFullscreen ? 'fullscreen' : ''}`} 
      style={{ height: isFullscreen ? '100vh' : 'auto' }}
    >
      <div className="editor-header">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary fullscreen-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Expandir tela cheia'}
        >
          <i className={`bi ${isFullscreen ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'}`}></i>
        </button>
      </div>
      <div className="editor-wrapper" style={{ height: isFullscreen ? 'calc(100vh - 45px)' : `${editorHeight}px` }}>
        <ReactQuill
          theme="snow"
          value={value || ''}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          style={{ height: '100%' }}
        />
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
