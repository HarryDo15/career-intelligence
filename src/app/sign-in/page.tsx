import { SignInForm } from "@/components/workspace/sign-in-form";
export const dynamic = "force-dynamic";
export default function SignIn() {
  return (
    <SignInForm
      registrationAllowed={process.env.ALLOW_REGISTRATION === "true"}
    />
  );
}
