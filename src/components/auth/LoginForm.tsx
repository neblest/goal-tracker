import React, { useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import { setAuthTokens } from "@/lib/auth/authTokens";
import type { LoginCommand, LoginResponseDto } from "@/types";

/**
 * Login form state model
 */
interface LoginFormVm {
  email: string;
  password: string;
}

/**
 * Login form validation errors
 */
interface LoginFormErrors {
  email?: string;
  password?: string;
  form?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login form validation
 */
function validateLoginForm(values: LoginFormVm): LoginFormErrors {
  const errors: LoginFormErrors = {};

  const trimmedEmail = values.email.trim();
  if (!trimmedEmail) {
    errors.email = "Email is required";
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = "Invalid email address format";
  }

  if (!values.password) {
    errors.password = "Password is required";
  }

  return errors;
}

/**
 * Login API call
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
        const response = await loginUser(command);

        // Save tokens to localStorage
        setAuthTokens({
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
        });

        // Success - redirect to /app/goals
        window.location.href = "/app/goals";
      } catch (error) {
        if (error instanceof ApiError) {
          switch (error.status) {
            case 401:
              setErrors({ form: "Incorrect email or password" });
              break;
            case 429:
              setErrors({ form: "Too many attempts. Please try again later." });
              break;
            case 400:
              setErrors({ form: "An error occurred. Please try again." });
              break;
            default:
              setErrors({ form: "A server error occurred. Please try again later." });
          }
        } else {
          setErrors({ form: "Failed to connect to server. Check your connection." });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [values]
  );

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      {/* Email Field */}
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
          placeholder="your@email.com"
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

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor={`${baseId}-password`} className="text-sm font-medium text-[#4A3F35]">
          Password
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

      {/* Form error banner */}
      {errors.form ? (
        <div
          className="flex items-start gap-2 rounded-md border border-[#C17A6F]/40 bg-[#C17A6F]/10 px-3 py-2 text-sm text-[#C17A6F]"
          role="status"
          aria-live="polite"
        >
          <span>{errors.form}</span>
        </div>
      ) : null}

      {/* Submit button */}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Logging in..." : "Log in"}
      </Button>

      {/* Registration link */}
      <div className="text-center text-sm text-[#8B7E74]">
        Don't have an account?{" "}
        <a href="/register" className="font-medium text-[#D4A574] hover:underline">
          Sign up
        </a>
      </div>
    </form>
  );
}

export default LoginForm;
