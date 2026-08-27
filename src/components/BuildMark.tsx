import {styled} from 'styled-components';

const Mark = styled.span`
  flex: 0 0 auto;
  font-size: 6px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.55;
  line-height: 1;
`;

export function BuildMark() {
  return <Mark title={`Build ${__APP_VERSION__}`}>{__APP_VERSION__}</Mark>;
}
