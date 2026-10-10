import { fixupPluginRules } from '@eslint/compat';
import js from '@eslint/js';
import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import reeditoPlugin from 'eslint-plugin-ghost';
import reactPlugin from 'eslint-plugin-react';

import {
    correctnessRules,
    jsUnusedVarsRule,
    localFilenamesPlugin,
    mochaRulesOff,
    strictLinterOptions
} from '@internal/cfg-eslint';

// reedito/admin uses local-filenames/match-regex (workspace-scoped, blocks
// below) instead of reedito/filenames/match-regex (from correctnessRules) — turn
// that one off here. no-unused-private-class-members is workspace-specific
// (ESLint 9 added it to recommended; codebase has intentional placeholders).
const reeditoBaseRules = {
    ...correctnessRules,
    ...jsUnusedVarsRule,
    'reedito/filenames/match-regex': 'off',
    'no-unused-private-class-members': 'off'
};

const emberRules = {
    'reedito/sort-imports-es6-autofix/sort-imports-es6': ['error', {
        memberSyntaxSortOrder: ['none', 'all', 'single', 'multiple']
    }],
    // Components
    'reedito/ember/no-attrs-in-components': 'error',
    'reedito/ember/no-attrs-snapshot': 'error',
    'reedito/ember/no-on-calls-in-components': 'error',
    // Computed Properties
    'reedito/ember/no-arrow-function-computed-properties': 'error',
    'reedito/ember/no-computed-properties-in-native-classes': 'error',
    'reedito/ember/no-deeply-nested-dependent-keys-with-each': 'error',
    'reedito/ember/no-duplicate-dependent-keys': 'error',
    'reedito/ember/no-incorrect-computed-macros': 'error',
    'reedito/ember/no-invalid-dependent-keys': 'error',
    'reedito/ember/no-side-effects': 'error',
    'reedito/ember/no-volatile-computed-properties': 'error',
    'reedito/ember/require-computed-macros': 'error',
    'reedito/ember/require-return-from-computed': 'error',
    'reedito/ember/use-brace-expansion': 'error',
    // Controllers
    'reedito/ember/alias-model-in-controller': 'error',
    'reedito/ember/avoid-using-needs-in-controllers': 'error',
    // Deprecations
    'reedito/ember/closure-actions': 'error',
    'reedito/ember/new-module-imports': 'error',
    'reedito/ember/no-function-prototype-extensions': 'error',
    'reedito/ember/no-observers': 'error',
    'reedito/ember/no-old-shims': 'error',
    'reedito/ember/no-string-prototype-extensions': 'error',
    // Ember Data
    'reedito/ember/use-ember-data-rfc-395-imports': 'error',
    // Ember Object
    'reedito/ember/avoid-leaking-state-in-ember-objects': 'error',
    'reedito/ember/no-get-with-default': 'error',
    'reedito/ember/no-try-invoke': 'error',
    'reedito/ember/require-super-in-lifecycle-hooks': 'error',
    // Octane
    'reedito/ember/classic-decorator-hooks': 'error',
    'reedito/ember/classic-decorator-no-classic-methods': 'error',
    'reedito/ember/no-ember-super-in-es-classes': 'error',
    'reedito/ember/no-empty-glimmer-component-classes': 'error',
    // jQuery
    'reedito/ember/jquery-ember-run': 'error',
    'reedito/ember/no-global-jquery': 'error',
    // Misc
    'reedito/ember/no-incorrect-calls-with-inline-anonymous-functions': 'error',
    'reedito/ember/no-invalid-debug-function-arguments': 'error',
    'reedito/ember/require-fetch-import': 'error',
    // Routes
    'reedito/ember/no-capital-letters-in-routes': 'error',
    'reedito/ember/no-private-routing-service': 'error',
    'reedito/ember/no-shadow-route-definition': 'error',
    'reedito/ember/no-unnecessary-index-route': 'error',
    'reedito/ember/no-unnecessary-route-path-option': 'error',
    'reedito/ember/route-path-style': 'error',
    'reedito/ember/routes-segments-snake-case': 'error',
    // Services
    'reedito/ember/no-unnecessary-service-injection-argument': 'error',
    // Stylistic
    'reedito/ember/order-in-components': 'error',
    'reedito/ember/order-in-controllers': 'error',
    'reedito/ember/order-in-routes': 'error',
    // Testing
    'reedito/ember/no-ember-testing-in-module-scope': 'error',
    'reedito/ember/no-invalid-test-waiters': 'error',
    'reedito/ember/no-legacy-test-waiters': 'error',
    'reedito/ember/no-noop-setup-on-error-in-before': 'error',
    'reedito/ember/no-pause-test': 'error',
    'reedito/ember/no-replace-test-comments': 'error',
    'reedito/ember/no-restricted-resolver-tests': 'error',
    'reedito/ember/no-settled-after-test-helper': 'error',
    'reedito/ember/no-test-and-then': 'error',
    'reedito/ember/no-test-import-export': 'error',
    'reedito/ember/no-test-module-for': 'error',
    'reedito/ember/no-test-support-import': 'error',
    'reedito/ember/no-test-this-render': 'error',
    'reedito/ember/prefer-ember-test-helpers': 'error',
    'reedito/ember/require-valid-css-selector-in-test-helpers': 'error'
};

