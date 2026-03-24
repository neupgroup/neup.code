import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BlocksInstance } from "./blocks-instance";

export const metadata: Metadata = {
  title: "Blocks",
  description: "Block editor workspace",
};

type BlocksPageProps = {
  searchParams: Promise<{ type?: string; id?: string; block?: string }>;
};

export default async function BlocksPage({ searchParams }: BlocksPageProps) {
  const { type, id, block } = await searchParams;

  if (block === "chapter" && id) {
    redirect(`/blocks?id=${id}`);
  }

  if (type === "bridge") {
    return redirect("/blocks");
  }

  if (id === "bridge") {
    redirect("/blocks");
  }

  return <BlocksInstance id={id} />;
}
