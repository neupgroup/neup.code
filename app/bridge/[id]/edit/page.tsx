import type { Metadata } from "next";
import { EditBridgePage } from "./edit-bridge-page";

export const metadata: Metadata = {
  title: "Edit Bridge",
  description: "Edit bridge page",
};

type EditBridgeRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditBridgeRoute({ params }: EditBridgeRouteProps) {
  const { id } = await params;
  return <EditBridgePage id={id} />;
}
