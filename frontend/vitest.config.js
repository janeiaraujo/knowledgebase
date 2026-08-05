import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

/**
 * Herda o vite.config para os testes de render enxergarem o mesmo que a
 * aplicacao: JSX, CSS, e o `define` que injeta __APP_VERSION__. Sem isso o
 * Sidebar quebraria no teste por um motivo que nao existe em producao.
 */
export default mergeConfig(viteConfig, defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/render/setup.js'],
        // Os testes de i18n rodam no node:test (npm run test:i18n) porque nao
        // precisam de DOM. Aqui ficam so os de render.
        include: ['tests/render/**/*.test.jsx']
    }
}));
