import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

/**
 * Botao de ditado por voz usando a Web Speech API do proprio navegador
 * (SpeechRecognition/webkitSpeechRecognition) - sem chamada a backend, sem
 * custo de IA. Transcreve ao vivo em pt-BR e vai anexando o texto final ao
 * campo de destino via onTranscript; o trecho ainda nao finalizado aparece
 * como preview abaixo do botao, sem ser commitado ainda.
 *
 * Suporte: Chrome/Edge (via webkitSpeechRecognition). Safari tem suporte
 * parcial. Firefox nao suporta - o botao fica desabilitado com uma dica.
 */

const getSpeechRecognitionCtor = () =>
  (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

export default function VoiceRecorderButton({ onTranscript, lang = 'pt-BR', label = 'Ditar por voz' }) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [permissionError, setPermissionError] = useState(false);
  const recognitionRef = useRef(null);

  const isSupported = Boolean(getSpeechRecognitionCtor());

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startRecording = () => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) return;

    setPermissionError(false);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          onTranscript(result[0].transcript);
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setPermissionError(true);
      }
      setIsRecording(false);
      setInterimText('');
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  if (!isSupported) {
    return (
      <OverlayTrigger overlay={<Tooltip>{t('voiceRecorderButton.ditadoPorVozNaoESuportado')}</Tooltip>}>
        <span className="d-inline-block">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled style={{ pointerEvents: 'none' }}>
            <i className="bi bi-mic-mute"></i>
          </button>
        </span>
      </OverlayTrigger>
    );
  }

  return (
    <div className="d-inline-flex flex-column align-items-start">
      <button
        type="button"
        className={`btn btn-sm ${isRecording ? 'btn-danger' : 'btn-outline-secondary'}`}
        onClick={isRecording ? stopRecording : startRecording}
        title={isRecording ? 'Parar gravação' : label}
      >
        <i className={`bi ${isRecording ? 'bi-stop-fill' : 'bi-mic'} me-1`}></i>
        {isRecording ? 'Gravando... clique para parar' : label}
      </button>
      {isRecording && interimText && (
        <small className="text-muted fst-italic mt-1">{interimText}</small>
      )}
      {permissionError && (
        <small className="text-danger mt-1">
          {t('voiceRecorderButton.permissaoDeMicrofoneNegadaHabilite')}
        </small>
      )}
    </div>
  );
}
