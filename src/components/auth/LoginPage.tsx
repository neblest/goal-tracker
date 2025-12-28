import React from "react";
import { LoginHeader } from "./LoginHeader";
import { LoginForm } from "./LoginForm";

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F9F6F3] to-[#EFE9E3] px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <LoginHeader />
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
