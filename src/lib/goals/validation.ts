export function normalizeTrim(value: string) {
  return value.trim();
}

export function validateGoalName(value: string) {
  const trimmed = normalizeTrim(value);
  if (trimmed.length < 1) return "Nazwa jest wymagana.";
  if (trimmed.length > 500) return "Nazwa może mieć maksymalnie 500 znaków.";
  return null;
}

export function validateTargetValue(value: string) {
  const trimmed = normalizeTrim(value);
  if (!trimmed) return "Wartość docelowa jest wymagana.";
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Wartość musi być liczbą dodatnią.";
  return null;
}

export function validateDeadlineFuture(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Deadline musi być w formacie RRRR-MM-DD.";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Nieprawidłowa data.";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  if (parsed.getTime() <= today.getTime()) return "Deadline musi być w przyszłości.";
  return null;
}
