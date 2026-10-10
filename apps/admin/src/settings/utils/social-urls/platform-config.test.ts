import * as assert from 'assert/strict';
import {
  SOCIAL_PLATFORM_CONFIG_BY_KEY,
  normalizeSocialInput,
} from '@/settings/utils/social-urls/index';

describe('normalizeSocialInput', () => {
  it('returns empty display and null stored for empty input', () => {
    const result = normalizeSocialInput('linkedin', '');
    assert.equal(result.displayValue, '');
    assert.equal(result.storedValue, null);
  });

  it('produces a displayValue that round-trips through storage', () => {
    // The post-blur display must match what the field will show on reload,
    // which is toDisplayValue(storedValue). Otherwise the user sees one
    // value after blur and a different value after refresh.
    const cases: Array<{ key: Parameters<typeof normalizeSocialInput>[0]; input: string }> = [
      { key: 'linkedin', input: 'https://uk.linkedin.com/in/reedito-team' },
      { key: 'linkedin', input: 'linkedin.com/in/reedito-team' },
      { key: 'twitter', input: 'https://x.com/@reedito' },
      { key: 'facebook', input: 'facebook.com/reedito' },
      { key: 'mastodon', input: 'https://mastodon.social/@reedito' },
      { key: 'youtube', input: 'http://youtube.com/@reedito' },
    ];

    for (const { key, input } of cases) {
      const { displayValue, storedValue } = normalizeSocialInput(key, input);
      const expected = SOCIAL_PLATFORM_CONFIG_BY_KEY[key].toDisplayValue(storedValue);
      assert.equal(
        displayValue,
        expected,
        `displayValue should round-trip for ${key} input "${input}"`,
      );
    }
  });

  it('falls back to the raw stored value when a legacy handle fails validation', () => {
    // Stored handles can predate current validation rules (or the current
    // platform rules entirely). Display must never crash the settings UI —
    // the raw value is shown and validation flags it when the user edits.
    const { toDisplayValue } = SOCIAL_PLATFORM_CONFIG_BY_KEY.twitter;
    assert.equal(toDisplayValue('not a valid handle!!'), 'not a valid handle!!');
    assert.equal(toDisplayValue('@reedito'), 'https://x.com/reedito');
  });

  it('strips the regional subdomain from LinkedIn display because it is not in storage', () => {
    // `uk.linkedin.com` is a valid input, but the stored handle drops the
    // regional prefix. The displayed value after blur should reflect what
    // will be displayed on reload — `www.linkedin.com`, not `uk.`.
    const { displayValue, storedValue } = normalizeSocialInput(
      'linkedin',
      'https://uk.linkedin.com/in/reedito-team',
    );
    assert.equal(storedValue, 'reedito-team');
    assert.equal(displayValue, 'https://www.linkedin.com/in/reedito-team');
  });
});
