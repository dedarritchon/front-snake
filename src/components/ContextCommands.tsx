import {Button} from '@frontapp/ui-kit';
import {useMemo, useState} from 'react';
import {styled} from 'styled-components';

import {useErrorBanner} from '../context/ErrorBannerContext';
import {useFrontContext} from '../context/FrontContext';
import {theme} from '../styles/theme';
import {listAvailableContextCommands, runContextCommand} from '../utils/contextCommands';

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid ${theme.colors.semantic.border.tertiary};
  border-radius: 8px;
  background: #fff;
`;

const SectionLabel = styled.h2`
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${theme.colors.semantic.text.secondary};
`;

const Hint = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${theme.colors.semantic.text.secondary};
`;

const CommandList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 260px;
  overflow: auto;
  padding-right: 2px;
`;

const CommandRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid ${theme.colors.semantic.border.tertiary};
  border-radius: 8px;
`;

const CommandHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const CommandName = styled.code`
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.semantic.text.primary};
`;

const Meta = styled.span`
  font-size: 11px;
  color: ${theme.colors.semantic.text.secondary};
`;

const ResultPanel = styled.pre`
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #15131b;
  color: #f4f1ea;
  font-size: 11px;
  line-height: 1.4;
  overflow: auto;
  max-height: 220px;
  white-space: pre-wrap;
  word-break: break-word;
`;

const ResultHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

function stringifyResult(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

export function ContextCommands() {
  const {context} = useFrontContext();
  const {showError, clearError} = useErrorBanner();
  const [runningName, setRunningName] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{name: string; body: string} | null>(null);

  const commands = useMemo(
    () => (context ? listAvailableContextCommands(context) : []),
    [context],
  );

  const handleRun = async (name: string) => {
    if (!context) {
      return;
    }
    clearError();
    setRunningName(name);
    try {
      const result = await runContextCommand(context, name);
      setLastResult({name, body: stringifyResult(result)});
    } catch (error) {
      showError(error, `Command ${name} failed.`);
      setLastResult({
        name,
        body: stringifyResult({error: error instanceof Error ? error.message : error}),
      });
    } finally {
      setRunningName(null);
    }
  };

  return (
    <Section>
      <SectionLabel>Context commands</SectionLabel>
      <Hint>
        From <code>context.functionArities</code> for type{' '}
        <code>{context?.type ?? 'guest'}</code>. Click to call and inspect the
        result.
      </Hint>

      {commands.length === 0 ? <Hint>No functions advertised on this context.</Hint> : null}

      <CommandList>
        {commands.map((command) => (
          <CommandRow key={command.name}>
            <CommandHeader>
              <CommandName>{command.name}()</CommandName>
              <Button
                type="secondary"
                isRounded={false}
                isDisabled={!command.hasDemo || runningName !== null}
                onClick={() => void handleRun(command.name)}
              >
                {runningName === command.name ? 'Running…' : 'Run'}
              </Button>
            </CommandHeader>
            <Meta>
              arity {command.arity}
              {command.hasDemo ? '' : ' · unavailable in demo'}
              {' · '}
              {command.hint}
            </Meta>
          </CommandRow>
        ))}
      </CommandList>

      {lastResult ? (
        <>
          <ResultHeader>
            <SectionLabel>Last result · {lastResult.name}()</SectionLabel>
            <Button type="secondary" isRounded={false} onClick={() => { setLastResult(null); }}>
              Clear
            </Button>
          </ResultHeader>
          <ResultPanel>{lastResult.body}</ResultPanel>
        </>
      ) : null}
    </Section>
  );
}