const mochaRulesOffForGhost = mochaRulesOff(reeditoPlugin);

export default [
    {
        ignores: [
            'dist/**',
            'tmp/**',
            'public/**',
            'config/**',
            'vendor/**',
            'node_modules/**'
        ]
    },
    {
        files: ['**/*'],
        ...strictLinterOptions
    },
    {
        files: ['**/*.js'],
        ...js.configs.recommended,
        languageOptions: {
            parser: babelParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                allowImportExportEverywhere: false,
                ecmaFeatures: {
                    globalReturn: false,
                    legacyDecorators: true,
                    jsx: true
                },
                requireConfigFile: false,
                babelOptions: {
                    plugins: [
                        '@babel/plugin-proposal-class-properties',
                        ['@babel/plugin-proposal-decorators', {legacy: true}],
                        'babel-plugin-transform-react-jsx'
                    ]
                }
            },
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        plugins: {
            reedito: fixupPluginRules(reeditoPlugin),
            react: reactPlugin,
            'local-filenames': localFilenamesPlugin
        },
        rules: {
            ...js.configs.recommended.rules,
            ...reeditoBaseRules,
            ...emberRules,
            'local-filenames/match-regex': ['error', '^[a-z0-9.-]+$', false],
            // Legacy reedito/admin overrides
            'reedito/ember/no-controller-access-in-routes': 'off',
            'reedito/ember/no-assignment-of-untracked-properties-used-in-tracking-contexts': 'off',
            'reedito/ember/no-actions-hash': 'off',
            'reedito/ember/no-classic-classes': 'off',
            'reedito/ember/no-classic-components': 'off',
            'reedito/ember/require-tagless-components': 'off',
            'reedito/ember/no-component-lifecycle-hooks': 'off',
            'reedito/ember/use-ember-get-and-set': 'off',
            'reedito/ember/no-mixins': 'off',
            'reedito/ember/no-new-mixins': 'off',
            'react/jsx-uses-react': 'error',
            'react/jsx-uses-vars': 'error'
        }
    },
    // Tests: mocha + embertest envs (sinon + should are legacy reedito/test globals)
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.mocha,
                ...globals.embertest,
                sinon: 'readonly',
                should: 'readonly'
            }
        },
        rules: {
            ...mochaRulesOffForGhost,
            'reedito/ember/no-invalid-debug-function-arguments': 'off',
            'reedito/mocha/no-setup-in-describe': 'off'
        }
    }
];
