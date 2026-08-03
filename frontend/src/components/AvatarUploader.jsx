import React, { useState, useRef, useCallback } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import Cropper from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { userAPI } from '../services/api';

const OUTPUT_SIZE = 512; // avatar final, quadrado
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // limite do arquivo ORIGINAL escolhido

/**
 * Recorta a area selecionada e devolve um Blob JPEG.
 * `croppedAreaPixels` vem do react-easy-crop, em pixels da imagem original.
 */
async function getCroppedBlob(imageSrc, croppedAreaPixels) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem'))),
      'image/jpeg',
      0.9
    );
  });
}

export default function AvatarUploader({ avatarUrl, name, onChange }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Imagem quebrada (URL fora do ar) cai para a inicial do nome
  const [imageFailed, setImageFailed] = useState(false);

  const displayedUrl = imageFailed ? null : avatarUrl;

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.avatar.invalidFormat'));
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast.error(t('profile.avatar.tooLarge'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append('file', blob, 'avatar.jpg');

      const { data } = await userAPI.uploadAvatar(formData);
      setImageFailed(false);
      onChange?.(data.user);
      setImageSrc(null);
      toast.success(t('profile.avatar.updated'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const { data } = await userAPI.deleteAvatar();
      setImageFailed(false);
      onChange?.(data.user);
      toast.success(t('profile.avatar.removed'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('profile.saveError'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <div className="position-relative d-inline-block">
        {displayedUrl ? (
          <img
            src={displayedUrl}
            alt={name || 'avatar'}
            className="rounded-circle"
            style={{ width: '88px', height: '88px', objectFit: 'cover' }}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div
            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
            style={{
              width: '88px',
              height: '88px',
              fontSize: '2rem',
              background: 'linear-gradient(135deg, #6610f2 0%, #d63384 100%)'
            }}
          >
            {name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-sm rounded-circle position-absolute bottom-0 end-0 d-flex align-items-center justify-content-center"
          style={{ width: '32px', height: '32px' }}
          onClick={() => inputRef.current?.click()}
          title={t('profile.avatar.change')}
        >
          <i className="bi bi-camera-fill"></i>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="d-none"
          onChange={handleFileSelected}
        />
      </div>

      <div className="mt-2">
        <Button variant="link" size="sm" className="p-0" onClick={() => inputRef.current?.click()}>
          {t('profile.avatar.change')}
        </Button>
        {avatarUrl && (
          <>
            <span className="text-muted mx-1">·</span>
            <Button
              variant="link"
              size="sm"
              className="p-0 text-danger"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? <Spinner size="sm" animation="border" /> : t('profile.avatar.remove')}
            </Button>
          </>
        )}
      </div>

      {/* Modal de recorte */}
      <Modal show={!!imageSrc} onHide={() => !saving && setImageSrc(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('profile.avatar.cropTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div
            className="position-relative bg-dark rounded"
            style={{ height: '320px' }}
          >
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          <Form.Group className="mt-3">
            <Form.Label className="small text-muted">
              <i className="bi bi-zoom-in me-1"></i>
              {t('profile.avatar.zoom')}
            </Form.Label>
            <Form.Range
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </Form.Group>

          <small className="text-muted">{t('profile.avatar.cropHelp')}</small>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setImageSrc(null)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !croppedAreaPixels}>
            {saving ? <Spinner size="sm" animation="border" /> : (
              <><i className="bi bi-check-lg me-1"></i>{t('profile.avatar.save')}</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
