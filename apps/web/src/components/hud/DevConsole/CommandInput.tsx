/** Keyboard-only input with history, schema hints, cycling completion and error spans. */
import { type ConsoleSuggestion } from '@xomdao/sdk';
import { type RefObject, useRef, useState, useSyncExternalStore } from 'react';
import {
  clearConsoleIssue,
  commandCompletion,
  consoleSnapshot,
  runCommand,
  subscribeConsole,
} from '@/lib/devConsole';
import { DEV_CONSOLE_KEYS as KEYS } from '@/lib/devConsoleKeys';
import { KeyHelp } from './KeyHelp';

export function CommandInput({
  input,
  onExit,
  onScroll,
}: {
  input: RefObject<HTMLInputElement | null>;
  onExit: () => void;
  onScroll: (direction: number) => void;
}) {
  const state = useSyncExternalStore(subscribeConsole, consoleSnapshot);
  const [line, setLine] = useState('');
  const [closed, setClosed] = useState(false);
  const [help, setHelp] = useState(false);
  const [running, setRunning] = useState(0);
  const currentLine = useRef(line);
  const submission = useRef(0);
  currentLine.current = line;
  const mirror = useRef<HTMLPreElement>(null);
  const historyIndex = useRef<number | null>(null);
  const draft = useRef('');
  const cycle = useRef<{ line: string; items: ConsoleSuggestion[]; index: number } | null>(null);
  const completion = commandCompletion(line);
  const suggestions = closed ? [] : (cycle.current?.items ?? completion.suggestions);
  const error = state.issue;
  const change = (value: string) => {
    clearConsoleIssue();
    currentLine.current = value;
    setLine(value);
    setClosed(false);
    cycle.current = null;
    historyIndex.current = null;
  };
  const usage = completion.usage;
  const parameter = completion.parameter;
  const highlight = parameter
    ? Math.max(usage.indexOf(`<${parameter}:`), usage.indexOf(`[${parameter}:`))
    : -1;
  const end =
    highlight < 0 ? -1 : usage.indexOf(usage[highlight] === '[' ? ']' : '>', highlight) + 1;
  return (
    <div className="dev-command">
      {help ? <KeyHelp /> : null}
      <div className="dev-command-usage">
        {highlight < 0 ? (
          usage
        ) : (
          <>
            {usage.slice(0, highlight)}
            <strong>{usage.slice(highlight, end)}</strong>
            {usage.slice(end)}
          </>
        )}
        {running ? ' · Đang chạy…' : ''}
      </div>
      {suggestions.length ? (
        <div className="dev-command-suggestions">
          {suggestions.slice(0, 7).map((suggestion, i) => (
            <span key={suggestion.value} className={cycle.current?.index === i ? 'selected' : ''}>
              {suggestion.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="dev-command-field">
        <span className="dev-command-prompt">›</span>
        <pre ref={mirror} className="dev-command-mirror" aria-hidden="true">
          {error ? (
            <>
              {line.slice(0, error.at)}
              <span className="dev-command-error-span">
                {line.slice(error.at, error.end ?? line.length) || ' '}
              </span>
              {line.slice(error.end ?? line.length)}
            </>
          ) : (
            line || ' '
          )}
        </pre>
        <input
          ref={input}
          value={line}
          aria-label="Lệnh dev"
          autoComplete="off"
          spellCheck={false}
          data-dev-console-input="true"
          onChange={(event) => change(event.target.value)}
          onBlur={onExit}
          onScroll={(event) => {
            if (mirror.current) mirror.current.scrollLeft = event.currentTarget.scrollLeft;
          }}
          onKeyUp={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.nativeEvent.isComposing) return;
            switch (event.code) {
              case KEYS.escape:
                event.preventDefault();
                if (!closed && suggestions.length) {
                  setClosed(true);
                  cycle.current = null;
                } else onExit();
                break;
              case KEYS.run: {
                event.preventDefault();
                if (!line.trim()) break;
                const submitted = line;
                const id = ++submission.current;
                change('');
                setRunning((count) => count + 1);
                void runCommand(line).then((result) => {
                  setRunning((count) => count - 1);
                  if (!result.ok) {
                    if (id === submission.current && !currentLine.current) {
                      currentLine.current = submitted;
                      setLine(submitted);
                    } else clearConsoleIssue();
                  }
                });
                break;
              }
              case KEYS.previous:
              case KEYS.next: {
                event.preventDefault();
                if (historyIndex.current === null) {
                  draft.current = line;
                  historyIndex.current = state.history.length;
                }
                historyIndex.current = Math.min(
                  state.history.length,
                  Math.max(0, historyIndex.current + (event.code === KEYS.previous ? -1 : 1)),
                );
                setLine(state.history[historyIndex.current] ?? draft.current);
                setClosed(false);
                cycle.current = null;
                break;
              }
              case KEYS.suggestion: {
                event.preventDefault();
                if (!cycle.current)
                  cycle.current = { line, items: completion.suggestions, index: -1 };
                const selected = cycle.current;
                if (!selected.items.length) break;
                selected.index =
                  selected.index < 0
                    ? event.shiftKey
                      ? selected.items.length - 1
                      : 0
                    : (selected.index + (event.shiftKey ? -1 : 1) + selected.items.length) %
                      selected.items.length;
                const suggestion = selected.items[selected.index]!;
                setLine(
                  selected.line.slice(0, suggestion.from) +
                    suggestion.value +
                    selected.line.slice(suggestion.to),
                );
                setClosed(false);
                break;
              }
              case KEYS.pageUp:
                event.preventDefault();
                onScroll(-1);
                break;
              case KEYS.pageDown:
                event.preventDefault();
                onScroll(1);
                break;
              case KEYS.help:
                if (event.shiftKey && !event.ctrlKey && !event.metaKey && !line) {
                  event.preventDefault();
                  setHelp(!help);
                }
                break;
            }
          }}
        />
      </div>
      {error ? <div className="dev-command-error">{error.message}</div> : null}
    </div>
  );
}
