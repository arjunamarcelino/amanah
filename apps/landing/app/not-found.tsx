import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-serif text-2xl font-medium text-primary">Amanah</p>
      <h1 className="font-serif text-4xl font-medium tracking-tight">Page not found</h1>
      <p className="text-foreground-soft">
        The page you were looking for isn’t here.
      </p>
      <Link
        href="/"
        className="mt-2 text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
      >
        Back to home
      </Link>
    </main>
  );
}
