import type { ReactNode } from "react";
import {
  compactInputClassName,
  compactTextareaClassName,
  inputClassName,
  labelClassName,
  textareaClassName,
} from "./form-styles";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children?: ReactNode;
};

export function FormField({ label, htmlFor, hint, className, children }: FormFieldProps) {
  return (
    <label className={`block ${className ?? ""}`} htmlFor={htmlFor}>
      <span className={labelClassName}>{label}</span>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
}

type FormSectionProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description ? <div className="mt-1 text-xs text-slate-500">{description}</div> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export { compactInputClassName, compactTextareaClassName, inputClassName, textareaClassName };