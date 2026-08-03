/**
 * Gamification Page
 * 
 * Features:
 * - User profile with level
 * - Badges showcase
 * - Leaderboard
 * - Challenges
 * - Activity history
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Card, Badge, ProgressBar, Button, Tab, Tabs, Table, Spinner, OverlayTrigger, Tooltip, Alert } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import api from '../services/api';

// Level colors
const LEVEL_COLORS = {
    1: '#6c757d',
    2: '#0dcaf0',
    3: '#198754',
    4: '#0d6efd',
    5: '#6f42c1',
    6: '#fd7e14',
    7: '#dc3545',
    8: '#d63384',
    9: '#ffc107',
    10: '#212529'
};

// Category labels
const CATEGORY_LABELS = {
    contribution: 'Contribuição',
    quality: 'Qualidade',
    engagement: 'Engajamento',
    streak: 'Sequências',
    special: 'Especiais'
};

export default function Gamification() {
  const { t } = useTranslation();
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [badges, setBadges] = useState(null);
    const [leaderboard, setLeaderboard] = useState(null);
    const [challenges, setChallenges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [leaderboardPeriod, setLeaderboardPeriod] = useState('month');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (activeTab === 'leaderboard') {
            loadLeaderboard();
        }
    }, [leaderboardPeriod, activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [profileRes, badgesRes, challengesRes] = await Promise.all([
                api.get('/gamification/profile'),
                api.get('/gamification/badges'),
                api.get('/gamification/challenges')
            ]);

            setProfile(profileRes.data.profile);
            setBadges(badgesRes.data);
            setChallenges(challengesRes.data.challenges);
        } catch (error) {
            console.error('Error loading gamification data:', error);
            toast.error(t('gamification.erroAoCarregarDadosDeGamificacao'));
        } finally {
            setLoading(false);
        }
    };

    const loadLeaderboard = async () => {
        try {
            const res = await api.get(`/gamification/leaderboard?period=${leaderboardPeriod}&limit=20`);
            setLeaderboard(res.data);
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-2">{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <Container fluid>
            <Row className="mb-4">
                <Col>
                    <h2 className="mb-1">
                        <i className="bi bi-trophy me-2"></i>
                        {t('gamification.gamificacao')}
                    </h2>
                    <p className="text-muted">{t('gamification.acompanheSeuProgressoEConquistas')}</p>
                </Col>
            </Row>

            <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4">
                {/* Overview Tab */}
                <Tab eventKey="overview" title={<span><i className="bi bi-person-circle me-2"></i>{t('gamification.meuPerfil')}</span>}>
                    <Row className="g-4">
                        {/* Profile Card */}
                        <Col lg={4}>
                            <Card className="border-0 shadow-sm text-center">
                                <Card.Body className="py-4">
                                    {/* Avatar with level ring */}
                                    <div className="position-relative d-inline-block mb-3">
                                        <div 
                                            className="rounded-circle d-flex align-items-center justify-content-center mx-auto"
                                            style={{
                                                width: 100,
                                                height: 100,
                                                background: `linear-gradient(135deg, ${LEVEL_COLORS[profile?.level?.level || 1]}, ${LEVEL_COLORS[profile?.level?.level || 1]}88)`,
                                                fontSize: '2.5rem',
                                                color: 'white'
                                            }}
                                        >
                                            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                        </div>
                                        <Badge 
                                            bg="warning" 
                                            className="position-absolute"
                                            style={{ bottom: 0, right: 0, fontSize: '1rem' }}
                                        >
                                            Lv.{profile?.level?.level || 1}
                                        </Badge>
                                    </div>

                                    <h4 className="mb-1">{user?.name}</h4>
                                    <p className="text-muted mb-3">{profile?.level?.name || 'Iniciante'}</p>

                                    {/* Points */}
                                    <div className="bg-light rounded p-3 mb-3">
                                        <div className="display-5 fw-bold text-primary">
                                            {profile?.total_points || 0}
                                        </div>
                                        <small className="text-muted">pontos totais</small>
                                    </div>

                                    {/* Level Progress */}
                                    {profile?.level?.next_level && (
                                        <div className="mb-3">
                                            <div className="d-flex justify-content-between small mb-1">
                                                <span>Lv.{profile.level.level}</span>
                                                <span>Lv.{profile.level.next_level.level}</span>
                                            </div>
                                            <ProgressBar 
                                                now={profile.level.progress} 
                                                variant="primary"
                                                style={{ height: 8 }}
                                            />
                                            <small className="text-muted">
                                                {profile.level.next_level.min - profile.total_points} pts para o próximo nível
                                            </small>
                                        </div>
                                    )}

                                    {/* Streak */}
                                    <div className="d-flex justify-content-center gap-4 mt-3">
                                        <div className="text-center">
                                            <div className="fs-3">🔥</div>
                                            <div className="fw-bold">{profile?.current_streak || 0}</div>
                                            <small className="text-muted">{t('gamification.sequenciaAtual')}</small>
                                        </div>
                                        <div className="text-center">
                                            <div className="fs-3">🏆</div>
                                            <div className="fw-bold">{profile?.longest_streak || 0}</div>
                                            <small className="text-muted">{t('gamification.recorde')}</small>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>

                            {/* Stats Card */}
                            <Card className="border-0 shadow-sm mt-4">
                                <Card.Header className="bg-white">
                                    <h6 className="mb-0">
                                        <i className="bi bi-bar-chart me-2"></i>
                                        {t('gamification.estatisticas')}
                                    </h6>
                                </Card.Header>
                                <Card.Body>
                                    <div className="d-flex justify-content-between mb-2">
                                        <span className="text-muted">{t('gamification.kbsCriados')}</span>
                                        <span className="fw-bold">{profile?.stats?.kbs_created || 0}</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-2">
                                        <span className="text-muted">{t('gamification.comentarios')}</span>
                                        <span className="fw-bold">{profile?.stats?.comments_made || 0}</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-2">
                                        <span className="text-muted">{t('gamification.revisoes')}</span>
                                        <span className="fw-bold">{profile?.stats?.reviews_completed || 0}</span>
                                    </div>
                                    <div className="d-flex justify-content-between">
                                        <span className="text-muted">{t('gamification.favoritosRecebidos')}</span>
                                        <span className="fw-bold">{profile?.stats?.favorites_received || 0}</span>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        {/* Badges Preview */}
                        <Col lg={8}>
                            <Card className="border-0 shadow-sm">
                                <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                                    <h6 className="mb-0">
                                        <i className="bi bi-award me-2"></i>
                                        {t('gamification.minhasConquistas')}
                                    </h6>
                                    <Badge bg="secondary">
                                        {badges?.earned || 0} / {badges?.total || 0}
                                    </Badge>
                                </Card.Header>
                                <Card.Body>
                                    <Row xs={3} md={4} lg={6} className="g-3">
                                        {profile?.badges?.slice(0, 12).map(badge => (
                                            <Col key={badge.id}>
                                                <OverlayTrigger
                                                    overlay={
                                                        <Tooltip>
                                                            <strong>{badge.name}</strong>
                                                            <br />
                                                            {badge.description}
                                                            <br />
                                                            <small>+{badge.points} pts</small>
                                                        </Tooltip>
                                                    }
                                                >
                                                    <div className="text-center p-2 bg-light rounded">
                                                        <div className="fs-2">{badge.icon}</div>
                                                        <small className="text-truncate d-block">{badge.name}</small>
                                                    </div>
                                                </OverlayTrigger>
                                            </Col>
                                        ))}
                                        {(!profile?.badges || profile.badges.length === 0) && (
                                            <Col xs={12}>
                                                <Alert variant="info" className="text-center mb-0">
                                                    <i className="bi bi-info-circle me-2"></i>
                                                    {t('gamification.voceAindaNaoConquistouBadgesContin')}
                                                </Alert>
                                            </Col>
                                        )}
                                    </Row>
                                </Card.Body>
                            </Card>

                            {/* Active Challenges */}
                            <Card className="border-0 shadow-sm mt-4">
                                <Card.Header className="bg-white">
                                    <h6 className="mb-0">
                                        <i className="bi bi-lightning me-2"></i>
                                        {t('gamification.desafiosAtivos')}
                                    </h6>
                                </Card.Header>
                                <Card.Body>
                                    {challenges.length > 0 ? (
                                        challenges.map(challenge => (
                                            <div key={challenge._id} className="border rounded p-3 mb-3">
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div>
                                                        <h6 className="mb-1">{challenge.name}</h6>
                                                        <small className="text-muted">{challenge.description}</small>
                                                    </div>
                                                    <Badge bg={challenge.completed ? 'success' : 'primary'}>
                                                        {challenge.completed ? 'Completo' : `${challenge.points_reward} pts`}
                                                    </Badge>
                                                </div>
                                                <ProgressBar 
                                                    now={(challenge.progress / challenge.goal_value) * 100}
                                                    label={`${challenge.progress}/${challenge.goal_value}`}
                                                    variant={challenge.completed ? 'success' : 'primary'}
                                                />
                                                <small className="text-muted">
                                                    Termina em: {new Date(challenge.end_date).toLocaleDateString('pt-BR')}
                                                </small>
                                            </div>
                                        ))
                                    ) : (
                                        <Alert variant="light" className="text-center mb-0">
                                            {t('gamification.nenhumDesafioAtivoNoMomento')}
                                        </Alert>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Tab>

                {/* Badges Tab */}
                <Tab eventKey="badges" title={<span><i className="bi bi-award me-2"></i>{t('gamification.badges')}</span>}>
                    {badges?.badges && Object.entries(badges.badges).map(([category, categoryBadges]) => (
                        <Card key={category} className="border-0 shadow-sm mb-4">
                            <Card.Header className="bg-white">
                                <h6 className="mb-0">
                                    {CATEGORY_LABELS[category] || category}
                                    <Badge bg="secondary" className="ms-2">
                                        {categoryBadges.filter(b => b.earned).length}/{categoryBadges.length}
                                    </Badge>
                                </h6>
                            </Card.Header>
                            <Card.Body>
                                <Row xs={2} md={3} lg={4} className="g-3">
                                    {categoryBadges.map(badge => (
                                        <Col key={badge.id}>
                                            <div 
                                                className={`text-center p-3 rounded border ${badge.earned ? 'bg-light' : 'bg-white opacity-50'}`}
                                            >
                                                <div className="fs-1 mb-2">{badge.icon}</div>
                                                <h6 className="mb-1">{badge.name}</h6>
                                                <small className="text-muted d-block mb-2">
                                                    {badge.description}
                                                </small>
                                                <Badge bg={badge.earned ? 'success' : 'secondary'}>
                                                    {badge.earned ? (
                                                        <>
                                                            <i className="bi bi-check me-1"></i>
                                                            {t('gamification.conquistado')}
                                                        </>
                                                    ) : (
                                                        `+${badge.points} pts`
                                                    )}
                                                </Badge>
                                                {badge.earned && badge.earned_at && (
                                                    <small className="d-block text-muted mt-1">
                                                        {new Date(badge.earned_at).toLocaleDateString('pt-BR')}
                                                    </small>
                                                )}
                                            </div>
                                        </Col>
                                    ))}
                                </Row>
                            </Card.Body>
                        </Card>
                    ))}
                </Tab>

                {/* Leaderboard Tab */}
                <Tab eventKey="leaderboard" title={<span><i className="bi bi-list-ol me-2"></i>{t('gamification.ranking')}</span>}>
                    <Card className="border-0 shadow-sm">
                        <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                            <h6 className="mb-0">
                                <i className="bi bi-trophy me-2"></i>
                                {t('gamification.topContribuidores')}
                            </h6>
                            <div className="btn-group btn-group-sm">
                                <Button
                                    variant={leaderboardPeriod === 'week' ? 'primary' : 'outline-primary'}
                                    onClick={() => setLeaderboardPeriod('week')}
                                >
                                    {t('gamification.semana')}
                                </Button>
                                <Button
                                    variant={leaderboardPeriod === 'month' ? 'primary' : 'outline-primary'}
                                    onClick={() => setLeaderboardPeriod('month')}
                                >
                                    {t('gamification.mes')}
                                </Button>
                                <Button
                                    variant={leaderboardPeriod === 'all' ? 'primary' : 'outline-primary'}
                                    onClick={() => setLeaderboardPeriod('all')}
                                >
                                    {t('gamification.geral')}
                                </Button>
                            </div>
                        </Card.Header>
                        <Card.Body className="p-0">
                            <Table hover className="mb-0">
                                <thead>
                                    <tr>
                                        <th style={{ width: 60 }} className="text-center">#</th>
                                        <th>{t('userActivity.user')}</th>
                                        <th className="text-center" style={{ width: 100 }}>{t('gamification.nivel')}</th>
                                        <th className="text-center" style={{ width: 100 }}>{t('gamification.badges')}</th>
                                        <th className="text-center" style={{ width: 100 }}>🔥 Streak</th>
                                        <th className="text-end" style={{ width: 120 }}>{t('gamification.pontos')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboard?.leaderboard?.map((entry, index) => (
                                        <tr 
                                            key={`${index}-${entry.user_id}`}
                                            className={String(entry.user_id) === String(user?.id) ? 'table-primary' : ''}
                                        >
                                            <td className="text-center">
                                                {index === 0 && '🥇'}
                                                {index === 1 && '🥈'}
                                                {index === 2 && '🥉'}
                                                {index > 2 && entry.rank}
                                            </td>
                                            <td>
                                                <div className="d-flex align-items-center">
                                                    <div 
                                                        className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center me-2"
                                                        style={{ width: 32, height: 32, fontSize: '0.8rem' }}
                                                    >
                                                        {entry.name?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                    {entry.name}
                                                </div>
                                            </td>
                                            <td className="text-center">
                                                <Badge 
                                                    style={{ 
                                                        backgroundColor: LEVEL_COLORS[entry.level?.level || 1],
                                                        color: 'white' 
                                                    }}
                                                >
                                                    Lv.{entry.level?.level || 1}
                                                </Badge>
                                            </td>
                                            <td className="text-center">{entry.badges_count}</td>
                                            <td className="text-center">{entry.streak_days}</td>
                                            <td className="text-end fw-bold">{entry.points}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </Card.Body>
                        {leaderboard?.current_user && leaderboard.current_user.rank > 20 && (
                            <Card.Footer className="bg-light">
                                <div className="d-flex justify-content-between align-items-center">
                                    <span>
                                        {t('gamification.suaPosicao')} <strong>#{leaderboard.current_user.rank}</strong>
                                    </span>
                                    <span>
                                        <strong>{leaderboard.current_user.points}</strong> pontos
                                    </span>
                                </div>
                            </Card.Footer>
                        )}
                    </Card>
                </Tab>
            </Tabs>
        </Container>
    );
}
