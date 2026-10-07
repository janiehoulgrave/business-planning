import React, { useEffect, useState } from 'react';

// Two-step button: first click asks, second click confirms. Replaces confirm() pop-ups,
// which some embedded browsers block.
export const ConfirmButton: React.FC<{
  className?: string;
  confirmLabel: string;
  onConfirm: () => void;
  children: React.ReactNode;
}> = ({ className = '', confirmLabel, onConfirm, children }) => {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const t = window.setTimeout(() => setAsking(false), 5000);
    return () => window.clearTimeout(t);
  }, [asking]);
  return (
    <button
      type="button"
      className={`${className} ${asking ? '!text-amber font-medium' : ''}`}
      onClick={() => {
        if (asking) {
          setAsking(false);
          onConfirm();
        } else setAsking(true);
      }}
    >
      {asking ? confirmLabel : children}
    </button>
  );
};
