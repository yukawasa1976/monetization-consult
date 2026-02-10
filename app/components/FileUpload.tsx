"use client";

import { useRef } from "react";

type FileUploadProps = {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  disabled: boolean;
};

export default function FileUpload({
  onFileSelect,
  selectedFile,
  onClear,
  disabled,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      alert("ファイルサイズは4MB以下にしてください");
      return;
    }
    onFileSelect(file);
  };

  if (selectedFile) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 shrink-0"
        >
          <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
        </svg>
        <span className="max-w-[150px] truncate">{selectedFile.name}</span>
        <button
          onClick={onClear}
          disabled={disabled}
          className="ml-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={handleChange}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-300 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-30"
        title="ファイルをアップロード（PDF・DOCX・TXT）"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path
            fillRule="evenodd"
            d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 18.835a2.25 2.25 0 0 1-3.182-3.182l.991-.991.005-.005 9.003-9.003a.75.75 0 0 1 1.06 1.06l-9.003 9.003-.005.005-.991.991a.75.75 0 0 0 1.061 1.06L18.97 6.84a2.25 2.25 0 0 0 0-3.182Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </>
  );
}
