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

function fromFront(context: WebViewContext) {
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

  return {
    context,
    guest: false,
    conversationId: getConversationId(),
    isAuthenticated:
      context.authentication.status === ApplicationAuthenticationStatusesEnum.AUTHORIZED,
    snakeClient: new SnakeClient(),
  };
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
    if (context) {
      return fromFront(context);
    }
    if (!timedOut) {
      return null;
    }
    return {
      context: null,
      guest: true,
      conversationId: null,
      isAuthenticated: false,
      snakeClient: new SnakeClient(),
    };
  }, [context, timedOut]);

  if (!value) {
    return <OutsideFront loading />;
  }

  return <FrontContext.Provider value={value}>{children}</FrontContext.Provider>;
}
