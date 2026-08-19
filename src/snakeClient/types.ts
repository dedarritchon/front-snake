import type {HttpResponse as FrontHttpResponse} from '@frontapp/plugin-sdk';
import type {ApplicationCancelToken} from '@frontapp/ui-bridge/dist/internal/asyncTypesV2';
import type {HttpRelayRequest} from '@frontapp/ui-bridge/dist/internal/relayTypesV2';

export interface SnakeConfig {
  relay: (request: HttpRelayRequest, cancelToken?: ApplicationCancelToken) => Promise<FrontHttpResponse>;
}
