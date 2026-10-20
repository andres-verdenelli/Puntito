import { notFound } from "next/navigation";
import { CODE } from "@/lib/game";
import { GameScreen } from "@/components/game-screen";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  if (!CODE.test(code)) notFound();
  return <GameScreen code={code} viewOnly={query.view === "1"} />;
}
