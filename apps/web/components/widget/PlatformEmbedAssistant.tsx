"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildEmbedScript,
  buildWidgetEmbedAssistant,
  buildWidgetEmbedAssistantsForDomains,
  type MultiSiteEmbedEntry,
  type SecurityWorkflowStatus,
  type WidgetEmbedResult,
} from "@/lib/widget/embed-platforms";
import {
  EMBED_SCRIPT_LOADING_MESSAGE,
  EMBED_SCRIPT_NOT_READY_MESSAGE,
  resolveWidgetScriptIntegrity,
} from "@/lib/widget/resolveWidgetScriptIntegrity";

const PATH1_TENANT_STEPS = [
  "กดปุ่ม「คัดลอกโค้ด」ด้านบน",
  "เข้าหน้าแก้ไขเว็บของคุณ (เช่น WordPress → ธีม → footer หรือช่อง Custom Code)",
  "วางโค้ดไว้ก่อนบรรทัด </body> แล้วกดบันทึก",
  "เปิดเว็บร้านจริง — ต้องเป็นโดเมนเดียวกับที่ตั้งใน Allowed Domain ด้านล่าง",
  "ถ้าเห็นปุ่มแชทมุมล่าง แปลว่าติดตั้งสำเร็จ",
] as const;

type Props = {
  tenantId: string;
  embedKey: string;
  appUrl: string;
  /** ไม่ส่งก็ได้ — ดึงจาก NEXT_PUBLIC_* บน Amplify อัตโนมัติ */
  scriptIntegrity?: string;
  allowedDomains?: string[];
  scriptPath?: string;
  variant?: "dashboard" | "admin";
  /** Admin: หลายโดเมน — สคริปต์เดียว + คู่มือแยกต่อเว็บ */
  multiSite?: boolean;
  /** Dashboard: แสดงเฉพาะสคริปต์ Manual (ซ่อนคู่มือแพลตฟอร์มยาว) */
  compact?: boolean;
};

function resolveAllowedDomain(domains: string[], targetUrl: string): string {
  if (domains.length === 0) return "";
  const trimmed = targetUrl.trim();
  if (trimmed) {
    try {
      const host = new URL(
        trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
      ).hostname.toLowerCase();
      const hit = domains.find((d) => d.toLowerCase() === host);
      if (hit) return hit;
    } catch {
      /* fall through */
    }
  }
  return domains[0];
}

function CopyButton({
  text,
  variant,
  label,
}: {
  text: string;
  variant: "dashboard" | "admin";
  label?: string;
}) {
  const defaultLabel =
    variant === "dashboard" ? "คัดลอกโค้ดไปติดตั้ง (Copy Code)" : "Copy สคริปต์";
  const buttonLabel = label ?? defaultLabel;
  const [copied, setCopied] = useState(false);
  const btnClass =
    variant === "admin"
      ? "text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
      : "text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700";

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className={btnClass}
    >
      {copied ? "✓ คัดลอกแล้ว" : buttonLabel}
    </button>
  );
}

function EmbedScriptBlock({
  embedScript,
  variant,
  title,
  subtitle,
  loading,
  onReload,
}: {
  embedScript: string | null;
  variant: "dashboard" | "admin";
  title: string;
  subtitle?: string;
  loading?: boolean;
  onReload?: () => void;
}) {
  const cardClass =
    variant === "admin"
      ? "bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm space-y-3"
      : "bg-surface-primary border border-border-default rounded-2xl p-5 space-y-3";
  const preClass =
    variant === "admin"
      ? "bg-zinc-900 text-emerald-400 rounded-xl p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap border border-zinc-800 select-all"
      : "bg-gray-950 text-green-400 rounded-xl p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap";

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p
          className={
            variant === "admin"
              ? "text-sm font-bold text-zinc-900"
              : "text-sm font-semibold text-text-primary"
          }
        >
          {title}
        </p>
        {embedScript && <CopyButton text={embedScript} variant={variant} />}
      </div>
      {subtitle && (
        <p className={variant === "admin" ? "text-xs text-zinc-500" : "text-xs text-text-muted"}>
          {subtitle}
        </p>
      )}
      <pre className={preClass}>
        {loading
          ? EMBED_SCRIPT_LOADING_MESSAGE
          : embedScript ?? EMBED_SCRIPT_NOT_READY_MESSAGE}
      </pre>
      {!embedScript && !loading && onReload && (
        <button
          type="button"
          onClick={onReload}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          โหลดโค้ดใหม่
        </button>
      )}
      {embedScript && (
        <p className={variant === "admin" ? "text-xs text-zinc-500" : "text-xs text-text-muted"}>
          {variant === "admin"
            ? "พร้อมคัดลอก — วางก่อน "
            : "คัดลอกไปวางก่อน "}
          <code className="bg-surface-secondary px-1 rounded">&lt;/body&gt;</code>
          {variant === "dashboard" && " บนเว็บร้านของคุณ"}
        </p>
      )}
    </div>
  );
}

