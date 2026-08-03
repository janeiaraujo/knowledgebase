import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { incidentAPI } from '../../services/api';
import { TagSelector, CategorySelector } from '../../components/tags/TagSelector';
import VoiceRecorderButton from '../../components/VoiceRecorderButton';
import ImageAttachments from '../../components/ImageAttachments';

const QuickCapture = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [recentCaptures, setRecentCaptures] = useState([]);
    const [loadingRecent, setLoadingRecent] = useState(true);
    const [attachmentsKey, setAttachmentsKey] = useState(0);
    const [images, setImages] = useState([]);
    const [linkedIncidentTitle, setLinkedIncidentTitle] = useState(null);

    const [formData, setFormData] = useState({
        problem: '',
        solution: '',
        logs: '',
        severity: 'medium',
        affected_services: '',
        category_id: '',
        tags: [],
        incident_id: null
    });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadRecentCaptures();
    }, []);

    // Chegando a partir de "Criar KB a partir deste incidente" (ver
    // IncidentView) - pre-preenche o problema/severidade/serviços.
    useEffect(() => {
        const prefill = location.state?.prefill;
        if (!prefill) return;

        setFormData(prev => ({
            ...prev,
            problem: prefill.problem || prev.problem,
            severity: prefill.severity || prev.severity,
            affected_services: prefill.affected_services || prev.affected_services,
            incident_id: prefill.incident_id || null
        }));
        setLinkedIncidentTitle(prefill.incident_id ? 'Este KB será vinculado ao incidente de origem.' : null);

        navigate(location.pathname, { replace: true, state: {} });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    const loadRecentCaptures = async () => {
        try {
            const capturesRes = await incidentAPI.listQuickCaptures({ limit: 5 });
            setRecentCaptures(capturesRes.data.records || []);
        } catch (err) {
            console.error('Error loading recent captures:', err);
        } finally {
            setLoadingRecent(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await incidentAPI.quickCapture({
                ...formData,
                images: images.map(({ url, filename, description }) => ({ url, filename, description }))
            });
            setResult(res.data);

            // Reset form
            setFormData({
                problem: '',
                solution: '',
                logs: '',
                severity: 'medium',
                affected_services: '',
                category_id: '',
                tags: [],
                incident_id: null
            });
            setLinkedIncidentTitle(null);
            setImages([]);
            setAttachmentsKey(prev => prev + 1); // forca remount do ImageAttachments (limpa estado interno)

            // Reload recent captures
            const capturesRes = await incidentAPI.listQuickCaptures({ limit: 5 });
            setRecentCaptures(capturesRes.data.records || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao gerar KB');
        } finally {
            setLoading(false);
        }
    };

    const appendTranscript = (field) => (text) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field] ? `${prev[field]} ${text}`.trim() : text.trim()
        }));
    };

    const severityConfig = {
        low: { label: 'Baixa', color: 'success', icon: 'bi-info-circle' },
        medium: { label: 'Média', color: 'warning', icon: 'bi-exclamation-triangle' },
        high: { label: 'Alta', color: 'danger', icon: 'bi-exclamation-octagon' },
        critical: { label: 'Crítica', color: 'dark', icon: 'bi-x-octagon' }
    };

    return (
        <div className="container-fluid py-4">
            <div className="row">
                {/* Main Form */}
                <div className="col-lg-8">
                    <div className="card shadow-sm">
                        <div className="card-header bg-primary text-white">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-lightning-charge-fill me-2 fs-4"></i>
                                <div>
                                    <h5 className="mb-0">Captura Rápida</h5>
                                    <small className="opacity-75">
                                        Texto, voz, logs e imagens - a IA aproveita tudo para gerar o artigo KB
                                    </small>
                                </div>
                            </div>
                        </div>
                        
                        <div className="card-body">
                            {linkedIncidentTitle && (
                                <div className="alert alert-info d-flex align-items-center mb-4">
                                    <i className="bi bi-link-45deg me-2"></i>
                                    <div className="flex-grow-1 small">{linkedIncidentTitle}</div>
                                </div>
                            )}
                            {/* Success Result */}
                            {result && (
                                <div className="alert alert-success d-flex align-items-start mb-4">
                                    <i className="bi bi-check-circle-fill me-3 fs-4"></i>
                                    <div className="flex-grow-1">
                                        <h6 className="alert-heading mb-1">
                                            {result.ai_generated ? '✨ KB gerado com IA!' : 'KB criado com sucesso!'}
                                        </h6>
                                        <p className="mb-2">{result.message}</p>
                                        <div className="d-flex gap-2">
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => navigate(`/kb/${result.record._id}/edit`)}
                                            >
                                                <i className="bi bi-pencil me-1"></i>
                                                Editar KB
                                            </button>
                                            <button
                                                className="btn btn-outline-success btn-sm"
                                                onClick={() => navigate(`/kb/${result.record._id}`)}
                                            >
                                                <i className="bi bi-eye me-1"></i>
                                                Visualizar
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setResult(null)}
                                    />
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className="alert alert-danger d-flex align-items-center mb-4">
                                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                    <div className="flex-grow-1">{error}</div>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setError(null)}
                                    />
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                {/* Problem */}
                                <div className="mb-4">
                                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                        <label className="form-label fw-semibold mb-0">
                                            <i className="bi bi-bug text-danger me-2"></i>
                                            Qual era o problema?
                                        </label>
                                        <VoiceRecorderButton
                                            label="Ditar problema"
                                            onTranscript={appendTranscript('problem')}
                                        />
                                    </div>
                                    <textarea
                                        className="form-control mt-2"
                                        rows="4"
                                        placeholder="Descreva o problema encontrado, cole logs/mensagens de erro, ou use o microfone. Ex: Usuário não conseguia acessar o sistema, recebia erro 403..."
                                        value={formData.problem}
                                        onChange={(e) => setFormData(prev => ({ ...prev, problem: e.target.value }))}
                                        required
                                    />
                                    <div className="form-text">
                                        Inclua mensagens de erro, sintomas observados, contexto do problema.
                                    </div>
                                </div>

                                {/* Solution */}
                                <div className="mb-4">
                                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                        <label className="form-label fw-semibold mb-0">
                                            <i className="bi bi-check-circle text-success me-2"></i>
                                            Qual foi a solução?
                                        </label>
                                        <VoiceRecorderButton
                                            label="Ditar solução"
                                            onTranscript={appendTranscript('solution')}
                                        />
                                    </div>
                                    <textarea
                                        className="form-control mt-2"
                                        rows="4"
                                        placeholder="Descreva os passos da solução, ou use o microfone. Ex: 1. Verificar permissões do usuário no AD. 2. Adicionar ao grupo X..."
                                        value={formData.solution}
                                        onChange={(e) => setFormData(prev => ({ ...prev, solution: e.target.value }))}
                                        required
                                    />
                                    <div className="form-text">
                                        Detalhe os passos realizados para resolver o problema.
                                    </div>
                                </div>

                                {/* Logs */}
                                <div className="mb-4">
                                    <label className="form-label fw-semibold">
                                        <i className="bi bi-terminal text-secondary me-2"></i>
                                        Logs / mensagens de erro
                                    </label>
                                    <textarea
                                        className="form-control font-monospace"
                                        style={{ fontSize: '0.85rem' }}
                                        rows="5"
                                        placeholder="Cole aqui trechos de log, stack trace ou a saída de erro (Ctrl+V)..."
                                        value={formData.logs}
                                        onChange={(e) => setFormData(prev => ({ ...prev, logs: e.target.value }))}
                                    />
                                    <div className="form-text">
                                        Opcional. Trechos relevantes do log ajudam a IA a identificar sintomas e causa raiz com mais precisão.
                                    </div>
                                </div>

                                {/* Images */}
                                <div className="mb-4">
                                    <label className="form-label fw-semibold">
                                        <i className="bi bi-camera text-primary me-2"></i>
                                        Capturas de tela do erro
                                    </label>
                                    <ImageAttachments
                                        key={attachmentsKey}
                                        context={formData.problem}
                                        onChange={setImages}
                                    />
                                    <div className="form-text">
                                        Opcional. Cada imagem é descrita automaticamente pela IA (quando configurada) e entra como evidência no KB gerado.
                                    </div>
                                </div>

                                <div className="row">
                                    {/* Severity */}
                                    <div className="col-md-6 mb-4">
                                        <label className="form-label fw-semibold">
                                            <i className="bi bi-speedometer2 me-2"></i>
                                            Severidade
                                        </label>
                                        <div className="d-flex flex-wrap gap-2">
                                            {Object.entries(severityConfig).map(([value, config]) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    className={`btn btn-sm ${formData.severity === value 
                                                        ? `btn-${config.color}` 
                                                        : `btn-outline-${config.color}`}`}
                                                    onClick={() => setFormData(prev => ({ ...prev, severity: value }))}
                                                >
                                                    <i className={`bi ${config.icon} me-1`}></i>
                                                    {config.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Category */}
                                    <div className="col-md-6 mb-4">
                                        <label className="form-label fw-semibold">
                                            <i className="bi bi-folder me-2"></i>
                                            Categoria
                                        </label>
                                        <CategorySelector
                                            selectedCategory={formData.category_id}
                                            onChange={(category_id) => setFormData(prev => ({ ...prev, category_id: category_id || '' }))}
                                        />
                                    </div>
                                </div>

                                {/* Affected Services */}
                                <div className="mb-4">
                                    <label className="form-label fw-semibold">
                                        <i className="bi bi-hdd-network me-2"></i>
                                        Serviços Afetados
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Ex: Active Directory, VPN, Office 365, SAP..."
                                        value={formData.affected_services}
                                        onChange={(e) => setFormData(prev => ({ ...prev, affected_services: e.target.value }))}
                                    />
                                </div>

                                {/* Tags */}
                                <div className="mb-4">
                                    <label className="form-label fw-semibold">
                                        <i className="bi bi-tags me-2"></i>
                                        Tags
                                    </label>
                                    <TagSelector
                                        selectedTags={formData.tags}
                                        onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                                    />
                                </div>

                                {/* Submit */}
                                <div className="d-grid gap-2">
                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-lg"
                                        disabled={loading || !formData.problem || !formData.solution}
                                    >
                                        {loading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" />
                                                Gerando KB com IA...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-magic me-2"></i>
                                                Gerar KB
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="col-lg-4">
                    {/* How it works */}
                    <div className="card shadow-sm mb-4">
                        <div className="card-header">
                            <h6 className="mb-0">
                                <i className="bi bi-question-circle me-2"></i>
                                Como funciona?
                            </h6>
                        </div>
                        <div className="card-body">
                            <div className="d-flex mb-3">
                                <div className="flex-shrink-0">
                                    <span className="badge bg-primary rounded-circle p-2">1</span>
                                </div>
                                <div className="ms-3">
                                    <strong>Problema e solução</strong>
                                    <p className="mb-0 text-muted small">
                                        Digite, dite por voz (<i className="bi bi-mic"></i>), ou cole logs e prints do erro.
                                    </p>
                                </div>
                            </div>
                            <div className="d-flex mb-3">
                                <div className="flex-shrink-0">
                                    <span className="badge bg-primary rounded-circle p-2">2</span>
                                </div>
                                <div className="ms-3">
                                    <strong>Evidências</strong>
                                    <p className="mb-0 text-muted small">
                                        Cada captura de tela ganha uma descrição automática da IA.
                                    </p>
                                </div>
                            </div>
                            <div className="d-flex">
                                <div className="flex-shrink-0">
                                    <span className="badge bg-success rounded-circle p-2">3</span>
                                </div>
                                <div className="ms-3">
                                    <strong>IA gera o artigo</strong>
                                    <p className="mb-0 text-muted small">
                                        Um KB completo em modo rascunho para revisão, com logs e imagens já anexados.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Captures */}
                    <div className="card shadow-sm">
                        <div className="card-header d-flex justify-content-between align-items-center">
                            <h6 className="mb-0">
                                <i className="bi bi-clock-history me-2"></i>
                                Capturas Recentes
                            </h6>
                            <button
                                className="btn btn-link btn-sm p-0"
                                onClick={() => navigate('/kb?source=quick_capture')}
                            >
                                Ver todas
                            </button>
                        </div>
                        <div className="card-body p-0">
                            {loadingRecent ? (
                                <div className="text-center py-4">
                                    <div className="spinner-border spinner-border-sm text-primary" />
                                </div>
                            ) : recentCaptures.length === 0 ? (
                                <div className="text-center py-4 text-muted">
                                    <i className="bi bi-inbox fs-3 d-block mb-2"></i>
                                    Nenhuma captura ainda
                                </div>
                            ) : (
                                <ul className="list-group list-group-flush">
                                    {recentCaptures.map(capture => (
                                        <li key={capture._id} className="list-group-item">
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div className="me-2" style={{ minWidth: 0 }}>
                                                    <a 
                                                        href={`/kb/${capture._id}`}
                                                        className="text-decoration-none fw-medium text-truncate d-block"
                                                        style={{ maxWidth: '200px' }}
                                                    >
                                                        {capture.title}
                                                    </a>
                                                    <small className="text-muted">
                                                        {new Date(capture.created_at).toLocaleDateString('pt-BR')}
                                                    </small>
                                                </div>
                                                <span className={`badge bg-${
                                                    capture.status === 'published' ? 'success' :
                                                    capture.status === 'review' ? 'warning' : 'secondary'
                                                }`}>
                                                    {capture.status === 'published' ? 'Publicado' :
                                                     capture.status === 'review' ? 'Em Revisão' : 'Rascunho'}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickCapture;
