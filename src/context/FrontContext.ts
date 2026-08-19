import type {WebViewContext} from '@frontapp/plugin-sdk/dist/webViewSdkTypes';
import {createContext, useContext} from 'react';

import type {SnakeClient} from '../snakeClient';

interface FrontContextType {
  context: WebViewContext;
  conversationId: string | null;
  isAuthenticated: boolean;
  snakeClient: SnakeClient;
}

export const FrontContext = createContext<FrontContextType | null>(null);

export function useFrontContext() {
  const context = useContext(FrontContext);

  if (!context) {
    throw new Error('Front context not initialized');
  }

  return context;
}
