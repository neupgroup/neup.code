import type { BridgeItem, BridgeKeyValueItem } from "../../../../app/bridge/bridge-storage";

type ApiBridgeBlockProps = {
  apiFormData: BridgeKeyValueItem[];
  apiHeaders: BridgeKeyValueItem[];
  apiQueryParams: BridgeKeyValueItem[];
  bridge: BridgeItem & { apiConfig: NonNullable<BridgeItem["apiConfig"]> };
  hasRequestBody: boolean;
  requestUrl: string;
};

export function ApiBridgeBlock({
  apiFormData,
  apiHeaders,
  apiQueryParams,
  bridge,
  hasRequestBody,
  requestUrl,
}: ApiBridgeBlockProps) {
  return (
    <div className="grid gap-3 pt-2">
      <h2 className="text-[1.1rem] font-semibold tracking-[-0.01em]">
        API configuration
      </h2>
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Request preview
        </p>

        <div className="mt-3 grid gap-3 text-[0.84rem] text-foreground">
          <div>
            <p className="font-semibold">Method</p>
            <p className="mt-1 text-muted-foreground">{bridge.method ?? "GET"}</p>
          </div>

          <div>
            <p className="font-semibold">Request URL</p>
            <p className="mt-1 break-all text-muted-foreground">{requestUrl}</p>
          </div>

          {apiHeaders.length ? (
            <div>
              <p className="font-semibold">Headers</p>
              <div className="mt-1 grid gap-1">
                {apiHeaders.map((item) => (
                  <p key={item.id} className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {item.key || "(empty key)"}:
                    </span>{" "}
                    {item.value || "(empty value)"}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {apiQueryParams.length ? (
            <div>
              <p className="font-semibold">Query params</p>
              <div className="mt-1 grid gap-1">
                {apiQueryParams.map((item) => (
                  <p key={item.id} className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {item.key || "(empty key)"}
                    </span>
                    {" = "}
                    {item.value || "(empty value)"}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {apiFormData.length ? (
            <div>
              <p className="font-semibold">Form data</p>
              <div className="mt-1 grid gap-1">
                {apiFormData.map((item) => (
                  <p key={item.id} className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {item.key || "(empty key)"}
                    </span>
                    {" = "}
                    {item.value || "(empty value)"}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {apiFormData.length ? (
            <div>
              <p className="font-semibold">Request body</p>
              <p className="mt-1 text-muted-foreground">
                This request will be sent as multipart form data.
              </p>
            </div>
          ) : hasRequestBody ? (
            <div>
              <p className="font-semibold">Request body</p>
              <div className="mt-1">
                <p className="text-muted-foreground">
                  Body type:{" "}
                  <span className="font-medium text-foreground">
                    {bridge.apiConfig.bodyType}
                  </span>
                </p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-3 text-[0.78rem] text-foreground">
                  {bridge.apiConfig.body}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
