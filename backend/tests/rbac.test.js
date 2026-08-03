/**
 * RBAC: quem pode o que.
 *
 * Vale a pena travar isso em teste porque a matriz de permissoes e um
 * lugar onde um "so mais um papel aqui" silencioso abre acesso indevido -
 * e nada no build acusaria.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission } from '../src/middlewares/rbac.middleware.js';

describe('hasPermission', () => {
    test('owner acumula as permissoes dos demais papeis', () => {
        for (const permission of ['kb:create', 'kb:delete', 'kb:approve', 'incident:create', 'ai:use']) {
            assert.equal(hasPermission('owner', permission), true, `owner deveria ter ${permission}`);
        }
    });

    test('viewer so le - nao cria, edita nem apaga', () => {
        assert.equal(hasPermission('viewer', 'kb:read'), true);

        for (const permission of ['kb:create', 'kb:edit', 'kb:delete', 'incident:create', 'file:upload']) {
            assert.equal(hasPermission('viewer', permission), false, `viewer nao deveria ter ${permission}`);
        }
    });

    test('member cria e edita, mas nao apaga nem aprova', () => {
        assert.equal(hasPermission('member', 'kb:create'), true);
        assert.equal(hasPermission('member', 'kb:edit'), true);

        // Separacao de funcoes: quem escreve nao aprova nem remove
        assert.equal(hasPermission('member', 'kb:delete'), false);
        assert.equal(hasPermission('member', 'kb:approve'), false);
        assert.equal(hasPermission('member', 'kb:publish'), false);
    });

    test('so o owner mexe em billing', () => {
        assert.equal(hasPermission('owner', 'billing:manage'), true);
        assert.equal(hasPermission('admin', 'billing:manage'), false);
        assert.equal(hasPermission('member', 'billing:manage'), false);
    });

    test('permissao desconhecida nega por padrao', () => {
        // Importante: um typo no nome da permissao precisa NEGAR, nao liberar
        assert.equal(hasPermission('owner', 'kb:destroy-everything'), false);
        assert.equal(hasPermission('owner', ''), false);
    });

    test('papel invalido ou ausente nao recebe permissao', () => {
        assert.equal(hasPermission('superuser', 'kb:read'), false);
        assert.equal(hasPermission(undefined, 'kb:read'), false);
        assert.equal(hasPermission(null, 'kb:read'), false);
    });
});
