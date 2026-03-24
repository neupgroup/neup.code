import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Doc",
  description: "Documentation workspace",
};

type DocPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DocPage({ searchParams }: DocPageProps) {
  const params = await searchParams;
  const nextSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      nextSearchParams.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        nextSearchParams.append(key, entry);
      }
    }
  }

  redirect(nextSearchParams.size ? `/blocks?${nextSearchParams.toString()}` : "/blocks");
}
