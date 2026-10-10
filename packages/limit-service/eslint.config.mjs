import { nodeLibConfig } from '@internal/cfg-eslint';

export default nodeLibConfig({
  extraTestRules: {
    // Tests throw plain errors to fail themselves and to check that unexpected ones
    // propagate. A Reedito error would be the wrong thing in both cases.
    'reedito/ghost-custom/no-native-error': 'off',
  },
});
