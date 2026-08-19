import {Route, Routes} from 'react-router';

import {PATHS} from '../constants/paths';
import {Home} from '../pages/Home';

export function AppRoutes() {
  return (
    <Routes>
      <Route path={PATHS.home} element={<Home />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
