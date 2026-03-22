import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Design",
  description: "Design section",
};

export default function DesignPage() {
  redirect("/doc?type=design");
}
