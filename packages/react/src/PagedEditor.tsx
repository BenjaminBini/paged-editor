import { useRef, useEffect, useCallback } from "react";

/**
 * Events emitted by the editor iframe via postMessage.
 */
interface EditorMessage {
  source: "paged-editor";
  type: "ready" | "save" | "change";
  payload: {
    file?: string;
    name?: string;
  };
}

export interface PagedEditorProps {
  /** URL or same-origin path where the paged-editor server is mounted (e.g., "/editor") */
  apiUrl: string;

  /** Additional CSS class for the container div */
  className?: string;

  /** Inline styles for the container div */
  style?: React.CSSProperties;

  /** Called when the editor has finished loading */
  onReady?: () => void;

  /** Called when a file is saved */
  onSave?: (file: string, name: string) => void;

  /** Called when file content changes (debounced ~500ms) */
  onChange?: (file: string, name: string) => void;
}

/**
 * Embeddable Markdown editor with Paged.js preview.
 *
 * Renders the paged-editor in an iframe and communicates via postMessage.
 * The editor server must be running at `apiUrl`.
 *
 * @example
 * ```tsx
 * import { PagedEditor } from '@paged-editor/react';
 *
 * function App() {
 *   return (
 *     <PagedEditor
 *       apiUrl="/editor"
 *       onSave={(file, name) => console.log('Saved:', name)}
 *       style={{ width: '100%', height: '100vh' }}
 *     />
 *   );
 * }
 * ```
 */
export function PagedEditor({
  apiUrl,
  className,
  style,
  onReady,
  onSave,
  onChange,
}: PagedEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Stable callback refs to avoid re-subscribing on every render
  const onReadyRef = useRef(onReady);
  const onSaveRef = useRef(onSave);
  const onChangeRef = useRef(onChange);

  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const handleMessage = useCallback((event: MessageEvent) => {
    // Only accept messages from our editor iframe
    if (!event.data || event.data.source !== "paged-editor") return;

    const msg = event.data as EditorMessage;

    switch (msg.type) {
      case "ready":
        onReadyRef.current?.();
        break;
      case "save":
        if (msg.payload.file && msg.payload.name) {
          onSaveRef.current?.(msg.payload.file, msg.payload.name);
        }
        break;
      case "change":
        if (msg.payload.file && msg.payload.name) {
          onChangeRef.current?.(msg.payload.file, msg.payload.name);
        }
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Normalize URL — strip trailing slash
  const src = apiUrl.replace(/\/+$/, "");

  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <iframe
        ref={iframeRef}
        src={src}
        style={{
          border: "none",
          width: "100%",
          height: "100%",
          display: "block",
        }}
        title="Paged Editor"
        allow="clipboard-write"
      />
    </div>
  );
}
