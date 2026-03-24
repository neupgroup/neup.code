import type { BridgeItem, BridgeKeyValueItem } from "../../../../app/bridge/bridge-storage";
import { ApiBridgeBlock } from "./api-bridge-block";
import { GrpcBridgeBlock } from "./grpc-bridge-block";
import { HandshakeBridgeBlock } from "./handshake-bridge-block";
import { WebhookBridgeBlock } from "./webhook-bridge-block";

type BridgeTypeBlockProps = {
  apiFormData: BridgeKeyValueItem[];
  apiHeaders: BridgeKeyValueItem[];
  apiQueryParams: BridgeKeyValueItem[];
  bridge: BridgeItem;
  hasRequestBody: boolean;
  requestUrl: string;
  requiredFields: BridgeKeyValueItem[];
};

export function BridgeTypeBlock({
  apiFormData,
  apiHeaders,
  apiQueryParams,
  bridge,
  hasRequestBody,
  requestUrl,
  requiredFields,
}: BridgeTypeBlockProps) {
  if (bridge.bridgeType === "api" && bridge.apiConfig) {
    return (
      <ApiBridgeBlock
        apiFormData={apiFormData}
        apiHeaders={apiHeaders}
        apiQueryParams={apiQueryParams}
        bridge={{ ...bridge, apiConfig: bridge.apiConfig }}
        hasRequestBody={hasRequestBody}
        requestUrl={requestUrl}
      />
    );
  }

  if (bridge.bridgeType === "webhook") {
    return <WebhookBridgeBlock bridge={bridge} requiredFields={requiredFields} />;
  }

  if (bridge.bridgeType === "grpc") {
    return <GrpcBridgeBlock bridge={bridge} requiredFields={requiredFields} />;
  }

  return <HandshakeBridgeBlock bridge={bridge} requiredFields={requiredFields} />;
}
