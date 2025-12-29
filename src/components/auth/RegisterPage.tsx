import { RegisterForm } from "./RegisterForm";
import { Logo } from "../shared/Logo";

/**
 * Główny komponent strony rejestracji
 * Zawiera formularz rejestracji i link do strony logowania
 */
export function RegisterPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Logo />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5DDD5] p-8">
          {/* Nagłówek */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-[#4A3F35] mb-2">Załóż konto</h1>
            <p className="text-sm text-[#8B7E74]">Utwórz nowe konto w Aimbition</p>
          </div>

          {/* Formularz rejestracji */}
          <RegisterForm />

          {/* Link do logowania */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[#8B7E74]">
              Masz już konto?{" "}
              <a
                href="/login"
                className="text-[#D4A574] hover:text-[#C9965E] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A574]/30 rounded"
              >
                Zaloguj się
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
