"use client";

import { useState, useRef, useCallback } from "react";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface PreviewRow {
  type?: string;
  summary?: string;
  rawTranscript?: string;
  cleanedText?: string;
}

export function ImportDialog({ isOpen, onClose, onImported }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview([]);
    setErrors([]);
    setResult(null);
    setImporting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const parsePreview = useCallback(async (f: File) => {
    setFile(f);
    setErrors([]);
    setResult(null);
    try {
      const text = await f.text();
      let rows: PreviewRow[];
      if (f.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        // CSV: parse header + first rows
        const lines = text.split("\n").filter((l) => l.trim());
        const headers = lines[0].split(",").map((h) => h.trim());
        rows = lines.slice(1).map((line) => {
          const vals = line.split(",");
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => {
            obj[h] = vals[i]?.trim() || "";
          });
          return obj as unknown as PreviewRow;
        });
      }
      setPreview(rows.slice(0, 5));
    } catch (err) {
      setErrors([`Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}`]);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) parsePreview(f);
    },
    [parsePreview]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parsePreview(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setErrors([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors([data.error || "Import failed"]);
      } else {
        setResult(data);
        if (data.imported > 0) {
          onImported();
        }
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Import failed"]);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Import Thoughts
          </h2>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Dropzone */}
        {!file && !result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-600"
            }`}
          >
            <svg className="mx-auto mb-3 h-10 w-10 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Drag & drop a file here, or click to browse
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Accepts .json and .csv files
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".json,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* Preview */}
        {file && !result && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {file.name}
              </span>
              <button
                onClick={reset}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                Change file
              </button>
            </div>

            {preview.length > 0 && (
              <div className="mb-4 max-h-60 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800">
                    <tr>
                      <th className="px-3 py-2 font-medium text-zinc-500">#</th>
                      <th className="px-3 py-2 font-medium text-zinc-500">Type</th>
                      <th className="px-3 py-2 font-medium text-zinc-500">Content</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                          {row.type || "note"}
                        </td>
                        <td className="max-w-md truncate px-3 py-2 text-zinc-600 dark:text-zinc-300">
                          {row.summary || row.cleanedText || row.rawTranscript || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 dark:bg-red-950">
            {errors.map((err, i) => (
              <p key={i} className="text-sm text-red-600 dark:text-red-400">
                {err}
              </p>
            ))}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mb-4">
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Successfully imported {result.imported} thought{result.imported !== 1 ? "s" : ""}
              </p>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950">
                <p className="mb-1 text-sm font-medium text-amber-700 dark:text-amber-300">
                  {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}:
                </p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {result ? "Close" : "Cancel"}
          </button>
          {file && !result && (
            <button
              onClick={handleImport}
              disabled={importing || errors.length > 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
