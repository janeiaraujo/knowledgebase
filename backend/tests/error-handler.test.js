/**
 * Ordem do tratador global de erros.
 *
 * No Fastify, cada `register` cria um contexto encapsulado que herda o
 * tratador de erro existente **naquele momento**. Definir o tratador depois
 * de registrar as rotas nao gera aviso nenhum: ele simplesmente nunca e
 * chamado por elas, e o padrao do framework responde no lugar.
 *
 * Foi o que aconteceu aqui: o setErrorHandler estava depois de todos os
 * register, entao a correcao do "Erro desconhecido" (mandar a mensagem no
 * campo `error`, em vez de um booleano) ficou inerte para todas as rotas -
 * elas devolviam o corpo padrao do Fastify, com `"error": "Bad Request"` no
 * lugar da mensagem real.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';

const SERVER = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/server.js'
);

describe('tratador global de erros', () => {
    test('e definido antes do primeiro registro de rota', () => {
        const code = fs.readFileSync(SERVER, 'utf8');

        const posicaoTratador = code.indexOf('fastify.setErrorHandler(');
        const primeiroRegistroDeRota = code.search(/fastify\.register\(\w+Routes\b/);

        assert.notEqual(posicaoTratador, -1, 'o servidor precisa definir um tratador global');
        assert.notEqual(primeiroRegistroDeRota, -1, 'nao encontrei nenhum register de rota');

        assert.ok(
            posicaoTratador < primeiroRegistroDeRota,
            'setErrorHandler aparece DEPOIS do primeiro register de rota.\n' +
            'Nessa ordem ele nao alcanca nenhuma rota: o contexto de cada plugin\n' +
            'herda o tratador que existia quando foi criado, e o padrao do Fastify\n' +
            'responde no lugar - sem erro, sem aviso.'
        );
    });

    describe('por que a ordem importa (comprovacao)', () => {
        const montar = async (definirAntes) => {
            const app = Fastify();
            const tratador = (erro, request, reply) =>
                reply.status(erro.statusCode || 500).send({ error: erro.message, deQuem: 'projeto' });

            if (definirAntes) app.setErrorHandler(tratador);
            await app.register(async (instancia) => {
                instancia.get('/estoura', async () => { throw new Error('causa real'); });
            }, { prefix: '/api' });
            if (!definirAntes) app.setErrorHandler(tratador);

            await app.listen({ port: 0, host: '127.0.0.1' });
            const corpo = await fetch(`http://127.0.0.1:${app.server.address().port}/api/estoura`)
                .then(r => r.json());
            await app.close();
            return corpo;
        };

        test('definido ANTES: o tratador do projeto responde', async () => {
            const corpo = await montar(true);
            assert.equal(corpo.deQuem, 'projeto');
            assert.equal(corpo.error, 'causa real', 'a mensagem real precisa chegar ao cliente');
        });

        test('definido DEPOIS: quem responde e o padrao do Fastify', async () => {
            const corpo = await montar(false);
            assert.equal(corpo.deQuem, undefined, 'o tratador do projeto nao foi chamado');
            assert.equal(
                corpo.error,
                'Internal Server Error',
                'o padrao do Fastify poe um rotulo generico no campo `error` - ' +
                'e o frontend le justamente esse campo'
            );
        });
    });
});
