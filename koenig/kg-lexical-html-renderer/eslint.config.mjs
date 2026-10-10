import { fixupPluginRules } from '@eslint/compat';
import eslint from '@eslint/js';
import {defineConfig} from 'eslint/config';
import reeditoPlugin from 'eslint-plugin-ghost';
import tseslint from 'typescript-eslint';

export default defineConfig([
    {ignores: ['build/**']},
    {
        files: ['**/*.ts'],
        extends: [
            eslint.configs.recommended,
            tseslint.configs.recommended
        ],
        languageOptions: {
            parserOptions: {ecmaVersion: 2022, sourceType: 'module', tsconfigRootDir: import.meta.dirname}
        },
        plugins: {
            ghost: fixupPluginRules(reeditoPlugin),
            reedito: fixupPluginRules(reeditoPlugin)
        },
        rules: {
            ...reeditoPlugin.configs.ts.rules,
            '@typescript-eslint/no-explicit-any': 'error'
        }
    },
    {
        files: ['test/**/*.ts'],
        rules: {
            ...reeditoPlugin.configs['ts-test'].rules,
            'ghost/mocha/no-global-tests': 'off',
            'ghost/mocha/handle-done-callback': 'off',
            'ghost/mocha/no-mocha-arrows': 'off',
            'ghost/mocha/max-top-level-suites': 'off'
        }
    }
]);
