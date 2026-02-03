import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gpsAPI } from '../../services/api';

const GPSFlowList = () => {
    const navigate = useNavigate();
    const [flows, setFlows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ active_only: false });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newFlow, setNewFlow] = useState({ name: '', description: '', category: 'general' });
    const [categories, setCategories] = useState([]);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadFlows();
        loadCategories();
    }, [filter]);

    const loadFlows = async () => {
        try {
            setLoading(true);
            const res = await gpsAPI.listFlows(filter);
            setFlows(res.data.flows || []);
        } catch (error) {
            console.error('Error loading flows:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const res = await gpsAPI.getCategories();
            setCategories(res.data.categories || []);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const handleCreateFlow = async (e) => {
        e.preventDefault();
        try {
            setCreating(true);
            const res = await gpsAPI.createFlow(newFlow);
            navigate(`/gps/flows/${res.data.flow._id}/edit`);
        } catch (error) {
            console.error('Error creating flow:', error);
            alert('Erro ao criar fluxo');
        } finally {
            setCreating(false);
        }
    };

    const handleDuplicate = async (flowId) => {
        if (!confirm('Deseja duplicar este fluxo?')) return;
        try {
            const res = await gpsAPI.duplicateFlow(flowId);
            navigate(`/gps/flows/${res.data.flow._id}/edit`);
        } catch (error) {
            console.error('Error duplicating flow:', error);
        }
    };

    const handleDelete = async (flowId) => {
        if (!window.confirm('Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita.')) return;
        
        try {
            setLoading(true);
            await gpsAPI.deleteFlow(flowId);
            await loadFlows();
            
            // Toast de sucesso
            const toastEl = document.createElement('div');
            toastEl.className = 'toast align-items-center text-white bg-success border-0 position-fixed top-0 end-0 m-3';
            toastEl.setAttribute('role', 'alert');
            toastEl.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="bi bi-check-circle me-2"></i>
                        Fluxo excluído com sucesso!
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            `;
            document.body.appendChild(toastEl);
            const toast = new window.bootstrap.Toast(toastEl);
            toast.show();
            setTimeout(() => toastEl.remove(), 3000);
        } catch (error) {
            console.error('Error deleting flow:', error);
            alert('Erro ao excluir fluxo: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (flow) => {
        try {
            await gpsAPI.updateFlow(flow._id, { is_active: !flow.is_active });
            loadFlows();
        } catch (error) {
            console.error('Error toggling flow:', error);
        }
    };

    const categoryLabels = {
        general: 'Geral',
        network: 'Rede',
        hardware: 'Hardware',
        software: 'Software',
        access: 'Acesso',
        email: 'E-mail',
        database: 'Banco de Dados',
        security: 'Segurança'
    };

    const categoryIcons = {
        general: 'bi-question-circle',
        network: 'bi-hdd-network',
        hardware: 'bi-pc-display',
        software: 'bi-window',
        access: 'bi-key',
        email: 'bi-envelope',
        database: 'bi-database',
        security: 'bi-shield-lock'
    };

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-1">
                        <i className="bi bi-signpost-2 me-2 text-primary"></i>
                        Fluxos GPS
                    </h2>
                    <p className="text-muted mb-0">
                        Guided Problem Solving - Diagnósticos guiados para atendimento
                    </p>
                </div>
                <button 
                    className="btn btn-primary"
                    onClick={() => setShowCreateModal(true)}
                >
                    <i className="bi bi-plus-lg me-2"></i>
                    Novo Fluxo
                </button>
            </div>

            {/* Filters */}
            <div className="card shadow-sm mb-4">
                <div className="card-body">
                    <div className="row g-3 align-items-center">
                        <div className="col-auto">
                            <div className="form-check form-switch">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="activeOnly"
                                    checked={!filter.active_only}
                                    onChange={(e) => setFilter(prev => ({ ...prev, active_only: !e.target.checked }))}
                                />
                                <label className="form-check-label" htmlFor="activeOnly">
                                    Mostrar inativos
                                </label>
                            </div>
                        </div>
                        <div className="col-auto">
                            <select
                                className="form-select form-select-sm"
                                value={filter.category || ''}
                                onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value || undefined }))}
                            >
                                <option value="">Todas categorias</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>
                                        {categoryLabels[cat] || cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Flows Grid */}
            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" />
                </div>
            ) : flows.length === 0 ? (
                <div className="text-center py-5">
                    <i className="bi bi-signpost-2 display-1 text-muted mb-3 d-block"></i>
                    <h5>Nenhum fluxo GPS criado</h5>
                    <p className="text-muted mb-3">
                        Crie fluxos de diagnóstico guiado para ajudar no atendimento de primeiro nível.
                    </p>
                    <button 
                        className="btn btn-primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <i className="bi bi-plus-lg me-2"></i>
                        Criar Primeiro Fluxo
                    </button>
                </div>
            ) : (
                <div className="row g-4">
                    {flows.map(flow => (
                        <div key={flow._id} className="col-md-6 col-lg-4">
                            <div className={`card h-100 shadow-sm ${!flow.is_active ? 'border-secondary opacity-75' : ''}`}>
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="d-flex align-items-center">
                                            <div className={`rounded-circle p-2 me-3 ${flow.is_active ? 'bg-primary' : 'bg-secondary'} bg-opacity-10`}>
                                                <i className={`bi ${categoryIcons[flow.category] || 'bi-question-circle'} fs-4 ${flow.is_active ? 'text-primary' : 'text-secondary'}`}></i>
                                            </div>
                                            <div>
                                                <h5 className="card-title mb-0">{flow.name}</h5>
                                                <small className={`badge ${flow.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                                    {flow.is_active ? 'Ativo' : 'Inativo'}
                                                </small>
                                            </div>
                                        </div>
                                        <div className="dropdown">
                                            <button className="btn btn-link text-muted p-0" data-bs-toggle="dropdown" aria-expanded="false">
                                                <i className="bi bi-three-dots-vertical"></i>
                                            </button>
                                            <ul className="dropdown-menu dropdown-menu-end">
                                                <li>
                                                    <button 
                                                        className="dropdown-item" 
                                                        type="button"
                                                        onClick={() => navigate(`/gps/flows/${flow._id}/edit`)}
                                                    >
                                                        <i className="bi bi-pencil me-2"></i>
                                                        Editar
                                                    </button>
                                                </li>
                                                <li>
                                                    <button 
                                                        className="dropdown-item" 
                                                        type="button"
                                                        onClick={() => handleDuplicate(flow._id)}
                                                    >
                                                        <i className="bi bi-copy me-2"></i>
                                                        Duplicar
                                                    </button>
                                                </li>
                                                <li>
                                                    <button 
                                                        className="dropdown-item" 
                                                        type="button"
                                                        onClick={() => handleToggleActive(flow)}
                                                    >
                                                        <i className={`bi ${flow.is_active ? 'bi-pause-circle' : 'bi-play-circle'} me-2`}></i>
                                                        {flow.is_active ? 'Desativar' : 'Ativar'}
                                                    </button>
                                                </li>
                                                <li><hr className="dropdown-divider" /></li>
                                                <li>
                                                    <button 
                                                        className="dropdown-item text-danger" 
                                                        type="button"
                                                        onClick={() => handleDelete(flow._id)}
                                                    >
                                                        <i className="bi bi-trash me-2"></i>
                                                        Excluir
                                                    </button>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                    
                                    <p className="card-text text-muted small mb-3">
                                        {flow.description || 'Sem descrição'}
                                    </p>
                                    
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div className="d-flex gap-2">
                                            <span className="badge bg-light text-dark">
                                                <i className="bi bi-diagram-3 me-1"></i>
                                                {flow.steps?.length || 0} etapas
                                            </span>
                                            <span className="badge bg-light text-dark">
                                                <i className={`${categoryIcons[flow.category] || 'bi-tag'} me-1`}></i>
                                                {categoryLabels[flow.category] || flow.category}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="card-footer bg-transparent border-top-0">
                                    <div className="d-grid gap-2">
                                        {flow.is_active ? (
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => navigate(`/gps/play/${flow._id}`)}
                                            >
                                                <i className="bi bi-play-fill me-2"></i>
                                                Iniciar Diagnóstico
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-outline-secondary btn-sm"
                                                onClick={() => navigate(`/gps/flows/${flow._id}/edit`)}
                                            >
                                                <i className="bi bi-pencil me-2"></i>
                                                Editar Fluxo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    <i className="bi bi-plus-circle me-2"></i>
                                    Novo Fluxo GPS
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close"
                                    onClick={() => setShowCreateModal(false)}
                                />
                            </div>
                            <form onSubmit={handleCreateFlow}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label">Nome do Fluxo *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Ex: Diagnóstico de Rede"
                                            value={newFlow.name}
                                            onChange={(e) => setNewFlow(prev => ({ ...prev, name: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Descrição</label>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            placeholder="Descreva o objetivo deste fluxo..."
                                            value={newFlow.description}
                                            onChange={(e) => setNewFlow(prev => ({ ...prev, description: e.target.value }))}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Categoria</label>
                                        <select
                                            className="form-select"
                                            value={newFlow.category}
                                            onChange={(e) => setNewFlow(prev => ({ ...prev, category: e.target.value }))}
                                        >
                                            {categories.map(cat => (
                                                <option key={cat} value={cat}>
                                                    {categoryLabels[cat] || cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary"
                                        onClick={() => setShowCreateModal(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary"
                                        disabled={creating || !newFlow.name}
                                    >
                                        {creating ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" />
                                                Criando...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-check-lg me-2"></i>
                                                Criar e Editar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GPSFlowList;
