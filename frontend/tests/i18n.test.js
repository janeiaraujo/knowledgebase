/**
 * Guarda dos dois idiomas da interface.
 *
 * A plataforma precisa atender pt e en por inteiro. O modo como isso
 * quebra e sempre silencioso: alguem adiciona uma chave so no pt, ou
 * escreve t('kbView.aprovar') com um typo, e a tela passa a mostrar o
 * caminho da chave no lugar do texto - o build continua verde.
 *
 * Estes testes fecham essa porta: paridade de chaves, chaves realmente
 * usadas no codigo, placeholders de interpolacao iguais nos dois lados e
 * <Trans> devolvendo o markup esperado.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const LOCALES = path.join(SRC, 'i18n', 'locales');

const load = (lang) => JSON.parse(fs.readFileSync(path.join(LOCALES, `${lang}.json`), 'utf8'));
const pt = load('pt');
const en = load('en');

/** Achata a arvore em caminhos. Arrays entram com o tamanho, que tambem precisa bater. */
function flatten(node, prefix = '', out = new Map()) {
    for (const [key, value] of Object.entries(node)) {
        const full = prefix ? `${prefix}.${key}` : key;
        if (Array.isArray(value)) out.set(`${full}[]`, value);
        else if (value && typeof value === 'object') flatten(value, full, out);
        else out.set(full, value);
    }
    return out;
}

const flatPt = flatten(pt);
const flatEn = flatten(en);

const collectFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(full);
    return /\.jsx?$/.test(entry.name) ? [full] : [];
});

const SOURCES = collectFiles(SRC).map(file => ({
    file: path.relative(SRC, file).replace(/\\/g, '/'),
    code: fs.readFileSync(file, 'utf8')
}));

/**
 * Chaves citadas no codigo com string literal: t('a.b'), i18nKey="a.b",
 * labelKey: 'a.b'. Chaves montadas em template (`x.${type}.y`) ficam de
 * fora de proposito - o valor so existe em runtime.
 */
function referencedKeys() {
    const found = [];
    const patterns = [
        /\bt\(\s*'([\w.-]+)'/g,
        /\bt\(\s*"([\w.-]+)"/g,
        /i18nKey\s*=\s*"([\w.-]+)"/g,
        /\b(?:labelKey|nameKey|descKey)\s*:\s*'([\w.-]+)'/g
    ];
    for (const { file, code } of SOURCES) {
        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(code)) !== null) found.push({ key: match[1], file });
        }
    }
    return found;
}

/** {{nome}} usados numa mensagem - precisam ser os mesmos nos dois idiomas. */
const placeholders = (value) =>
    new Set(String(value).match(/\{\{\s*[\w.]+\s*\}\}/g)?.map(p => p.replace(/\s/g, '')) || []);

/** Sufixos de plural do i18next: a chave base e a mesma, o sufixo nao conta. */
const stripPluralSuffix = (key) => key.replace(/_(zero|one|two|few|many|other)$/, '');

