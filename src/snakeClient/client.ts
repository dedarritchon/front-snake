import type {SnakeConfig} from './types';

/**
 * Root API client. Add domain sub-clients here (e.g. `meetings`, `employees`).
 * Each sub-client should extend `CommonClient` and call `this.get` / `this.post`
 * with absolute URLs (or relative paths if Front's relay is configured with a base).
 */
export class SnakeClient {
  constructor(_config: SnakeConfig) {
    // Example:
    // this.meetings = new MeetingsClient(config);
  }
}
