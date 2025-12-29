import React from "react";
import { Logo } from "../shared/Logo";

export function LoginHeader() {
  return (
    <header className="text-center space-y-6">
      <Logo />
      <div>
        <h1 className="text-3xl font-bold text-[#4A3F35]">Log in</h1>
        <p className="mt-2 text-sm text-[#8B7E74]">Enter your credentials to access your goals</p>
      </div>
    </header>
  );
}

export default LoginHeader;
