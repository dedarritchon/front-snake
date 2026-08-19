import {contextUpdates} from '@frontapp/plugin-sdk';
import type {WebViewContext} from '@frontapp/plugin-sdk/dist/webViewSdkTypes';
import {ApplicationAuthenticationStatusesEnum} from '@frontapp/ui-bridge/dist/internal/contextTypesV2';
import {type ReactNode, useEffect, useMemo, useState} from 'react';

import {SnakeClient} from '../snakeClient';
import {FrontContext} from './FrontContext';

export function FrontContextProvider({children}: {children: ReactNode}) {
  const [context, setContext] = useState<WebViewContext | null>(null);

  useEffect(() => {
    const sub = contextUpdates.subscribe((nextContext) => {
      setContext(nextContext);
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  const value = useMemo(() => {
    if (!context) {
      return null;
    }

    const getConversationId = (): string | null => {
      switch (context.type) {
        case 'singleConversation':
        case 'singleConversationPopover':
          return context.conversation.id;
        case 'multiConversations':
        case 'noConversation':
        case 'noConversationPopover':
        case 'message':
        case 'messageComposer':
          return null;
      }
    };

    const isAuthenticated = context.authentication.status === ApplicationAuthenticationStatusesEnum.AUTHORIZED;

    const snakeClient = new SnakeClient();

    return {
      context,
      conversationId: getConversationId(),
      isAuthenticated,
      snakeClient,
    };
  }, [context]);

  if (!value) {
    return <div>Initializing Front context...</div>;
  }

  return <FrontContext.Provider value={value}>{children}</FrontContext.Provider>;
}
