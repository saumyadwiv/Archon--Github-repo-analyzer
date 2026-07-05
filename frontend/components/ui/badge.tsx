import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors font-mono',
  {
    variants: {
      variant: {
        default: 'border-border-light bg-surface-2 text-foreground',
        brand: 'border-brand/30 bg-brand/15 text-brand-light',
        success: 'border-grade-a/30 bg-grade-a/15 text-grade-a',
        warning: 'border-grade-c/30 bg-grade-c/15 text-grade-c',
        danger: 'border-cycle/30 bg-cycle/15 text-cycle',
        outline: 'border-border-light text-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
