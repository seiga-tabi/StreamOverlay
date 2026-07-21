import type { FormEvent } from "react";
import type { PalworldServerConnectionSummary } from "@streamops/shared";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormControl,
  FormError,
  FormField,
  FormHint,
  FormLabel,
  Input
} from "../../../shared/ui";
import type { PalworldServerText } from "../i18n";

type PalworldServerConnectionFormProps = {
  connection: PalworldServerConnectionSummary;
  baseUrl: string;
  adminPassword: string;
  baseUrlError?: string;
  passwordError?: string;
  passwordRequired?: boolean;
  operation?: "testing" | "saving" | "removing";
  disabled?: boolean;
  text: PalworldServerText;
  onBaseUrlChange: (value: string) => void;
  onAdminPasswordChange: (value: string) => void;
  onTest: () => void;
  onSave: () => void;
  onRemove: () => void;
};

export function PalworldServerConnectionForm({
  connection,
  baseUrl,
  adminPassword,
  baseUrlError,
  passwordError,
  passwordRequired,
  operation,
  disabled = false,
  text,
  onBaseUrlChange,
  onAdminPasswordChange,
  onTest,
  onSave,
  onRemove
}: PalworldServerConnectionFormProps) {
  const busy = Boolean(operation);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSave();
  }

  return (
    <Card className="palworld-server-connection" padding="lg">
      <CardHeader>
        <CardTitle>{text.connectionTitle}</CardTitle>
        <CardDescription>{text.connectionDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="palworld-server-form" id="palworld-server-connection-form" onSubmit={submit}>
          <FormField required invalid={Boolean(baseUrlError)} disabled={busy || disabled}>
            <FormLabel>{text.baseUrlLabel}</FormLabel>
            <FormControl>
              <Input
                autoCapitalize="none"
                autoComplete="url"
                disabled={busy || disabled}
                inputMode="url"
                name="palworldServerBaseUrl"
                onChange={(event) => onBaseUrlChange(event.target.value)}
                placeholder={text.baseUrlPlaceholder}
                spellCheck={false}
                type="url"
                value={baseUrl}
              />
            </FormControl>
            <FormHint>{text.baseUrlHint}</FormHint>
            {baseUrlError ? <FormError>{baseUrlError}</FormError> : null}
          </FormField>

          <FormField
            required={passwordRequired ?? !connection.passwordConfigured}
            invalid={Boolean(passwordError)}
            disabled={busy || disabled}
          >
            <FormLabel>{text.passwordLabel}</FormLabel>
            <FormControl>
              <Input
                autoComplete="new-password"
                disabled={busy || disabled}
                name="palworldServerAdminPassword"
                onChange={(event) => onAdminPasswordChange(event.target.value)}
                placeholder={text.passwordPlaceholder}
                spellCheck={false}
                type="password"
                value={adminPassword}
              />
            </FormControl>
            <FormHint>
              {text.passwordAdminHint} {connection.passwordConfigured ? text.passwordSavedHint : text.passwordNewHint}
            </FormHint>
            {passwordError ? <FormError>{passwordError}</FormError> : null}
          </FormField>

          <p className="palworld-server-security-notice">{text.credentialsNotice}</p>
        </form>
      </CardContent>
      <CardFooter className="palworld-server-form-actions">
        <div className="palworld-server-primary-actions">
          <Button
            disabled={busy || disabled}
            loading={operation === "testing"}
            loadingLabel={text.testing}
            onClick={onTest}
            variant="secondary"
          >
            {text.test}
          </Button>
          <Button
            disabled={busy || disabled}
            form="palworld-server-connection-form"
            loading={operation === "saving"}
            loadingLabel={text.saving}
            type="submit"
          >
            {text.save}
          </Button>
        </div>
        {connection.configured ? (
          <Button
            disabled={busy || disabled}
            loading={operation === "removing"}
            onClick={onRemove}
            variant="danger"
          >
            {text.remove}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
