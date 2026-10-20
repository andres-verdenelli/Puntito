import { AppFrame } from "@/components/app-frame";

export default function PlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppFrame>{children}</AppFrame>;
}
