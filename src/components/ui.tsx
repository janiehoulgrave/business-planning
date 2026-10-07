import React from 'react';

type Variant = 'primary' | 'secondary' | 'quiet';

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' }
> = ({ variant = 'primary', size = 'md', className = '', children, ...rest }) => {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-colors disabled:cursor-not-allowed';
  const sizes = size === 'lg' ? 'h-14 px-8 text-[17px]' : 'h-11 px-6 text-[15px]';
  const variants: Record<Variant, string> = {
    primary: 'bg-ink text-paper hover:bg-[#2a2f36] disabled:bg-[#b9c0c8]',
    secondary: 'bg-paper text-ink border border-ink hover:bg-mist disabled:opacity-50',
    quiet: 'text-slate hover:text-ink px-3 disabled:opacity-40',
  };
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
};

export const Panel: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`bg-paper rounded-2xl border border-line ${className}`}>{children}</div>
);

export const Label: React.FC<{ htmlFor?: string; children: React.ReactNode; hint?: string }> = ({ htmlFor, children, hint }) => (
  <label htmlFor={htmlFor} className="block mb-2">
    <span className="text-[15px] font-medium">{children}</span>
    {hint && <span className="block text-[13px] text-slate mt-0.5">{hint}</span>}
  </label>
);

export const inputClass =
  'w-full h-12 px-4 rounded-xl border border-line bg-paper text-[17px] outline-none transition-colors focus:border-blue focus:ring-2 focus:ring-blue/15';
