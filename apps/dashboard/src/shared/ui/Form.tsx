import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import "./Form.css";

type FormFieldContextValue = {
  controlId: string;
  disabled: boolean;
  errorId: string;
  hasError: boolean;
  hasHint: boolean;
  hintId: string;
  invalid: boolean;
  loading: boolean;
  readOnly: boolean;
  required: boolean;
  setHasError: (value: boolean) => void;
  setHasHint: (value: boolean) => void;
};

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

export type FormFieldProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  controlId?: string;
  disabled?: boolean;
  invalid?: boolean;
  loading?: boolean;
  readOnly?: boolean;
  required?: boolean;
};

export type FormLabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
};

export type FormControlProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
  loading?: boolean;
  readOnly?: boolean;
};

export type FormHintProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

export type FormErrorProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

type FieldControlStateProps = {
  invalid?: boolean;
  loading?: boolean;
  readOnly?: boolean;
};

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> &
  FieldControlStateProps;

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldControlStateProps;

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldControlStateProps;

function getFormId(id: string) {
  return `yoro-form-${id.replace(/:/g, "")}`;
}

function getClassName(baseClassName: string, className?: string) {
  return [baseClassName, className].filter(Boolean).join(" ");
}

function mergeDescribedBy(...ids: Array<string | undefined>) {
  const describedBy = ids.filter(Boolean).join(" ");
  return describedBy.length > 0 ? describedBy : undefined;
}

function getFieldDescribedBy({
  context,
  invalid,
  describedBy,
}: {
  context: FormFieldContextValue | null;
  invalid: boolean;
  describedBy?: string;
}) {
  return mergeDescribedBy(
    describedBy,
    context?.hasHint ? context.hintId : undefined,
    invalid && context?.hasError ? context.errorId : undefined,
  );
}

function useFieldControlState({
  describedBy,
  disabled,
  id,
  invalid,
  loading,
  readOnly,
}: {
  describedBy?: string;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  loading?: boolean;
  readOnly?: boolean;
}) {
  const context = useContext(FormFieldContext);
  const resolvedInvalid = invalid ?? context?.invalid ?? false;
  const resolvedLoading = loading ?? context?.loading ?? false;
  const resolvedDisabled = disabled ?? context?.disabled ?? false;
  const resolvedReadOnly = readOnly ?? context?.readOnly ?? false;

  return {
    describedBy: getFieldDescribedBy({
      context,
      describedBy,
      invalid: resolvedInvalid,
    }),
    disabled: resolvedDisabled,
    id: id ?? context?.controlId,
    invalid: resolvedInvalid,
    loading: resolvedLoading,
    readOnly: resolvedReadOnly,
    required: context?.required,
  };
}

export function FormField({
  children,
  className,
  controlId,
  disabled = false,
  id,
  invalid = false,
  loading = false,
  readOnly = false,
  required = false,
  ...props
}: FormFieldProps) {
  const reactId = useId();
  const fieldId = id ?? getFormId(reactId);
  const resolvedControlId = controlId ?? `${fieldId}-control`;
  const [hasHint, setHasHint] = useState(false);
  const [hasError, setHasError] = useState(false);
  const updateHasHint = useCallback((value: boolean) => setHasHint(value), []);
  const updateHasError = useCallback((value: boolean) => setHasError(value), []);
  const contextValue = useMemo<FormFieldContextValue>(
    () => ({
      controlId: resolvedControlId,
      disabled,
      errorId: `${fieldId}-error`,
      hasError,
      hasHint,
      hintId: `${fieldId}-hint`,
      invalid,
      loading,
      readOnly,
      required,
      setHasError: updateHasError,
      setHasHint: updateHasHint,
    }),
    [
      disabled,
      fieldId,
      hasError,
      hasHint,
      invalid,
      loading,
      readOnly,
      required,
      resolvedControlId,
      updateHasError,
      updateHasHint,
    ],
  );

  return (
    <FormFieldContext.Provider value={contextValue}>
      <div
        {...props}
        aria-busy={loading ? true : undefined}
        className={getClassName("yoro-form-field", className)}
        data-disabled={disabled ? "true" : undefined}
        data-invalid={invalid ? "true" : undefined}
        data-loading={loading ? "true" : undefined}
        data-readonly={readOnly ? "true" : undefined}
        id={fieldId}
      >
        {children}
      </div>
    </FormFieldContext.Provider>
  );
}

export function FormLabel({ children, className, htmlFor, ...props }: FormLabelProps) {
  const context = useContext(FormFieldContext);

  return (
    <label
      {...props}
      className={getClassName("yoro-form-label", className)}
      data-required={context?.required ? "true" : undefined}
      htmlFor={htmlFor ?? context?.controlId}
    >
      {children}
    </label>
  );
}

