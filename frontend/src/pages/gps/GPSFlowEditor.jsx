import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gpsAPI } from '../../services/api';

const GPSFlowEditor = () => {
    const { flowId } = useParams();
    const navigate = useNavigate();
    const [flow, setFlow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [selectedStep, setSelectedStep] = useState(null);
    const [showStepModal, setShowStepModal] = useState(false);

    const stepTypes = {
        question: { label: 'Pergunta', icon: 'bi-question-circle', color: 'primary' },
        action: { label: 'Ação', icon: 'bi-lightning', color: 'warning' },
        evidence: { label: 'Evidência', icon: 'bi-camera', color: 'info' },
        condition: { label: 'Condição', icon: 'bi-signpost-split', color: 'secondary' },
        end: { label: 'Fim', icon: 'bi-flag', color: 'success' }
    };

    const inputTypes = [
        { value: 'text', label: 'Texto curto' },
        { value: 'textarea', label: 'Texto longo' },
        { value: 'select', label: 'Seleção única' },
        { value: 'checkbox', label: 'Múltipla escolha' },
        { value: 'yesno', label: 'Sim/Não' },
        { value: 'number', label: 'Número' },
        { value: 'file', label: 'Arquivo' },
        { value: 'image', label: 'Imagem/Screenshot' }
    ];

    useEffect(() => {
        loadFlow();
    }, [flowId]);

    const loadFlow = async () => {
        try {
            setLoading(true);
            const res = await gpsAPI.getFlow(flowId);
            setFlow(res.data.flow);
        } catch (error) {
            console.error('Error loading flow:', error);
            alert('Erro ao carregar fluxo');
            navigate('/gps');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await gpsAPI.updateFlow(flowId, flow);
            setHasChanges(false);
            alert('Fluxo salvo com sucesso!');
        } catch (error) {
            console.error('Error saving flow:', error);
            alert('Erro ao salvar fluxo');
        } finally {
            setSaving(false);
        }
    };

    const updateFlow = useCallback((updates) => {
        setFlow(prev => ({ ...prev, ...updates }));
        setHasChanges(true);
    }, []);

    const generateStepId = () => {
        return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    const addStep = (type = 'question') => {
        const newStep = {
            id: generateStepId(),
            type,
            title: '',
            description: '',
            input_type: type === 'question' ? 'text' : undefined,
            required: true,
            options: type === 'question' ? [] : undefined,
            next_step: 'end'
        };
        
        setSelectedStep(newStep);
        setShowStepModal(true);
    };

    const editStep = (step) => {
        setSelectedStep({ ...step });
        setShowStepModal(true);
    };

    const saveStep = () => {
        if (!selectedStep.title) {
            alert('Título é obrigatório');
            return;
        }

        const steps = [...(flow.steps || [])];
        const existingIndex = steps.findIndex(s => s.id === selectedStep.id);
        
        if (existingIndex >= 0) {
            steps[existingIndex] = selectedStep;
        } else {
            // Insert before 'end' step
            const endIndex = steps.findIndex(s => s.type === 'end');
            if (endIndex >= 0) {
                steps.splice(endIndex, 0, selectedStep);
            } else {
                steps.push(selectedStep);
            }
        }

        updateFlow({ steps });
        setShowStepModal(false);
        setSelectedStep(null);
    };

    const deleteStep = (stepId) => {
        if (stepId === 'start' || stepId === 'end') {
            alert('Não é possível remover etapas de início/fim');
            return;
        }
        
        if (!confirm('Deseja remover esta etapa?')) return;
        
        const steps = flow.steps.filter(s => s.id !== stepId);
        
        // Update references to deleted step
        steps.forEach(step => {
            if (step.next_step === stepId) {
                step.next_step = 'end';
            }
            if (step.options) {
                step.options.forEach(opt => {
                    if (opt.next_step === stepId) {
                        opt.next_step = 'end';
                    }
                });
            }
        });
        
        updateFlow({ steps });
    };

    const moveStep = (stepId, direction) => {
        const steps = [...flow.steps];
        const currentIndex = steps.findIndex(s => s.id === stepId);
        
        if (
            (direction === -1 && currentIndex <= 1) || // Can't move before start
            (direction === 1 && currentIndex >= steps.length - 2) // Can't move after end
        ) {
            return;
        }

        const newIndex = currentIndex + direction;
        [steps[currentIndex], steps[newIndex]] = [steps[newIndex], steps[currentIndex]];
        updateFlow({ steps });
    };

    const addOption = () => {
        const options = [...(selectedStep.options || [])];
        options.push({
            value: `option_${options.length + 1}`,
            label: '',
            next_step: 'end'
        });
        setSelectedStep(prev => ({ ...prev, options }));
    };

    const updateOption = (index, field, value) => {
        const options = [...selectedStep.options];
        options[index] = { ...options[index], [field]: value };
        setSelectedStep(prev => ({ ...prev, options }));
    };

    const removeOption = (index) => {
        const options = selectedStep.options.filter((_, i) => i !== index);
        setSelectedStep(prev => ({ ...prev, options }));
    };

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center">
                <div className="spinner-border text-primary" />
            </div>
        );
    }

    if (!flow) {
        return (
            <div className="container-fluid py-5 text-center">
                <h5>Fluxo não encontrado</h5>
                <button className="btn btn-primary" onClick={() => navigate('/gps')}>
                    Voltar
                </button>
            </div>
        );
    }

    const categoryLabels = {
        general: 'Geral', network: 'Rede', hardware: 'Hardware', software: 'Software',
        access: 'Acesso', email: 'E-mail', database: 'Banco de Dados', security: 'Segurança'
    };

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-start mb-4">
                <div>
                    <button 
                        className="btn btn-link text-decoration-none p-0 mb-2"
                        onClick={() => navigate('/gps')}
                    >
                        <i className="bi bi-arrow-left me-2"></i>
                        Voltar aos Fluxos
                    </button>
                    <h2 className="mb-1">
                        <i className="bi bi-pencil-square me-2 text-primary"></i>
                        Editar Fluxo GPS
                    </h2>
                </div>
                <div className="d-flex gap-2">
                    {hasChanges && (
                        <span className="badge bg-warning text-dark align-self-center">
                            Alterações não salvas
                        </span>
                    )}
                    <button 
                        className="btn btn-success"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg me-2"></i>
                                Salvar
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="row">
                {/* Flow Properties */}
                <div className="col-lg-4">
                    <div className="card shadow-sm mb-4">
                        <div className="card-header">
                            <h6 className="mb-0">
                                <i className="bi bi-gear me-2"></i>
                                Propriedades do Fluxo
                            </h6>
                        </div>
                        <div className="card-body">
                            <div className="mb-3">
                                <label className="form-label">Nome *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={flow.name || ''}
                                    onChange={(e) => updateFlow({ name: e.target.value })}
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Descrição</label>
                                <textarea
                                    className="form-control"
                                    rows="2"
                                    value={flow.description || ''}
                                    onChange={(e) => updateFlow({ description: e.target.value })}
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Categoria</label>
                                <select
                                    className="form-select"
                                    value={flow.category || 'general'}
                                    onChange={(e) => updateFlow({ category: e.target.value })}
                                >
                                    {Object.entries(categoryLabels).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-check form-switch">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="isActive"
                                    checked={flow.is_active || false}
                                    onChange={(e) => updateFlow({ is_active: e.target.checked })}
                                />
                                <label className="form-check-label" htmlFor="isActive">
                                    Fluxo Ativo
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Add Step Buttons */}
                    <div className="card shadow-sm">
                        <div className="card-header">
                            <h6 className="mb-0">
                                <i className="bi bi-plus-circle me-2"></i>
                                Adicionar Etapa
                            </h6>
                        </div>
                        <div className="card-body">
                            <div className="d-grid gap-2">
                                {Object.entries(stepTypes).filter(([key]) => key !== 'end').map(([type, config]) => (
                                    <button
                                        key={type}
                                        className={`btn btn-outline-${config.color}`}
                                        onClick={() => addStep(type)}
                                    >
                                        <i className={`bi ${config.icon} me-2`}></i>
                                        {config.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Steps List */}
                <div className="col-lg-8">
                    <div className="card shadow-sm">
                        <div className="card-header d-flex justify-content-between align-items-center">
                            <h6 className="mb-0">
                                <i className="bi bi-diagram-3 me-2"></i>
                                Etapas do Fluxo ({flow.steps?.length || 0})
                            </h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="list-group list-group-flush">
                                {(flow.steps || []).map((step, index) => (
                                    <div 
                                        key={step.id}
                                        className="list-group-item"
                                    >
                                        <div className="d-flex align-items-center">
                                            {/* Order buttons */}
                                            <div className="d-flex flex-column me-3">
                                                <button
                                                    className="btn btn-link btn-sm p-0 text-muted"
                                                    onClick={() => moveStep(step.id, -1)}
                                                    disabled={index <= 1 || step.id === 'start'}
                                                >
                                                    <i className="bi bi-chevron-up"></i>
                                                </button>
                                                <button
                                                    className="btn btn-link btn-sm p-0 text-muted"
                                                    onClick={() => moveStep(step.id, 1)}
                                                    disabled={index >= (flow.steps.length - 2) || step.type === 'end'}
                                                >
                                                    <i className="bi bi-chevron-down"></i>
                                                </button>
                                            </div>

                                            {/* Step number */}
                                            <div className="flex-shrink-0 me-3">
                                                <span className={`badge rounded-pill bg-${stepTypes[step.type]?.color || 'secondary'}`} style={{ width: '32px' }}>
                                                    {index + 1}
                                                </span>
                                            </div>

                                            {/* Step icon */}
                                            <div className={`rounded-circle p-2 me-3 bg-${stepTypes[step.type]?.color || 'secondary'} bg-opacity-10`}>
                                                <i className={`bi ${stepTypes[step.type]?.icon || 'bi-circle'} text-${stepTypes[step.type]?.color || 'secondary'}`}></i>
                                            </div>

                                            {/* Step info */}
                                            <div className="flex-grow-1 me-3">
                                                <div className="fw-semibold">
                                                    {step.title || '(Sem título)'}
                                                </div>
                                                <small className="text-muted">
                                                    {stepTypes[step.type]?.label}
                                                    {step.input_type && ` • ${inputTypes.find(t => t.value === step.input_type)?.label || step.input_type}`}
                                                    {step.required && ' • Obrigatório'}
                                                </small>
                                                {step.next_step && step.type !== 'end' && (
                                                    <div>
                                                        <small className="text-muted">
                                                            <i className="bi bi-arrow-right me-1"></i>
                                                            Próximo: {flow.steps.find(s => s.id === step.next_step)?.title || step.next_step}
                                                        </small>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="d-flex gap-1">
                                                <button
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={() => editStep(step)}
                                                    title="Editar"
                                                >
                                                    <i className="bi bi-pencil"></i>
                                                </button>
                                                {step.id !== 'start' && step.type !== 'end' && (
                                                    <button
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => deleteStep(step.id)}
                                                        title="Remover"
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step Edit Modal */}
            {showStepModal && selectedStep && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    <i className={`bi ${stepTypes[selectedStep.type]?.icon} me-2`}></i>
                                    {selectedStep.id === 'start' || flow.steps.some(s => s.id === selectedStep.id) 
                                        ? 'Editar Etapa' 
                                        : 'Nova Etapa'
                                    }
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close"
                                    onClick={() => { setShowStepModal(false); setSelectedStep(null); }}
                                />
                            </div>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label">Título *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Ex: Qual é o problema?"
                                            value={selectedStep.title || ''}
                                            onChange={(e) => setSelectedStep(prev => ({ ...prev, title: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label">Tipo</label>
                                        <select
                                            className="form-select"
                                            value={selectedStep.type || 'question'}
                                            onChange={(e) => setSelectedStep(prev => ({ 
                                                ...prev, 
                                                type: e.target.value,
                                                input_type: e.target.value === 'question' ? (prev.input_type || 'text') : undefined
                                            }))}
                                            disabled={selectedStep.id === 'start' || selectedStep.id === 'end'}
                                        >
                                            {Object.entries(stepTypes).map(([value, config]) => (
                                                <option key={value} value={value}>{config.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">Descrição/Instrução</label>
                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        placeholder="Instruções ou explicação para o operador..."
                                        value={selectedStep.description || ''}
                                        onChange={(e) => setSelectedStep(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>

                                {selectedStep.type === 'question' && (
                                    <>
                                        <div className="row">
                                            <div className="col-md-6 mb-3">
                                                <label className="form-label">Tipo de Entrada</label>
                                                <select
                                                    className="form-select"
                                                    value={selectedStep.input_type || 'text'}
                                                    onChange={(e) => setSelectedStep(prev => ({ 
                                                        ...prev, 
                                                        input_type: e.target.value,
                                                        options: ['select', 'checkbox', 'yesno'].includes(e.target.value) 
                                                            ? (prev.options?.length ? prev.options : [])
                                                            : undefined
                                                    }))}
                                                >
                                                    {inputTypes.map(type => (
                                                        <option key={type.value} value={type.value}>{type.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-6 mb-3 d-flex align-items-end">
                                                <div className="form-check">
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input"
                                                        id="stepRequired"
                                                        checked={selectedStep.required !== false}
                                                        onChange={(e) => setSelectedStep(prev => ({ ...prev, required: e.target.checked }))}
                                                    />
                                                    <label className="form-check-label" htmlFor="stepRequired">
                                                        Campo obrigatório
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Options for select/checkbox/yesno */}
                                        {['select', 'checkbox', 'yesno'].includes(selectedStep.input_type) && (
                                            <div className="mb-3">
                                                <label className="form-label d-flex justify-content-between">
                                                    <span>Opções</span>
                                                    {selectedStep.input_type !== 'yesno' && (
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-link btn-sm p-0"
                                                            onClick={addOption}
                                                        >
                                                            <i className="bi bi-plus-lg me-1"></i>
                                                            Adicionar opção
                                                        </button>
                                                    )}
                                                </label>
                                                
                                                {selectedStep.input_type === 'yesno' ? (
                                                    <div className="alert alert-info small mb-0">
                                                        <i className="bi bi-info-circle me-2"></i>
                                                        Tipo Sim/Não gera automaticamente as opções. Configure o próximo passo para cada resposta.
                                                    </div>
                                                ) : (
                                                    <div className="border rounded p-2">
                                                        {(selectedStep.options || []).map((opt, index) => (
                                                            <div key={index} className="d-flex gap-2 mb-2">
                                                                <input
                                                                    type="text"
                                                                    className="form-control form-control-sm"
                                                                    placeholder="Rótulo da opção"
                                                                    value={opt.label || ''}
                                                                    onChange={(e) => updateOption(index, 'label', e.target.value)}
                                                                />
                                                                <select
                                                                    className="form-select form-select-sm"
                                                                    style={{ width: '150px' }}
                                                                    value={opt.next_step || 'end'}
                                                                    onChange={(e) => updateOption(index, 'next_step', e.target.value)}
                                                                >
                                                                    {flow.steps.map(s => (
                                                                        <option key={s.id} value={s.id}>
                                                                            → {s.title || s.id}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-danger"
                                                                    onClick={() => removeOption(index)}
                                                                >
                                                                    <i className="bi bi-x"></i>
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {(!selectedStep.options || selectedStep.options.length === 0) && (
                                                            <div className="text-muted small text-center py-2">
                                                                Clique em "Adicionar opção" para criar opções
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                {selectedStep.type === 'evidence' && (
                                    <div className="mb-3">
                                        <label className="form-label">Tipo de Evidência</label>
                                        <select
                                            className="form-select"
                                            value={selectedStep.evidence_type || 'any'}
                                            onChange={(e) => setSelectedStep(prev => ({ ...prev, evidence_type: e.target.value }))}
                                        >
                                            <option value="any">Qualquer (texto, arquivo ou imagem)</option>
                                            <option value="text">Somente texto</option>
                                            <option value="image">Somente imagem/screenshot</option>
                                            <option value="file">Somente arquivo</option>
                                        </select>
                                    </div>
                                )}

                                {selectedStep.type !== 'end' && !['select', 'checkbox', 'yesno'].includes(selectedStep.input_type) && (
                                    <div className="mb-3">
                                        <label className="form-label">Próximo Passo (padrão)</label>
                                        <select
                                            className="form-select"
                                            value={selectedStep.next_step || 'end'}
                                            onChange={(e) => setSelectedStep(prev => ({ ...prev, next_step: e.target.value }))}
                                        >
                                            {flow.steps.filter(s => s.id !== selectedStep.id).map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.title || s.id}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary"
                                    onClick={() => { setShowStepModal(false); setSelectedStep(null); }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary"
                                    onClick={saveStep}
                                >
                                    <i className="bi bi-check-lg me-2"></i>
                                    Salvar Etapa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GPSFlowEditor;
