import { useState, type FormEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import { validateEmail, validatePassword, validateConfirmPassword } from "@/lib/auth/validation";
import type { RegisterCommand, RegisterResponseDto } from "@/types";

/**
 * Registration form state ViewModel
 */
export interface RegisterFormVm {
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Registration form validation errors
 */
export interface RegisterFormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
}

/**
 * Registration form component
 * Handles new user registration with client-side validation
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
   * Handle form field value changes
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));

    // Clear error for edited field
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
   * Validate all form fields
   * @returns true if form is valid, false otherwise
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
   * Registration API call
   */
  const register = async (command: RegisterCommand): Promise<RegisterResponseDto> => {
    return apiFetchJson<RegisterResponseDto>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(command),
    });
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Clear general error
    if (errors.form) {
      setErrors((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { form: _removed, ...rest } = prev;
        return rest;
      });
    }

    // Validation
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const command: RegisterCommand = {
        email: values.email.trim(),
        password: values.password,
      };

      await register(command);

      // Redirect after successful registration
      window.location.href = "/app/goals";
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setErrors((prev) => ({ ...prev, email: "This email address is already in use." }));
        } else if (error.status === 429) {
          setErrors((prev) => ({ ...prev, form: "Too many attempts. Please try again in a moment." }));
        } else if (error.status >= 500) {
          setErrors((prev) => ({ ...prev, form: "A server error occurred. Please try again later." }));
        } else {
          setErrors((prev) => ({ ...prev, form: error.message || "Invalid data." }));
        }
      } else {
        setErrors((prev) => ({ ...prev, form: "Failed to connect to server. Check your internet connection." }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Email field */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-[#4A3F35]">
          Email address
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
          placeholder="name@example.com"
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-[#C17A6F]">
            {errors.email}
          </p>
        )}
      </div>

      {/* Password field */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-[#4A3F35]">
          Password
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
            Password must be at least 8 characters.
          </p>
        )}
        {errors.password && (
          <p id="password-error" className="text-sm text-[#C17A6F]">
            {errors.password}
          </p>
        )}
      </div>

      {/* Confirm password field */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-[#4A3F35]">
          Confirm password
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

      {/* General error */}
      {errors.form && (
        <div aria-live="polite" className="rounded-xl bg-[#C17A6F]/10 p-3 border border-[#C17A6F]/20">
          <p className="text-sm text-[#C17A6F]">{errors.form}</p>
        </div>
      )}

      {/* Submit button */}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
