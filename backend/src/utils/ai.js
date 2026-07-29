/**
 * Acesso centralizado ao cliente OpenAI.
 *
 * A IA e opcional: o projeto sobe e funciona sem OPENAI_API_KEY. As rotas que
 * dependem dela respondem 503 com uma mensagem clara em vez de estourar 500.
 */

import OpenAI from 'openai';

let client = null;

/** Indica se a integracao de IA esta configurada. */
export function isAIConfigured() {
    return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Retorna o cliente OpenAI (instancia unica).
 * Lanca um erro 503 tratado pelo Fastify quando a chave nao esta configurada.
 */
export function getOpenAI() {
    if (!isAIConfigured()) {
        const error = new Error(
            'Recurso de IA indisponivel: defina OPENAI_API_KEY no backend/.env para habilita-lo.'
        );
        error.statusCode = 503;
        error.code = 'AI_NOT_CONFIGURED';
        throw error;
    }

    if (!client) {
        client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return client;
}
