/**
 * Walidacja adresu email
 * @param value - wartość pola email
 * @returns komunikat błędu lub null jeśli pole jest prawidłowe
 */
export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Adres e-mail jest wymagany.";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return "Podaj prawidłowy adres e-mail.";
  return null;
}

/**
 * Walidacja hasła
 * @param value - wartość pola hasła
 * @returns komunikat błędu lub null jeśli pole jest prawidłowe
 */
export function validatePassword(value: string): string | null {
  if (!value) return "Hasło jest wymagane.";
  if (value.length < 8) return "Hasło musi mieć co najmniej 8 znaków.";
  return null;
}

/**
 * Walidacja potwierdzenia hasła
 * @param password - wartość pola hasła
 * @param confirmPassword - wartość pola potwierdzenia hasła
 * @returns komunikat błędu lub null jeśli pole jest prawidłowe
 */
export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) return "Potwierdzenie hasła jest wymagane.";
  if (password !== confirmPassword) return "Hasła muszą być identyczne.";
  return null;
}
