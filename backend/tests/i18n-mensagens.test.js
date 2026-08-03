/**
 * Guarda das mensagens bilingues da API.
 *
 * A traducao acontece na borda, consultando um catalogo por texto exato.
 * Isso tem um custo: se alguem escrever um `throw` novo e nao registrar a
 * mensagem, ela simplesmente sai no idioma em que foi escrita - sem erro,
 * sem aviso, exatamente o problema que estamos consertando. O teste de
 * cobertura abaixo e o que impede isso de voltar a acontecer.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MESSAGES } from '../src/i18n/messages.js';
import {
    parseAcceptLanguage,
    resolveLanguage,
    translateMessage,
    translateReplyPayload,
    DEFAULT_LANGUAGE
} from '../src/i18n/index.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const collectFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(full);
    return full.endsWith('.js') ? [full] : [];
});

/**
 * Mensagens escritas literalmente nas rotas: `error: '...'` e `message: '...'`.
 * Ignora o proprio modulo de i18n (o catalogo cita todas por definicao).
 */
function mensagensNoCodigo() {
    const encontradas = new Map();
    // Sem quebra de linha na captura de proposito: `log.error('Auth
    // middleware error:', error)` tem um "error:" DENTRO da string, e sem
    // essa restricao a captura corria ate a aspa da linha seguinte,
    // engolindo codigo como se fosse mensagem.
    const padrao = /\b(?:error|message)\s*:\s*'((?:[^'\\\n]|\\.)*)'/g;

    for (const file of collectFiles(SRC)) {
        const relativo = path.relative(SRC, file).replace(/\\/g, '/');
        if (relativo.startsWith('i18n/')) continue;

        const code = fs.readFileSync(file, 'utf8');
        padrao.lastIndex = 0;
        let match;
        while ((match = padrao.exec(code)) !== null) {
            const texto = match[1].replace(/\\'/g, "'");
            if (!encontradas.has(texto)) encontradas.set(texto, relativo);
        }
    }
    return encontradas;
}

/**
 * Nem todo `error: '...'` e mensagem para o usuario - ha mapas de cor
 * (`error: '#dc3545'`) e placeholders internos. Filtra o que claramente nao
 * e texto de interface.
 */
const ehMensagemDeUsuario = (texto) =>
    /[A-Za-zÀ-ÿ]{3}/.test(texto) &&
    /\s/.test(texto) &&
    !/^#?[0-9a-f]{3,8}$/i.test(texto);

