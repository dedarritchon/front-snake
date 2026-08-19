import type {ReactNode} from 'react';
import {Navigate} from 'react-router';

import {PATHS} from '../constants/paths';
import {useFrontContext} from '../context/FrontContext';

/**
 * Optional auth gate. The template Home route is public; wrap vendor routes that
 * need Front application authentication before calling relayHttp.
 */
export function ProtectedRoute({children}: {children: ReactNode}) {
  const {isAuthenticated} = useFrontContext();

  if (!isAuthenticated) {
    return <Navigate to={PATHS.signIn} replace />;
  }

  return <>{children}</>;
}
