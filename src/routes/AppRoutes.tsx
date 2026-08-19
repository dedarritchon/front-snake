import {Route, Routes} from 'react-router';

import {PATHS} from '../constants/paths';
import {Home} from '../pages/Home';
import {MusicSelector} from '../pages/MusicSelector';
import {Room} from '../pages/Room';

export function AppRoutes() {
  return (
    <Routes>
      <Route path={PATHS.musicSelector} element={<MusicSelector />} />
      <Route path={PATHS.room} element={<Room />} />
      <Route path={PATHS.home} element={<Home />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
