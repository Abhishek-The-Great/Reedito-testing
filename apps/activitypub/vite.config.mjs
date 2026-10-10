import adminXViteConfig from '@reedito/admin-x-framework/vite';
import pkg from './package.json';
import { resolve } from 'path';
import fs from 'fs';

const REEDITO_CARDS_PATH = resolve(__dirname, '../../reedito/core/core/frontend/src/cards');

const validateCardsDirectoryPlugin = (cardsPath) => {
  return {
    name: 'validate-cards-directory',
    buildStart() {
      const jsPath = resolve(cardsPath, 'js');
      const cssPath = resolve(cardsPath, 'css');

      if (!fs.existsSync(cardsPath)) {
        throw new Error(`Reedito cards directory not found at: ${cardsPath}`);
      }

      if (!fs.existsSync(jsPath)) {
        throw new Error(`Reedito cards JS directory not found at: ${jsPath}`);
      }

      if (!fs.existsSync(cssPath)) {
        throw new Error(`Reedito cards CSS directory not found at: ${cssPath}`);
      }

      const jsFiles = fs.readdirSync(jsPath).filter((f) => f.endsWith('.js'));
      const cssFiles = fs.readdirSync(cssPath).filter((f) => f.endsWith('.css'));

      if (jsFiles.length === 0) {
        throw new Error(`No JavaScript files found in Reedito cards directory: ${jsPath}`);
      }

      if (cssFiles.length === 0) {
        throw new Error(`No CSS files found in Reedito cards directory: ${cssPath}`);
      }

      console.log(
        `✓ Found ${jsFiles.length} JS and ${cssFiles.length} CSS card files at: ${cardsPath}`,
      );
    },
  };
};

export default (function viteConfig() {
  const config = adminXViteConfig({
    packageName: pkg.name,
    entry: resolve(__dirname, 'src/index.tsx'),
    overrides: {
      test: {
        include: ['./test/unit/**/*', './src/**/*.test.ts'],
      },
      resolve: {
        alias: {
          '@src': resolve(__dirname, './src'),
          '@assets': resolve(__dirname, './src/assets'),
          '@components': resolve(__dirname, './src/components'),
          '@hooks': resolve(__dirname, './src/hooks'),
          '@utils': resolve(__dirname, './src/utils'),
          '@views': resolve(__dirname, './src/views'),
          '@reedito-cards': REEDITO_CARDS_PATH,
        },
      },
      plugins: [validateCardsDirectoryPlugin(REEDITO_CARDS_PATH)],
    },
  });

  return config;
});