function buildReadyEmbedScript(params: {
  tenantId: string;
  embedKey: string;
  appUrl: string;
  scriptIntegrity: string;
  scriptPath?: string;
}): string | null {
  if (!params.embedKey) return null;
  try {
    return buildEmbedScript({
      tenantId: params.tenantId,
      embedKey: params.embedKey,
      allowedDomain: "pending",
      appUrl: params.appUrl,
      scriptIntegrity: params.scriptIntegrity,
      scriptPath: params.scriptPath,
    });
  } catch {
    return null;
  }
}

function SecurityPanel({
  status,
  variant,
}: {
  status: SecurityWorkflowStatus;
  variant: "dashboard" | "admin";
}) {
  const border =
    variant === "admin"
      ? "border border-zinc-200 rounded-xl p-4"
      : "border border-border-default rounded-xl p-4";

  return (
    <div className={border}>
      <p
        className={
          variant === "admin"
            ? "text-xs font-semibold text-zinc-900 mb-3"
            : "text-xs font-semibold text-text-primary mb-3"
        }
      >
        PATH 1 — Manual embed security
      </p>
      <ul className="space-y-2 text-xs">
        {(
          [
            ["โดเมนตรง Allowed Domain", status.domainMatched],
            ["SRI (Subresource Integrity)", status.sriEnabled],
          ] as const
        ).map(([label, ok]) => (
          <li key={label} className="flex justify-between gap-2">
            <span className={variant === "admin" ? "text-zinc-500" : "text-text-muted"}>
              {label}
            </span>
            <span className={ok ? "text-green-600" : "text-amber-600"}>
              {ok ? "พร้อม" : "รอดำเนินการ"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SiteGuidePanel({
  entry,
  variant,
}: {
  entry: MultiSiteEmbedEntry;
  variant: "dashboard" | "admin";
}) {
  const { result, domain } = entry;
  const guideBoxClass =
    variant === "admin"
      ? "rounded-xl bg-zinc-50 p-4 text-sm border border-zinc-100"
      : "rounded-xl bg-surface-secondary p-4 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span
          className={
            variant === "admin"
              ? "px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-medium"
              : "px-2 py-1 rounded-full bg-brand-100 text-brand-700 font-medium"
          }
        >
          {result.manualGuide.displayName}
        </span>
        <span
          className={
            variant === "admin"
              ? "px-2 py-1 rounded-full bg-zinc-100 text-zinc-600"
              : "px-2 py-1 rounded-full bg-surface-secondary text-text-muted"
          }
        >
          {result.manualGuide.installationType}
        </span>
        <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-mono">
          {domain}
        </span>
      </div>

      <div className={guideBoxClass}>
        <p
          className={
            variant === "admin"
              ? "font-bold text-zinc-900 mb-2 text-sm"
              : "font-medium text-text-primary mb-2"
          }
        >
          คู่มือติดตั้ง: {result.manualGuide.displayName}
        </p>
        <ol
          className={
            variant === "admin"
              ? "list-decimal list-inside space-y-1 text-zinc-600 text-xs"
              : "list-decimal list-inside space-y-1 text-text-secondary text-xs"
          }
        >
          {result.manualGuide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <SecurityPanel status={result.securityWorkflowStatus} variant={variant} />
    </div>
  );
}

function TenantSingleSiteAssistant({
  tenantId,
  embedKey,
  appUrl,
  scriptIntegrity: scriptIntegrityProp,
  scriptPath,
  variant = "dashboard",
  compact = false,
}: Omit<Props, "allowedDomains" | "multiSite"> & {
  variant?: "dashboard" | "admin";
  compact?: boolean;
}) {
  const [tenantDomain, setTenantDomain] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [serverEmbedScript, setServerEmbedScript] = useState<string | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const scriptIntegrity = resolveWidgetScriptIntegrity(scriptIntegrityProp);

  const loadEmbedFromServer = useCallback(async () => {
    setScriptLoading(true);
    setScriptError(null);
    try {
      const res = await fetch("/api/tenant/embed-snippet", { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        embedScript?: string;
        message?: string;
        error?: string;
      };
      if (res.ok && data.ok && data.embedScript) {
        setServerEmbedScript(data.embedScript);
      } else {
        setServerEmbedScript(null);
        setScriptError(
          data.message ??
            "โค้ดยังไม่พร้อม ลองกดโหลดใหม่หรือแจ้งทีมงาน Zudobot"
        );
      }
    } catch {
      setServerEmbedScript(null);
      setScriptError("โหลดโค้ดไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setScriptLoading(false);
    }
  }, []);

  useEffect(() => {
    if (compact) void loadEmbedFromServer();
  }, [compact, loadEmbedFromServer]);

  useEffect(() => {
    fetch("/api/tenant/domains")
      .then((r) => r.json())
      .then((d: { domain?: string | null }) => {
        const dmn = d.domain?.trim() ?? "";
        setTenantDomain(dmn);
        if (dmn) setTargetUrl(`https://${dmn}`);
      });
  }, []);

  const domains = tenantDomain ? [tenantDomain] : [];
  const allowedDomain = resolveAllowedDomain(domains, targetUrl);

  const readyEmbedScript = useMemo(
    () =>
      buildReadyEmbedScript({
        tenantId,
        embedKey,
        appUrl,
        scriptIntegrity,
        scriptPath,
      }),
    [tenantId, embedKey, appUrl, scriptIntegrity, scriptPath]
  );

  const assistant = useMemo((): WidgetEmbedResult | null => {
    if (!embedKey || !allowedDomain) return null;
    try {
      return buildWidgetEmbedAssistant({
        tenantId,
        embedKey,
        allowedDomain,
        targetUrl: targetUrl.trim() || undefined,
        appUrl,
        scriptIntegrity,
        scriptPath,
      });
    } catch {
      return null;
    }
  }, [
    tenantId,
    embedKey,
    allowedDomain,
    targetUrl,
    appUrl,
    scriptIntegrity,
    scriptPath,
  ]);

  const displayScript =
    serverEmbedScript ?? assistant?.embedScript ?? readyEmbedScript;
  const cardClass = "bg-surface-primary border border-border-default rounded-2xl p-5";

  return (
    <div className="space-y-6">
      <EmbedScriptBlock
        variant={variant}
        title={compact ? "วิธีที่ 2 — คัดลอกโค้ดไปวางเอง" : "Embed Script (SRI + Whitelist)"}
        subtitle={
          compact
            ? "ทำตามขั้นตอนด้านล่าง — ใช้ได้ทันที ไม่ต้องตั้งค่าเซิร์ฟเวอร์เอง"
            : "โค้ดพร้อมใช้งาน — คัดลอกไปวางก่อน </body>"
        }
        embedScript={displayScript}
        loading={compact && scriptLoading}
        onReload={compact ? () => void loadEmbedFromServer() : undefined}
      />

      {compact ? (
        <>
          <div className={`${cardClass} space-y-2`}>
            <p className="text-xs font-semibold text-text-primary">ทำตามนี้ทีละขั้น</p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-text-secondary">
              {PATH1_TENANT_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          {scriptError && !displayScript && (
            <p className="text-xs text-amber-700">{scriptError}</p>
          )}
          {!tenantDomain && displayScript && (
            <p className="text-xs text-text-muted">
              อย่าลืมตั้ง Allowed Domain ด้านล่างให้ตรงกับโดเมนเว็บร้าน (เช่น shop.com)
            </p>
          )}
          {assistant && (
            <button
              type="button"
              onClick={() => setShowManualGuide((v) => !v)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              {showManualGuide ? "ซ่อนคู่มือ Manual" : "ดูคู่มือติดตั้ง Manual (แพลตฟอร์ม)"}
            </button>
          )}
          {showManualGuide && assistant && (
            <div className={`${cardClass} space-y-4`}>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://my-store.com"
                className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm font-mono"
              />
              <SiteGuidePanel
                entry={{ domain: allowedDomain, targetUrl, result: assistant }}
                variant={variant}
              />
            </div>
          )}
        </>
      ) : (
        <div className={`${cardClass} space-y-4`}>
          <p className="text-sm font-semibold text-text-primary">ตรวจจับแพลตฟอร์ม & คู่มือติดตั้ง</p>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://my-store.com"
            className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm font-mono"
          />
          {assistant && (
            <SiteGuidePanel
              entry={{ domain: allowedDomain, targetUrl, result: assistant }}
              variant={variant}
            />
          )}
          {!tenantDomain && displayScript && (
            <p className="text-xs text-zinc-500">
              คัดลอกโค้ดด้านบนได้เลย — ตั้ง Allowed Domain ด้านล่างเพื่อให้ Widget โหลดบนร้านของคุณ
            </p>
          )}
          {!tenantDomain && !displayScript && (
            <p className="text-xs text-amber-600">{EMBED_SCRIPT_NOT_READY_MESSAGE}</p>
          )}
        </div>
      )}
    </div>
  );
}

function AdminMultiSiteAssistant({
  tenantId,
  embedKey,
  appUrl,
  scriptIntegrity: scriptIntegrityProp,
  scriptPath,
  allowedDomains,
  variant,
}: Required<
  Pick<Props, "tenantId" | "embedKey" | "appUrl" | "scriptPath" | "variant">
> & {
  scriptIntegrity?: string;
  allowedDomains: string[];
}) {
  const [activeDomain, setActiveDomain] = useState("");

  const scriptIntegrity = resolveWidgetScriptIntegrity(scriptIntegrityProp);

  useEffect(() => {
    if (allowedDomains.length === 0) {
      setActiveDomain("");
      return;
    }
    setActiveDomain((prev) =>
      prev && allowedDomains.includes(prev) ? prev : allowedDomains[0]
    );
  }, [allowedDomains]);

  const readyEmbedScript = useMemo(
    () =>
      buildReadyEmbedScript({
        tenantId,
        embedKey,
        appUrl,
        scriptIntegrity,
        scriptPath,
      }),
    [tenantId, embedKey, appUrl, scriptIntegrity, scriptPath]
  );

  const multi = useMemo(() => {
    if (!embedKey || allowedDomains.length === 0) return null;
    try {
      return buildWidgetEmbedAssistantsForDomains(
        { tenantId, embedKey, appUrl, scriptIntegrity, scriptPath },
        allowedDomains
      );
    } catch {
      return null;
    }
  }, [tenantId, embedKey, allowedDomains, appUrl, scriptIntegrity, scriptPath]);

  const displayScript = multi?.universalEmbedScript ?? readyEmbedScript;
  const activeEntry = multi?.sites.find((s) => s.domain === activeDomain) ?? multi?.sites[0];

  const cardClass = "bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm";

  return (
    <div className="space-y-6">
      <EmbedScriptBlock
        variant={variant}
        title={
          allowedDomains.length > 0
            ? `📦 โค้ดสคริปต์สากล (${allowedDomains.length} โดเมน)`
            : "📦 โค้ดสคริปต์สากล (Universal External Embed)"
        }
        subtitle="โค้ดชุดเดียววางบนทุกเว็บที่อนุมัติ — SRI จาก Amplify"
        embedScript={displayScript}
      />

      {multi && multi.sites.length > 0 && (
        <div className={`${cardClass} space-y-4`}>
          <div>
            <p className="text-sm font-bold text-zinc-900">
              🌐 คู่มือติดตั้งแยกตามเว็บไซต์ ({multi.sites.length})
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              เลือกโดเมนเพื่อดูแพลตฟอร์มที่ตรวจจับได้และขั้นตอนติดตั้ง
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {multi.sites.map((site) => (
              <button
                key={site.domain}
                type="button"
                onClick={() => setActiveDomain(site.domain)}
                className={[
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  activeDomain === site.domain
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-zinc-400",
                ].join(" ")}
              >
                {site.domain}
              </button>
            ))}
          </div>

          {activeEntry && <SiteGuidePanel entry={activeEntry} variant={variant} />}
        </div>
      )}

      {allowedDomains.length === 0 && displayScript && (
        <p className="text-xs text-zinc-500 px-1">
          คัดลอกโค้ดด้านบนได้เลย — เพิ่มโดเมนใน Whitelist ด้านล่างเพื่อเปิดใช้งานบนแต่ละเว็บ
        </p>
      )}
      {allowedDomains.length === 0 && !displayScript && (
        <p className="text-xs text-amber-600 px-1">{EMBED_SCRIPT_NOT_READY_MESSAGE}</p>
      )}
    </div>
  );
}

export function PlatformEmbedAssistant(props: Props) {
  const {
    multiSite = false,
    allowedDomains,
    variant = "dashboard",
    compact = false,
  } = props;

  const isAdminMulti =
    multiSite || (variant === "admin" && (allowedDomains?.length ?? 0) > 0);

  if (isAdminMulti && allowedDomains) {
    return (
      <AdminMultiSiteAssistant
        tenantId={props.tenantId}
        embedKey={props.embedKey}
        appUrl={props.appUrl}
        scriptIntegrity={props.scriptIntegrity}
        scriptPath={props.scriptPath ?? "/api/public/zudobot/widget.js"}
        allowedDomains={allowedDomains}
        variant={variant}
      />
    );
  }

  return (
    <TenantSingleSiteAssistant
      {...props}
      variant={variant ?? "dashboard"}
      compact={compact}
    />
  );
}
