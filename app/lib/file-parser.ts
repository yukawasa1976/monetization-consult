const MAX_CHARS = 30000;

export async function parseFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();
  let text: string;

  switch (ext) {
    case "pdf": {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const data = new Uint8Array(buffer);
      const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => "str" in item ? item.str : "").join(""));
      }
      text = pages.join("\n");
      break;
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const result = await mammoth.default.extractRawText({ buffer });
      text = result.value;
      break;
    }
    case "txt": {
      text = buffer.toString("utf-8");
      break;
    }
    default:
      throw new Error(
        `未対応のファイル形式です: .${ext}（PDF・DOCX・TXTに対応しています）`
      );
  }

  if (text.length > MAX_CHARS) {
    return text.slice(0, MAX_CHARS) + "\n\n（以下省略：30,000文字を超えたため）";
  }
  return text;
}
