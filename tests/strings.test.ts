import { describe, expect, it } from 'vitest';
import { strings } from '../src/strings';

describe('strings', () => {
  it('has an app title', () => {
    expect(strings.appTitle).not.toBe('');
  });
});
