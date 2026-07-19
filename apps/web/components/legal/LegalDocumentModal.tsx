"use client";

import { useEffect, useState } from "react";

export type LegalDocType = "DATA_PROCESSING_AGREEMENT" | "TENANT_TERMS_OF_SERVICE";

interface LegalDoc {
  documentType: LegalDocType;
  title: string;
  version?: string;
  content: string;   // HTML
  effectiveAt?: string;
  updatedAt?: string;
}

/** Fetches the ACTIVE document of a type and renders its HTML on a white surface. */
export function LegalDocumentBody({ documentType }: { documentType: LegalDocType }) {
  const [doc, setDoc]       = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(false);
      try {
        const res = await fetch(`/api/legal-documents/${documentType}/active`);
        const d = await res.json();
        if (!alive) return;
        if (res.ok && d.success) setDoc(d.data);
        else setError(true);
      } catch { if (alive) setError(true); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [documentType]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (error || !doc) {
    return <p className="text-sm text-gray-500 py-8 text-center">ยังไม่มีเอกสารฉบับใช้งาน — กรุณาตั้งค่าในระบบแอดมิน หรือรัน seed</p>;
  }

  return (
    <article className="bg-white text-gray-800 rounded-xl">
      <h2 className="text-lg font-bold text-gray-900">{doc.title}</h2>
      {doc.version && <p className="text-xs text-gray-400 mt-0.5 mb-4">เวอร์ชัน {doc.version}</p>}
      {/* Content is trusted (served from our own DB, seeded from our legal docs). */}
      <div className="legal-html text-sm leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: doc.content }} />
      <style jsx>{`
        .legal-html :global(h3) { font-weight: 700; color: #111827; margin-top: 1rem; margin-bottom: .25rem; }
        .legal-html :global(ul) { list-style: disc; padding-left: 1.25rem; }
        .legal-html :global(p)  { margin: .25rem 0; }
      `}</style>
    </article>
  );
}

/** White-background modal that displays a legal document. Used by consent links. */
export function LegalDocumentModal({ documentType, onClose }: { documentType: LegalDocType; onClose: () => void }) {
  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
          <span className="text-sm font-semibold text-gray-700">เอกสาร</span>
          <button onClick={onClose} className="text-xl text-gray-400 hover:text-gray-700 leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">
          <LegalDocumentBody documentType={documentType} />
        </div>
        <div className="px-6 py-3 border-t border-gray-200 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">ปิด</button>
        </div>
      </div>
    </div>
  );
}
