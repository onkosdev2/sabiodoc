import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../utils/cn'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  hint?: string
}

/** Checkbox con etiqueta accesible, usado por ejemplo en "Recordarme". */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, id, className, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="flex items-start gap-2">
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600',
          'focus:ring-2 focus:ring-primary-500/40',
          className,
        )}
        {...props}
      />
      <label htmlFor={inputId} className="select-none text-sm text-slate-600">
        {label}
        {hint && (
          <span id={`${inputId}-hint`} className="mt-0.5 block text-xs text-slate-500">
            {hint}
          </span>
        )}
      </label>
    </div>
  )
})

export default Checkbox
