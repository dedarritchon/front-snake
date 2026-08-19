import type {ApplicationRecipient} from '@frontapp/plugin-sdk';
import {createContext, useContext} from 'react';

export interface AppContextType {
  frontRecipients: readonly ApplicationRecipient[] | null;
  selectedFrontRecipient: ApplicationRecipient | null;
  selectedRecipientEmail: string;
  setSelectedFrontRecipient: (recipient: ApplicationRecipient | null) => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('App context not initialized');
  }

  return context;
}
