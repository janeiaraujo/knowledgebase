import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { incidentAPI, kbAPI, tagsAPI, categoriesAPI } from '../../services/api';

const QuickCapture = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [recentCaptures, setRecentCaptures] = useState([]);
    const [loadingRecent, setLoadingRecent] = useState(true);
    
    const [formData, setFormData] = useState({
        problem: '',
        solution: '',
        severity: 'medium',
        affected_services: '',
        category_id: '',
        tags: []
    });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [catRes, tagRes, capturesRes] = await Promise.all([
                categoriesAPI.list({ limit: 100 }),
                tagsAPI.list({ limit: 100 }),
                incidentAPI.listQuickCaptures({ limit: 5 })
            ]);
            setCategories(catRes.data.categories || []);
            setTags(tagRes.data.tags || []);
            setRecentCaptures(capturesRes.data.records || []);
        } catch (err) {
            console.error('Error loading data:', err);
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
            const res = await incidentAPI.quickCapture(formData);
            setResult(res.data);
            
            // Reset form
            setFormData({
                problem: '',
                solution: '',
                severity: 'medium',
                affected_services: '',
                category_id: '',
                tags: []
            });
            
            // Reload recent captures
            const capturesRes = await incidentAPI.listQuickCaptures({ limit: 5 });
            setRecentCaptures(capturesRes.data.records || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao gerar KB');
        } finally {
            setLoading(false);
        }
    };

    const handleTagToggle = (tagId) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.includes(tagId)
                ? prev.tags.filter(t => t !== tagId)
                : [...prev.tags, tagId]
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
                                        Descreva o problema e a solução - a IA gera o artigo KB
                                    </small>
                                </div>
                            </div>
                        </div>
                        
                        <div className="card-body">
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
                                    <label className="form-label fw-semibold">
                                        <i className="bi bi-bug text-danger me-2"></i>
                                        Qual era o problema?
                                    </label>
                                    <textarea
                                        className="form-control"
                                        rows="4"
                                        placeholder="Descreva o problema encontrado. Ex: Usuário não conseguia acessar o sistema, recebia erro 403..."
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
                                    <label className="form-label fw-semibold">
                                        <i className="bi bi-check-circle text-success me-2"></i>
                                        Qual foi a solução?
                                    </label>
                                    <textarea
                                        className="form-control"
                                        rows="4"
                                        placeholder="Descreva os passos da solução. Ex: 1. Verificar permissões do usuário no AD. 2. Adicionar ao grupo X..."
                                        value={formData.solution}
                                        onChange={(e) => setFormData(prev => ({ ...prev, solution: e.target.value }))}
                                        required
                                    />
                                    <div className="form-text">
                                        Detalhe os passos realizados para resolver o problema.
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
                                        <select
                                            className="form-select"
                                            value={formData.category_id}
                                            onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                                        >
                                            <option value="">Selecione uma categoria...</option>
                                            {categories.map(cat => (
                                                <option key={cat._id} value={cat._id}>
                                                    {cat.icon && <span>{cat.icon} </span>}
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </select>
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
                                {tags.length > 0 && (
                                    <div className="mb-4">
                                        <label className="form-label fw-semibold">
                                            <i className="bi bi-tags me-2"></i>
                                            Tags
                                        </label>
                                        <div className="d-flex flex-wrap gap-2">
                                            {tags.map(tag => (
                                                <button
                                                    key={tag._id}
                                                    type="button"
                                                    className={`btn btn-sm ${formData.tags.includes(tag._id) 
                                                        ? 'btn-primary' 
                                                        : 'btn-outline-secondary'}`}
                                                    onClick={() => handleTagToggle(tag._id)}
                                                    style={formData.tags.includes(tag._id) && tag.color ? {
                                                        backgroundColor: tag.color,
                                                        borderColor: tag.color
                                                    } : {}}
                                                >
                                                    {tag.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

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
                                    <strong>Descreva o problema</strong>
                                    <p className="mb-0 text-muted small">
                                        O que aconteceu? Qual erro apareceu?
                                    </p>
                                </div>
                            </div>
                            <div className="d-flex mb-3">
                                <div className="flex-shrink-0">
                                    <span className="badge bg-primary rounded-circle p-2">2</span>
                                </div>
                                <div className="ms-3">
                                    <strong>Descreva a solução</strong>
                                    <p className="mb-0 text-muted small">
                                        O que você fez para resolver?
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
                                        Um KB completo em modo rascunho para revisão.
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
