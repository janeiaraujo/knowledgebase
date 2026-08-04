/**
 * Log que so aparece em desenvolvimento.
 *
 * O ciclo de vida do WebSocket (conectou, fechou, reconectando em Nms) e util
 * quando se esta depurando notificacao em tempo real, e so ruido no console de
 * quem esta usando a plataforma. Apagar as chamadas resolveria o ruido e
 * perderia a informacao; este guarda mantem as duas coisas.
 *
 * `import.meta.env.DEV` e substituido em tempo de build pelo Vite, entao em
 * producao o corpo destas funcoes some do bundle junto com as chamadas.
 */

const emDesenvolvimento = import.meta.env.DEV;

export const debug = (...args) => {
    if (emDesenvolvimento) console.log(...args);
};

export const debugWarn = (...args) => {
    if (emDesenvolvimento) console.warn(...args);
};
