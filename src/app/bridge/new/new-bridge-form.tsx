"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SelectionChipGroup } from "../../../components/ui/chip";
import {
  normalizeRichTextHtml,
  richTextHasContent,
} from "../rich-text";
import {
  loadBridges,
  saveBridges,
  type BridgeEntryKind,
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
        <p className="text-[0.78rem] font-semibold text-muted-foreground">
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

type RichTextFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

function RichTextField({ label, value, placeholder, onChange }: RichTextFieldProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML === value) return;
    editorRef.current.innerHTML = value;
  }, [value]);

  function applyCommand(command: "bold" | "italic" | "underline") {
    if (typeof document === "undefined") return;
    editorRef.current?.focus();
    document.execCommand(command);
    onChange(normalizeRichTextHtml(editorRef.current?.innerHTML ?? ""));
  }

  function handleInput() {
    onChange(normalizeRichTextHtml(editorRef.current?.innerHTML ?? ""));
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    if (typeof document !== "undefined") {
      document.execCommand("insertText", false, text);
    }
    onChange(normalizeRichTextHtml(editorRef.current?.innerHTML ?? ""));
  }

  const isEmpty = !richTextHasContent(value);

  return (
    <div className="grid gap-2">
      <span className="text-[0.78rem] font-semibold text-muted-foreground">{label}</span>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyCommand("bold")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-[0.84rem] font-semibold transition hover:bg-muted"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => applyCommand("italic")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-[0.84rem] italic transition hover:bg-muted"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => applyCommand("underline")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-[0.84rem] underline transition hover:bg-muted"
        >
          U
        </button>
      </div>

      <div className="relative w-full max-w-2xl rounded-xl border border-border bg-background">
        {isEmpty ? (
          <p className="pointer-events-none absolute left-3 top-3 text-[0.9rem] text-muted-foreground">
            {placeholder}
          </p>
        ) : null}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={handleInput}
          onPaste={handlePaste}
          className="min-h-28 px-3 py-3 text-[0.92rem] outline-none"
        />
      </div>
    </div>
  );
}

type NewBridgeFormState = {
  name: string;
  entryKind: BridgeEntryKind;
  bridgeType: BridgeType;
  isPrivateInternal: boolean;
  endpoint: string;
  environment: BridgeItem["environment"];
  method: NonNullable<BridgeItem["method"]>;
  apiHeaders: BridgeKeyValueItem[];
  apiQueryParams: BridgeKeyValueItem[];
  apiFormData: BridgeKeyValueItem[];
  apiBodyType: "none" | "json" | "raw";
  apiBody: string;
  requiredFields: BridgeKeyValueItem[];
  serviceName: string;
  secret: string;
  privateNote: string;
  publicNote: string;
};

type FormErrors = Partial<Record<keyof NewBridgeFormState, string>>;

const INITIAL_STATE: NewBridgeFormState = {
  name: "",
  entryKind: "bridge",
  bridgeType: "api",
  isPrivateInternal: false,
  endpoint: "",
  environment: "development",
  method: "POST",
  apiHeaders: [],
  apiQueryParams: [],
  apiFormData: [],
  apiBodyType: "none",
  apiBody: "",
  requiredFields: [],
  serviceName: "",
  secret: "",
  privateNote: "",
  publicNote: "",
};

function bridgeToFormState(bridge: BridgeItem): NewBridgeFormState {
  return {
    name: bridge.name,
    entryKind: bridge.entryKind ?? "bridge",
    bridgeType: bridge.bridgeType,
    isPrivateInternal: Boolean(bridge.isPrivateInternal),
    endpoint: bridge.endpoint,
    environment: bridge.environment,
    method: bridge.method ?? "POST",
    apiHeaders: bridge.apiConfig?.headers ?? [],
    apiQueryParams: bridge.apiConfig?.queryParams ?? [],
    apiFormData: bridge.apiConfig?.formData ?? [],
    apiBodyType: bridge.apiConfig?.bodyType ?? "none",
    apiBody: bridge.apiConfig?.body ?? "",
    requiredFields: bridge.requiredFields ?? [],
    serviceName: bridge.serviceName ?? "",
    secret: bridge.secret ?? "",
    privateNote: bridge.privateNote ?? "",
    publicNote: bridge.publicNote ?? bridge.notes ?? "",
  };
}

