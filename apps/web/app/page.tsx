import { Button } from "@repo/ui";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">cc-v2 monorepo</h1>
      <p className="text-gray-600">apps/web + packages/ui</p>
      <Button>Shared UI Button</Button>
    </main>
  );
}
