import type { Button } from '@psc/sdk/client';

/** The chess set's lacquer and ivory nine-slice buttons. */
export const PRIMARY_BUTTON = { image: 'button', slice: 32, size: 28 } as const;
export const SECONDARY_BUTTON = { image: 'button-secondary', slice: 32, size: 28 } as const;

export function styleButton(button: Button, primary = false) {
  button.label
    .setColor(primary ? '#fff4df' : '#32251b')
    .setStroke(primary ? '#102331' : '#32251b', primary ? 1 : 0)
    .setFontStyle('700');
  // A container's original hit area does not follow setSize. Keep it within the rendered face.
  const resize = button.setSize;
  button.setSize = (width, height) => {
    resize(width, height);
    button.container.input?.hitArea.setTo(0, 0, width, height);
    return button;
  };
  return button;
}
