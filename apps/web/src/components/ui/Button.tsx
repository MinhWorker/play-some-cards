import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` is the yellow button, `secondary` the blue one. */
  variant?: 'primary' | 'secondary';
  size?: 'normal' | 'small';
}

/** The chunky game button (styles: `.btn` in styles/base.css). Click sounds are added globally. */
export function Button({
  variant = 'primary',
  size = 'normal',
  className,
  type = 'button',
  ...rest
}: Props) {
  const classes = [
    'btn',
    variant === 'secondary' && 'secondary',
    size === 'small' && 'small',
    className,
  ];
  return <button type={type} className={classes.filter(Boolean).join(' ')} {...rest} />;
}
