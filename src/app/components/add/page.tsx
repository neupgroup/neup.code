import type { Metadata } from "next";
import { AddComponentForm } from "./add-component-form";

export const metadata: Metadata = {
  title: "Add Component",
  description: "Add a component with one or more code blocks.",
};

export default function AddComponentPage() {
  return <AddComponentForm />;
}
