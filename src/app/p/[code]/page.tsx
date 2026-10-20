import { notFound } from "next/navigation";
import { CODE } from "@/lib/game";
import { GameScreen } from "@/components/game-screen";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!CODE.test(code)) notFound();
  return <GameScreen code={code} />;
}
