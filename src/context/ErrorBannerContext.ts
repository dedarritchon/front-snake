import {createContext, useContext} from 'react';

export interface ErrorBannerItem {
  id: string;
  message: string;
}

export interface ErrorBannerContextType {
  errors: readonly ErrorBannerItem[];
  showError: (error: unknown, fallback?: string) => void;
  dismissError: (id: string) => void;
  clearError: () => void;
}

export const ErrorBannerContext = createContext<ErrorBannerContextType | null>(null);

export function useErrorBanner() {
  const context = useContext(ErrorBannerContext);

  if (!context) {
    throw new Error('ErrorBannerProvider is not mounted');
  }

  return context;
}
