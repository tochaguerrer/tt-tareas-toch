import Image from "next/image";
import { createElement, Fragment, type ReactNode } from "react";
import { validateDocument, type RichNode } from "@/lib/requests/rich-content";

const attachmentUrl = (id: string) => `/inicio/solicitudes/adjuntos/${id}`;
const blocks: Record<string, string> = {
  paragraph: "p", bulletList: "ul", orderedList: "ol", listItem: "li",
  blockquote: "blockquote", codeBlock: "pre",
};
const marks: Record<string, string> = {
  bold: "strong", italic: "em", underline: "u", strike: "s", code: "code",
};

function renderNode(node: RichNode): ReactNode {
  if (node.type === "text") {
    return (node.marks ?? []).reduce<ReactNode>((content, mark) => {
      if (mark.type === "link") return <a href={mark.attrs?.href}>{content}</a>;
      if (mark.type === "textStyle") return (
        <span style={{ color: mark.attrs?.color, fontFamily: mark.attrs?.fontFamily }}>{content}</span>
      );
      return Object.hasOwn(marks, mark.type) ? createElement(marks[mark.type], null, content) : content;
    }, node.text);
  }
  if (node.type === "image") {
    return <Image src={attachmentUrl(String(node.attrs?.attachmentId)) + "?inline=1"}
      alt={String(node.attrs?.alt ?? "Imagen adjunta")} width={800} height={450}
      unoptimized style={{ maxWidth: "100%", height: "auto", width: "auto" }} />;
  }
  if (node.type === "hardBreak") return <br />;
  if (node.type === "horizontalRule") return <hr />;
  const children = node.content?.map((child, index) => <Fragment key={index}>{renderNode(child)}</Fragment>);
  if (node.type === "heading") return createElement(`h${Number(node.attrs?.level) + 1}`, null, children);
  if (Object.hasOwn(blocks, node.type)) {
    return createElement(blocks[node.type], node.type === "orderedList" ? { start: node.attrs?.start } : null, children);
  }
  return children;
}

export function RequestContent({ description, description_document, attachments }: { description: string; description_document: unknown; attachments: { id: string; filename: string }[] }) {
  let document: RichNode | undefined;
  if (description_document) {
    try {
      document = validateDocument(description_document, attachments.map(file => file.id)).document;
    } catch {
      // Legacy or invalid documents still have a plain-text description.
    }
  }
  return (
    <section>
      <h2>Detalle</h2>
      {document ? renderNode(document) : <p style={{ whiteSpace: "pre-wrap" }}>{description}</p>}
      <h2>Adjuntos</h2>
      {attachments.length ? <ul>{attachments.map(file => (
        <li key={file.id}><a href={attachmentUrl(file.id)}>{file.filename}</a></li>
      ))}</ul> : <p>Esta solicitud no tiene adjuntos.</p>}
    </section>
  );
}
