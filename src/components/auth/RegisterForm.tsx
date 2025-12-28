import { useState, type FormEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import { validateEmail, validatePassword, validateConfirmPassword } from "@/lib/auth/validation";
import type { RegisterCommand, RegisterResponseDto } from "@/types";

/**
 * ViewModel stanu formularza rejestracji
 */
export interface RegisterFormVm {
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Błędy walidacji formularza rejestracji
 */
export interface RegisterFormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
}

/**
 * Komponent formularza rejestracji
 * Obsługuje rejestrację nowego użytkownika z walidacją po stronie klienta
 */
export function RegisterForm() {
  const [values, setValues] = useState<RegisterFormVm>({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Obsługa zmiany wartości pola formularza
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));

    // Czyszczenie błędu dla edytowanego pola
    const fieldName = name as keyof RegisterFormErrors;
    if (errors[fieldName]) {
      setErrors((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [fieldName]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  /**
   * Walidacja wszystkich pól formularza
   * @returns true jeśli formularz jest poprawny, false w przeciwnym razie
   */
  const validate = (): boolean => {
    const newErrors: RegisterFormErrors = {};

    const emailError = validateEmail(values.email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validatePassword(values.password);
    if (passwordError) newErrors.password = passwordError;

    const confirmPasswordError = validateConfirmPassword(values.password, values.confirmPassword);
    if (confirmPasswordError) newErrors.confirmPassword = confirmPasswordError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Wywołanie API rejestracji
   */
  const register = async (command: RegisterCommand): Promise<RegisterResponseDto> => {
    return apiFetchJson<RegisterResponseDto>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(command),
    });
  };

  /**
   * Obsługa submit formularza
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Czyszczenie błędu ogólnego
    if (errors.form) {
      setErrors((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { form: _removed, ...rest } = prev;
        return rest;
      });
    }

    // Walidacja
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const command: RegisterCommand = {
        email: values.email.trim(),
        password: values.password,
      };

      await register(command);

      // Przekierowanie po pomyślnej rejestracji
      window.location.href = "/app/goals";
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setErrors((prev) => ({ ...prev, email: "Ten adres e-mail jest już używany." }));
        } else if (error.status === 429) {
          setErrors((prev) => ({ ...prev, form: "Zbyt wiele prób. Spróbuj ponownie za chwilę." }));
        } else if (error.status >= 500) {
          setErrors((prev) => ({ ...prev, form: "Wystąpił błąd serwera. Spróbuj ponownie później." }));
        } else {
          setErrors((prev) => ({ ...prev, form: error.message || "Nieprawidłowe dane." }));
        }
      } else {
        setErrors((prev) => ({ ...prev, form: "Nie udało się połączyć z serwerem. Sprawdź połączenie internetowe." }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Pole email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-[#4A3F35]">
          Adres e-mail
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={values.email}
          onChange={handleChange}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          disabled={isSubmitting}
          placeholder="nazwa@example.com"
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-[#C17A6F]">
            {errors.email}
          </p>
        )}
      </div>

      {/* Pole hasła */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-[#4A3F35]">
          Hasło
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={values.password}
          onChange={handleChange}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : "password-requirements"}
          disabled={isSubmitting}
        />
        {!errors.password && (
          <p id="password-requirements" className="text-xs text-[#8B7E74]">
            Hasło musi mieć co najmniej 8 znaków.
          </p>
        )}
        {errors.password && (
          <p id="password-error" className="text-sm text-[#C17A6F]">
            {errors.password}
          </p>
        )}
      </div>

      {/* Pole potwierdzenia hasła */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-[#4A3F35]">
          Potwierdź hasło
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={values.confirmPassword}
          onChange={handleChange}
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
          disabled={isSubmitting}
        />
        {errors.confirmPassword && (
          <p id="confirm-password-error" className="text-sm text-[#C17A6F]">
            {errors.confirmPassword}
          </p>
        )}
      </div>

      {/* Błąd ogólny */}
      {errors.form && (
        <div aria-live="polite" className="rounded-xl bg-[#C17A6F]/10 p-3 border border-[#C17A6F]/20">
          <p className="text-sm text-[#C17A6F]">{errors.form}</p>
        </div>
      )}

      {/* Przycisk submit */}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Tworzenie konta..." : "Załóż konto"}
      </Button>
    </form>
  );
}
