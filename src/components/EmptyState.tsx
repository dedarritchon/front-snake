import {styled} from 'styled-components';

import {theme} from '../styles/theme';

const Wrapper = styled.div`
  border: 1px dashed ${theme.colors.semantic.border.tertiary};
  border-radius: 8px;
  padding: 16px;
  color: ${theme.colors.semantic.text.secondary};
  font-size: 13px;
`;

export function EmptyState({message}: {message: string}) {
  return <Wrapper>{message}</Wrapper>;
}
