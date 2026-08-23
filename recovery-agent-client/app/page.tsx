import Link from "next/link";
import { Button } from "../components/ui/Button";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center p-24">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Recovery Agent Dashboard
        </h1>
        <p className="text-xl text-zinc-500 dark:text-zinc-400">
          Manage your B2B receivables and streamline the payment recovery workflow.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/companies">Manage Companies</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/invoices">Manage Invoices</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
