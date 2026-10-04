/** Minimal keyboard-only console; the complete log and suggestion UI follows in step 5. */
import { useEffect, useRef, useState } from 'react';
import { request } from '@/lib/socket';
import './DevConsole.css';
export default function DevConsole() {
  const input = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const [output, setOutput] = useState('');
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        (event.target instanceof HTMLInputElement && event.target !== input.current)
      )
        return;
      if (event.ctrlKey && event.code === 'Slash') {
        event.preventDefault();
        setActive(true);
        requestAnimationFrame(() => input.current?.focus());
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div className="dev-console" hidden={!active}>
      <pre>{output}</pre>
      <input
        ref={input}
        aria-label="Lệnh dev"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.code === 'Escape') {
            setActive(false);
            input.current?.blur();
          }
          if (e.code === 'Enter') {
            const line = e.currentTarget.value;
            void request('dev:command', { line }).then(
              (r) => setOutput(r.output),
              (err: Error) => setOutput(err.message),
            );
            e.currentTarget.value = '';
          }
        }}
        onKeyUp={(e) => e.stopPropagation()}
      />
    </div>
  );
}
