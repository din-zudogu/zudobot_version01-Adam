"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHROME_EXTENSION_ID,
  CHROME_WEB_STORE_URL,
  chromeWebStoreUrl,
  getChromeRuntime,
} from "@/lib/widget/integration/chromeExtension";

type Provider = "github" | "gitlab" | "bitbucket" | "codecommit";
type Step =
  | "choose_provider"
  | "codecommit_choice"
  | "codecommit_form"
  | "codecommit_cloudformation"
  | "pick_repo"
  | "agent_running"
  | "preview_live"
  | "failed";

type Props = {
  tenantId: string;
  embedKey: string;
  onFallbackToManual: () => void;
};

type ConnectionResp = {
  connection: { id: string; provider: Provider; repoIdentifier: string | null } | null;
};
type RepoSummary = { id: string; name: string; fullName: string };
type JobStatusResp = { status: string; pullRequestUrl?: string | null; errorMessage?: string | null };

export function GitConnectFlow({ tenantId, embedKey, onFallbackToManual }: Props) {
  const [step, setStep] = useState<Step>("choose_provider");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [jobId, setJobId] = useState<string | null>(null);
  const [pullRequestUrl, setPullRequestUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // AWS CodeCommit key-paste form state
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("");
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState("");
  const [awsRegion, setAwsRegion] = useState("ap-southeast-1");

  // AWS CodeCommit CloudFormation (cross-account IAM Role) flow state
  const [cfLaunchUrl, setCfLaunchUrl] = useState<string | null>(null);
  const [cfExternalIdToken, setCfExternalIdToken] = useState<string | null>(null);
  const [cfRoleArn, setCfRoleArn] = useState("");
  const [cfRegion, setCfRegion] = useState("ap-southeast-1");
  const [cfBusy, setCfBusy] = useState(false);
  const [cfStarting, setCfStarting] = useState(false);

  // Preview step — relocated Chrome-extension tab-injection logic (unchanged
  // mechanism, only its placement moved out of the old standalone "extension" tab).
  const extensionId = CHROME_EXTENSION_ID;
  const storeUrl = extensionId ? chromeWebStoreUrl(extensionId) : CHROME_WEB_STORE_URL || "";
  const [previewBusy, setPreviewBusy] = useState(false);
  const [goLiveBusy, setGoLiveBusy] = useState(false);

  const loadConnection = useCallback(async () => {
    const res = await fetch("/api/integration/git/connections", { cache: "no-store" });
    const data = (await res.json()) as ConnectionResp;
    if (data.connection) {
      setConnectionId(data.connection.id);
      if (data.connection.repoIdentifier) {
        setStep("agent_running");
      } else {
        setStep("pick_repo");
      }
    }
  }, []);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  function startOAuth(provider: Exclude<Provider, "codecommit">) {
    window.location.href = `/api/integration/git/oauth/${provider}/start`;
  }

  async function submitCodeCommitKeys() {
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/integration/git/connections/codecommit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey, region: awsRegion }),
      });
      const data = (await res.json()) as { ok?: boolean; connectionId?: string; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error === "invalid_aws_credentials" ? "ข้อมูล AWS ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" : "เชื่อมต่อไม่สำเร็จ");
        return;
      }
      setConnectionId(data.connectionId ?? null);
      await loadRepos(data.connectionId ?? null);
      setStep("pick_repo");
    } finally {
      setBusy(false);
    }
  }

  async function startCloudFormationFlow() {
    setCfStarting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/integration/git/connections/codecommit/cloudformation/start", {
        method: "POST",
      });
      const data = (await res.json()) as { launchUrl?: string; externalIdToken?: string; error?: string };
      if (!res.ok || !data.launchUrl || !data.externalIdToken) {
        setErrorMessage("ไม่สามารถเริ่มขั้นตอนนี้ได้ กรุณาลองใหม่");
        return;
      }
      setCfLaunchUrl(data.launchUrl);
      setCfExternalIdToken(data.externalIdToken);
      window.open(data.launchUrl, "_blank", "noopener,noreferrer");
    } finally {
      setCfStarting(false);
    }
  }

  async function submitCloudFormationRole() {
    if (!cfExternalIdToken || !cfRoleArn.trim()) return;
    setCfBusy(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/integration/git/connections/codecommit/cloudformation/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleArn: cfRoleArn.trim(), region: cfRegion, externalIdToken: cfExternalIdToken }),
      });
      const data = (await res.json()) as { ok?: boolean; connectionId?: string; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(
          data.error === "assume_role_failed"
            ? "เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบว่าสร้าง Stack เสร็จสมบูรณ์แล้ว และคัดลอก Role ARN มาถูกต้อง"
            : data.error === "invalid_or_expired_state"
              ? "หมดเวลาเชื่อมต่อ กรุณาเริ่มใหม่อีกครั้ง"
              : "เชื่อมต่อไม่สำเร็จ"
        );
        return;
      }
      setConnectionId(data.connectionId ?? null);
      await loadRepos(data.connectionId ?? null);
      setStep("pick_repo");
    } finally {
      setCfBusy(false);
    }
  }

  const loadRepos = useCallback(async (cid: string | null) => {
    const id = cid ?? connectionId;
    if (!id) return;
    const res = await fetch(`/api/integration/git/repos?connectionId=${id}`, { cache: "no-store" });
    const data = (await res.json()) as { repos?: RepoSummary[] };
    setRepos(data.repos ?? []);
  }, [connectionId]);

  useEffect(() => {
    if (step === "pick_repo" && connectionId) void loadRepos(connectionId);
  }, [step, connectionId, loadRepos]);

  async function confirmRepoAndTrigger() {
    if (!connectionId || !selectedRepo) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const patchRes = await fetch(`/api/integration/git/connections/${connectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoIdentifier: selectedRepo, defaultBranch: selectedBranch }),
      });
      if (!patchRes.ok) {
        setErrorMessage("ไม่สามารถเข้าถึงเว็บไซต์นี้ได้ กรุณาเลือกใหม่");
        return;
      }
      const triggerRes = await fetch("/api/integration/git/agent/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = (await triggerRes.json()) as { jobId?: string };
      if (data.jobId) {
        setJobId(data.jobId);
        setStep("agent_running");
      } else {
        setErrorMessage("เริ่มการติดตั้งไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step !== "agent_running" || !jobId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/integration/git/agent/status?jobId=${jobId}`, { cache: "no-store" });
      const data = (await res.json()) as JobStatusResp;
      if (data.status === "pr_open") {
        setPullRequestUrl(data.pullRequestUrl ?? null);
        setStep("preview_live");
        clearInterval(interval);
      } else if (data.status === "failed") {
        setErrorMessage(data.errorMessage ?? "ไม่สามารถติดตั้งอัตโนมัติได้");
        setStep("failed");
        clearInterval(interval);
      } else if (data.status === "live") {
        setStep("preview_live");
        clearInterval(interval);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [step, jobId]);

  function tryPreviewOnOwnSite() {
    if (!extensionId || !getChromeRuntime()?.sendMessage) {
      if (storeUrl && window.confirm("ต้องติดตั้งตัวช่วยของ Zudobot ใน Chrome ก่อนถึงจะทดลองดูได้ — ไปที่ Chrome Web Store เลยไหม?")) {
        window.open(storeUrl, "_blank", "noopener,noreferrer");
      } else {
        window.alert("เปิดหน้านี้ใน Google Chrome และติดตั้งตัวช่วยก่อน แล้วเปิดเว็บไซต์ของคุณ คลิกไอคอน Zudobot บนแถบเครื่องมือ แล้วกด \"ฝังสคริปต์บนแท็บนี้\"");
      }
      return;
    }
    setPreviewBusy(true);
    getChromeRuntime()!.sendMessage(
      extensionId,
      { action: "INJECT_WIDGET_SCRIPT", tenantId, widgetId: embedKey },
      () => {
        setPreviewBusy(false);
        window.alert("เปิดเว็บไซต์ของคุณ คลิกไอคอน Zudobot บนแถบเครื่องมือ Chrome แล้วกด \"ฝังสคริปต์บนแท็บนี้\" เพื่อดูตัวอย่าง");
      }
    );
  }

  async function confirmGoLive() {
    if (!jobId) return;
    if (
      !window.confirm(
        "ยืนยันว่าต้องการให้ Zudobot แสดงบนเว็บไซต์จริงของคุณเลยใช่ไหม? ลูกค้าทุกคนที่เข้าเว็บจะเห็นทันทีหลังจากนี้"
      )
    ) {
      return;
    }
    setGoLiveBusy(true);
    try {
      const res = await fetch("/api/integration/git/golive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (res.ok) {
        window.alert("Zudobot กำลังทำงานอยู่บนหน้าเว็บไซต์จริงของคุณแล้ว");
      } else {
        window.alert("ใช้งานบนเว็บไซต์จริงไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setGoLiveBusy(false);
    }
  }

  if (step === "choose_provider") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 text-sm text-text-secondary leading-relaxed">
          <p className="font-semibold text-brand-800 mb-1">เชื่อมต่อเว็บไซต์ของคุณ</p>
          <p>เลือกที่เก็บโค้ดของเว็บไซต์คุณ ระบบจะติดตั้งให้อัตโนมัติ</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => startOAuth("github")} className="py-3 rounded-xl border border-border-default bg-white hover:bg-surface-secondary text-sm font-semibold">
            GitHub
          </button>
          <button type="button" onClick={() => startOAuth("gitlab")} className="py-3 rounded-xl border border-border-default bg-white hover:bg-surface-secondary text-sm font-semibold">
            GitLab
          </button>
          <button type="button" onClick={() => startOAuth("bitbucket")} className="py-3 rounded-xl border border-border-default bg-white hover:bg-surface-secondary text-sm font-semibold">
            Bitbucket
          </button>
          <button type="button" onClick={() => setStep("codecommit_choice")} className="py-3 rounded-xl border border-border-default bg-white hover:bg-surface-secondary text-sm font-semibold">
            AWS CodeCommit
          </button>
        </div>
      </div>
    );
  }

  if (step === "codecommit_choice") {
    return (
      <div className="space-y-3 max-w-md">
        <p className="text-sm text-text-secondary">เลือกวิธีเชื่อมต่อ AWS CodeCommit</p>
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setStep("codecommit_cloudformation");
          }}
          className="w-full text-left py-3 px-4 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100"
        >
          <p className="text-sm font-semibold text-brand-800">แนะนำ — เชื่อมต่อผ่าน AWS Console</p>
          <p className="text-xs text-text-secondary mt-0.5">คลิกปุ่มเดียว ระบบเตรียมข้อมูลไว้ให้หมดแล้ว ไม่ต้องพิมพ์อะไรเอง ไม่ต้องสร้าง Access Key</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setStep("codecommit_form");
          }}
          className="w-full text-left py-3 px-4 rounded-xl border border-border-default bg-white hover:bg-surface-secondary"
        >
          <p className="text-sm font-semibold text-text-primary">วางกุญแจ AWS ด้วยตนเอง</p>
          <p className="text-xs text-text-muted mt-0.5">สำหรับผู้ที่มี AWS Access Key อยู่แล้ว</p>
        </button>
        <button type="button" onClick={() => setStep("choose_provider")} className="text-xs text-text-muted hover:text-text-primary">
          ← กลับ
        </button>
      </div>
    );
  }

  if (step === "codecommit_cloudformation") {
    return (
      <div className="space-y-3 max-w-md">
        <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 text-sm text-text-secondary leading-relaxed">
          <p className="font-semibold text-brand-800 mb-1">เชื่อมต่อผ่าน AWS Console</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>กดปุ่มด้านล่างเพื่อเปิดหน้า AWS CloudFormation (ข้อมูลกรอกไว้ให้แล้ว)</li>
            <li>ตรวจสอบหน้าสรุป แล้วกด &quot;Create stack&quot; ในหน้า AWS</li>
            <li>รอสถานะเป็น &quot;CREATE_COMPLETE&quot; แล้วเปิดแท็บ Outputs เพื่อคัดลอกค่า &quot;RoleArn&quot;</li>
            <li>นำ Role ARN มาวางด้านล่างนี้</li>
          </ol>
        </div>
        <button
          type="button"
          disabled={cfStarting}
          onClick={() => void startCloudFormationFlow()}
          className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50"
        >
          {cfStarting ? "กำลังเตรียมข้อมูล..." : cfLaunchUrl ? "↗ เปิดหน้า AWS อีกครั้ง" : "↗ เปิดหน้า AWS Console"}
        </button>
        {cfLaunchUrl && (
          <div className="space-y-3 pt-2 border-t border-border-default">
            <input
              type="text"
              placeholder="วาง Role ARN ที่นี่ (arn:aws:iam::...)"
              value={cfRoleArn}
              onChange={(e) => setCfRoleArn(e.target.value)}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm font-mono"
            />
            <input
              type="text"
              placeholder="AWS Region (e.g. ap-southeast-1)"
              value={cfRegion}
              onChange={(e) => setCfRegion(e.target.value)}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm font-mono"
            />
            {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
            <button
              type="button"
              disabled={cfBusy || !cfRoleArn.trim()}
              onClick={() => void submitCloudFormationRole()}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {cfBusy ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ"}
            </button>
          </div>
        )}
        {!cfLaunchUrl && errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
        <button type="button" onClick={() => setStep("codecommit_choice")} className="text-xs text-text-muted hover:text-text-primary">
          ← กลับ
        </button>
      </div>
    );
  }

  if (step === "codecommit_form") {
    return (
      <div className="space-y-3 max-w-md">
        <input type="text" placeholder="AWS Access Key ID" value={awsAccessKeyId} onChange={(e) => setAwsAccessKeyId(e.target.value)} className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm font-mono" />
        <input type="password" placeholder="AWS Secret Access Key" value={awsSecretAccessKey} onChange={(e) => setAwsSecretAccessKey(e.target.value)} className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm font-mono" />
        <input type="text" placeholder="AWS Region (e.g. ap-southeast-1)" value={awsRegion} onChange={(e) => setAwsRegion(e.target.value)} className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm font-mono" />
        {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
        <button type="button" disabled={busy} onClick={() => void submitCodeCommitKeys()} className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50">
          {busy ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ"}
        </button>
        <button type="button" onClick={() => setStep("codecommit_choice")} className="text-xs text-text-muted hover:text-text-primary">
          ← กลับ
        </button>
      </div>
    );
  }

  if (step === "pick_repo") {
    return (
      <div className="space-y-3 max-w-md">
        <p className="text-sm text-text-secondary">เลือกเว็บไซต์ที่ต้องการติดตั้ง</p>
        <select value={selectedRepo} onChange={(e) => setSelectedRepo(e.target.value)} className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm">
          <option value="">-- เลือกเว็บไซต์ --</option>
          {repos.map((r) => (
            <option key={r.id} value={r.fullName}>{r.fullName}</option>
          ))}
        </select>
        <input type="text" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} placeholder="สาขาหลัก (เช่น main)" className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm font-mono" />
        {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
        <button type="button" disabled={busy || !selectedRepo} onClick={() => void confirmRepoAndTrigger()} className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50">
          {busy ? "กำลังเริ่มติดตั้ง..." : "เริ่มติดตั้ง"}
        </button>
      </div>
    );
  }

  if (step === "agent_running") {
    return (
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6 text-center space-y-2">
        <p className="text-sm font-semibold text-text-primary">⏳ กำลังติดตั้ง Zudobot ให้เว็บไซต์ของคุณ...</p>
        <p className="text-xs text-text-muted">อาจใช้เวลาสักครู่</p>
      </div>
    );
  }

  if (step === "failed") {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-3">
        <p>⚠️ ระบบไม่สามารถติดตั้งอัตโนมัติให้เว็บไซต์นี้ได้</p>
        <button type="button" onClick={onFallbackToManual} className="text-sm font-semibold text-brand-700 hover:underline">
          ไปที่วิธีคัดลอกโค้ดแทน →
        </button>
      </div>
    );
  }

  // preview_live
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-4">
      <div>
        <p className="text-sm font-semibold text-amber-900">🟡 สถานะ: กำลังทดลองใช้งาน</p>
        <p className="text-xs text-amber-800 mt-1">
          Zudobot ติดตั้งเรียบร้อยแล้ว แต่ยังเป็นเวอร์ชันทดลองอยู่ ลูกค้าที่เข้าเว็บไซต์จริงตอนนี้ยังไม่เห็น
        </p>
      </div>
      <div className="space-y-2 text-xs text-amber-900">
        <p className="font-semibold">ทดลองดูก่อนใช้งานจริง:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>เปิดเว็บไซต์ของคุณในแท็บใหม่</li>
          <li>คลิกไอคอน Zudobot บนแถบเครื่องมือ Chrome</li>
          <li>กด &quot;ฝังสคริปต์บนแท็บนี้&quot;</li>
        </ol>
      </div>
      <button
        type="button"
        disabled={previewBusy}
        onClick={tryPreviewOnOwnSite}
        className="w-full py-2.5 rounded-xl border border-brand-300 bg-white text-brand-700 text-sm font-semibold disabled:opacity-50"
      >
        👀 ทดลองดูตอนนี้
      </button>
      <button
        type="button"
        disabled={goLiveBusy}
        onClick={() => void confirmGoLive()}
        className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-50"
      >
        {goLiveBusy ? "กำลังใช้งาน..." : "✅ พร้อมแล้ว ใช้งานบนเว็บไซต์จริงเลย"}
      </button>
      {pullRequestUrl && <p className="text-[10px] text-amber-700 break-all">อ้างอิง: {pullRequestUrl}</p>}
    </div>
  );
}
