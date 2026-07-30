export default function HomePage() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Property Manager
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Phase 2 is in place: email/password authentication, role-based
        authorization, and the protected dashboard shell. Sign in to continue —
        accounts are provisioned by the landlord; there is no public
        registration.
      </p>
    </section>
  );
}
