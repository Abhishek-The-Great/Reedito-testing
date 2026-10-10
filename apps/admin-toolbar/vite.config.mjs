/* eslint-env node */
import { publicAppViteConfig } from '@internal/cfg-vite-public-app';

export default publicAppViteConfig({
  packageRoot: import.meta.dirname,
  packageName: '@reedito/admin-toolbar',
  entry: 'src/index.js',
  framework: 'preact',
  svgr: false,
  libFormat: 'iife',
  libName: 'ReeditoAdminToolbar',
  sourcemap: false,
});
