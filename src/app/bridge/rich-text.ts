const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "BR", "DIV", "P"]);

function sanitizeNode(node: Node, doc: Document) {
  if (node.nodeType === Node.TEXT_NODE) return;

  if (node.nodeType !== Node.ELEMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }

  const element = node as HTMLElement;

  for (const child of Array.from(element.childNodes)) {
    sanitizeNode(child, doc);
  }

  if (!ALLOWED_TAGS.has(element.tagName)) {
    const fragment = doc.createDocumentFragment();
    while (element.firstChild) {
      fragment.appendChild(element.firstChild);
    }
    element.parentNode?.replaceChild(fragment, element);
    return;
  }

  for (const attribute of Array.from(element.attributes)) {
    element.removeAttribute(attribute.name);
  }
}

export function normalizeRichTextHtml(html: string) {
  const trimmed = html.trim();
  if (!trimmed) return "";
  if (typeof window === "undefined") return trimmed;

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(`<div>${trimmed}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;

  if (!root) return "";

  sanitizeNode(root, doc);

  return root.innerHTML
    .replace(/<div><br><\/div>/gi, "<br>")
    .replace(/<p><br><\/p>/gi, "<br>")
    .trim();
}

export function richTextHasContent(html: string) {
  return richTextToPlainText(html).length > 0;
}

export function richTextToPlainText(html: string) {
  const normalized = normalizeRichTextHtml(html);
  return normalized
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function richTextToMarkdown(html: string) {
  const normalized = normalizeRichTextHtml(html);
  if (!normalized) return "";

  return normalized
    .replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, (_, __, content) => `**${content}**`)
    .replace(/<(em|i)>(.*?)<\/(em|i)>/gi, (_, __, content) => `*${content}*`)
    .replace(/<u>(.*?)<\/u>/gi, (_, content) => `<u>${content}</u>`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p)>/gi, "\n\n")
    .replace(/<(div|p)>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
