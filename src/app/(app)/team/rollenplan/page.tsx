import { redirect } from "next/navigation";

/** Der Rollenplan ist jetzt Teil des Regieplans (rechte Spalte „Team heute“). Alte Links führen dorthin. */
export default async function Rollenplan({ searchParams }: PageProps<"/team/rollenplan">) {
  const { tag } = await searchParams;
  redirect(typeof tag === "string" ? `/team/regieplan/?tag=${encodeURIComponent(tag)}` : "/team/regieplan/");
}
