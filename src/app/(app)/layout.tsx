"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { ColecaoProvider } from "@/lib/colecao-context";
import { Disco } from "@/components/Disco";

export default function LayoutDoApp({ children }: { children: React.ReactNode }) {
  const { user, carregando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!carregando && !user) router.replace("/login");
  }, [carregando, user, router]);

  if (carregando || !user) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label="Carregando">
        <Disco className="h-16 w-16 animate-spin [animation-duration:2s] motion-reduce:animate-none" aneis={3} />
      </div>
    );
  }
  return (
    <ColecaoProvider>
      <AppShell>{children}</AppShell>
    </ColecaoProvider>
  );
}
