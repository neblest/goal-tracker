import React, { useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import type { LoginCommand, LoginResponseDto } from "@/types";

/**
 * Model stanu formularza logowania
 */
interface LoginFormVm {
  email: string;
  password: string;
}

/**
 * Błędy walidacji formularza logowania
 */
interface LoginFormErrors {
  email?: string;
  password?: string;
  form?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Walidacja formularza logowania
 */
function validateLoginForm(values: LoginFormVm): LoginFormErrors {
  const errors: LoginFormErrors = {};

  const trimmedEmail = values.email.trim();
  if (!trimmedEmail) {
    errors.email = "Email jest wymagany";
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = "Niepoprawny format adresu email";
  }

  if (!values.password) {
    errors.password = "Hasło jest wymagane";
  }

  return errors;
}

/**
 * Wywołanie API logowania
 */
async function loginUser(command: LoginCommand): Promise<LoginResponseDto> {
  return apiFetchJson<LoginResponseDto>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export function LoginForm() {
  const baseId = useId();
  const [values, setValues] = useState<LoginFormVm>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((field: keyof LoginFormVm, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete (next as Record<string, string | undefined>)[field as string];
      if (field !== "form") {
        delete next.form;
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const nextErrors = validateLoginForm(values);
      setErrors(nextErrors);

      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      const command: LoginCommand = {
        email: values.email.trim(),
        password: values.password,
      };

      setIsSubmitting(true);
      try {
        await loginUser(command);
        // Sukces - przekierowanie do /app/goals
        window.location.href = "/app/goals";
      } catch (error) {
        if (error instanceof ApiError) {
          switch (error.status) {
            case 401:
              setErrors({ form: "Niepoprawny email lub hasło" });
              break;
            case 429:
              setErrors({ form: "Zbyt wiele prób. Spróbuj ponownie później." });
              break;
            case 400:
              setErrors({ form: "Wystąpił błąd. Spróbuj ponownie." });
              break;
            default:
              setErrors({ form: "Wystąpił błąd serwera. Spróbuj ponownie później." });
          }
        } else {
          setErrors({ form: "Nie udało się połączyć z serwerem. Sprawdź połączenie." });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [values]
  );

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      {/* Pole Email */}
      <div className="space-y-2">
        <Label htmlFor={`${baseId}-email`} className="text-sm font-medium text-[#4A3F35]">
          Email
        </Label>
        <Input
          id={`${baseId}-email`}
          name="email"
          type="email"
          value={values.email}
          onChange={(event) => handleChange("email", event.target.value)}
          placeholder="twoj@email.com"
          required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${baseId}-email-error` : undefined}
        />
        {errors.email ? (
          <p id={`${baseId}-email-error`} className="text-sm text-[#C17A6F]">
            {errors.email}
          </p>
        ) : null}
      </div>

      {/* Pole Hasło */}
      <div className="space-y-2">
        <Label htmlFor={`${baseId}-password`} className="text-sm font-medium text-[#4A3F35]">
          Hasło
        </Label>
        <Input
          id={`${baseId}-password`}
          name="password"
          type="password"
          value={values.password}
          onChange={(event) => handleChange("password", event.target.value)}
          placeholder="••••••••"
          required
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? `${baseId}-password-error` : undefined}
        />
        {errors.password ? (
          <p id={`${baseId}-password-error`} className="text-sm text-[#C17A6F]">
            {errors.password}
          </p>
        ) : null}
      </div>

      {/* Banner błędu formularza */}
      {errors.form ? (
        <div
          className="flex items-start gap-2 rounded-md border border-[#C17A6F]/40 bg-[#C17A6F]/10 px-3 py-2 text-sm text-[#C17A6F]"
          role="status"
          aria-live="polite"
        >
          <span>{errors.form}</span>
        </div>
      ) : null}

      {/* Przycisk submit */}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Logowanie..." : "Zaloguj się"}
      </Button>

      {/* Link do rejestracji */}
      <div className="text-center text-sm text-[#8B7E74]">
        Nie masz konta?{" "}
        <a href="/register" className="font-medium text-[#D4A574] hover:underline">
          Zarejestruj się
        </a>
      </div>
    </form>
  );
}

export default LoginForm;
