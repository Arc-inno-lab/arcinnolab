import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-10">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
