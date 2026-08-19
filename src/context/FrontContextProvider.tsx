import {contextUpdates} from '@frontapp/plugin-sdk';
import type {WebViewContext} from '@frontapp/plugin-sdk/dist/webViewSdkTypes';
import {ApplicationAuthenticationStatusesEnum} from '@frontapp/ui-bridge/dist/internal/contextTypesV2';
import {type ReactNode, useEffect, useMemo, useState} from 'react';

import {OutsideFront} from '../components/OutsideFront';
import {SnakeClient} from '../snakeClient';
import {FrontContext} from './FrontContext';

function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function FrontContextProvider({children}: {children: ReactNode}) {
  const [context, setContext] = useState<WebViewContext | null>(null);
  const [timedOut, setTimedOut] = useState(() => !isFramed());

  useEffect(() => {
    const sub = contextUpdates.subscribe((nextContext) => {
      setContext(nextContext);
    });

    if (isFramed()) {
      const timer = window.setTimeout(() => {
        setTimedOut(true);
      }, 2500);
      return () => {
        sub.unsubscribe();
        window.clearTimeout(timer);
      };
    }

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

    const isAuthenticated =
      context.authentication.status === ApplicationAuthenticationStatusesEnum.AUTHORIZED;

    return {
      context,
      conversationId: getConversationId(),
      isAuthenticated,
      snakeClient: new SnakeClient(),
    };
  }, [context]);

  if (value) {
    return <FrontContext.Provider value={value}>{children}</FrontContext.Provider>;
  }

  return <OutsideFront loading={!timedOut} />;
}
