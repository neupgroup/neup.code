import type { Metadata } from "next";
import { AddComponentPartForm } from "./add-component-part-form";

export const metadata: Metadata = {
  title: "Add Component Part",
  description: "Add a new code block to a saved component.",
};

type AddComponentPartPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AddComponentPartPage({ params }: AddComponentPartPageProps) {
  const { id } = await params;
  return <AddComponentPartForm id={id} />;
}
