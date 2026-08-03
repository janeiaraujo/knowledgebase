import js from '@eslint/js';
import globals from 'globals';

/**
 * Lint do backend.
 *
 * A intencao aqui nao e padronizar estilo - isso e gosto, e discutir aspas
 * simples em PR de contribuidor novo afasta mais do que ajuda. As regras
 * ligadas como erro sao as que apontam bug de verdade: variavel que nao
 * existe, valor atribuido e nunca usado, promise solta, case que vaza.
 */
export default [
    {
        ignores: ['node_modules/**', 'uploads/**', 'coverage/**']
    },

    js.configs.recommended,

    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.es2024
            }
        },
        rules: {
            // Bugs de verdade
            'no-undef': 'error',
            'no-unsafe-optional-chaining': 'error',
            'no-constant-binary-expression': 'error',
            'no-self-compare': 'error',
            'no-unmodified-loop-condition': 'error',
            'no-fallthrough': 'error',

            // require-atomic-updates fica DESLIGADA de proposito. Ela acusa
            // `request.currentUser = await ...` nos middlewares, mas o
            // `request` do Fastify e um objeto por requisicao e os
            // middlewares rodam em sequencia - a corrida que a regra descreve
            // nao existe aqui. Eram 22 acusacoes, todas do mesmo padrao, e
            // conviver com 22 falsos positivos e como se treina alguem a
            // ignorar o linter.
            'require-atomic-updates': 'off',

            // `catch (error) {}` engole a causa e foi exatamente o padrao que
            // escondeu o "Erro desconhecido" que custou horas de investigacao.
            'no-empty': ['error', { allowEmptyCatch: false }],

            // Variavel nao usada costuma ser resto de refatoracao - ou o
            // sintoma de um import que deixou de fazer sentido.
            //
            // Argumentos ficam de fora: a assinatura de handler do Fastify e
            // (request, reply), e boa parte das rotas so usa um dos dois.
            // Exigir prefixo _ em 200 assinaturas seria ruido sem ganho, e
            // ruido e como uma regra vira `eslint-disable` em todo lugar.
            'no-unused-vars': ['error', {
                args: 'none',
                caughtErrors: 'none',
                varsIgnorePattern: '^_',
                // `const { note, status, ...updates } = body` tira `status` do
                // resto de proposito, para ele nao ser aplicado junto. Sem
                // isto a regra acusaria, e "corrigir" removendo o campo
                // mudaria o comportamento da rota.
                ignoreRestSiblings: true
            }],

            // console fica liberado: o projeto usa em seeds e scripts, e o
            // logger do Fastify convive com isso sem prejuizo.
            'no-console': 'off'
        }
    },

    {
        // Testes usam o runner nativo do Node e podem ter helpers soltos.
        files: ['tests/**/*.js', 'scripts/**/*.js'],
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
        }
    }
];
