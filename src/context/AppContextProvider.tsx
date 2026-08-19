import type {ApplicationRecipient} from '@frontapp/plugin-sdk';
import {type ReactNode, useEffect, useMemo, useState} from 'react';

import {getRecipientEmails, getRecipientsDefaultSelection} from '../utils/frontUtils';
import {AppContext} from './AppContext';
import {useFrontContext} from './FrontContext';

export function AppContextProvider({children}: {children: ReactNode}) {
  const {context, conversationId} = useFrontContext();

  const [frontRecipients, setFrontRecipients] = useState<readonly ApplicationRecipient[] | null>(null);
  const [selectedFrontRecipient, setSelectedFrontRecipient] = useState<ApplicationRecipient | null>(null);

  useEffect(() => {
    setFrontRecipients(null);
    setSelectedFrontRecipient(null);

    if (!context) {
      setFrontRecipients([]);
      return;
    }

    switch (context.type) {
      case 'message':
      case 'messageComposer':
      case 'multiConversations':
      case 'noConversation':
      case 'noConversationPopover':
        setFrontRecipients([]);
        return;
    }

    context
      .listRecipients()
      .then(({results}) => {
        setFrontRecipients(results);
        setSelectedFrontRecipient(getRecipientsDefaultSelection(results, context));
      })
      .catch(() => {
        setFrontRecipients([]);
      });
  }, [context, conversationId]);

  const selectedRecipientEmail = useMemo(() => {
    return getRecipientEmails(selectedFrontRecipient)[0] ?? '';
  }, [selectedFrontRecipient]);

  return (
    <AppContext.Provider
      value={{
        frontRecipients,
        selectedFrontRecipient,
        selectedRecipientEmail,
        setSelectedFrontRecipient,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