type NewBridgeFormProps = {
  mode?: "create" | "edit";
  bridge?: BridgeItem | null;
  chapterQuery?: string | null;
};

export function NewBridgeForm({
  mode = "create",
  bridge = null,
  chapterQuery = null,
}: NewBridgeFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<NewBridgeFormState>(() =>
    bridge ? bridgeToFormState(bridge) : INITIAL_STATE,
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showApiHeaders, setShowApiHeaders] = useState(() => form.apiHeaders.length > 0);
  const [showApiQueryParams, setShowApiQueryParams] = useState(
    () => form.apiQueryParams.length > 0,
  );
  const [showApiFormData, setShowApiFormData] = useState(() => form.apiFormData.length > 0);
  const targetChapterId = chapterQuery && chapterQuery !== "base" ? chapterQuery : null;
  const targetChapter =
    mode === "create" && targetChapterId
      ? loadBridges().find(
          (item) => item.id === targetChapterId && (item.entryKind ?? "bridge") === "chapter",
        ) ?? null
      : null;

  useEffect(() => {
    if (mode === "edit" && bridge) {
      const nextForm = bridgeToFormState(bridge);
      setForm(nextForm);
      setShowApiHeaders(nextForm.apiHeaders.length > 0);
      setShowApiQueryParams(nextForm.apiQueryParams.length > 0);
      setShowApiFormData(nextForm.apiFormData.length > 0);
      setErrors({});
    }
  }, [bridge, mode]);

  function updateField<K extends keyof NewBridgeFormState>(
    field: K,
    value: NewBridgeFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function addKeyValueItem(
    field: "apiHeaders" | "apiQueryParams" | "apiFormData" | "requiredFields",
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: [...prev[field], createKeyValueItem()],
    }));
  }

  function changeKeyValueItem(
    field: "apiHeaders" | "apiQueryParams" | "apiFormData" | "requiredFields",
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

  function removeKeyValueItem(
    field: "apiHeaders" | "apiQueryParams" | "apiFormData" | "requiredFields",
    id: string,
  ) {
    setForm((prev) => {
      const nextItems = prev[field].filter((item) => item.id !== id);

      if (field === "apiHeaders" && nextItems.length === 0) {
        setShowApiHeaders(false);
      }

      if (field === "apiQueryParams" && nextItems.length === 0) {
        setShowApiQueryParams(false);
      }

      if (field === "apiFormData" && nextItems.length === 0) {
        setShowApiFormData(false);
      }

      return {
        ...prev,
        [field]: nextItems,
      };
    });
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

    if (!(mode === "create" && form.entryKind === "note") && !form.name.trim()) {
      nextErrors.name = "Bridge name is required.";
    }

    if (form.entryKind === "bridge" && !form.endpoint.trim()) {
      nextErrors.endpoint = "Endpoint is required.";
    }

    if (form.entryKind === "bridge" && form.bridgeType === "webhook" && !form.secret.trim()) {
      nextErrors.secret = "Signing secret is required for webhook.";
    }

    if (form.entryKind === "bridge" && form.bridgeType === "grpc" && !form.serviceName.trim()) {
      nextErrors.serviceName = "Service name is required for gRPC.";
    }

    if (form.entryKind === "bridge" && form.bridgeType === "handshake" && !form.secret.trim()) {
      nextErrors.secret = "Handshake key is required for handshake.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function buildBridgeItem(): BridgeItem {
    const item: BridgeItem = {
      id: bridge?.id ?? createId(),
      name:
        mode === "create" && form.entryKind === "note"
          ? "Untitled note"
          : form.name.trim(),
      entryKind: form.entryKind,
      parentChapterId:
        mode === "create" ? targetChapter?.id ?? null : bridge?.parentChapterId ?? null,
      bridgeType: form.bridgeType,
      isPrivateInternal: form.isPrivateInternal,
      endpoint: form.entryKind === "bridge" ? form.endpoint.trim() : "",
      environment: form.environment,
      createdAt: bridge?.createdAt ?? new Date().toISOString(),
    };

    if (form.entryKind === "bridge" && form.bridgeType === "api") {
      item.method = form.method;
      item.apiConfig = {
        headers: cleanKeyValueItems(form.apiHeaders),
        queryParams: cleanKeyValueItems(form.apiQueryParams),
        formData: cleanKeyValueItems(form.apiFormData),
        bodyType: form.apiBodyType,
        body: form.apiBody.trim(),
      };
    }

    if (form.entryKind === "bridge" && form.bridgeType === "grpc") {
      item.serviceName = form.serviceName.trim();
    }

    if (
      form.entryKind === "bridge" &&
      form.bridgeType === "webhook" ||
      (form.entryKind === "bridge" &&
      form.bridgeType === "handshake" ||
      form.bridgeType === "grpc")
    ) {
      item.requiredFields = cleanKeyValueItems(form.requiredFields);
    }

    if (
      form.entryKind === "bridge" &&
      (form.bridgeType === "webhook" || form.bridgeType === "handshake")
    ) {
      item.secret = form.secret.trim();
    }

    const normalizedPrivateNote = normalizeRichTextHtml(form.privateNote);
    const normalizedPublicNote = normalizeRichTextHtml(form.publicNote);

    if (richTextHasContent(normalizedPrivateNote)) {
      item.privateNote = normalizedPrivateNote;
    }

    if (richTextHasContent(normalizedPublicNote)) {
      item.publicNote = normalizedPublicNote;
    }

    return item;
  }

  function saveBridge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setIsSaving(true);

    const existing = loadBridges();
    const item = buildBridgeItem();
    const nextItems =
      mode === "edit"
        ? existing.map((existingItem) => (existingItem.id === item.id ? item : existingItem))
        : [item, ...existing];

    saveBridges(nextItems);

    router.push(
      mode === "edit"
        ? `/bridge/${item.id}`
        : targetChapter
          ? `/bridge/${targetChapter.id}`
          : "/bridge",
    );
    router.refresh();
  }

  const isEditMode = mode === "edit";
  const isQuickCreateNote = !isEditMode && form.entryKind === "note";
  const description = isEditMode
    ? "Update the saved entry settings. Changes stay in your browser locally."
    : targetChapter
      ? `Create a new block and place it inside ${targetChapter.name}.`
    : form.entryKind === "bridge"
      ? "Create a bridge entry and save it locally in your browser."
      : form.entryKind === "chapter"
        ? "Create a chapter entry like a Notion page and save it locally in your browser."
        : "Create a note entry instantly.";
  const submitLabel = isSaving
    ? isEditMode
      ? "Saving changes..."
      : "Saving..."
    : isEditMode
      ? "Save changes"
      : form.entryKind === "bridge"
        ? "Save bridge"
        : form.entryKind === "chapter"
          ? "Save chapter"
          : "Save note";
  const cancelHref = isEditMode && bridge ? `/bridge/${bridge.id}` : targetChapter ? `/bridge/${targetChapter.id}` : "/bridge";
  const backHref = isEditMode && bridge ? `/bridge/${bridge.id}` : targetChapter ? `/bridge/${targetChapter.id}` : "/bridge";
  const backLabel = isEditMode ? bridge?.name ?? "Bridge" : targetChapter?.name ?? "Bridge";
  const entryKindOptions = [
    { label: "Bridge", value: "bridge" },
    { label: "Chapter", value: "chapter" },
    { label: "Note", value: "note" },
  ] as const;
  const bridgeTypeOptions = [
    { label: "API", value: "api" },
    { label: "Webhook", value: "webhook" },
    { label: "gRPC", value: "grpc" },
    { label: "Handshake", value: "handshake" },
  ] as const;
  const privateInternalOptions = [
    { label: "False", value: "false" },
    { label: "True", value: "true" },
  ] as const;
  const environmentOptions = [
    { label: "Development", value: "development" },
    { label: "Staging", value: "staging" },
    { label: "Production", value: "production" },
  ] as const;
  const methodOptions = [
    { label: "GET", value: "GET" },
    { label: "POST", value: "POST" },
    { label: "PUT", value: "PUT" },
    { label: "PATCH", value: "PATCH" },
    { label: "DELETE", value: "DELETE" },
  ] as const;
  const bodyTypeOptions = [
    { label: "None", value: "none" },
    { label: "JSON", value: "json" },
    { label: "Raw", value: "raw" },
  ] as const;

  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:text-foreground"
        >
          <span aria-hidden="true">&lt;</span>
          <span>{backLabel}</span>
        </Link>
        <div className="space-y-2">
          <h1 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.02em]">
            {isEditMode ? (
              "Edit bridge / chapter / note"
            ) : (
              <>
                <span>Create new </span>
                {entryKindOptions.map((option, index) => {
                  const isActive = form.entryKind === option.value;

                  return (
                    <span key={option.value}>
                      <button
                        type="button"
                        onClick={() => updateField("entryKind", option.value as BridgeEntryKind)}
                        className={`transition ${
                          isActive
                            ? "underline decoration-[1.5px] underline-offset-[5px]"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {option.label.toLowerCase()}
                      </button>
                      {index < entryKindOptions.length - 1 ? (
                        <span className="px-1 text-muted-foreground">/</span>
                      ) : (
                        <span>.</span>
                      )}
                    </span>
                  );
                })}
              </>
            )}
          </h1>
          <p className="max-w-2xl text-[0.9rem] leading-[1.5] text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <form className="grid gap-4 pt-1" onSubmit={saveBridge}>
        {!isQuickCreateNote ? (
          <label className="grid gap-1.5">
            <span className="text-[0.78rem] font-semibold text-muted-foreground">
              {form.entryKind === "bridge"
                ? "Bridge name"
                : form.entryKind === "chapter"
                  ? "Chapter title"
                  : "Note title"}
            </span>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className="w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
              placeholder={
                form.entryKind === "bridge"
                  ? "Primary API Bridge"
                  : form.entryKind === "chapter"
                    ? "Architecture chapter"
                    : "Implementation note"
              }
            />
            {errors.name ? <span className="text-[0.78rem] text-rose-600">{errors.name}</span> : null}
          </label>
        ) : null}

        {form.entryKind === "bridge" ? (
          <>
            <SelectionChipGroup
              label="Bridge type"
              options={[...bridgeTypeOptions]}
              value={form.bridgeType}
              onChange={(value) => updateField("bridgeType", value as BridgeType)}
            />

            <SelectionChipGroup
              label="Private/internal bridge"
              options={[...privateInternalOptions]}
              value={form.isPrivateInternal ? "true" : "false"}
              onChange={(value) => updateField("isPrivateInternal", value === "true")}
            />

            <label className="grid gap-1.5">
              <span className="text-[0.78rem] font-semibold text-muted-foreground">
                Endpoint
              </span>
              <input
                value={form.endpoint}
                onChange={(event) => updateField("endpoint", event.target.value)}
                className="w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
                placeholder="https://api.example.com/v1"
              />
              {errors.endpoint ? (
                <span className="text-[0.78rem] text-rose-600">{errors.endpoint}</span>
              ) : null}
            </label>

            <SelectionChipGroup
              label="Environment"
              options={[...environmentOptions]}
              value={form.environment}
              onChange={(value) => updateField("environment", value as BridgeItem["environment"])}
            />
          </>
        ) : null}

        {form.entryKind === "bridge" && form.bridgeType === "api" ? (
          <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-[0.78rem] font-semibold text-muted-foreground">
              API configuration
            </p>

            <SelectionChipGroup
              label="HTTP method"
              options={[...methodOptions]}
              value={form.method}
              onChange={(value) =>
                updateField("method", value as NonNullable<BridgeItem["method"]>)
              }
            />

            {showApiHeaders ? (
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
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowApiHeaders(true);
                  addKeyValueItem("apiHeaders");
                }}
                className="inline-flex w-fit rounded-full border border-border px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted"
              >
                Add header
              </button>
            )}

            {showApiQueryParams ? (
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
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowApiQueryParams(true);
                  addKeyValueItem("apiQueryParams");
                }}
                className="inline-flex w-fit rounded-full border border-border px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted"
              >
                Add query param
              </button>
            )}

            <SelectionChipGroup
              label="Body type"
              options={[...bodyTypeOptions]}
              value={form.apiBodyType}
              onChange={(value) =>
                updateField("apiBodyType", value as NewBridgeFormState["apiBodyType"])
              }
            />

            {form.apiBodyType !== "none" ? (
              <label className="grid gap-1.5">
                <span className="text-[0.78rem] font-semibold text-muted-foreground">
                  Body
                </span>
                <textarea
                  value={form.apiBody}
                  onChange={(event) => updateField("apiBody", event.target.value)}
                  className="min-h-24 w-full max-w-2xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
                  placeholder={
                    form.apiBodyType === "json"
                      ? '{ "key": "value" }'
                      : "Raw request body"
                  }
                />
              </label>
            ) : null}

            {showApiFormData ? (
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
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowApiFormData(true);
                  addKeyValueItem("apiFormData");
                }}
                className="inline-flex w-fit rounded-full border border-border px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted"
              >
                Add form field
              </button>
            )}
          </div>
        ) : null}

        {form.entryKind === "bridge" && form.bridgeType === "grpc" ? (
          <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <label className="grid gap-1.5">
              <span className="text-[0.78rem] font-semibold text-muted-foreground">
                Service name
              </span>
              <input
                value={form.serviceName}
                onChange={(event) => updateField("serviceName", event.target.value)}
                className="w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
                placeholder="BridgeService"
              />
              {errors.serviceName ? (
                <span className="text-[0.78rem] text-rose-600">{errors.serviceName}</span>
              ) : null}
            </label>

            <KeyValueEditor
              label="Required fields"
              hint="List the fields this gRPC bridge expects before it can run."
              items={form.requiredFields}
              addLabel="Add required field"
              onAdd={() => addKeyValueItem("requiredFields")}
              onChange={(id, field, value) =>
                changeKeyValueItem("requiredFields", id, field, value)
              }
              onRemove={(id) => removeKeyValueItem("requiredFields", id)}
            />
          </div>
        ) : null}

        {form.entryKind === "bridge" && (form.bridgeType === "webhook" || form.bridgeType === "handshake") ? (
          <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <label className="grid gap-1.5">
              <span className="text-[0.78rem] font-semibold text-muted-foreground">
                {form.bridgeType === "webhook" ? "Signing secret" : "Handshake key"}
              </span>
              <input
                value={form.secret}
                onChange={(event) => updateField("secret", event.target.value)}
                className="w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2.5 text-[0.92rem]"
                placeholder="••••••••••••"
              />
              {errors.secret ? (
                <span className="text-[0.78rem] text-rose-600">{errors.secret}</span>
              ) : null}
            </label>

            <KeyValueEditor
              label="Required fields"
              hint="List the fields this bridge expects in the incoming request or payload."
              items={form.requiredFields}
              addLabel="Add required field"
              onAdd={() => addKeyValueItem("requiredFields")}
              onChange={(id, field, value) =>
                changeKeyValueItem("requiredFields", id, field, value)
              }
              onRemove={(id) => removeKeyValueItem("requiredFields", id)}
            />
          </div>
        ) : null}

        {form.entryKind === "bridge" ? (
          <RichTextField
            label="Private note (optional)"
            value={form.privateNote}
            placeholder="Internal context, deployment details, or team-only notes..."
            onChange={(value) => updateField("privateNote", value)}
          />
        ) : null}

        {!isQuickCreateNote ? (
          <RichTextField
            label={
              form.entryKind === "bridge"
                ? "Public note (optional)"
                : form.entryKind === "chapter"
                  ? "Chapter content"
                  : "Note content"
            }
            value={form.publicNote}
            placeholder={
              form.entryKind === "bridge"
                ? "Public-facing note or bridge summary..."
                : form.entryKind === "chapter"
                  ? "Write the chapter content here..."
                  : "Write the note content here..."
            }
            onChange={(value) => updateField("publicNote", value)}
          />
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex rounded-full bg-primary px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {submitLabel}
          </button>
          <Link
            href={cancelHref}
            className="inline-flex rounded-full border border-border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground transition hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
