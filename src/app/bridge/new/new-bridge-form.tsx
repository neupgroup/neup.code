"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  loadBridges,
  saveBridges,
  type BridgeKeyValueItem,
  type BridgeItem,
  type BridgeType,
} from "../bridge-storage";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createKeyValueItem(): BridgeKeyValueItem {
  return { id: createId(), key: "", value: "" };
}

type KeyValueEditorProps = {
  label: string;
  hint?: string;
  items: BridgeKeyValueItem[];
  addLabel: string;
  onAdd: () => void;
  onChange: (id: string, field: "key" | "value", value: string) => void;
  onRemove: (id: string) => void;
};

function KeyValueEditor({
  label,
  hint,
  items,
  addLabel,
  onAdd,
  onChange,
  onRemove,
}: KeyValueEditorProps) {
  return (
    <div className="grid gap-2">
      <div>
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        {hint ? <p className="mt-1 text-[0.78rem] text-muted-foreground">{hint}</p> : null}
      </div>

      <div className="grid gap-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[0.78rem] text-muted-foreground">
            No entries added.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={item.key}
                onChange={(event) => onChange(item.id, "key", event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-[0.88rem]"
                placeholder="key"
              />
              <input
                value={item.value}
                onChange={(event) => onChange(item.id, "value", event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-[0.88rem]"
                placeholder="value"
              />
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="rounded-lg border border-border px-3 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground transition hover:bg-muted"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex w-fit rounded-full border border-border px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted"
      >
        {addLabel}
      </button>
    </div>
  );
}

type NewBridgeFormState = {
  name: string;
  bridgeType: BridgeType;
  endpoint: string;
  environment: BridgeItem["environment"];
  method: NonNullable<BridgeItem["method"]>;
  apiHeaders: BridgeKeyValueItem[];
  apiQueryParams: BridgeKeyValueItem[];
  apiFormData: BridgeKeyValueItem[];
  apiBodyType: "none" | "json" | "raw";
  apiBody: string;
  serviceName: string;
  secret: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof NewBridgeFormState, string>>;

const INITIAL_STATE: NewBridgeFormState = {
  name: "",
  bridgeType: "api",
  endpoint: "",
  environment: "development",
  method: "POST",
  apiHeaders: [],
  apiQueryParams: [],
  apiFormData: [],
  apiBodyType: "none",
  apiBody: "",
  serviceName: "",
  secret: "",
  notes: "",
};

export function NewBridgeForm() {
  const router = useRouter();
  const [form, setForm] = useState<NewBridgeFormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  function updateField<K extends keyof NewBridgeFormState>(
    field: K,
    value: NewBridgeFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function addKeyValueItem(field: "apiHeaders" | "apiQueryParams" | "apiFormData") {
    setForm((prev) => ({
      ...prev,
      [field]: [...prev[field], createKeyValueItem()],
    }));
  }

  function changeKeyValueItem(
    field: "apiHeaders" | "apiQueryParams" | "apiFormData",
    id: string,
    targetField: "key" | "value",
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].map((item) =>
        item.id === id ? { ...item, [targetField]: value } : item,
      ),
    }));
  }

  function removeKeyValueItem(field: "apiHeaders" | "apiQueryParams" | "apiFormData", id: string) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((item) => item.id !== id),
    }));
  }

  function cleanKeyValueItems(items: BridgeKeyValueItem[]) {
    return items
      .map((item) => ({
        id: item.id,
        key: item.key.trim(),
        value: item.value.trim(),
      }))
      .filter((item) => item.key.length > 0 || item.value.length > 0);
  }

  function validate() {
    const nextErrors: FormErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = "Bridge name is required.";
    }

    if (!form.endpoint.trim()) {
      nextErrors.endpoint = "Endpoint is required.";
    }

    if (form.bridgeType === "webhook" && !form.secret.trim()) {
      nextErrors.secret = "Signing secret is required for webhook.";
    }

    if (form.bridgeType === "grpc" && !form.serviceName.trim()) {
      nextErrors.serviceName = "Service name is required for gRPC.";
    }

    if (form.bridgeType === "handshake" && !form.secret.trim()) {
      nextErrors.secret = "Handshake key is required for handshake.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function buildBridgeItem(): BridgeItem {
    const item: BridgeItem = {
      id: createId(),
      name: form.name.trim(),
      bridgeType: form.bridgeType,
      endpoint: form.endpoint.trim(),
      environment: form.environment,
      createdAt: new Date().toISOString(),
    };

    if (form.bridgeType === "api") {
      item.method = form.method;
      item.apiConfig = {
        headers: cleanKeyValueItems(form.apiHeaders),
        queryParams: cleanKeyValueItems(form.apiQueryParams),
        formData: cleanKeyValueItems(form.apiFormData),
        bodyType: form.apiBodyType,
        body: form.apiBody.trim(),
      };
    }

    if (form.bridgeType === "grpc") {
      item.serviceName = form.serviceName.trim();
    }

    if (form.bridgeType === "webhook" || form.bridgeType === "handshake") {
      item.secret = form.secret.trim();
    }

    if (form.notes.trim()) {
      item.notes = form.notes.trim();
    }

    return item;
  }

  function saveBridge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setIsSaving(true);

    const existing = loadBridges();
    const item = buildBridgeItem();
    saveBridges([item, ...existing]);

    router.push("/bridge");
    router.refresh();
  }

  return (
    <section className="rounded-[1.1rem] border border-border bg-card p-6">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Bridge
      </p>
      <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">Create new bridge</h1>
      <p className="mt-1 text-[0.88rem] text-muted-foreground">
        Fill the essential details and save. This is stored in your browser locally.
      </p>

      <form className="mt-5 grid gap-4" onSubmit={saveBridge}>
        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Bridge name
          </span>
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
            placeholder="Primary API Bridge"
          />
          {errors.name ? <span className="text-[0.78rem] text-rose-600">{errors.name}</span> : null}
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Bridge type
          </span>
          <select
            value={form.bridgeType}
            onChange={(event) => updateField("bridgeType", event.target.value as BridgeType)}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
          >
            <option value="api">api</option>
            <option value="webhook">webhook</option>
            <option value="grpc">gRPC</option>
            <option value="handshake">handshake</option>
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Endpoint
          </span>
          <input
            value={form.endpoint}
            onChange={(event) => updateField("endpoint", event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
            placeholder="https://api.example.com/v1"
          />
          {errors.endpoint ? (
            <span className="text-[0.78rem] text-rose-600">{errors.endpoint}</span>
          ) : null}
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Environment
          </span>
          <select
            value={form.environment}
            onChange={(event) =>
              updateField("environment", event.target.value as BridgeItem["environment"])
            }
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
          >
            <option value="development">development</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
        </label>

        {form.bridgeType === "api" ? (
          <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              API configuration
            </p>

            <label className="grid gap-1.5">
              <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                HTTP method
              </span>
              <select
                value={form.method}
                onChange={(event) =>
                  updateField(
                    "method",
                    event.target.value as NonNullable<BridgeItem["method"]>,
                  )
                }
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </label>

            <KeyValueEditor
              label="Headers"
              hint="Add any custom request headers."
              items={form.apiHeaders}
              addLabel="Add header"
              onAdd={() => addKeyValueItem("apiHeaders")}
              onChange={(id, field, value) =>
                changeKeyValueItem("apiHeaders", id, field, value)
              }
              onRemove={(id) => removeKeyValueItem("apiHeaders", id)}
            />

            <KeyValueEditor
              label="Query params"
              hint="Optional query parameters appended to the endpoint."
              items={form.apiQueryParams}
              addLabel="Add query param"
              onAdd={() => addKeyValueItem("apiQueryParams")}
              onChange={(id, field, value) =>
                changeKeyValueItem("apiQueryParams", id, field, value)
              }
              onRemove={(id) => removeKeyValueItem("apiQueryParams", id)}
            />

            <label className="grid gap-1.5">
              <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Body type
              </span>
              <select
                value={form.apiBodyType}
                onChange={(event) =>
                  updateField(
                    "apiBodyType",
                    event.target.value as NewBridgeFormState["apiBodyType"],
                  )
                }
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
              >
                <option value="none">none</option>
                <option value="json">json</option>
                <option value="raw">raw</option>
              </select>
            </label>

            {form.apiBodyType !== "none" ? (
              <label className="grid gap-1.5">
                <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Body
                </span>
                <textarea
                  value={form.apiBody}
                  onChange={(event) => updateField("apiBody", event.target.value)}
                  className="min-h-24 rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
                  placeholder={
                    form.apiBodyType === "json"
                      ? '{ "key": "value" }'
                      : "Raw request body"
                  }
                />
              </label>
            ) : null}

            <KeyValueEditor
              label="Form data"
              hint="Add multipart form data fields."
              items={form.apiFormData}
              addLabel="Add form field"
              onAdd={() => addKeyValueItem("apiFormData")}
              onChange={(id, field, value) =>
                changeKeyValueItem("apiFormData", id, field, value)
              }
              onRemove={(id) => removeKeyValueItem("apiFormData", id)}
            />
          </div>
        ) : null}

        {form.bridgeType === "grpc" ? (
          <label className="grid gap-1.5">
            <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Service name
            </span>
            <input
              value={form.serviceName}
              onChange={(event) => updateField("serviceName", event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
              placeholder="BridgeService"
            />
            {errors.serviceName ? (
              <span className="text-[0.78rem] text-rose-600">{errors.serviceName}</span>
            ) : null}
          </label>
        ) : null}

        {form.bridgeType === "webhook" || form.bridgeType === "handshake" ? (
          <label className="grid gap-1.5">
            <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {form.bridgeType === "webhook" ? "Signing secret" : "Handshake key"}
            </span>
            <input
              value={form.secret}
              onChange={(event) => updateField("secret", event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
              placeholder="••••••••••••"
            />
            {errors.secret ? (
              <span className="text-[0.78rem] text-rose-600">{errors.secret}</span>
            ) : null}
          </label>
        ) : null}

        <label className="grid gap-1.5">
          <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Notes (optional)
          </span>
          <textarea
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            className="min-h-24 rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
            placeholder="Any deployment or handshake notes..."
          />
        </label>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save bridge"}
          </button>
          <Link
            href="/bridge"
            className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
