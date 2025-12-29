/**
 * Email address validation
 * @param value - email field value
 * @returns error message or null if field is valid
 */
export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Email address is required.";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return "Enter a valid email address.";
  return null;
}

/**
 * Password validation
 * @param value - password field value
 * @returns error message or null if field is valid
 */
export function validatePassword(value: string): string | null {
  if (!value) return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  return null;
}

/**
 * Password confirmation validation
 * @param password - password field value
 * @param confirmPassword - password confirmation field value
 * @returns error message or null if field is valid
 */
export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) return "Password confirmation is required.";
  if (password !== confirmPassword) return "Passwords must match.";
  return null;
}
