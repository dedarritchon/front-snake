import {describe, expect, it} from 'vitest';

import {
  getErrorMessage,
  isFrontNoCredentialsError,
  isSnakeAPIError,
  SnakeAPIError,
} from './errorUtils';

describe('errorUtils', () => {
  it('detects SnakeAPIError even as a duck-typed object', () => {
    const error = new SnakeAPIError('nope', {
      method: 'GET',
      url: '/x',
      status: 500,
      responseBody: null,
    });
    expect(isSnakeAPIError(error)).toBe(true);
    expect(
      isSnakeAPIError({
        name: 'SnakeAPIError',
        context: {status: 404, method: 'GET', url: '/', responseBody: null},
      }),
    ).toBe(true);
    expect(isSnakeAPIError(new Error('nope'))).toBe(false);
  });

  it('spots Front logout 404s', () => {
    const body = {
      name: 'FrontError',
      status: 'not_found',
      reason: 'No credentials exist for server',
    };
    expect(isFrontNoCredentialsError(body)).toBe(true);
    expect(
      isFrontNoCredentialsError(
        new SnakeAPIError('missing', {
          method: 'GET',
          url: '/',
          status: 404,
          responseBody: body,
        }),
      ),
    ).toBe(true);
    expect(
      isFrontNoCredentialsError(
        new SnakeAPIError('nope', {
          method: 'GET',
          url: '/',
          status: 500,
          responseBody: body,
        }),
      ),
    ).toBe(false);
  });

  it('unwraps display messages', () => {
    expect(getErrorMessage('  boom  ')).toBe('boom');
    expect(getErrorMessage(new Error('Error: Error: hid'))).toBe('hid');
    expect(getErrorMessage({reason: 'relay down'})).toBe('relay down');
    expect(getErrorMessage(null)).toBe('Something went wrong.');
  });
});
