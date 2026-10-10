import { configDefaults, defineConfig } from 'vitest/config';
import type { PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { emberAssetsPlugin } from './vite-ember-assets';
import { reeditoBackendProxyPlugin } from './vite-backend-proxy';
import { sharedDefine, sharedResolve, testDefine } from './vite.shared';

export const REEDITO_URL = process.env.REEDITO_URL ?? 'http://localhost:2368/';

// Dev-only prefix Vite serves under. Keeps Vite's internals (HMR client,
// module graph, refresh runtime) off `/reedito/*` so Reedito's Express middleware
// owns user-facing admin URLs in both dev and prod.
export const DEV_BASE = '/__admin-dev__';

/**
 * Extracts the subdirectory path from REEDITO_URL.
 * e.g., "http://localhost:2368/blog/" -> "/blog"
 *       "http://localhost:2368/" -> ""
 */
export function getSubdir(): string {
  const url = new URL(REEDITO_URL);
  return url.pathname.replace(/\/$/, '');
}

function getBase(command: 'build' | 'serve'): string {
  if (process.env.REEDITO_CDN_URL) {
    return process.env.REEDITO_CDN_URL;
  }
  if (command === 'build') {
    return './';
  }
  return `${getSubdir()}${DEV_BASE}`;
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  base: getBase(command),
  plugins: [tailwindcss() as PluginOption, react(), emberAssetsPlugin(), reeditoBackendProxyPlugin()],
  define: mode === 'test' ? testDefine : sharedDefine,
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: true,
    // Vite 8 already forwards browser console warn/error to the terminal
    // when it detects an AI agent is driving the dev server, and stays
    // quiet for humans. Uncomment to force it on for everyone (noisier):
    // forwardConsole: { logLevels: ['warn', 'error'] }
  },
  optimizeDeps: {
    include: ['@reedito/koenig-lexical'],
  },
  resolve: sharedResolve,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-utils/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Acceptance and component tests run in a real browser via
    // vitest.acceptance.config.ts
    exclude: [
      ...configDefaults.exclude,
      'src/**/*.acceptance.test.tsx',
      'src/**/*.component.test.tsx',
    ],
  },
}));
