/**
 * "Esta tela monta sem estourar?"
 *
 * Nao testa comportamento. Testa a unica coisa que nenhum outro teste deste
 * projeto testava: que o componente renderiza.
 *
 * O motivo e concreto. Ao introduzir o ESLint, cinco bugs que ja estavam em
 * producao apareceram - e os tres do frontend eram todos da mesma familia:
 *
 *   - uma tela importava useTranslation e nunca chamava o hook (57 usos de
 *     t() sem escopo: a pagina inteira quebrada);
 *   - outra chamava useTranslation sem importar;
 *   - uma funcao no escopo de modulo chamava t().
 *
 * Nenhum quebrava `vite build`. Nenhum seria pego por teste de i18n, de lint
 * de estilo ou de API. Todos seriam pegos por montar a tela uma vez.
 *
 * Por isso o teste e deliberadamente raso: sem interacao, sem assercao sobre
 * conteudo. Profundidade aqui custaria manutencao e nao pegaria mais nada
 * dessa familia.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';

import i18n from '../../src/i18n';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { ThemeProvider } from '../../src/contexts/ThemeContext';

// Carregamento tardio: importar as 43 telas de uma vez tornaria a falha de
// uma so em falha de todas, e o erro apareceria sem dizer de quem e.
const TELAS = {
    'auth/Login': () => import('../../src/pages/auth/Login'),
    'auth/Register': () => import('../../src/pages/auth/Register'),
    'auth/MagicLink': () => import('../../src/pages/auth/MagicLink'),
    'auth/ForgotPassword': () => import('../../src/pages/auth/ForgotPassword'),
    'auth/ResetPassword': () => import('../../src/pages/auth/ResetPassword'),
    'Dashboard': () => import('../../src/pages/Dashboard'),
    'Profile': () => import('../../src/pages/Profile'),
    'Settings': () => import('../../src/pages/Settings'),
    'Notifications': () => import('../../src/pages/Notifications'),
    'Favorites': () => import('../../src/pages/Favorites'),
    'Search': () => import('../../src/pages/Search'),
    'SmartSearch': () => import('../../src/pages/SmartSearch'),
    'Analytics': () => import('../../src/pages/Analytics'),
    'Reports': () => import('../../src/pages/Reports'),
    'Reviews': () => import('../../src/pages/Reviews'),
    'Import': () => import('../../src/pages/Import'),
    'AuditLogs': () => import('../../src/pages/AuditLogs'),
    'Webhooks': () => import('../../src/pages/Webhooks'),
    'UserActivity': () => import('../../src/pages/UserActivity'),
    'KBRequests': () => import('../../src/pages/KBRequests'),
    'Integrations': () => import('../../src/pages/Integrations'),
    'Gamification': () => import('../../src/pages/Gamification'),
    'HelpCenter': () => import('../../src/pages/HelpCenter'),
    'Templates': () => import('../../src/pages/Templates'),
    'Admin': () => import('../../src/pages/Admin'),
    'kb/KBList': () => import('../../src/pages/kb/KBList'),
    'kb/KBView': () => import('../../src/pages/kb/KBView'),
    'kb/KBCreate': () => import('../../src/pages/kb/KBCreate'),
    'kb/KBEdit': () => import('../../src/pages/kb/KBEdit'),
    'kb/KBPermissions': () => import('../../src/pages/kb/KBPermissions'),
    'kb/KBVersionHistory': () => import('../../src/pages/kb/KBVersionHistory'),
    'kb/QuickCapture': () => import('../../src/pages/kb/QuickCapture'),
    'incidents/IncidentList': () => import('../../src/pages/incidents/IncidentList'),
    'incidents/IncidentView': () => import('../../src/pages/incidents/IncidentView'),
    'events/EventList': () => import('../../src/pages/events/EventList'),
    'gps/GPSFlowList': () => import('../../src/pages/gps/GPSFlowList'),
    'gps/GPSFlowEditor': () => import('../../src/pages/gps/GPSFlowEditor'),
    'gps/GPSPlayer': () => import('../../src/pages/gps/GPSPlayer'),
    'gps/GPSSessions': () => import('../../src/pages/gps/GPSSessions'),
    'postmortem/PostMortemList': () => import('../../src/pages/postmortem/PostMortemList'),
    'postmortem/PostMortemEditor': () => import('../../src/pages/postmortem/PostMortemEditor')
};

function Envoltorio({ children }) {
    return (
        <MemoryRouter initialEntries={['/']}>
            <I18nextProvider i18n={i18n}>
                <ThemeProvider>
                    <AuthProvider>{children}</AuthProvider>
                </ThemeProvider>
            </I18nextProvider>
        </MemoryRouter>
    );
}

describe('as telas montam sem estourar', () => {
    beforeEach(() => {
        // Sessao valida: sem isso varias telas so renderizam o spinner de
        // carregamento e o teste nao exercitaria o corpo delas.
        localStorage.setItem('accessToken', 'token-de-teste');
        localStorage.setItem('user', JSON.stringify({
            _id: '000000000000000000000001',
            name: 'Teste',
            email: 'teste@exemplo.com',
            role: 'owner',
            tenant_id: '000000000000000000000002'
        }));
    });

    for (const [nome, carregar] of Object.entries(TELAS)) {
        it(nome, async () => {
            const modulo = await carregar();
            const Tela = modulo.default;

            expect(Tela, `${nome} nao exporta um componente como default`).toBeTypeOf('function');

            // Se o componente estourar no render, o erro sobe aqui com o
            // nome da tela no titulo do teste.
            const { container } = render(<Envoltorio><Tela /></Envoltorio>);

            expect(container).toBeTruthy();
        });
    }
});

describe('o teste pega o que deveria pegar', () => {
    // Sem isto o bloco acima poderia estar verde por acidente - por exemplo se
    // o render engolisse a excecao em vez de propaga-la.
    it('uma tela que usa hook sem declarar estoura o teste', async () => {
        const Quebrada = () => {
            // Reproduz o bug real: t() sem o useTranslation no escopo.
            return <div>{t('qualquer.chave')}</div>;   // eslint-disable-line no-undef
        };

        expect(() => render(<Envoltorio><Quebrada /></Envoltorio>)).toThrow();
    });

    it('uma tela normal nao estoura', () => {
        const Boa = () => <div>ok</div>;
        expect(() => render(<Envoltorio><Boa /></Envoltorio>)).not.toThrow();
    });
});
