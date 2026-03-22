import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DocInstance } from "./doc-instance";

export const metadata: Metadata = {
  title: "Doc",
  description: "Documentation workspace",
};

type DocPageProps = {
  searchParams: Promise<{ type?: string; id?: string; block?: string }>;
};

export default async function DocPage({ searchParams }: DocPageProps) {
  const { type, id, block } = await searchParams;

  if (block === "chapter" && id) {
    redirect(`/doc?id=${id}`);
  }

  if (type === "bridge") {
    return redirect("/doc");
  }

  if (id === "bridge") {
    redirect("/doc");
  }

  return <DocInstance id={id} />;
}
