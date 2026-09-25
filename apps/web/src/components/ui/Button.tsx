import type { ButtonHTMLAttributes } from 'react';
import { buttonSounds, type Sfx } from '@/lib/sound';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` is the yellow button, `secondary` the blue one. */
  variant?: 'primary' | 'secondary';
  size?: 'normal' | 'small';
  /** Sound on click / mouse hover; `'none'` mutes it. Default: inherited, else the standard ones. */
  clickSound?: Sfx | 'none';
  hoverSound?: Sfx | 'none';
}

/**
 * The chunky game button (styles: `.btn` in styles/base.css). Click/hover sounds are added
 * globally by `installButtonSounds`; `clickSound` / `hoverSound` change them for this button.
 */
export function Button({
  variant = 'primary',
  size = 'normal',
  className,
  type = 'button',
  clickSound,
  hoverSound,
  ...rest
}: Props) {
  const classes = [
    'btn',
    variant === 'secondary' && 'secondary',
    size === 'small' && 'small',
    className,
  ];
  return (
    <button
      type={type}
      className={classes.filter(Boolean).join(' ')}
      {...buttonSounds({ click: clickSound, hover: hoverSound })}
      {...rest}
    />
  );
}
