import Link from "next/link";
import { Button } from "../components/backoffice/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          grub backoffice
        </p>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">
            Pagina no encontrada
          </h1>
          <p className="text-sm text-muted-foreground">
            La ruta que abriste no existe o ya fue movida al layout principal
            del backoffice.
          </p>
        </div>
        <Button asChild>
          <Link href="/backoffice">Ir al backoffice</Link>
        </Button>
      </div>
    </main>
  );
}
