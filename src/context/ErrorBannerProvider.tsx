import {type ReactNode, useCallback, useMemo, useState} from 'react';
import {styled} from 'styled-components';

import {getErrorMessage} from '../utils/errorUtils';
import {ErrorBannerContext, type ErrorBannerItem} from './ErrorBannerContext';

const Shell = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const Stack = styled.div`
  position: absolute;
  z-index: 1000;
  top: 12px;
  right: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
`;

const Card = styled.div`
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #f5c2c2;
  box-shadow: 0 8px 24px rgba(26, 18, 18, 0.12);
  color: #8a1f1f;
  font-size: 12px;
  line-height: 1.45;
`;

const Accent = styled.span`
  width: 4px;
  align-self: stretch;
  flex-shrink: 0;
  border-radius: 999px;
  background: #d64545;
`;

const Message = styled.p`
  margin: 0;
  flex: 1;
  min-width: 0;
`;

const Dismiss = styled.button`
  border: none;
  background: none;
  padding: 0 2px;
  color: #8a1f1f;
  font-size: 16px;
  line-height: 1;
  opacity: 0.65;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
  }
`;

let nextErrorId = 0;

export function ErrorBannerProvider({children}: {children: ReactNode}) {
  const [errors, setErrors] = useState<ErrorBannerItem[]>([]);

  const dismissError = useCallback((id: string) => {
    setErrors((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearError = useCallback(() => {
    setErrors([]);
  }, []);

  const showError = useCallback((error: unknown, fallback = 'Something went wrong.') => {
    const message = getErrorMessage(error, fallback);
    const id = `error-${++nextErrorId}`;
    setErrors((current) => [...current, {id, message}]);
  }, []);

  const value = useMemo(
    () => ({
      errors,
      showError,
      dismissError,
      clearError,
    }),
    [errors, showError, dismissError, clearError],
  );

  return (
    <ErrorBannerContext.Provider value={value}>
      <Shell>
        {errors.length > 0 ? (
          <Stack>
            {errors.map((item) => (
              <Card key={item.id} role="alert">
                <Accent aria-hidden />
                <Message>{item.message}</Message>
                <Dismiss type="button" aria-label="Dismiss error" onClick={() => { dismissError(item.id); }}>
                  ×
                </Dismiss>
              </Card>
            ))}
          </Stack>
        ) : null}
        {children}
      </Shell>
    </ErrorBannerContext.Provider>
  );
}
