import {useNavigate, useParams} from 'react-router';

import {VersusSession} from '../components/VersusSession';
import {PATHS} from '../constants/paths';

export function Room() {
  const {roomId = ''} = useParams();
  const navigate = useNavigate();

  return (
    <VersusSession
      roomId={roomId}
      claimHost={false}
      onSolo={() => {
        void navigate(PATHS.home);
      }}
    />
  );
}