describe('mensagens da API nos dois idiomas', () => {
    test('toda mensagem escrita nas rotas esta no catalogo', () => {
        const faltando = [...mensagensNoCodigo()]
            .filter(([texto]) => ehMensagemDeUsuario(texto) && !MESSAGES[texto])
            .map(([texto, arquivo]) => `${arquivo}: "${texto}"`);

        assert.deepEqual(
            faltando,
            [],
            'Mensagem sem entrada no catalogo sai sempre no idioma em que foi escrita.\n' +
            'Adicione em src/i18n/messages.js como \'chave\': [portugues, ingles].'
        );
    });

    test('nenhuma entrada do catalogo tem lado vazio', () => {
        const quebradas = Object.entries(MESSAGES)
            .filter(([, valor]) => !Array.isArray(valor) || valor.length !== 2 ||
                !String(valor[0]).trim() || !String(valor[1]).trim())
            .map(([chave]) => chave);

        assert.deepEqual(quebradas, [], 'Entrada precisa ser [portugues, ingles], ambos preenchidos.');
    });

    test('catalogo nao guarda entrada que ninguem usa', () => {
        // Catalogo que acumula lixo para de ser confiavel: ninguem sabe se
        // uma entrada esta ali porque e usada ou porque sobrou.
        const noCodigo = new Set(mensagensNoCodigo().keys());
        const orfas = Object.keys(MESSAGES).filter(chave => !noCodigo.has(chave));

        assert.deepEqual(orfas, [], 'Entrada do catalogo que nao aparece em nenhuma rota - remova.');
    });

    describe('escolha do idioma', () => {
        test('le o Accept-Language respeitando a ordem de preferencia', () => {
            assert.equal(parseAcceptLanguage('en-US,en;q=0.9,pt;q=0.8'), 'en');
            assert.equal(parseAcceptLanguage('pt-BR,pt;q=0.9'), 'pt');
            // q menor vem depois, mesmo aparecendo primeiro na string
            assert.equal(parseAcceptLanguage('en;q=0.2,pt;q=0.9'), 'pt');
        });

        test('ignora idioma que nao atendemos e cabecalho ausente', () => {
            assert.equal(parseAcceptLanguage('fr-FR,fr;q=0.9'), null);
            assert.equal(parseAcceptLanguage('*'), null);
            assert.equal(parseAcceptLanguage(''), null);
            assert.equal(parseAcceptLanguage(undefined), null);
        });

        test('a preferencia salva do usuario vence o cabecalho do navegador', () => {
            const request = {
                headers: { 'accept-language': 'en-US,en;q=0.9' },
                currentUser: { preferences: { language: 'pt' } }
            };
            assert.equal(resolveLanguage(request), 'pt', 'quem escolheu pt no Perfil deve receber pt');
        });

        test('sem usuario e sem cabecalho, cai no padrao', () => {
            assert.equal(resolveLanguage({ headers: {} }), DEFAULT_LANGUAGE);
            assert.equal(resolveLanguage(undefined), DEFAULT_LANGUAGE);
        });
    });

    describe('traducao', () => {
        test('traduz nos dois sentidos', () => {
            assert.equal(translateMessage('Record not found', 'pt'), 'Registro não encontrado');
            assert.equal(translateMessage('Record not found', 'en'), 'Record not found');
            assert.equal(translateMessage('Notificação não encontrada', 'en'), 'Notification not found');
            assert.equal(translateMessage('Notificação não encontrada', 'pt'), 'Notificação não encontrada');
        });

        test('texto fora do catalogo passa intacto', () => {
            // Pode ser conteudo do proprio usuario ou mensagem de biblioteca.
            const cru = 'E11000 duplicate key error collection: kb.records';
            assert.equal(translateMessage(cru, 'en'), cru);
            assert.equal(translateMessage(cru, 'pt'), cru);
        });

        test('valor que nao e string passa intacto', () => {
            assert.equal(translateMessage(undefined, 'en'), undefined);
            assert.equal(translateMessage(42, 'en'), 42);
        });
    });

    describe('hook de resposta', () => {
        const pedidoEn = { headers: { 'accept-language': 'en' } };

        test('traduz error e message, preservando o resto do corpo', () => {
            const saida = translateReplyPayload(pedidoEn, {
                error: 'Record not found',
                message: 'Record not found',
                statusCode: 404
            });

            assert.deepEqual(saida, {
                error: 'Record not found',
                message: 'Record not found',
                statusCode: 404
            });

            const emPortugues = translateReplyPayload({ headers: {} }, {
                error: 'Record not found', message: 'Record not found', statusCode: 404
            });
            assert.equal(emPortugues.error, 'Registro não encontrado');
            assert.equal(emPortugues.statusCode, 404, 'campos que nao sao texto nao podem ser tocados');
        });

        test('nao altera o payload original', () => {
            const original = { error: 'Record not found' };
            translateReplyPayload(pedidoEn, original);
            assert.equal(original.error, 'Record not found', 'o hook precisa devolver copia, nao mutar');
        });

        test('deixa passar payload sem campo de texto', () => {
            const lista = [{ _id: 1 }, { _id: 2 }];
            assert.equal(translateReplyPayload(pedidoEn, lista), lista);
            assert.equal(translateReplyPayload(pedidoEn, null), null);

            const registro = { title: 'Não encontrado', total: 2 };
            assert.equal(translateReplyPayload(pedidoEn, registro), registro,
                'conteudo do usuario nao passa pelo catalogo');
        });
    });
});
