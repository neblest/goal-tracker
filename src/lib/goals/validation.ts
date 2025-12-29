export function normalizeTrim(value: string) {
  return value.trim();
}

export function validateGoalName(value: string) {
  const trimmed = normalizeTrim(value);
  if (trimmed.length < 1) return "Name is required.";
  if (trimmed.length > 50) return "Name can be at most 50 characters.";
  return null;
}

export function validateProgressNotes(value: string) {
  const trimmed = normalizeTrim(value);
  if (trimmed.length > 150) return "Notes can be at most 150 characters.";
  return null;
}

export function validateReflectionNotes(value: string) {
  const trimmed = normalizeTrim(value);
  if (trimmed.length > 1000) return "Note can be at most 1000 characters.";
  return null;
}

export function validateAiSummary(value: string) {
  const trimmed = normalizeTrim(value);
  if (trimmed.length > 5000) return "Summary can be at most 5000 characters.";
  return null;
}

export function validateTargetValue(value: string) {
  const trimmed = normalizeTrim(value);
  if (!trimmed) return "Target value is required.";
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Value must be a positive number.";
  return null;
}

export function validateDeadlineFuture(value: string) {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return "Deadline must be in dd.MM.yyyy format.";

  const parts = value.split(".");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return "Invalid date.";

  const parsed = new Date(year, month - 1, day);

  // Validate the date is actually valid (e.g., not 31.02.2024)
  if (parsed.getDate() !== day || parsed.getMonth() !== month - 1 || parsed.getFullYear() !== year) {
    return "Invalid date.";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);

  if (parsed.getTime() <= today.getTime()) return "Deadline must be in the future.";
  return null;
}
