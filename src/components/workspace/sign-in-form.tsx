"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Layers2, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
export function SignInForm({
  registrationAllowed,
}: {
  registrationAllowed: boolean;
}) {
  const [register, setRegister] = useState(false);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email")).trim().toLowerCase();
    const password = String(values.get("password"));
    try {
      const result = register
        ? await authClient.signUp.email({
            name: String(values.get("name")).trim(),
            email,
            password,
          })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(
          result.error.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : register
              ? "Couldn’t create the account. Try signing in if you already registered."
              : "Couldn’t sign in. Check your email and password.",
        );
        setPending(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Couldn’t reach the sign-in service. Please try again.");
      setPending(false);
    }
  }
  return (
    <main id="main" className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-[#eeeafa] p-14 lg:flex">
        <Link
          href="/demo"
          className="flex items-center gap-3 text-lg font-semibold"
        >
          <Layers2 className="text-primary" />
          career intelligence
        </Link>
        <div className="max-w-md">
          <p className="mb-5 text-xs font-semibold tracking-[.18em] text-primary">
            YOUR NEXT CHAPTER
          </p>
          <h1 className="text-5xl leading-tight font-semibold tracking-tight">
            A little clarity.
            <br />A lot of possibility.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-[#777087]">
            Bring your applications together, see your progress, and give your
            next opportunity the attention it deserves.
          </p>
          <div className="mt-10 border-t border-primary/15 pt-6 text-xs text-[#777087]">
            A personal workspace for an intentional job search.
          </div>
        </div>
        <span className="text-xs text-[#777087]">
          Built with care. Built for your next move.
        </span>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link
            href="/demo"
            className="mb-10 flex items-center gap-2 text-sm font-semibold text-primary lg:hidden"
          >
            <Layers2 />
            Career Intelligence
          </Link>
          <h2 className="text-3xl font-semibold tracking-tight">
            {register ? "Make room for what’s next." : "Welcome back."}
          </h2>
          <p className="mt-3 mb-8 text-sm text-muted-foreground">
            {register
              ? "Create your personal career workspace."
              : "Your next opportunity is waiting. Let’s get focused."}
          </p>
          <form onSubmit={submit} className="space-y-5">
            <fieldset disabled={pending} className="space-y-5">
              {register && (
                <label className="block">
                  <span className="label">Name</span>
                  <input
                    className="field"
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={100}
                    placeholder="Your name"
                  />
                </label>
              )}
              <label className="block">
                <span className="label">Email</span>
                <input
                  className="field"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="you@example.com"
                />
              </label>
              <label className="block">
                <span className="label">Password</span>
                <input
                  className="field"
                  name="password"
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  placeholder={
                    register ? "At least 12 characters" : "Your password"
                  }
                />
              </label>
            </fieldset>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
              >
                {error}
              </p>
            )}
            <Button className="w-full" disabled={pending} type="submit">
              {pending
                ? "One moment…"
                : register
                  ? "Create workspace"
                  : "Sign in"}
              <ArrowRight />
            </Button>
          </form>
          {registrationAllowed && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              {register ? "Already have a workspace? " : "New here? "}
              <button
                disabled={pending}
                onClick={() => {
                  setRegister(!register);
                  setError("");
                }}
                className="font-semibold text-primary"
              >
                {register ? "Sign in" : "Create an account"}
              </button>
            </p>
          )}
          <div className="mt-8 border-t border-border pt-6 text-center">
            <Link href="/demo" className="text-xs font-medium text-primary">
              Explore the read-only demo →
            </Link>
            <p className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck size={13} />
              Your applications stay in your personal workspace.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
