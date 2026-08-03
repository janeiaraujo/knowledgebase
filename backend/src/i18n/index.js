/**
 * Traducao das mensagens da API.
 *
 * O problema que isso resolve: a interface passou a atender pt e en, mas a
 * API respondia sempre no idioma em que a mensagem foi escrita - e estava
 * escrita nos dois, sem criterio (182 mensagens em ingles, 76 em portugues).
 * Quem usava a plataforma em ingles recebia "Notificação não encontrada".
 *
 * A traducao acontece na borda, num hook de serializacao, e nao em cada
 * `throw`. Assim as ~255 mensagens espalhadas por 15 modulos passam a ter
 * os dois idiomas sem reescrever nenhuma rota - e um `throw` novo continua
 * funcionando (ele so nao e traduzido ate entrar no catalogo, o que o teste
 * de cobertura cobra).
 */

import { MESSAGES } from './messages.js';

export const SUPPORTED_LANGUAGES = ['pt', 'en'];
export const DEFAULT_LANGUAGE = 'pt';

/**
 * Le o Accept-Language e devolve o primeiro idioma suportado, respeitando a
 * ordem de preferencia (q-values). "en-US,en;q=0.9,pt;q=0.8" -> "en".
 */
export function parseAcceptLanguage(header) {
    if (!header) return null;

    const preferencias = String(header)
        .split(',')
        .map(parte => {
            const [tag, ...params] = parte.trim().split(';');
            const q = params
                .map(p => p.trim())
                .find(p => p.startsWith('q='));
            return { tag: tag.trim().toLowerCase(), q: q ? parseFloat(q.slice(2)) : 1 };
        })
        .filter(p => p.tag && !Number.isNaN(p.q))
        .sort((a, b) => b.q - a.q);

    for (const { tag } of preferencias) {
        // "pt-BR" atende "pt"; "*" nao expressa preferencia
        const base = tag.split('-')[0];
        if (SUPPORTED_LANGUAGES.includes(base)) return base;
    }
    return null;
}

/**
 * Idioma da resposta, em ordem de prioridade: a preferencia salva do usuario
 * autenticado (o que ele escolheu no Perfil), depois o Accept-Language do
 * navegador, e por fim o padrao.
 */
export function resolveLanguage(request) {
    const preferencia = request?.currentUser?.preferences?.language;
    if (SUPPORTED_LANGUAGES.includes(preferencia)) return preferencia;

    return parseAcceptLanguage(request?.headers?.['accept-language']) || DEFAULT_LANGUAGE;
}

/**
 * Traduz uma mensagem conhecida. Texto fora do catalogo passa intacto: pode
 * ser conteudo do proprio usuario ou mensagem de biblioteca, e reescrever
 * isso seria pior do que deixar como esta.
 */
export function translateMessage(message, language = DEFAULT_LANGUAGE) {
    if (typeof message !== 'string') return message;

    const entrada = MESSAGES[message];
    if (!entrada) return message;

    const indice = language === 'en' ? 1 : 0;
    return entrada[indice] || message;
}

/**
 * Hook de serializacao: traduz `error` e `message` de qualquer resposta.
 * Roda tanto no caminho de sucesso quanto no tratador global de erros.
 */
export function translateReplyPayload(request, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
    if (typeof payload.error !== 'string' && typeof payload.message !== 'string') return payload;

    const idioma = resolveLanguage(request);
    const traduzido = { ...payload };

    if (typeof traduzido.error === 'string') traduzido.error = translateMessage(traduzido.error, idioma);
    if (typeof traduzido.message === 'string') traduzido.message = translateMessage(traduzido.message, idioma);

    return traduzido;
}
