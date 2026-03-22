import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Bridge",
  description: "Bridge page",
};

export default function BridgePage() {
  redirect("/doc?type=bridge");
}
