import React, { useState, useRef, useCallback, useEffect } from 'react';
import { fileAPI, aiAPI } from '../services/api';

/**
 * Anexos de imagem para a Captura Rapida (screenshots de erro etc.):
 * - selecionar arquivo(s), arrastar-e-soltar, ou colar (Ctrl+V) do clipboard
 * - upload via /api/files/upload (ja existente)
 * - legenda automatica via IA (/api/ai/describe-image), editavel pelo usuario
 *
 * Semi-controlado: mantem a lista de imagens (com estado de upload/legenda)
 * internamente, e notifica o pai via onChange toda vez que ela muda - assim
 * o pai so precisa ler o valor final na hora de enviar o formulario, sem
 * precisar entender o formato interno (uploading/describing/error).
 * Item exposto: { fileId, url, filename, description }
 */
export default function ImageAttachments({ onChange, context = '' }) {
  const [images, setImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!onChange) return;
    onChange(
      images
        .filter(img => img.fileId && !img.error)
        .map(({ fileId, url, filename, description }) => ({ fileId, url, filename, description }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const updateImage = useCallback((localId, patch) => {
    setImages(prev => prev.map(img => (img.localId === localId ? { ...img, ...patch } : img)));
  }, []);

  const addFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const newEntries = files.map(file => ({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      filename: file.name || 'screenshot.png',
      url: URL.createObjectURL(file),
      description: '',
      uploading: true,
      describing: false,
      error: null
    }));

    setImages(prev => [...prev, ...newEntries]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const entry = newEntries[i];

      try {
        const { data } = await fileAPI.upload(file);
        updateImage(entry.localId, {
          fileId: data.fileId,
          url: data.url,
          uploading: false,
          describing: true
        });

        try {
          const { data: aiData } = await aiAPI.describeImage(data.fileId, context);
          updateImage(entry.localId, { description: aiData.description, describing: false });
        } catch (aiErr) {
          // IA opcional (pode nao estar configurada - 503) - segue sem legenda automatica
          updateImage(entry.localId, { describing: false });
        }
      } catch (uploadErr) {
        updateImage(entry.localId, {
          uploading: false,
          error: uploadErr.response?.data?.error || 'Falha no upload'
        });
      }
    }
  }, [updateImage, context]);

  const handleFileInput = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length) {
      e.preventDefault();
      addFiles(imageFiles);
    }
  };

  const handleRemove = (localId) => {
    setImages(prev => {
      const img = prev.find(i => i.localId === localId);
      if (img?.fileId) fileAPI.delete(img.fileId).catch(() => {});
      return prev.filter(i => i.localId !== localId);
    });
  };

  return (
    <div className="image-attachments">
      <div
        className={`border rounded p-3 text-center ${isDragging ? 'border-primary bg-light' : 'border-dashed'}`}
        style={{ borderStyle: 'dashed', cursor: 'pointer' }}
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <i className="bi bi-image text-muted fs-4 d-block mb-1"></i>
        <small className="text-muted">
          Clique para escolher, arraste imagens aqui, ou clique e cole (Ctrl+V) uma captura de tela
        </small>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="d-none"
          onChange={handleFileInput}
        />
      </div>

      {images.length > 0 && (
        <div className="d-flex flex-wrap gap-3 mt-3">
          {images.map(img => (
            <div key={img.localId} className="card" style={{ width: '160px' }}>
              <div className="position-relative">
                <img
                  src={img.url}
                  alt={img.filename}
                  className="card-img-top"
                  style={{ height: '100px', objectFit: 'cover', opacity: img.uploading ? 0.5 : 1 }}
                />
                {img.uploading && (
                  <div className="position-absolute top-50 start-50 translate-middle">
                    <span className="spinner-border spinner-border-sm text-primary" />
                  </div>
                )}
                <button
                  type="button"
                  className="btn-close btn-close-white bg-dark bg-opacity-50 rounded-circle position-absolute top-0 end-0 m-1 p-1"
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleRemove(img.localId)}
                  title="Remover"
                />
              </div>
              <div className="card-body p-2">
                {img.error ? (
                  <small className="text-danger">{img.error}</small>
                ) : (
                  <textarea
                    className="form-control form-control-sm"
                    rows={2}
                    placeholder={img.describing ? 'Descrevendo com IA...' : 'Descrição da imagem'}
                    value={img.description}
                    disabled={img.describing}
                    onChange={(e) => updateImage(img.localId, { description: e.target.value })}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
