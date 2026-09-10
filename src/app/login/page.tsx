import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { InterregMention } from "@/components/InterregFooter";

export default function LoginPage() {
  return (
    <main
      id="main"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: "var(--gradient-brand)" }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "url(/brand/hero.jpg)", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.22, mixBlendMode: "overlay" }}
        aria-hidden="true"
      />
      <div className="relative fade-up w-full max-w-3xl">
        <div className="flex justify-center">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
        <InterregMention onDark />
      </div>
    </main>
  );
}
