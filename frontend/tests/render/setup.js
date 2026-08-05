import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Ambiente minimo para as telas montarem.
 *
 * A ideia nao e testar comportamento - e responder "esta tela monta sem
 * estourar?". Por isso tudo que fala com o mundo externo devolve vazio: o que
 * importa e o caminho de render, nao o dado.
 */

// jsdom nao implementa estes, e varias telas os usam no mount.
window.matchMedia = window.matchMedia || ((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
}));

window.scrollTo = window.scrollTo || (() => {});

global.IntersectionObserver = global.IntersectionObserver || class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

global.ResizeObserver = global.ResizeObserver || class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// WebSocket: as notificacoes em tempo real abrem conexao no mount.
global.WebSocket = class {
    constructor() { this.readyState = 0; }
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
};

// Nenhuma chamada de rede sai daqui. Cada metodo do api devolve uma resposta
// vazia, no formato que os componentes esperam - e o Proxy cobre metodo novo
// sem precisar atualizar o mock a cada rota criada.
const respostaVazia = () => Promise.resolve({
    data: {
        records: [], incidents: [], events: [], comments: [], tags: [],
        categories: [], users: [], groups: [], departments: [], templates: [],
        notifications: [], webhooks: [], favorites: [], flows: [], sessions: [],
        postmortems: [], requests: [], schedules: [], history: [], articles: [],
        results: [], integrations: [], logs: [], versions: [], badges: [],
        organization: { name: '', settings: {} },
        pagination: { page: 1, pages: 1, total: 0 },
        stats: {}, summary: {}, data: {}, user: {}
    }
});

// Um objeto cujo acesso a qualquer metodo devolve a resposta vazia. Assim o
// mock nao precisa acompanhar cada metodo novo que uma rota ganhar.
const grupoFalso = () => new Proxy({}, {
    get: (_, prop) => (prop === 'then' || typeof prop === 'symbol' ? undefined : respostaVazia)
});

// O Vitest valida os exports nomeados do mock, entao eles vao listados. A
// lista quebrar quando alguem criar um grupo novo e o comportamento desejado:
// o teste avisa em vez de silenciosamente chamar a API de verdade.
const GRUPOS = [
    'authAPI', 'kbAPI', 'recordAPI', 'incidentAPI', 'eventAPI', 'fileAPI',
    'aiAPI', 'databaseAPI', 'organizationAPI', 'userAPI', 'billingAPI',
    'notificationAPI', 'exportAPI', 'commentAPI', 'tagAPI', 'categoryAPI',
    'favoriteAPI', 'relationAPI', 'templateAPI', 'analyticsAPI', 'gpsAPI'
];

vi.mock('../../src/services/api', () => {
    const padrao = grupoFalso();
    padrao.interceptors = { request: { use: () => {} }, response: { use: () => {} } };

    return Object.fromEntries([
        ['default', padrao],
        ...GRUPOS.map(nome => [nome, grupoFalso()])
    ]);
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});
