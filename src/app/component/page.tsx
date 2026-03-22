import { redirect } from "next/navigation";

export default function ComponentAliasPage() {
  redirect("/doc?type=component");
}
