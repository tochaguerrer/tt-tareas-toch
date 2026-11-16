"use client";
import {useEditor,EditorContent,type Editor} from "@tiptap/react";
import { useId, useRef, type ReactNode } from "react";
import StarterKit from "@tiptap/starter-kit";
import {TextStyle,FontFamily,Color} from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";
import {fonts} from "@/lib/requests/rich-content";
const AttachmentImage=Image.extend({
  addAttributes(){return {...this.parent?.(),attachmentId:{default:null}};},
});
export function RichEditor({ onReady, onChange, onAddFiles, disabled, attachmentsDisabled, attachments }: {
  onReady: (editor: Editor) => void;
  onChange: (value: string) => void;
  onAddFiles: (files: File[]) => void;
  disabled: boolean;
  attachmentsDisabled: boolean;
  attachments: ReactNode;
}) {
  const menuId = useId();
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const editor=useEditor({
    extensions:[StarterKit.configure({heading:{levels:[1,2,3]},link:{openOnClick:false}}),TextStyle,FontFamily,Color,AttachmentImage],
    immediatelyRender:false,shouldRerenderOnTransaction:true,
    content:{type:"doc",content:[{type:"paragraph"}]},
    onCreate:({editor})=>onReady(editor),
    onUpdate:({editor})=>onChange(JSON.stringify(editor.getJSON())),
    editable:!disabled,
    editorProps:{
      attributes:{"aria-label":"Detalle de la Solicitud de Servicio","role":"textbox","aria-multiline":"true",class:"request-editor"},
      handlePaste(_view,event){
        const files=Array.from(event.clipboardData?.files??[]);
        if(files.length){event.preventDefault();onAddFiles(files);return true;}return false;
      },
      handleDrop(_view,event){
        const files=Array.from(event.dataTransfer?.files??[]);
        if(files.length){event.preventDefault();onAddFiles(files);return true;}return false;
      },
      transformPastedHTML(html){
        const doc=new DOMParser().parseFromString(html,"text/html");
        doc.querySelectorAll("img,script,style,iframe,object").forEach(node=>node.remove());
        return doc.body.innerHTML;
      },
    },
  });
  if (!editor) return <p className="field-help">Cargando editor…</p>;

  const button = (label: string, symbol: string, run: () => void, active?: boolean) =>
    <button type="button" aria-label={label} title={label} aria-pressed={active} disabled={disabled}
      onMouseDown={event => event.preventDefault()} onClick={run}>{symbol}</button>;
  const heading = [1, 2, 3].find(level => editor.isActive("heading", { level }));

  return <div className="rich-editor-shell" data-empty={editor.isEmpty}>
    <div className="editor-toolbar" role="group" aria-label="Formato del detalle">
      <div className="editor-tool-group">
        {button("Deshacer", "↶", () => editor.chain().focus().undo().run())}
        {button("Rehacer", "↷", () => editor.chain().focus().redo().run())}
      </div>
      <select aria-label="Tipo de bloque" disabled={disabled} value={heading ?? "paragraph"} onChange={event => {
        const value = event.target.value;
        if (value === "paragraph") editor.chain().focus().setParagraph().run();
        else editor.chain().focus().setHeading({ level: Number(value) as 1 | 2 | 3 }).run();
      }}>
        <option value="paragraph">Texto normal</option>
        <option value="1">Título 1</option><option value="2">Título 2</option><option value="3">Título 3</option>
      </select>
      <div className="editor-tool-group">
        {button("Negrita", "𝐁", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {button("Cursiva", "𝑰", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {button("Tachado", "S̶", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
        {button("Subrayado", "U̲", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
        {button("Enlace", "🔗", () => {
          const href = window.prompt("Dirección del enlace (https://…)", editor.getAttributes("link").href ?? "");
          if (href && /^https?:\/\//i.test(href)) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
        }, editor.isActive("link"))}
        {button("Bloque de código", "‹›", () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}
      </div>
      <button type="button" popoverTarget={menuId + "-format"} aria-label="Más opciones de formato" title="Más opciones de formato" disabled={disabled}>⋯</button>
      <div id={menuId + "-format"} popover="auto" className="editor-menu" aria-label="Más opciones de formato">
        <label>Fuente <select disabled={disabled} value={editor.getAttributes("textStyle").fontFamily ?? "Arial"}
          onChange={event => editor.chain().focus().setFontFamily(event.target.value).run()}>
          {fonts.map(font => <option key={font}>{font}</option>)}
        </select></label>
        <label>Color del texto <input type="color" defaultValue="#18253b" disabled={disabled}
          onInput={event => editor.chain().focus().setColor(event.currentTarget.value).run()} /></label>
      </div>
    </div>
    <fieldset className="editor-editable" disabled={disabled}>
      <legend className="sr-only">Detalle de la Solicitud de Servicio</legend>
      <EditorContent editor={editor} />
    </fieldset>
    <div className="editor-attachments">
      <div className="editor-toolbar editor-insert-bar">
        <button type="button" popoverTarget={menuId + "-insert"} aria-label="Insertar" title="Insertar" disabled={disabled}>＋</button>
        <div id={menuId + "-insert"} popover="auto" className="editor-menu editor-insert-menu" aria-label="Insertar">
          {button("Viñetas", "Viñetas", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
          {button("Lista numerada", "Lista numerada", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
          {button("Cita", "Cita", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
          {button("Separador", "Separador", () => editor.chain().focus().setHorizontalRule().run())}
          <div className="editor-upload-options">
            <button type="button" disabled={attachmentsDisabled} onClick={() => imageInput.current?.click()}>Insertar imagen</button>
            <button type="button" disabled={attachmentsDisabled} onClick={() => fileInput.current?.click()}>Adjuntar archivos</button>
          </div>
        </div>
        <p className="field-help">Pegá capturas o arrastrá archivos al detalle.</p>
      </div>
      <input ref={imageInput} type="file" hidden multiple accept=".png,.jpg,.jpeg,.webp,.gif" disabled={attachmentsDisabled}
        onChange={event => {
          onAddFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }} />
      <input ref={fileInput} type="file" hidden multiple accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.docx,.xlsx,.pptx,.zip" disabled={attachmentsDisabled}
        onChange={event => {
          onAddFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }} />
      {attachments}
    </div>
  </div>;
}
