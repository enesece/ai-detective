import { LoginForm } from "@/components/admin/LoginForm";

export default function AdminLoginPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Sign in</h1>
      <p className="text-muted max-w-prose text-sm">
        For the site admin. Signing in replaces this browser&apos;s anonymous player session.
      </p>
      <LoginForm />
    </div>
  );
}
