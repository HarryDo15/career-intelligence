"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-2xl font-semibold">Your workspace couldn’t load.</h1>
      <p className="my-4 text-muted-foreground">
        Please try again. If this continues, check that the database is
        available.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
