import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {HashRouter} from 'react-router';
import {styled} from 'styled-components';

import {AppContextProvider} from './context/AppContextProvider';
import {ErrorBannerProvider} from './context/ErrorBannerProvider';
import {FrontContextProvider} from './context/FrontContextProvider';
import {AppRoutes} from './routes/AppRoutes';
import {GlobalStyles} from './styles/GlobalStyles';

const queryClient = new QueryClient();

const Root = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: #b7c86a;
`;

export function App() {
  return (
    <FrontContextProvider>
      <QueryClientProvider client={queryClient}>
        <AppContextProvider>
          <GlobalStyles />
          <HashRouter basename="">
            <Root>
              <ErrorBannerProvider>
                <AppRoutes />
              </ErrorBannerProvider>
            </Root>
          </HashRouter>
        </AppContextProvider>
      </QueryClientProvider>
    </FrontContextProvider>
  );
}
