import {HttpVerbsEnum} from '@frontapp/ui-bridge/dist/internal/httpTypesV2';
import type {HttpRelayRequest} from '@frontapp/ui-bridge/dist/internal/relayTypesV2';

import {SnakeAPIError} from '../../utils/errorUtils';
import type {SnakeConfig} from '../types';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
} as const;

export abstract class CommonClient {
  protected config: SnakeConfig;

  constructor(config: SnakeConfig) {
    this.config = config;
  }

  private async makeRequest<T = unknown>(request: Omit<HttpRelayRequest, 'url'> & {url: string}): Promise<T> {
    const response = await this.config.relay(request);

    if (response.status >= 400) {
      throw new SnakeAPIError(`Snake API Error: ${request.verb} ${request.url} returned ${response.status}`, {
        method: request.verb,
        url: request.url,
        status: response.status,
        responseBody: response.body,
      });
    }

    return response.body as T;
  }

  protected async get<T = unknown>(path: string): Promise<T> {
    return this.makeRequest<T>({
      verb: HttpVerbsEnum.GET,
      url: path,
      headers: DEFAULT_HEADERS,
    });
  }

  protected async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.makeRequest<T>({
      verb: HttpVerbsEnum.POST,
      url: path,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(body),
    });
  }
}
