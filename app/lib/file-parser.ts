import mammoth from "mammoth";

const MAX_CHARS = 30000;

export async function parseFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();
  let text: string;

  switch (ext) {
    case "pdf": {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      text = result.text;
      parser.destroy();
      break;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
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
