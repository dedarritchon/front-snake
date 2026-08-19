import {Button} from '@frontapp/ui-kit';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';
import {styled} from 'styled-components';

import {PATHS} from '../../constants/paths';
import {useErrorBanner} from '../../context/ErrorBannerContext';
import {useFrontContext} from '../../context/FrontContext';
import {theme} from '../../styles/theme';

const Wrapper = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
`;

const Card = styled.div`
  border: 1px solid ${theme.colors.semantic.border.tertiary};
  border-radius: 10px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
`;

const Title = styled.h1`
  font-size: 20px;
  color: ${theme.colors.semantic.text.primary};
`;

const Description = styled.p`
  color: ${theme.colors.semantic.text.secondary};
  text-align: center;
  font-size: 14px;
  margin: 0;
`;

export default function SignIn() {
  const navigate = useNavigate();
  const {isAuthenticated, context} = useFrontContext();
  const {showError, clearError} = useErrorBanner();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      void navigate(PATHS.home);
    }
  }, [isAuthenticated, navigate]);

  const handleSignIn = async () => {
    clearError();
    setIsLoading(true);
    try {
      await context?.authenticate();
    } catch (error) {
      showError(error, 'Could not start authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Wrapper>
      <Card>
        <Title>Connect</Title>
        <Description>
          Optional auth demo. Failures appear in the shared error banner. Wrap real plugin routes with{' '}
          <code>ProtectedRoute</code> when you need credentials.
        </Description>
        <Button onClick={() => void handleSignIn()} type="primary" isDisabled={isLoading} isRounded={false}>
          {isLoading ? 'Connecting…' : 'Sign in'}
        </Button>
        <Button type="secondary" isRounded={false} onClick={() => void navigate(PATHS.home)}>
          Back to Home
        </Button>
      </Card>
    </Wrapper>
  );
}
