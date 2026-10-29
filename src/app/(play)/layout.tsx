import { AppFrame } from "@/components/app-frame";
import { DatabaseGate } from "@/components/database-gate";

export default function PlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppFrame>
      <DatabaseGate>{children}</DatabaseGate>
    </AppFrame>
  );
}
