import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { gpsAPI } from '../../services/api';

const GPSFlowEditor = () => {
    const { t } = useTranslation();
    const { flowId } = useParams();
    const navigate = useNavigate();
    const [flow, setFlow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [selectedStep, setSelectedStep] = useState(null);
    const [showStepModal, setShowStepModal] = useState(false);

    const stepTypes = {
        question: { icon: 'bi-question-circle', color: 'primary' },
        action: { icon: 'bi-lightning', color: 'warning' },
        evidence: { icon: 'bi-camera', color: 'info' },
        condition: { icon: 'bi-signpost-split', color: 'secondary' },
        end: { icon: 'bi-flag', color: 'success' }
    };

    const inputTypes = [
        { value: 'text' },
        { value: 'textarea' },
        { value: 'select' },
        { value: 'checkbox' },
        { value: 'yesno' },
        { value: 'number' },
        { value: 'file' },
        { value: 'image' }
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
            alert(t('gpsEditor.loadError'));
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
            alert(t('gpsEditor.saved'));
        } catch (error) {
            console.error('Error saving flow:', error);
            alert(t('gpsEditor.saveError'));
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
            alert(t('gpsEditor.titleRequired'));
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
            alert(t('gpsEditor.cannotRemoveEnds'));
            return;
        }
        
        if (!confirm(t('gpsEditor.confirmRemoveStep'))) return;
        
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
                <h5>{t('gpsEditor.notFound')}</h5>
                <button className="btn btn-primary" onClick={() => navigate('/gps')}>
                    {t('common.back')}
                </button>
            </div>
        );
    }

    const categories = ['general', 'network', 'hardware', 'software',
        'access', 'email', 'database', 'security'];

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
                        {t('gpsEditor.backToFlows')}
                    </button>
                    <h2 className="mb-1">
                        <i className="bi bi-pencil-square me-2 text-primary"></i>
                        {t('gpsEditor.title')}
                    </h2>
                </div>
                <div className="d-flex gap-2">
                    {hasChanges && (
                        <span className="badge bg-warning text-dark align-self-center">
                            {t('gpsEditor.unsavedChanges')}
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
                                {t('gpsEditor.saving')}
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg me-2"></i>
                                {t('gpsEditor.save')}
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
                                {t('gpsEditor.flowProperties')}
                            </h6>
                        </div>
                        <div className="card-body">
                            <div className="mb-3">
                                <label className="form-label">{t('gpsEditor.name')} *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={flow.name || ''}
                                    onChange={(e) => updateFlow({ name: e.target.value })}
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">{t('common.description')}</label>
                                <textarea
                                    className="form-control"
                                    rows="2"
                                    value={flow.description || ''}
                                    onChange={(e) => updateFlow({ description: e.target.value })}
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">{t('search.category')}</label>
                                <select
                                    className="form-select"
                                    value={flow.category || 'general'}
                                    onChange={(e) => updateFlow({ category: e.target.value })}
                                >
                                    {categories.map(value => (
                                        <option key={value} value={value}>{t(`gpsEditor.categories.${value}`)}</option>
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
                                    {t('gpsEditor.flowActive')}
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Add Step Buttons */}
                    <div className="card shadow-sm">
                        <div className="card-header">
                            <h6 className="mb-0">
                                <i className="bi bi-plus-circle me-2"></i>
                                {t('gpsEditor.addStep')}
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
                                        {t(`gpsEditor.stepTypes.${type}`)}
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
                                {t('gpsEditor.flowSteps', { count: flow.steps?.length || 0 })}
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
                                                    {step.title || t('gpsEditor.untitledStep')}
                                                </div>
                                                <small className="text-muted">
                                                    {t(`gpsEditor.stepTypes.${step.type}`)}
                                                    {step.input_type && ` • ${t(`gpsEditor.inputTypes.${step.input_type}`)}`}
                                                    {step.required && ` • ${t('gpsEditor.required')}`}
                                                </small>
                                                {step.next_step && step.type !== 'end' && (
                                                    <div>
                                                        <small className="text-muted">
                                                            <i className="bi bi-arrow-right me-1"></i>
                                                            {t('gpsEditor.next')}: {flow.steps.find(s => s.id === step.next_step)?.title || step.next_step}
                                                        </small>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="d-flex gap-1">
                                                <button
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={() => editStep(step)}
                                                    title={t('common.edit')}
                                                >
                                                    <i className="bi bi-pencil"></i>
                                                </button>
                                                {step.id !== 'start' && step.type !== 'end' && (
                                                    <button
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => deleteStep(step.id)}
                                                        title={t('integrations.remove')}
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
                                        ? t('gpsEditor.editStep')
                                        : t('gpsEditor.newStep')
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
                                        <label className="form-label">{t('common.title')} *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder={t('gpsEditor.titlePlaceholder')}
                                            value={selectedStep.title || ''}
                                            onChange={(e) => setSelectedStep(prev => ({ ...prev, title: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label">{t('gpsEditor.type')}</label>
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
                                            {Object.keys(stepTypes).map(value => (
                                                <option key={value} value={value}>{t(`gpsEditor.stepTypes.${value}`)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">{t('gpsEditor.instruction')}</label>
                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        placeholder={t('gpsEditor.instructionPlaceholder')}
                                        value={selectedStep.description || ''}
                                        onChange={(e) => setSelectedStep(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>

                                {selectedStep.type === 'question' && (
                                    <>
                                        <div className="row">
                                            <div className="col-md-6 mb-3">
                                                <label className="form-label">{t('gpsEditor.inputType')}</label>
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
                                                        <option key={type.value} value={type.value}>{t(`gpsEditor.inputTypes.${type.value}`)}</option>
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
                                                        {t('gpsEditor.requiredField')}
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Options for select/checkbox/yesno */}
                                        {['select', 'checkbox', 'yesno'].includes(selectedStep.input_type) && (
                                            <div className="mb-3">
                                                <label className="form-label d-flex justify-content-between">
                                                    <span>{t('gpsEditor.options')}</span>
                                                    {selectedStep.input_type !== 'yesno' && (
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-link btn-sm p-0"
                                                            onClick={addOption}
                                                        >
                                                            <i className="bi bi-plus-lg me-1"></i>
                                                            {t('gpsEditor.addOption')}
                                                        </button>
                                                    )}
                                                </label>
                                                
                                                {selectedStep.input_type === 'yesno' ? (
                                                    <div className="alert alert-info small mb-0">
                                                        <i className="bi bi-info-circle me-2"></i>
                                                        {t('gpsEditor.yesnoHelp')}
                                                    </div>
                                                ) : (
                                                    <div className="border rounded p-2">
                                                        {(selectedStep.options || []).map((opt, index) => (
                                                            <div key={index} className="d-flex gap-2 mb-2">
                                                                <input
                                                                    type="text"
                                                                    className="form-control form-control-sm"
                                                                    placeholder={t('gpsEditor.optionLabel')}
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
                                                                {t('gpsEditor.noOptions')}
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
                                        <label className="form-label">{t('gpsEditor.evidenceType')}</label>
                                        <select
                                            className="form-select"
                                            value={selectedStep.evidence_type || 'any'}
                                            onChange={(e) => setSelectedStep(prev => ({ ...prev, evidence_type: e.target.value }))}
                                        >
                                            <option value="any">{t('gpsEditor.evidenceAny')}</option>
                                            <option value="text">{t('gpsEditor.evidenceText')}</option>
                                            <option value="image">{t('gpsEditor.evidenceImage')}</option>
                                            <option value="file">{t('gpsEditor.evidenceFile')}</option>
                                        </select>
                                    </div>
                                )}

                                {selectedStep.type !== 'end' && !['select', 'checkbox', 'yesno'].includes(selectedStep.input_type) && (
                                    <div className="mb-3">
                                        <label className="form-label">{t('gpsEditor.defaultNextStep')}</label>
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
                                    {t('common.cancel')}
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary"
                                    onClick={saveStep}
                                >
                                    <i className="bi bi-check-lg me-2"></i>
                                    {t('gpsEditor.saveStep')}
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
