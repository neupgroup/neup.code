import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Components",
  description: "Components section",
};

export default function ComponentsPage() {
  redirect("/doc?type=component");
}
