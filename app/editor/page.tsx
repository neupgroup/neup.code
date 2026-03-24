import type { Metadata } from "next";
import { EditorInstance } from "./editor-instance";

export const metadata: Metadata = {
  title: "Editor",
  description: "Plain editor workspace",
};

export default function EditorPage() {
  return <EditorInstance />;
}
