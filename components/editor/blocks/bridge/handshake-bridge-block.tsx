import type { BridgeItem, BridgeKeyValueItem } from "../../../../app/bridge/bridge-storage";

type HandshakeBridgeBlockProps = {
  bridge: BridgeItem;
  requiredFields: BridgeKeyValueItem[];
};

export function HandshakeBridgeBlock({
  bridge,
  requiredFields,
}: HandshakeBridgeBlockProps) {
  if (!bridge.serviceName && !bridge.secret && !requiredFields.length) {
    return null;
  }

  return (
    <div className="grid gap-3 pt-2">
      <h2 className="text-[1.1rem] font-semibold tracking-[-0.01em]">
        Bridge configuration
      </h2>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="grid gap-3 text-[0.84rem] text-foreground">
          {bridge.serviceName ? (
            <div>
              <p className="font-semibold">Service name</p>
              <p className="mt-1 text-muted-foreground">{bridge.serviceName}</p>
            </div>
          ) : null}

          {bridge.secret ? (
            <div>
              <p className="font-semibold">Handshake key</p>
              <p className="mt-1 text-muted-foreground">Configured</p>
            </div>
          ) : null}

          {requiredFields.length ? (
            <div>
              <p className="font-semibold">Required fields</p>
              <div className="mt-1 grid gap-1">
                {requiredFields.map((item) => (
                  <p key={item.id} className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {item.key || "(empty key)"}
                    </span>
                    {item.value ? ` - ${item.value}` : ""}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
