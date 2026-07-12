import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type MouseEventHandler,
  type Ref,
  type ReactElement,
  type ReactNode,
} from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "danger";

export type ButtonSize = "sm" | "md" | "lg";

type ButtonBaseProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loadingLabel?: ReactNode;
  className?: string;
  "aria-label"?: string;
};

export type ButtonRootRenderProps = {
  children: ReactNode;
  className: string;
  onClick: MouseEventHandler<HTMLElement>;
  "aria-busy"?: true;
  "aria-disabled"?: true;
  "aria-label"?: string;
  "data-loading"?: "true";
  "data-size": ButtonSize;
  "data-variant": ButtonVariant;
  tabIndex?: number;
};

type NativeButtonProps = ButtonBaseProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    | keyof ButtonBaseProps
    | "aria-busy"
    | "aria-disabled"
    | "children"
    | "className"
    | "disabled"
  > & {
    as?: "button";
  };

type AnchorButtonProps = ButtonBaseProps &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof ButtonBaseProps | "aria-busy" | "aria-disabled" | "children" | "className"
  > & {
    as: "a";
    href: string;
  };

type CustomButtonProps = ButtonBaseProps & {
  renderRoot: (props: ButtonRootRenderProps) => ReactElement;
  onClick?: MouseEventHandler<HTMLElement>;
};

export type ButtonProps = NativeButtonProps | AnchorButtonProps | CustomButtonProps;

function getButtonClassName({
  className,
  fullWidth,
}: {
  className?: string;
  fullWidth: boolean;
}) {
  return ["yoro-button", fullWidth ? "yoro-button--full-width" : undefined, className]
    .filter(Boolean)
    .join(" ");
}

function getButtonContent({
  children,
  leftIcon,
  loading,
  loadingLabel,
  rightIcon,
}: Pick<ButtonBaseProps, "children" | "leftIcon" | "loading" | "loadingLabel" | "rightIcon">) {
  return (
    <>
      {loading ? (
        <span aria-hidden="true" className="yoro-button__spinner" />
      ) : leftIcon ? (
        <span aria-hidden="true" className="yoro-button__icon yoro-button__icon--left">
          {leftIcon}
        </span>
      ) : null}
      <span className="yoro-button__label">{children}</span>
      {loadingLabel ? <span className="yoro-button__loading-label">{loadingLabel}</span> : null}
      {!loading && rightIcon ? (
        <span aria-hidden="true" className="yoro-button__icon yoro-button__icon--right">
          {rightIcon}
        </span>
      ) : null}
    </>
  );
}

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (props, ref) => {
    const {
      children,
      className,
      disabled = false,
      fullWidth = false,
      leftIcon,
      loading = false,
      loadingLabel,
      rightIcon,
      size = "md",
      variant = "primary",
      "aria-label": ariaLabel,
    } = props;
    const isDisabled = disabled || loading;
    const buttonClassName = getButtonClassName({ className, fullWidth });
    const content = getButtonContent({ children, leftIcon, loading, loadingLabel, rightIcon });

    if ("renderRoot" in props) {
      const handleCustomClick: MouseEventHandler<HTMLElement> = (event) => {
        if (isDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        props.onClick?.(event);
      };

      return props.renderRoot({
        children: content,
        className: buttonClassName,
        onClick: handleCustomClick,
        "aria-busy": loading ? true : undefined,
        "aria-disabled": isDisabled ? true : undefined,
        "aria-label": ariaLabel,
        "data-loading": loading ? "true" : undefined,
        "data-size": size,
        "data-variant": variant,
        tabIndex: isDisabled ? -1 : undefined,
      });
    }

    if (props.as === "a") {
      const {
        as: _as,
        children: _children,
        className: _className,
        disabled: _disabled,
        fullWidth: _fullWidth,
        leftIcon: _leftIcon,
        loading: _loading,
        loadingLabel: _loadingLabel,
        rightIcon: _rightIcon,
        size: _size,
        variant: _variant,
        "aria-label": _ariaLabel,
        onClick,
        tabIndex,
        ...anchorProps
      } = props;
      const handleAnchorClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
        if (isDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      };

      return (
        <a
          {...anchorProps}
          ref={ref as Ref<HTMLAnchorElement>}
          aria-busy={loading ? true : undefined}
          aria-disabled={isDisabled ? true : undefined}
          aria-label={ariaLabel}
          className={buttonClassName}
          data-loading={loading ? "true" : undefined}
          data-size={size}
          data-variant={variant}
          onClick={handleAnchorClick}
          tabIndex={isDisabled ? -1 : tabIndex}
        >
          {content}
        </a>
      );
    }

    const {
      as: _as,
      children: _children,
      className: _className,
      disabled: _disabled,
      fullWidth: _fullWidth,
      leftIcon: _leftIcon,
      loading: _loading,
      loadingLabel: _loadingLabel,
      rightIcon: _rightIcon,
      size: _size,
      variant: _variant,
      "aria-label": _ariaLabel,
      onClick,
      type = "button",
      ...buttonProps
    } = props;
    const handleButtonClick: MouseEventHandler<HTMLButtonElement> = (event) => {
      if (isDisabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onClick?.(event);
    };

    return (
      <button
        {...buttonProps}
        ref={ref as Ref<HTMLButtonElement>}
        aria-busy={loading ? true : undefined}
        aria-disabled={isDisabled ? true : undefined}
        aria-label={ariaLabel}
        className={buttonClassName}
        data-loading={loading ? "true" : undefined}
        data-size={size}
        data-variant={variant}
        disabled={isDisabled}
        onClick={handleButtonClick}
        type={type}
      >
        {content}
      </button>
    );
  },
);

Button.displayName = "Button";
