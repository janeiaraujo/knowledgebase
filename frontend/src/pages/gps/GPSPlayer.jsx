import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gpsAPI } from '../../services/api';
import ReactMarkdown from 'react-markdown';

const GPSPlayer = () => {
    const { flowId, sessionId: existingSessionId } = useParams();
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [flow, setFlow] = useState(null);
    const [currentStep, setCurrentStep] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [response, setResponse] = useState('');
    const [evidence, setEvidence] = useState(null);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [rcaContent, setRcaContent] = useState(null);
    const [generatingRCA, setGeneratingRCA] = useState(false);

    useEffect(() => {
        if (existingSessionId) {
            loadSession(existingSessionId);
        } else {
            startNewSession();
        }
    }, [flowId, existingSessionId]);

    const startNewSession = async () => {
        try {
            setLoading(true);
            const res = await gpsAPI.startSession(flowId);
            setSession(res.data.session);
            setCurrentStep(res.data.current_step);
            setFlow(null); // Will be loaded with session
            setProgress({ current: 1, total: res.data.flow_steps_count });
        } catch (error) {
            console.error('Error starting session:', error);
            alert('Erro ao iniciar sessão. Verifique se o fluxo está ativo.');
            navigate('/gps');
        } finally {
            setLoading(false);
        }
    };

    const loadSession = async (id) => {
        try {
            setLoading(true);
            const res = await gpsAPI.getSession(id);
            setSession(res.data.session);
            setCurrentStep(res.data.current_step);
            setFlow(res.data.flow);
            setProgress(res.data.progress);
            
            // Check if session has RCA
            if (res.data.session.rca_generated) {
                setRcaContent(res.data.session.rca_generated.content);
            }
        } catch (error) {
            console.error('Error loading session:', error);
            alert('Erro ao carregar sessão');
            navigate('/gps');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!response && currentStep.required !== false) {
            alert('Por favor, preencha a resposta');
            return;
        }

        try {
            setSubmitting(true);
            const res = await gpsAPI.submitResponse(session._id, {
                step_id: currentStep.id,
                response,
                evidence: evidence
            });

            setSession(res.data.session);
            setCurrentStep(res.data.next_step);
            setProgress(res.data.progress);
            setResponse('');
            setEvidence(null);

            // If complete, check for RCA
            if (res.data.is_complete) {
                setCurrentStep(null);
            }
        } catch (error) {
            console.error('Error submitting response:', error);
            alert('Erro ao enviar resposta');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAbandon = async () => {
        if (!confirm('Deseja abandonar este diagnóstico? O progresso será perdido.')) return;
        
        try {
            await gpsAPI.abandonSession(session._id, 'User abandoned');
            navigate('/gps');
        } catch (error) {
            console.error('Error abandoning session:', error);
        }
    };

    const handleGenerateRCA = async () => {
        try {
            setGeneratingRCA(true);
            const res = await gpsAPI.generateRCA(session._id);
            setRcaContent(res.data.rca);
        } catch (error) {
            console.error('Error generating RCA:', error);
            alert('Erro ao gerar análise');
        } finally {
            setGeneratingRCA(false);
        }
    };

    const renderInput = () => {
        if (!currentStep) return null;

        const inputType = currentStep.input_type || 'text';

        switch (inputType) {
            case 'textarea':
                return (
                    <textarea
                        className="form-control"
                        rows="4"
                        placeholder="Digite sua resposta..."
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        disabled={submitting}
                        autoFocus
                    />
                );

            case 'select':
                return (
                    <div className="d-grid gap-2">
                        {(currentStep.options || []).map((opt, index) => (
                            <button
                                key={index}
                                type="button"
                                className={`btn btn-lg ${response === opt.value ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => setResponse(opt.value)}
                                disabled={submitting}
                            >
                                {opt.label || opt.value}
                            </button>
                        ))}
                    </div>
                );

            case 'yesno':
                return (
                    <div className="d-flex gap-3 justify-content-center">
                        <button
                            type="button"
                            className={`btn btn-lg px-5 ${response === 'yes' ? 'btn-success' : 'btn-outline-success'}`}
                            onClick={() => setResponse('yes')}
                            disabled={submitting}
                        >
                            <i className="bi bi-check-lg me-2"></i>
                            Sim
                        </button>
                        <button
                            type="button"
                            className={`btn btn-lg px-5 ${response === 'no' ? 'btn-danger' : 'btn-outline-danger'}`}
                            onClick={() => setResponse('no')}
                            disabled={submitting}
                        >
                            <i className="bi bi-x-lg me-2"></i>
                            Não
                        </button>
                    </div>
                );

            case 'checkbox':
                return (
                    <div>
                        {(currentStep.options || []).map((opt, index) => {
                            const selected = (response || '').split(',').includes(opt.value);
                            return (
                                <div key={index} className="form-check mb-2">
                                    <input
                                        type="checkbox"
                                        className="form-check-input"
                                        id={`opt_${index}`}
                                        checked={selected}
                                        onChange={(e) => {
                                            const values = (response || '').split(',').filter(v => v);
                                            if (e.target.checked) {
                                                values.push(opt.value);
                                            } else {
                                                const idx = values.indexOf(opt.value);
                                                if (idx > -1) values.splice(idx, 1);
                                            }
                                            setResponse(values.join(','));
                                        }}
                                        disabled={submitting}
                                    />
                                    <label className="form-check-label" htmlFor={`opt_${index}`}>
                                        {opt.label || opt.value}
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                );

            case 'number':
                return (
                    <input
                        type="number"
                        className="form-control form-control-lg"
                        placeholder="Digite um número..."
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        disabled={submitting}
                        autoFocus
                    />
                );

            case 'image':
            case 'file':
                return (
                    <div>
                        <input
                            type="text"
                            className="form-control mb-2"
                            placeholder="Descrição ou URL do arquivo..."
                            value={response}
                            onChange={(e) => setResponse(e.target.value)}
                            disabled={submitting}
                        />
                        <div className="alert alert-info small">
                            <i className="bi bi-info-circle me-2"></i>
                            Cole o texto, URL ou descreva o arquivo/imagem que deseja anexar como evidência.
                        </div>
                    </div>
                );

            default: // text
                return (
                    <input
                        type="text"
                        className="form-control form-control-lg"
                        placeholder="Digite sua resposta..."
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        disabled={submitting}
                        autoFocus
                    />
                );
        }
    };

    if (loading) {
        return (
            <div className="container py-5 text-center">
                <div className="spinner-border text-primary mb-3" />
                <p className="text-muted">Carregando diagnóstico...</p>
            </div>
        );
    }

    // Session completed
    if (session?.status === 'completed') {
        return (
            <div className="container py-4" style={{ maxWidth: '800px' }}>
                <div className="card shadow">
                    <div className="card-body text-center py-5">
                        <div className="mb-4">
                            <i className="bi bi-check-circle-fill text-success display-1"></i>
                        </div>
                        <h2 className="mb-3">Diagnóstico Concluído!</h2>
                        <p className="text-muted mb-4">
                            Você completou todas as etapas do diagnóstico "{session.flow_name}".
                        </p>
                        
                        {/* RCA Section */}
                        {!rcaContent ? (
                            <div className="mb-4">
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={handleGenerateRCA}
                                    disabled={generatingRCA}
                                >
                                    {generatingRCA ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" />
                                            Gerando análise...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-magic me-2"></i>
                                            Gerar Análise / RCA
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="text-start mb-4">
                                <div className="card bg-light">
                                    <div className="card-header">
                                        <h5 className="mb-0">
                                            <i className="bi bi-file-earmark-text me-2"></i>
                                            Análise do Diagnóstico
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        <ReactMarkdown>{rcaContent}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Summary of responses */}
                        <div className="text-start mb-4">
                            <h5 className="mb-3">Resumo das Respostas</h5>
                            <div className="list-group">
                                {session.responses.map((resp, index) => (
                                    <div key={index} className="list-group-item">
                                        <div className="d-flex justify-content-between">
                                            <strong>{resp.step_title}</strong>
                                            <small className="text-muted">
                                                {new Date(resp.timestamp).toLocaleTimeString('pt-BR')}
                                            </small>
                                        </div>
                                        <p className="mb-0 text-muted">{resp.response}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="d-flex gap-3 justify-content-center">
                            <button
                                className="btn btn-outline-primary"
                                onClick={() => navigate('/gps')}
                            >
                                <i className="bi bi-arrow-left me-2"></i>
                                Voltar aos Fluxos
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate(`/gps/play/${flowId}`)}
                            >
                                <i className="bi bi-arrow-repeat me-2"></i>
                                Novo Diagnóstico
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-4" style={{ maxWidth: '800px' }}>
            {/* Progress */}
            <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <small className="text-muted">
                        {session?.flow_name}
                    </small>
                    <small className="text-muted">
                        Etapa {progress.current} de {progress.total}
                    </small>
                </div>
                <div className="progress" style={{ height: '8px' }}>
                    <div 
                        className="progress-bar" 
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                </div>
            </div>

            {/* Current Step */}
            {currentStep && (
                <div className="card shadow">
                    <div className="card-body p-4">
                        {/* Step header */}
                        <div className="text-center mb-4">
                            <span className="badge bg-primary rounded-pill px-3 py-2 mb-3">
                                Etapa {progress.current}
                            </span>
                            <h3 className="mb-2">{currentStep.title}</h3>
                            {currentStep.description && (
                                <p className="text-muted">{currentStep.description}</p>
                            )}
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                {renderInput()}
                            </div>

                            {/* Evidence option for non-evidence steps */}
                            {currentStep.type !== 'evidence' && (
                                <div className="mb-4">
                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            id="addEvidence"
                                            checked={evidence !== null}
                                            onChange={(e) => setEvidence(e.target.checked ? '' : null)}
                                        />
                                        <label className="form-check-label text-muted" htmlFor="addEvidence">
                                            Adicionar evidência/observação
                                        </label>
                                    </div>
                                    {evidence !== null && (
                                        <textarea
                                            className="form-control mt-2"
                                            rows="2"
                                            placeholder="Cole aqui logs, prints, ou observações..."
                                            value={evidence}
                                            onChange={(e) => setEvidence(e.target.value)}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="d-flex justify-content-between">
                                <button
                                    type="button"
                                    className="btn btn-outline-danger"
                                    onClick={handleAbandon}
                                >
                                    <i className="bi bi-x-lg me-2"></i>
                                    Abandonar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg"
                                    disabled={submitting || (!response && currentStep.required !== false)}
                                >
                                    {submitting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            Próximo
                                            <i className="bi bi-arrow-right ms-2"></i>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Responses so far */}
            {session?.responses?.length > 0 && (
                <div className="mt-4">
                    <button
                        className="btn btn-link text-muted text-decoration-none w-100"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#responseHistory"
                    >
                        <i className="bi bi-clock-history me-2"></i>
                        Ver respostas anteriores ({session.responses.length})
                    </button>
                    <div className="collapse" id="responseHistory">
                        <div className="list-group list-group-flush mt-2">
                            {session.responses.map((resp, index) => (
                                <div key={index} className="list-group-item bg-light">
                                    <small className="text-muted d-block">{resp.step_title}</small>
                                    <span>{resp.response}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GPSPlayer;
