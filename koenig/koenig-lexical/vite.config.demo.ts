import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import {defineConfig} from 'vite';
import {resolve, dirname} from 'path';
import {fileURLToPath} from 'url';
import {createRequire} from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// https://vitejs.dev/config/
export default (function viteDemoConfig() {
    return defineConfig({
        plugins: [
            svgr(),
            react()
        ],
        base: '/',
        define: {
            __APP_VERSION__: JSON.stringify('0.0.0')
        },
        resolve: {
            alias: {
                // required to prevent double-bundling of yjs due to cjs/esm mismatch
                // (see https://github.com/facebook/lexical/issues/2153)
                yjs: require.resolve('yjs/src/index.js')
            }
        },
        optimizeDeps: {
            include: [
                '@reedito/kg-clean-basic-html',
                '@reedito/kg-default-transforms',
                '@reedito/kg-markdown-html-renderer',
                '@reedito/kg-simplemde',
                '@reedito/kg-unsplash-selector'
            ]
        },
        build: {
            sourcemap: true,
            rolldownOptions: {
                input: {
                    main: resolve(__dirname, 'index.html')
                }
            }
        },
        test: {
            globals: true, // required for @testing-library/jest-dom extensions
            environment: 'jsdom',
            setupFiles: './test/test-setup.ts',
            include: ['./test/unit/*'],
            testTimeout: 10000,
            ...(process.env.CI && { // https://github.com/vitest-dev/vitest/issues/1674
                minThreads: 1,
                maxThreads: 2
            })
        }
    });
});