describe('i18n', () => {
    test('pt e en tem exatamente as mesmas chaves', () => {
        const soPt = [...flatPt.keys()].filter(k => !flatEn.has(k));
        const soEn = [...flatEn.keys()].filter(k => !flatPt.has(k));

        assert.deepEqual(
            { soPt, soEn },
            { soPt: [], soEn: [] },
            'Chave presente num idioma e ausente no outro - a tela mostra o caminho da chave em vez do texto.'
        );
    });

    test('nenhuma traducao vazia', () => {
        const vazias = [];
        for (const [lang, flat] of [['pt', flatPt], ['en', flatEn]]) {
            for (const [key, value] of flat) {
                if (Array.isArray(value)) {
                    if (value.length === 0 || value.some(v => !String(v).trim())) vazias.push(`${lang}:${key}`);
                } else if (!String(value).trim()) {
                    vazias.push(`${lang}:${key}`);
                }
            }
        }
        assert.deepEqual(vazias, [], 'Traducao vazia aparece como texto em branco na tela.');
    });

    test('listas tem o mesmo tamanho nos dois idiomas', () => {
        const divergentes = [];
        for (const [key, value] of flatPt) {
            if (!Array.isArray(value)) continue;
            const other = flatEn.get(key);
            if (!Array.isArray(other) || other.length !== value.length) {
                divergentes.push(`${key}: pt=${value.length} en=${Array.isArray(other) ? other.length : 'ausente'}`);
            }
        }
        assert.deepEqual(divergentes, [], 'Lista com tamanhos diferentes muda o que a tela mostra conforme o idioma.');
    });

    test('placeholders de interpolacao batem entre pt e en', () => {
        const divergentes = [];
        for (const [key, value] of flatPt) {
            if (Array.isArray(value)) continue;
            const other = flatEn.get(key);
            if (other === undefined) continue;

            const aqui = placeholders(value);
            const la = placeholders(other);
            const faltando = [...aqui].filter(p => !la.has(p));
            const sobrando = [...la].filter(p => !aqui.has(p));
            if (faltando.length || sobrando.length) {
                divergentes.push(`${key}: falta no en [${faltando}] / so no en [${sobrando}]`);
            }
        }
        assert.deepEqual(divergentes, [], 'Placeholder ausente vira texto literal "{{nome}}" na tela.');
    });

    test('toda chave citada no codigo existe nas traducoes', () => {
        const quebradas = referencedKeys()
            .filter(({ key }) => {
                const base = stripPluralSuffix(key);
                if (flatPt.has(key) || flatPt.has(base)) return false;
                // plurais: a chave nua nao existe, so as variantes com sufixo
                return ![...flatPt.keys()].some(k => stripPluralSuffix(k) === base);
            })
            .map(({ key, file }) => `${file} -> ${key}`);

        assert.deepEqual(quebradas, [], 'Chave inexistente faz a tela mostrar o caminho literal.');
    });

    test('nenhum callback usa `t` como parametro num arquivo que traduz', () => {
        // Ja aconteceu: `sourceTokens.map(t => ...)` num componente com
        // useTranslation. Dentro do callback, `t` e o item da lista, entao
        // t('chave') estoura "t is not a function" no render. O build passa
        // - so quebra na tela, e so quando a lista tem itens.
        const sombras = [];
        for (const { file, code } of SOURCES) {
            if (!code.includes('useTranslation')) continue;
            for (const pattern of [/\(\s*t\s*\)\s*=>/g, /(?<![\w.$])\bt\s*=>/g]) {
                pattern.lastIndex = 0;
                let match;
                while ((match = pattern.exec(code)) !== null) {
                    const linha = code.slice(0, match.index).split('\n').length;
                    sombras.push(`${file}:${linha} -> ${match[0].trim()}`);
                }
            }
        }
        assert.deepEqual(sombras, [], 'Renomeie o parametro: `t` esta reservado para a funcao de traducao.');
    });

    test('nao sobra texto em portugues cru nas telas ja traduzidas', () => {
        // Lista fechada: telas que ja passaram pela traducao nao podem
        // regredir. Telas ainda nao traduzidas ficam de fora ate a vez delas.
        const TRADUZIDAS = [
            'pages/Settings.jsx', 'pages/Reviews.jsx', 'pages/Favorites.jsx',
            'pages/Notifications.jsx', 'pages/Search.jsx', 'pages/SmartSearch.jsx',
            'pages/Integrations.jsx', 'pages/kb/KBView.jsx',
            'pages/Reports.jsx', 'pages/UserActivity.jsx',
            'pages/gps/GPSFlowEditor.jsx', 'pages/postmortem/PostMortemEditor.jsx',
            'components/integrations/InboundEventSources.jsx'
        ];
        const atributoLiteral = /(?:placeholder|title|label)\s*=\s*"([^"]*)"/gi;

        // Tokens tecnicos (URL, host, e-mail, caminho) sao iguais em
        // qualquer idioma - e "datadoghq.com" contem "com", que casaria
        // com a palavra portuguesa. Some com eles antes de avaliar.
        const semTecnico = (valor) => valor.replace(/\S*[./@]\S*/g, ' ');

        const ehTecnico = (valor) => !/\s/.test(valor) || !/[A-Za-zÀ-ÿ]{3}/.test(semTecnico(valor));

        const parecePortugues = (valor) => {
            const texto = semTecnico(valor);
            return /[áàâãéêíóôõúüç]/i.test(texto) ||
                /\b(?:de|da|do|das|dos|para|com|não|você|uma|seu|sua|este|esta)\b/i.test(texto);
        };

        // Texto solto entre tags JSX (>Aprovar<). Sem isso a varredura so
        // olhava atributos, e frases no corpo da tela passavam batido.
        const textoJsx = /(?<=>)([^<>{}\n]{4,80})(?=<)/g;

        const achados = [];
        for (const { file, code } of SOURCES) {
            if (!TRADUZIDAS.includes(file)) continue;

            for (const pattern of [atributoLiteral, textoJsx]) {
                pattern.lastIndex = 0;
                let match;
                while ((match = pattern.exec(code)) !== null) {
                    const valor = match[1].trim();
                    if (!ehTecnico(valor) && parecePortugues(valor)) achados.push(`${file}: ${valor}`);
                }
            }
        }
        assert.deepEqual(achados, [], 'Texto em portugues fixo numa tela ja traduzida - nao muda com o idioma.');
    });
});