export function FormControl({
  children,
  className,
  disabled,
  invalid,
  loading,
  readOnly,
  ...props
}: FormControlProps) {
  const context = useContext(FormFieldContext);
  const resolvedInvalid = invalid ?? context?.invalid ?? false;
  const resolvedLoading = loading ?? context?.loading ?? false;
  const resolvedDisabled = disabled ?? context?.disabled ?? false;
  const resolvedReadOnly = readOnly ?? context?.readOnly ?? false;

  return (
    <div
      {...props}
      aria-busy={resolvedLoading ? true : undefined}
      className={getClassName("yoro-form-control", className)}
      data-disabled={resolvedDisabled ? "true" : undefined}
      data-invalid={resolvedInvalid ? "true" : undefined}
      data-loading={resolvedLoading ? "true" : undefined}
      data-readonly={resolvedReadOnly ? "true" : undefined}
    >
      {children}
    </div>
  );
}

export function FormHint({ children, className, id, ...props }: FormHintProps) {
  const context = useContext(FormFieldContext);
  const setHasHint = context?.setHasHint;
  const hintId = id ?? context?.hintId;

  useEffect(() => {
    if (!setHasHint) {
      return;
    }
    setHasHint(true);
    return () => setHasHint(false);
  }, [setHasHint]);

  return (
    <p {...props} className={getClassName("yoro-form-hint", className)} id={hintId}>
      {children}
    </p>
  );
}

export function FormError({ children, className, id, ...props }: FormErrorProps) {
  const context = useContext(FormFieldContext);
  const setHasError = context?.setHasError;
  const errorId = id ?? context?.errorId;

  useEffect(() => {
    if (!setHasError) {
      return;
    }
    setHasError(true);
    return () => setHasError(false);
  }, [setHasError]);

  return (
    <p
      {...props}
      className={getClassName("yoro-form-error", className)}
      id={errorId}
      role={props.role ?? "alert"}
    >
      {children}
    </p>
  );
}

export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const {
    "aria-describedby": ariaDescribedBy,
    className,
    disabled,
    id,
    invalid,
    loading,
    readOnly,
    required,
    ...inputProps
  } = props;
  const fieldState = useFieldControlState({
    describedBy: ariaDescribedBy,
    disabled,
    id,
    invalid,
    loading,
    readOnly,
  });

  return (
    <input
      {...inputProps}
      ref={ref}
      aria-busy={fieldState.loading ? true : undefined}
      aria-describedby={fieldState.describedBy}
      aria-invalid={fieldState.invalid ? true : undefined}
      className={getClassName("yoro-input", className)}
      data-loading={fieldState.loading ? "true" : undefined}
      data-readonly={fieldState.readOnly ? "true" : undefined}
      disabled={fieldState.disabled}
      id={fieldState.id}
      readOnly={fieldState.readOnly}
      required={required ?? fieldState.required}
    />
  );
});

Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>((props, ref) => {
  const {
    "aria-describedby": ariaDescribedBy,
    className,
    disabled,
    id,
    invalid,
    loading,
    readOnly,
    required,
    ...textareaProps
  } = props;
  const fieldState = useFieldControlState({
    describedBy: ariaDescribedBy,
    disabled,
    id,
    invalid,
    loading,
    readOnly,
  });

  return (
    <textarea
      {...textareaProps}
      ref={ref}
      aria-busy={fieldState.loading ? true : undefined}
      aria-describedby={fieldState.describedBy}
      aria-invalid={fieldState.invalid ? true : undefined}
      className={getClassName("yoro-textarea", className)}
      data-loading={fieldState.loading ? "true" : undefined}
      data-readonly={fieldState.readOnly ? "true" : undefined}
      disabled={fieldState.disabled}
      id={fieldState.id}
      readOnly={fieldState.readOnly}
      required={required ?? fieldState.required}
    />
  );
});

Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectProps>((props, ref) => {
  const {
    "aria-describedby": ariaDescribedBy,
    className,
    disabled,
    id,
    invalid,
    loading,
    readOnly,
    required,
    ...selectProps
  } = props;
  const resolvedReadOnly =
    readOnly ?? (props["aria-readonly"] === true || props["aria-readonly"] === "true");
  const fieldState = useFieldControlState({
    describedBy: ariaDescribedBy,
    disabled,
    id,
    invalid,
    loading,
    readOnly: resolvedReadOnly,
  });

  return (
    <select
      {...selectProps}
      ref={ref}
      aria-busy={fieldState.loading ? true : undefined}
      aria-describedby={fieldState.describedBy}
      aria-invalid={fieldState.invalid ? true : undefined}
      aria-readonly={fieldState.readOnly ? true : undefined}
      className={getClassName("yoro-select", className)}
      data-loading={fieldState.loading ? "true" : undefined}
      data-readonly={fieldState.readOnly ? "true" : undefined}
      disabled={fieldState.disabled}
      id={fieldState.id}
      required={required ?? fieldState.required}
    />
  );
});

Select.displayName = "Select";
