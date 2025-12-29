import { RegisterForm } from "./RegisterForm";
import { Logo } from "../shared/Logo";

/**
 * Main registration page component
 * Contains registration form and link to login page
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
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-[#4A3F35] mb-2">Create account</h1>
            <p className="text-sm text-[#8B7E74]">Create a new Aimbition account</p>
          </div>

          {/* Registration form */}
          <RegisterForm />

          {/* Login link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[#8B7E74]">
              Already have an account?{" "}
              <a
                href="/login"
                className="text-[#D4A574] hover:text-[#C9965E] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A574]/30 rounded"
              >
                Log in
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
