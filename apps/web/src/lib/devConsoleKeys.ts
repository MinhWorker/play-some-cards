/** Physical-key shortcuts; forms and IME composition keep their normal keyboard behavior. */
export const DEV_CONSOLE_KEYS = {
  toggle: 'Backquote',
  focus: 'Slash',
  escape: 'Escape',
  run: 'Enter',
  previous: 'ArrowUp',
  next: 'ArrowDown',
  suggestion: 'Tab',
  pageUp: 'PageUp',
  pageDown: 'PageDown',
  help: 'Slash',
} as const;
export function installConsoleKeys(
  toggle: () => void,
  focus: () => void,
  input: () => HTMLInputElement | null,
) {
  const key = (event: KeyboardEvent) => {
    if (event.isComposing || !event.ctrlKey || event.altKey || event.metaKey || event.shiftKey)
      return;
    const target = event.target;
    if (
      target instanceof Element &&
      target !== input() &&
      target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')
    )
      return;
    const action =
      event.code === DEV_CONSOLE_KEYS.toggle
        ? toggle
        : event.code === DEV_CONSOLE_KEYS.focus
          ? focus
          : null;
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      action();
    }
  };
  window.addEventListener('keydown', key, true);
  return () => window.removeEventListener('keydown', key, true);
}
