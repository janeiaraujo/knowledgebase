import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Lint do frontend.
 *
 * A regra que mais paga aqui e `react-hooks/rules-of-hooks`: ela teria pegado,
 * em segundos, o bug em que um componente auxiliar chamava t() sem declarar o
 * useTranslation - ReferenceError na tela, com o build passando. Custou uma
 * varredura manual de 43 arquivos descobrir isso na mao.
 *
 * Estilo continua fora do escopo: as regras ligadas apontam bug, nao gosto.
 */
export default [
    {
        ignores: ['node_modules/**', 'dist/**', 'coverage/**']
    },

    js.configs.recommended,

    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2024,
                // Injetado em tempo de build pelo `define` do vite.config.js
                __APP_VERSION__: 'readonly'
            },
            parserOptions: {
                ecmaFeatures: { jsx: true }
            }
        },
        settings: {
            react: { version: 'detect' }
        },
        plugins: {
            react,
            'react-hooks': reactHooks
        },
        rules: {
            // Hooks: a razao principal de existir este arquivo
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',

            // JSX que referencia componente inexistente ou variavel fora de
            // escopo - a familia de erro que so aparece ao renderizar
            'react/jsx-no-undef': 'error',
            'react/jsx-uses-vars': 'error',
            'react/jsx-uses-react': 'off',
            'react/jsx-key': 'error',
            'react/no-children-prop': 'error',

            // Bugs de JS
            'no-undef': 'error',
            'no-unsafe-optional-chaining': 'error',
            'no-constant-binary-expression': 'error',
            'no-self-compare': 'error',
            'no-empty': ['error', { allowEmptyCatch: false }],

            // Argumentos ficam de fora pelo mesmo motivo do backend: as
            // assinaturas de callback sao fixas e exigir _ so gera ruido.
            'no-unused-vars': ['error', {
                args: 'none',
                caughtErrors: 'none',
                // React fica de fora: o JSX runtime automatico do Vite
                // dispensa o import, mas ele aparece em 66 arquivos por
                // habito e tirar todos e faxina de outro PR.
                varsIgnorePattern: '^(_|React$)',
                ignoreRestSiblings: true
            }],

            'no-console': 'off'
        }
    },

    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: { ...globals.node }
        }
    },

    {
        // Testes de render rodam no Vitest, com globals habilitados.
        files: ['tests/render/**/*.{js,jsx}'],
        languageOptions: {
            globals: {
                ...globals.node,
                describe: 'readonly', it: 'readonly', expect: 'readonly',
                vi: 'readonly', beforeEach: 'readonly', afterEach: 'readonly'
            }
        }
    }
];
