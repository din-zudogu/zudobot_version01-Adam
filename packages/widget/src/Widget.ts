import { getStyles } from "./styles";
import { initWidget, sendChatMessage, uploadFile, pollUpdates, recordConsent, createCheckout, fetchLegalDocument, recordDocConsent } from "./api";
import type { LegalDocType } from "./api";
import type { BotConfig, WidgetOptions, RecommendedProduct, FileAttachment } from "./types";

/** Exact wording shown (red) when a customer declines order-data consent. */
const CONSENT_DECLINE_MESSAGE =
  "หากท่านไม่ให้ความยินยอม ทางร้านค้าจะไม่สามารถเก็บข้อมูลการสั่งซื้อ เพื่อออกใบเสร็จรับเงินหรือทำการจัดส่งสินค้าให้ลูกค้าได้";

// ── File attachment constants ────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_MSG   = 3;
const ACCEPTED_TYPES = [
  "image/jpeg","image/png","image/gif","image/webp","image/bmp",
  "application/pdf",
  "audio/mpeg","audio/mp4","audio/wav","audio/ogg","audio/webm",
  "video/mp4","video/webm","video/quicktime",
];
const FILE_ICONS: Record<string, string> = {
  "image":       "🖼️",
  "application": "📄",
  "audio":       "🎵",
  "video":       "🎬",
};

// ── Session ID — persists across page navigations in same browser tab ──────

function getOrCreateSessionId(): string {
  const KEY = "zudobot_sid";
  let sid = sessionStorage.getItem(KEY);
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem(KEY, sid); }
  return sid;
}

// ── Visitor ID — persists across sessions in same browser (localStorage) ───

function getOrCreateVisitorId(embedKey: string): string {
  const KEY = `zudobot_vid_${embedKey}`;
  try {
    let vid = localStorage.getItem(KEY);
    if (!vid) { vid = crypto.randomUUID(); localStorage.setItem(KEY, vid); }
    return vid;
  } catch { return ""; }
}

// ── Consent helpers ───────────────────────────────────────────────────────

function getConsentKey(embedKey: string): string {
  return `zudobot_consent_${embedKey}`;
}

function loadConsent(embedKey: string): "given" | "declined" | null {
  try {
    const v = localStorage.getItem(getConsentKey(embedKey));
    if (v === "given" || v === "declined") return v;
  } catch { /* private browsing */ }
  return null;
}

function saveConsent(embedKey: string, value: "given" | "declined") {
  try { localStorage.setItem(getConsentKey(embedKey), value); } catch { /* ignore */ }
}

// ── Markdown-lite + XSS escape ────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderText(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) return escapeHtml(linkText);
      } catch { return escapeHtml(linkText); }
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    })
    .replace(/\n/g, "<br>");
}

function formatPrice(price: number, suffix: string): string {
  if (price === -1) return "ติดต่อสอบถาม";
  if (price === 0)  return "ฟรี";
  return `฿${price.toLocaleString("th-TH")}${suffix || ""}`;
}

function safeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch { return null; }
}

// ── Widget ────────────────────────────────────────────────────────────────

// ── fnc_zdb_chatbox message store ─────────────────────────────
interface MsgEntry {
  id:           string;
  role:         "user" | "bot" | "admin";
  text:         string;
  el:           HTMLElement;       // the .zd-msg element
  rowEl:        HTMLElement;       // the .zd-msg-row wrapper
  innerEl:      HTMLElement;       // the .zd-msg-inner element
  metaEl:       HTMLElement;       // timestamp + read receipt
  imgPreviews:  string[];
  unsent:       boolean;
  edited:       boolean;
  timestamp:    Date;
}

export class ZudobotWidget {
  private opts:           WidgetOptions;
  private config:         BotConfig | null = null;
  private sessionId:      string = getOrCreateSessionId();
  private visitorId:      string = "";
  private isOpen          = false;
  private isSending       = false;
  private handoffMode     = false;
  private consentGiven:   boolean | null = null;  // null = not yet decided
  private pollInterval:   ReturnType<typeof setInterval> | null = null;
  private lastPollTime    = new Date().toISOString();

  private containerEl!:  HTMLElement;
  private messagesEl!:   HTMLElement;
  private inputEl!:      HTMLTextAreaElement;
  private sendBtn!:      HTMLButtonElement;
  private consentEl?:    HTMLElement;
  private fileInput!:    HTMLInputElement;
  private filePreviewEl!: HTMLElement;
  private pendingFiles:        File[]   = [];
  private pendingFilePreviews: string[] = [];

  // fnc_zdb_chatbox state
  private msgStore:      Map<string, MsgEntry> = new Map();
  private unreadCount    = 0;
  private editingId:     string | null = null;
  private editBarEl?:    HTMLElement;
  private badgeEl?:      HTMLElement;
  private previewEl?:    HTMLElement;
  private ctxMenu?:      HTMLElement;
  private longPressTimer?: ReturnType<typeof setTimeout>;

  // Drag-to-reposition (desktop mouse only)
  private customPosition: { top: number; left: number } | null = null;
  private dragState: { startX: number; startY: number; startTop: number; startLeft: number; moved: boolean } | null = null;
  private suppressNextClick = false;

  constructor(opts: WidgetOptions) { this.opts = opts; }

  async init() {
    this.visitorId = getOrCreateVisitorId(this.opts.embedKey);
    this.config = await initWidget(this.opts.embedKey, this.opts.apiUrl);

    if (!this.config) {
      this.config = {
        botName:        "Zudobot",
        welcomeMessage: "สวัสดีครับ มีอะไรให้ช่วยไหมครับ?",
        widgetColor:    this.opts.color,
        widgetPosition: this.opts.position,
        requireConsent: false,
      };
    }

    // Resolve existing consent from localStorage
    const stored = loadConsent(this.opts.embedKey);
    if (stored === "given")   { this.consentGiven = true;  }
    if (stored === "declined"){ this.consentGiven = false; }

    this.mount();
  }

  private mount() {
    const cfg  = this.config!;
    const side = cfg.widgetPosition === "bottom-left" ? "left" : "right";

    const style       = document.createElement("style");
    style.textContent = getStyles(cfg.widgetColor, cfg.widgetPosition);
    document.head.appendChild(style);

    const container = document.createElement("div");
    container.id    = "zudobot-container";
    container.innerHTML = `
      <div id="zudobot-preview"></div>
      <button id="zudobot-bubble" aria-label="เปิดแชท" style="${side}:24px">
        <img id="zudobot-logo" src="https://zudobotstorage.s3.ap-southeast-2.amazonaws.com/zudobot_single_logo-logo.PNG" alt="" />
        <span id="zudobot-bubble-close" style="display:none;font-size:20px;color:#fff;line-height:1;">✕</span>
        <span id="zudobot-badge"></span>
      </button>
      <div id="zudobot-window" class="zd-hidden" style="${side}:24px">
        <div id="zudobot-header">
          <div class="zd-avatar">
            <img src="https://zudobotstorage.s3.ap-southeast-2.amazonaws.com/zudobot_single_logo-logo.PNG" alt="Zudobot Logo" />
          </div>
          <div class="zd-bot-info">
            <div class="zd-title">${escapeHtml(cfg.botName)}</div>
            <div class="zd-subtitle"><span class="zd-online"></span>ออนไลน์ • พร้อมช่วยเหลือ</div>
          </div>
          <button id="zudobot-close" aria-label="ย่อกล่องสนทนา" title="ย่อกล่องสนทนา">
            <span class="zd-ico-min">⌄</span>
            <span class="zd-ico-back">←</span>
          </button>
        </div>
        <div id="zudobot-messages"></div>
        <div id="zudobot-footer">
          <div id="zudobot-edit-bar">
            <span>✏️ กำลังแก้ไขข้อความ</span>
            <button id="zudobot-edit-cancel" aria-label="ยกเลิก">✕</button>
          </div>
          <div id="zudobot-file-preview"></div>
          <div id="zudobot-input-row">
            <input type="file" id="zudobot-file-input" multiple accept="${ACCEPTED_TYPES.join(",")}" style="display:none" aria-label="แนบไฟล์" />
            <button id="zudobot-attach" aria-label="แนบไฟล์" title="แนบรูป/เอกสาร/เสียง/วิดีโอ (สูงสุด 10MB)">📎</button>
            <textarea id="zudobot-input" rows="1" placeholder="พิมพ์ข้อความ..." maxlength="800"></textarea>
            <button id="zudobot-send" aria-label="ส่ง">➤</button>
          </div>
          <div id="zudobot-meta">
            <a id="zudobot-powered" href="https://zudogu.com" target="_blank" rel="noopener noreferrer">
              Powered by <strong>ZUDOGU</strong>
            </a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(container);
    this.containerEl = container;

    const bubbleEl = document.getElementById("zudobot-bubble")!;
    bubbleEl.addEventListener("click", () => {
      if (this.suppressNextClick) { this.suppressNextClick = false; return; }
      this.toggle();
    });
    document.getElementById("zudobot-close")!.addEventListener("click",  () => this.toggle(false));

    this.setupDrag(bubbleEl, document.getElementById("zudobot-window")!);
    const saved = this.loadSavedPosition();
    if (saved) this.applyCustomPosition(saved.top, saved.left);

    this.messagesEl   = document.getElementById("zudobot-messages")!;
    this.inputEl      = document.getElementById("zudobot-input") as HTMLTextAreaElement;
    this.sendBtn      = document.getElementById("zudobot-send")  as HTMLButtonElement;
    this.fileInput    = document.getElementById("zudobot-file-input") as HTMLInputElement;
    this.filePreviewEl = document.getElementById("zudobot-file-preview")!;
    this.badgeEl       = document.getElementById("zudobot-badge")   as HTMLElement;
    this.previewEl     = document.getElementById("zudobot-preview") as HTMLElement;
    this.editBarEl     = document.getElementById("zudobot-edit-bar") as HTMLElement;

    // Edit cancel button
    document.getElementById("zudobot-edit-cancel")?.addEventListener("click", () => this.cancelEdit());

    // Close context menu on outside click
    document.addEventListener("click", () => this.closeContextMenu());

    this.sendBtn.addEventListener("click", () => this.send());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.send(); }
    });
    this.inputEl.addEventListener("input", () => {
      this.inputEl.style.height = "auto";
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 100) + "px";
    });

    // File attach button
    document.getElementById("zudobot-attach")!.addEventListener("click", () => {
      this.fileInput.click();
    });
    this.fileInput.addEventListener("change", () => {
      this.handleFileSelect(Array.from(this.fileInput.files ?? []));
      this.fileInput.value = ""; // reset so same file can be re-selected
    });

    // Paste image support — Ctrl+V / Cmd+V with image in clipboard
    this.inputEl.addEventListener("paste", (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItems = items.filter(it => it.type.startsWith("image/"));
      if (imageItems.length === 0) return; // normal text paste — let default handle
      e.preventDefault();
      const files = imageItems.map(it => it.getAsFile()).filter(Boolean) as File[];
      if (files.length > 0) this.handleFileSelect(files);
    });

    // Consent gate (legacy — kept for tenants that still enable requireConsent)
    if (cfg.requireConsent && this.consentGiven === null) {
      this.showConsentScreen();
    } else {
      if (cfg.consentText) {
        this.showPrivacyNotice(cfg.consentText);
      }
      this.appendBotMessage(cfg.welcomeMessage);
    }

    // Omni-channel bridge: auto-open + inject context when landing via LINE/FB/IG/TikTok link
    this.detectLaunchParams();
  }

  /** Non-blocking PDPA notice — no agree/decline required */
  private showPrivacyNotice(text: string) {
    const el = document.createElement("div");
    el.className = "zd-consent-screen zd-privacy-notice";
    el.innerHTML = `
      <div class="zd-consent-icon">🔒</div>
      <p class="zd-consent-title">ความเป็นส่วนตัว</p>
      <p class="zd-consent-text">${escapeHtml(text)}</p>
    `;
    this.messagesEl.appendChild(el);
  }

  // ── Consent Screen ────────────────────────────────────────────────

  private showConsentScreen() {
    const cfg = this.config!;
    const consentText = cfg.consentText ||
      "ระบบนี้จะเก็บประวัติการสนทนาเพื่อให้บริการที่ดียิ่งขึ้น กรุณายืนยันความยินยอมก่อนเริ่มสนทนา";

    const el = document.createElement("div");
    el.id    = "zudobot-consent";
    el.className = "zd-consent-screen";
    el.innerHTML = `
      <div class="zd-consent-icon">🔒</div>
      <p class="zd-consent-title">นโยบายความเป็นส่วนตัว</p>
      <p class="zd-consent-text">${escapeHtml(consentText)}</p>
      <div class="zd-consent-actions">
        <button id="zd-consent-accept" class="zd-consent-btn zd-consent-accept">ยินยอม</button>
        <button id="zd-consent-decline" class="zd-consent-btn zd-consent-decline">ไม่ยินยอม</button>
      </div>
      <p class="zd-consent-note">หากไม่ยินยอม บอทจะยังตอบได้แต่ไม่บันทึกประวัติ</p>
    `;
    this.messagesEl.appendChild(el);
    this.consentEl = el;

    // Disable input while showing consent
    this.inputEl.disabled = true;
    this.sendBtn.disabled = true;

    document.getElementById("zd-consent-accept")!.addEventListener("click", () => this.handleConsent(true));
    document.getElementById("zd-consent-decline")!.addEventListener("click", () => this.handleConsent(false));
  }

  private async handleConsent(given: boolean) {
    this.consentGiven = given;
    saveConsent(this.opts.embedKey, given ? "given" : "declined");
    recordConsent(this.opts.embedKey, this.opts.apiUrl, this.sessionId, given);

    if (this.consentEl) {
      this.consentEl.remove();
      this.consentEl = undefined;
    }

    this.inputEl.disabled = false;
    this.sendBtn.disabled = false;

    if (!given) {
      const notice = document.createElement("div");
      notice.className = "zd-msg zd-bot";
      notice.innerHTML = "ℹ️ บอทจะตอบในโหมด <strong>ไม่บันทึกประวัติ</strong> — การสนทนานี้จะไม่ถูกเก็บข้อมูล";
      this.messagesEl.appendChild(notice);
    }

    this.appendBotMessage(this.config!.welcomeMessage);
    this.scrollToBottom();
    this.inputEl.focus();
  }

  // ── Toggle ────────────────────────────────────────────────────────

  private toggle(forceState?: boolean) {
    this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
    const win    = document.getElementById("zudobot-window")!;
    win.classList.toggle("zd-hidden", !this.isOpen);
    const logoEl  = document.getElementById("zudobot-logo")  as HTMLImageElement | null;
    const closeEl = document.getElementById("zudobot-bubble-close") as HTMLSpanElement | null;
    if (logoEl)  logoEl.style.display  = this.isOpen ? "none" : "";
    if (closeEl) closeEl.style.display = this.isOpen ? "" : "none";
    if (this.isOpen && this.inputEl && !this.inputEl.disabled) this.inputEl.focus();
    // Clear unread when opening
    if (this.isOpen) this.clearUnread();
  }

  private clearUnread() {
    this.unreadCount = 0;
    if (this.badgeEl) { this.badgeEl.textContent = "0"; this.badgeEl.classList.remove("zd-show"); }
    if (this.previewEl) this.previewEl.classList.remove("zd-show");
  }

  private addUnread(previewText: string) {
    if (this.isOpen) return;
    this.unreadCount++;
    if (this.badgeEl) {
      this.badgeEl.textContent = this.unreadCount > 9 ? "9+" : String(this.unreadCount);
      this.badgeEl.classList.add("zd-show");
    }
    if (this.previewEl) {
      this.previewEl.textContent = previewText.length > 40 ? previewText.slice(0, 40) + "…" : previewText;
      this.previewEl.classList.add("zd-show");
    }
  }

  open()  { this.toggle(true);  }
  close() { this.toggle(false); }

  // ── Drag-to-reposition (desktop mouse only) ────────────────────────
  // Dragging the launcher bubble moves the whole widget anywhere within the
  // page viewport; the chat window and unread-preview follow it. Disabled on
  // mobile (<=767px) where the chat window takes over full-screen instead.

  private getPositionKey(): string {
    return `zudobot_pos_${this.opts.embedKey}`;
  }

  private loadSavedPosition(): { top: number; left: number } | null {
    try {
      const raw = localStorage.getItem(this.getPositionKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.top === "number" && typeof parsed?.left === "number") return parsed;
    } catch { /* private browsing */ }
    return null;
  }

  private savePosition(pos: { top: number; left: number }) {
    try { localStorage.setItem(this.getPositionKey(), JSON.stringify(pos)); } catch { /* private browsing */ }
  }

  private clampToViewport(top: number, left: number, w: number, h: number): { top: number; left: number } {
    const maxLeft = Math.max(0, window.innerWidth  - w);
    const maxTop  = Math.max(0, window.innerHeight - h);
    return { top: Math.min(Math.max(0, top), maxTop), left: Math.min(Math.max(0, left), maxLeft) };
  }

  /** Applies the bubble's inline position (or clears it back to default CSS on mobile). */
  private renderBubblePosition() {
    const bubble = document.getElementById("zudobot-bubble");
    if (!bubble) return;
    if (window.innerWidth <= 767 || !this.customPosition) {
      bubble.style.top = bubble.style.left = bubble.style.bottom = bubble.style.right = "";
      return;
    }
    const clamped = this.clampToViewport(this.customPosition.top, this.customPosition.left, bubble.offsetWidth, bubble.offsetHeight);
    bubble.style.top    = `${clamped.top}px`;
    bubble.style.left   = `${clamped.left}px`;
    bubble.style.bottom = "auto";
    bubble.style.right  = "auto";
  }

  /** Keeps the unread-preview bubble and chat window anchored to the launcher's current spot. */
  private repositionFollowers() {
    if (window.innerWidth <= 767 || !this.customPosition) return;
    const bubble = document.getElementById("zudobot-bubble");
    if (!bubble) return;
    const rect = bubble.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const alignLeft = rect.left < vw / 2;

    if (this.previewEl) {
      this.previewEl.style.top    = "auto";
      this.previewEl.style.bottom = `${Math.max(0, vh - rect.top + 8)}px`;
      if (alignLeft) { this.previewEl.style.left = `${rect.left}px`;  this.previewEl.style.right = "auto"; }
      else           { this.previewEl.style.right = `${vw - rect.right}px`; this.previewEl.style.left = "auto"; }
    }

    const win = document.getElementById("zudobot-window");
    if (win) {
      const GAP   = 12;
      const winW  = win.offsetWidth  || 375;
      const winH  = win.offsetHeight || 600;
      const openAbove = rect.top > vh / 2;

      let top  = openAbove ? rect.top - winH - GAP : rect.bottom + GAP;
      let left = alignLeft ? rect.left : rect.right - winW;
      top  = Math.max(GAP, Math.min(top,  vh - winH - GAP));
      left = Math.max(GAP, Math.min(left, vw - winW - GAP));

      win.style.top    = `${top}px`;
      win.style.left   = `${left}px`;
      win.style.bottom = "auto";
      win.style.right  = "auto";
      win.style.transformOrigin = `${openAbove ? "bottom" : "top"} ${alignLeft ? "left" : "right"}`;
    }
  }

  private applyCustomPosition(top: number, left: number) {
    const bubble = document.getElementById("zudobot-bubble");
    if (!bubble) return;
    this.customPosition = this.clampToViewport(top, left, bubble.offsetWidth, bubble.offsetHeight);
    this.renderBubblePosition();
    this.repositionFollowers();
  }

  /**
   * Elements inside the open chat window that must keep their normal click/
   * type/scroll/select behavior — a pointerdown on (or inside) any of these
   * never starts a widget drag.
   */
  private static readonly NON_DRAG_SELECTOR =
    "button, a, input, textarea, .zd-msg, .zd-product-card, .zd-consent-screen, " +
    ".zd-consent-gate, .zd-legal-overlay, .zd-ctx-menu, .zd-file-thumb, .zd-file-chip";

  private setupDrag(bubble: HTMLElement, win: HTMLElement) {
    let activeHandle: HTMLElement | null = null;

    const onMove = (e: PointerEvent) => {
      if (!this.dragState) return;
      const dx = e.clientX - this.dragState.startX;
      const dy = e.clientY - this.dragState.startY;
      if (!this.dragState.moved && Math.hypot(dx, dy) > 4) this.dragState.moved = true;
      if (this.dragState.moved) this.applyCustomPosition(this.dragState.startTop + dy, this.dragState.startLeft + dx);
    };

    const onUp = () => {
      if (!this.dragState) return;
      activeHandle?.classList.remove("zd-dragging");
      activeHandle = null;
      document.body.classList.remove("zd-drag-active");
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      if (this.dragState.moved && this.customPosition) {
        this.savePosition(this.customPosition);
        this.suppressNextClick = true;
      }
      this.dragState = null;
    };

    // Position is always tracked relative to the launcher bubble, whether the
    // drag started on the bubble itself or on the open window's background —
    // this keeps the bubble and window in sync as one draggable widget.
    const beginDrag = (e: PointerEvent, handleEl: HTMLElement) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || window.innerWidth <= 767) return;
      const rect = bubble.getBoundingClientRect();
      this.dragState = { startX: e.clientX, startY: e.clientY, startTop: rect.top, startLeft: rect.left, moved: false };
      activeHandle = handleEl;
      handleEl.classList.add("zd-dragging");
      document.body.classList.add("zd-drag-active");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    };

    bubble.addEventListener("pointerdown", (e: PointerEvent) => beginDrag(e, bubble));

    win.addEventListener("pointerdown", (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(ZudobotWidget.NON_DRAG_SELECTOR)) return; // let normal interaction happen
      beginDrag(e, win);
    });

    window.addEventListener("resize", () => {
      this.renderBubblePosition();
      this.repositionFollowers();
    });
  }

  // ── Message Rendering ─────────────────────────────────────────────

  private fmtTime(d: Date): string {
    return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  private appendBotMessage(text: string): HTMLElement {
    const id    = crypto.randomUUID();
    const now   = new Date();
    const cfg   = this.config!;

    // Row wrapper
    const row   = document.createElement("div");
    row.className = "zd-msg-row zd-row-bot";

    // Bot avatar
    const avatarEl = document.createElement("div");
    avatarEl.className = "zd-msg-avatar";
    avatarEl.innerHTML = `<img src="https://zudobotstorage.s3.ap-southeast-2.amazonaws.com/zudobot_single_logo-logo.PNG" alt="${escapeHtml(cfg.botName)}" />`;

    // Bubble wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "zd-msg-wrapper";

    const msg = document.createElement("div");
    msg.className = "zd-msg zd-bot";
    msg.dataset.msgId = id;

    const inner = document.createElement("div");
    inner.className = "zd-msg-inner";
    inner.innerHTML = renderText(text);
    msg.appendChild(inner);
    wrapper.appendChild(msg);

    // Meta (timestamp)
    const meta = document.createElement("div");
    meta.className = "zd-msg-meta";
    meta.innerHTML = `<span class="zd-ts">${this.fmtTime(now)}</span>`;

    const colEl = document.createElement("div");
    colEl.className = "zd-msg-col";

    const bubbleTime = document.createElement("div");
    bubbleTime.className = "zd-bubble-time";
    bubbleTime.appendChild(wrapper);
    bubbleTime.appendChild(meta);
    colEl.appendChild(bubbleTime);

    row.appendChild(avatarEl);
    row.appendChild(colEl);

    this.messagesEl.appendChild(row);
    this.scrollToBottom();

    // Mark previous user message as "อ่านแล้ว"
    this.markLastUserRead();

    // Unread badge when window closed
    this.addUnread(text);

    const entry: MsgEntry = { id, role: "bot", text, el: msg, rowEl: row, innerEl: inner, metaEl: meta, imgPreviews: [], unsent: false, edited: false, timestamp: now };
    this.msgStore.set(id, entry);
    return msg;
  }

  private markLastUserRead() {
    // Find last user message and set read receipt
    let lastUserEntry: MsgEntry | null = null;
    this.msgStore.forEach(e => { if (e.role === "user" && !e.unsent) lastUserEntry = e; });
    if (!lastUserEntry) return;
    const e = lastUserEntry as MsgEntry;
    // Remove existing read receipts from others
    this.msgStore.forEach(en => {
      if (en.role === "user" && en.id !== e.id) {
        const rr = en.metaEl.querySelector(".zd-read-receipt");
        if (rr) rr.remove();
      }
    });
    if (!e.metaEl.querySelector(".zd-read-receipt")) {
      const rr = document.createElement("span");
      rr.className = "zd-read-receipt";
      rr.textContent = "อ่านแล้ว";
      e.metaEl.appendChild(rr);
    }
  }

  private appendUserMessage(text: string, imagePreviews?: string[]) {
    const id    = crypto.randomUUID();
    const now   = new Date();
    const hasImg = imagePreviews && imagePreviews.length > 0;

    const row = document.createElement("div");
    row.className = "zd-msg-row zd-row-user";

    const colEl = document.createElement("div");
    colEl.className = "zd-msg-col zd-col-user";

    const wrapper = document.createElement("div");
    wrapper.className = "zd-msg-wrapper";

    const msg = document.createElement("div");
    msg.className = hasImg ? "zd-msg zd-user zd-has-img" : "zd-msg zd-user";
    msg.dataset.msgId = id;

    const inner = document.createElement("div");
    inner.className = "zd-msg-inner";

    let innerHtml = "";
    if (hasImg) {
      for (const src of imagePreviews!) {
        if (src.startsWith("data:image/")) {
          innerHtml += `<img class="zd-msg-img-preview" src="${src}" alt="รูปที่แนบ" />`;
        }
      }
    }
    if (text) innerHtml += `<span class="zd-msg-text">${escapeHtml(text)}</span>`;
    inner.innerHTML = innerHtml;
    msg.appendChild(inner);

    // Context menu button (desktop hover)
    const menuBtn = document.createElement("button");
    menuBtn.className = "zd-msg-menu-btn";
    menuBtn.textContent = "⋯";
    menuBtn.title = "ตัวเลือก";
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showContextMenu(id, e.clientX, e.clientY);
    });
    msg.appendChild(menuBtn);
    wrapper.appendChild(msg);

    // Long press (mobile)
    wrapper.addEventListener("touchstart", () => {
      this.longPressTimer = setTimeout(() => this.showContextMenu(id, 0, 0, true), 600);
    }, { passive: true });
    wrapper.addEventListener("touchend", () => { clearTimeout(this.longPressTimer); });
    wrapper.addEventListener("touchmove", () => { clearTimeout(this.longPressTimer); });

    const meta = document.createElement("div");
    meta.className = "zd-msg-meta";
    meta.innerHTML = `<span class="zd-ts">${this.fmtTime(now)}</span>`;

    const bubbleTime = document.createElement("div");
    bubbleTime.className = "zd-bubble-time";
    bubbleTime.appendChild(wrapper);
    bubbleTime.appendChild(meta);
    colEl.appendChild(bubbleTime);
    row.appendChild(colEl);
    this.messagesEl.appendChild(row);
    this.scrollToBottom();

    const entry: MsgEntry = { id, role: "user", text, el: msg, rowEl: row, innerEl: inner, metaEl: meta, imgPreviews: imagePreviews ?? [], unsent: false, edited: false, timestamp: now };
    this.msgStore.set(id, entry);
  }

  // ── Context menu ──────────────────────────────────────────────────────

  private showContextMenu(msgId: string, x: number, y: number, mobile = false) {
    const entry = this.msgStore.get(msgId);
    if (!entry || entry.role !== "user" || entry.unsent) return;
    this.closeContextMenu();

    const menu = document.createElement("div");
    menu.className = "zd-ctx-menu";
    this.ctxMenu = menu;

    const actions = [
      { icon: "✏️", label: "แก้ไขข้อความ", action: () => this.startEdit(msgId) },
      { icon: "📋", label: "คัดลอก",        action: () => navigator.clipboard?.writeText(entry.text).catch(() => {}) },
      { sep: true },
      { icon: "🗑️", label: "ยกเลิกการส่ง",  action: () => this.unsendMsg(msgId), danger: true },
    ];

    for (const a of actions) {
      if ("sep" in a) {
        const sep = document.createElement("div");
        sep.className = "zd-ctx-sep";
        menu.appendChild(sep);
      } else {
        const btn = document.createElement("button");
        btn.className = "zd-ctx-item" + (a.danger ? " zd-ctx-danger" : "");
        btn.innerHTML = `${a.icon} ${escapeHtml(a.label)}`;
        btn.addEventListener("click", (e) => { e.stopPropagation(); a.action(); this.closeContextMenu(); });
        menu.appendChild(btn);
      }
    }

    document.body.appendChild(menu);

    // Position
    if (mobile) {
      menu.style.cssText = "bottom:80px;left:50%;transform:translateX(-50%);top:auto;";
    } else {
      const vw = window.innerWidth, vh = window.innerHeight;
      const mw = 150, mh = 140;
      menu.style.left = Math.min(x, vw - mw - 8) + "px";
      menu.style.top  = Math.min(y, vh - mh - 8) + "px";
    }
  }

  private closeContextMenu() {
    if (this.ctxMenu) { this.ctxMenu.remove(); this.ctxMenu = undefined; }
  }

  // ── Edit ──────────────────────────────────────────────────────────────

  private startEdit(msgId: string) {
    const entry = this.msgStore.get(msgId);
    if (!entry || entry.unsent) return;
    this.editingId = msgId;
    this.inputEl.value = entry.text;
    this.inputEl.focus();
    if (this.editBarEl) this.editBarEl.classList.add("zd-show");
    entry.el.style.opacity = "0.6";
  }

  private cancelEdit() {
    if (this.editingId) {
      const entry = this.msgStore.get(this.editingId);
      if (entry) entry.el.style.opacity = "";
    }
    this.editingId = null;
    this.inputEl.value = "";
    if (this.editBarEl) this.editBarEl.classList.remove("zd-show");
  }

  private applyEdit(newText: string) {
    const entry = this.msgStore.get(this.editingId!);
    if (!entry) return;
    entry.text    = newText;
    entry.edited  = true;
    entry.el.style.opacity = "";
    const textEl = entry.innerEl.querySelector(".zd-msg-text");
    if (textEl) textEl.textContent = newText;
    // Add edited label
    if (!entry.metaEl.querySelector(".zd-edited-label")) {
      const lbl = document.createElement("span");
      lbl.className = "zd-edited-label";
      lbl.textContent = "(แก้ไขแล้ว)";
      entry.metaEl.prepend(lbl);
    }
    this.editingId = null;
    if (this.editBarEl) this.editBarEl.classList.remove("zd-show");
  }

  // ── Unsend ────────────────────────────────────────────────────────────

  private unsendMsg(msgId: string) {
    const entry = this.msgStore.get(msgId);
    if (!entry) return;
    entry.unsent = true;
    entry.el.className = "zd-msg zd-user zd-unsent";
    entry.innerEl.innerHTML = `<span>ยกเลิกการส่งข้อความแล้ว</span>`;
    // Remove menu button
    entry.el.querySelector(".zd-msg-menu-btn")?.remove();
    // Clear read receipt
    entry.metaEl.querySelector(".zd-read-receipt")?.remove();
  }

  private appendProductCards(products: RecommendedProduct[]) {
    if (!products || products.length === 0) return;

    const wrapper   = document.createElement("div");
    wrapper.className = "zd-product-list";

    for (const p of products) {
      const card = document.createElement("div");
      card.className = "zd-product-card";

      const imgHtml = p.imageUrl && safeUrl(p.imageUrl)
        ? `<img class="zd-product-img" src="${escapeHtml(safeUrl(p.imageUrl)!)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.display='none'" />`
        : `<div class="zd-product-img-placeholder">🛍️</div>`;

      const priceFormatted = formatPrice(p.price, p.priceSuffix);
      const stockBadge = (p.stock !== null && p.stock !== undefined && p.stock <= 5 && p.stock > 0)
        ? `<span class="zd-stock-badge">เหลือ ${p.stock} ชิ้น!</span>`
        : "";

      const detailUrl = safeUrl(p.productUrl) ?? null;
      const viewBtn   = detailUrl
        ? `<a class="zd-product-btn zd-btn-detail" href="${escapeHtml(detailUrl)}" target="_blank" rel="noopener noreferrer">ดูรายละเอียด</a>`
        : "";

      // "ซื้อเลย" — use a button so we can call the checkout API first
      const hasBuyOption = p._id || safeUrl(p.stripePaymentLink) || detailUrl;
      const buyBtn = hasBuyOption
        ? `<button class="zd-product-btn zd-btn-buy" data-product-id="${escapeHtml(p._id ?? "")}" data-payment-link="${escapeHtml(p.stripePaymentLink ?? "")}" data-product-url="${escapeHtml(p.productUrl ?? "")}">ซื้อเลย →</button>`
        : "";

      card.innerHTML = `
        ${imgHtml}
        <div class="zd-product-info">
          <p class="zd-product-name">${escapeHtml(p.name)}</p>
          ${p.description ? `<p class="zd-product-desc">${escapeHtml(p.description.slice(0, 80))}${p.description.length > 80 ? "…" : ""}</p>` : ""}
          <div class="zd-product-price-row">
            <span class="zd-product-price">${escapeHtml(priceFormatted)}</span>
            ${stockBadge}
          </div>
          <div class="zd-product-actions">
            ${viewBtn}
            ${buyBtn}
          </div>
        </div>
      `;

      // Wire up buy button
      const btn = card.querySelector<HTMLButtonElement>(".zd-btn-buy");
      if (btn) {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          btn.textContent = "กำลังโหลด...";

          const productId    = btn.dataset.productId ?? "";
          const paymentLink  = btn.dataset.paymentLink ?? "";
          const fallbackUrl  = btn.dataset.productUrl ?? "";

          // Prefer: checkout API (handles stripePaymentLink or productUrl server-side)
          // Fall back to local values if API unreachable
          let checkoutUrl: string | null = null;

          if (productId) {
            checkoutUrl = await createCheckout(this.opts.embedKey, this.opts.apiUrl, productId);
          }
          if (!checkoutUrl) {
            checkoutUrl = safeUrl(paymentLink) ?? safeUrl(fallbackUrl);
          }

          if (checkoutUrl) {
            window.open(checkoutUrl, "_blank", "noopener,noreferrer");
          }

          btn.disabled = false;
          btn.textContent = "ซื้อเลย →";
        });
      }

      wrapper.appendChild(card);
    }

    this.messagesEl.appendChild(wrapper);
    this.scrollToBottom();
  }

  private showTyping(): HTMLElement {
    const el     = document.createElement("div");
    el.id        = "zudobot-typing";
    el.className = "zd-msg zd-bot zd-typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
    return el;
  }

  private removeTyping() { document.getElementById("zudobot-typing")?.remove(); }

  private scrollToBottom() { this.messagesEl.scrollTop = this.messagesEl.scrollHeight; }

  private setSending(state: boolean) {
    this.isSending = state;
    this.sendBtn.disabled = state;
    this.inputEl.disabled = state;
  }

  // ── File attachment ───────────────────────────────────────────────

  private handleFileSelect(files: File[]) {
    const errors: string[] = [];
    const valid: File[] = [];

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`"${file.name}" ไม่รองรับชนิดไฟล์นี้`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`"${file.name}" ขนาดเกิน 10 MB`);
        continue;
      }
      if (this.pendingFiles.length + valid.length >= MAX_FILES_PER_MSG) {
        errors.push("สูงสุด 3 ไฟล์ต่อข้อความ");
        break;
      }
      valid.push(file);
    }

    if (errors.length) {
      this.appendBotMessage(`⚠️ ${errors.join(" · ")}`);
    }

    const startIdx = this.pendingFiles.length;
    this.pendingFiles.push(...valid);

    // Generate data URL previews for image files
    valid.forEach((file, i) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.pendingFilePreviews[startIdx + i] = ev.target!.result as string;
          this.renderFilePreview();
        };
        reader.readAsDataURL(file);
      }
    });

    this.renderFilePreview();
  }

  private renderFilePreview() {
    this.filePreviewEl.innerHTML = "";
    if (this.pendingFiles.length === 0) return;
    const wrapper = document.createElement("div");
    wrapper.className = "zd-file-preview-bar";
    this.pendingFiles.forEach((file, idx) => {
      const preview = this.pendingFilePreviews[idx];
      if (preview) {
        // Image: show thumbnail
        const thumb = document.createElement("div");
        thumb.className = "zd-file-thumb";
        thumb.innerHTML = `<img src="${preview}" alt="${escapeHtml(file.name)}" />
          <button class="zd-file-remove" data-idx="${idx}" aria-label="ลบ">×</button>`;
        wrapper.appendChild(thumb);
      } else {
        // Non-image: show chip
        const chip = document.createElement("div");
        chip.className = "zd-file-chip";
        const icon = FILE_ICONS[file.type.split("/")[0]] ?? "📎";
        chip.innerHTML = `<span>${icon} ${escapeHtml(file.name.length > 18 ? file.name.slice(0,15)+"…" : file.name)}</span>
          <button class="zd-file-remove" data-idx="${idx}" aria-label="ลบ">×</button>`;
        wrapper.appendChild(chip);
      }
    });
    wrapper.querySelectorAll(".zd-file-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = parseInt((btn as HTMLElement).dataset.idx ?? "0", 10);
        this.pendingFiles.splice(i, 1);
        this.pendingFilePreviews.splice(i, 1);
        this.renderFilePreview();
      });
    });
    this.filePreviewEl.appendChild(wrapper);
  }

  private async uploadPendingFiles(): Promise<FileAttachment[]> {
    if (this.pendingFiles.length === 0) return [];
    const results: FileAttachment[] = [];
    for (const file of this.pendingFiles) {
      try {
        const att = await uploadFile(file, this.opts.embedKey, this.opts.apiUrl);
        if (att) results.push(att);
      } catch {
        this.appendBotMessage(`⚠️ อัปโหลด "${file.name}" ไม่สำเร็จ กรุณาลองใหม่`);
      }
    }
    this.pendingFiles        = [];
    this.pendingFilePreviews = [];
    this.renderFilePreview();
    return results;
  }

  // ── Human-like response delay ──────────────────────────────────────

  /**
   * Calculates a human-like display delay before showing the AI response.
   * Simulates natural typing speed: ~45 chars/sec with ±15% random variance.
   * Clamped to [800ms, 4500ms] — keeps feel natural without frustrating waits.
   */
  private calcDisplayDelay(text: string): number {
    const base = Math.min(text.length * 0.044, 4.5) * 1000; // ~45 chars/sec
    const jitter = 0.85 + Math.random() * 0.3;              // ±15% variance
    return Math.max(800, Math.min(Math.round(base * jitter), 4500));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Split one long paragraph into sentence-boundary chunks <= maxLen.
  // Thai text without .!? punctuation falls through as a single chunk (no mid-word splits).
  private splitOnSentenceBoundaries(text: string, maxLen: number): string[] {
    const re = /[^.!?\n]*[.!?]+\s*/g;
    const sentences: string[] = [];
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) { sentences.push(m[0]); last = re.lastIndex; }
    const tail = text.slice(last).trim();
    if (tail) sentences.push(tail);
    if (sentences.length === 0) return [text];

    const chunks: string[] = [];
    let cur = "";
    for (const s of sentences) {
      const t = s.trim();
      if (!t) continue;
      if (!cur)                                    cur = t;
      else if (cur.length + 1 + t.length <= maxLen) cur += " " + t;
      else { chunks.push(cur); cur = t; }
    }
    if (cur) chunks.push(cur);
    return chunks.length > 0 ? chunks : [text];
  }

  // Split reply into display bubbles. Splits only at paragraph/sentence boundaries;
  // never cuts mid-sentence. Returns [text] unchanged if <= maxLen.
  private splitIntoBubbles(text: string, maxLen = 150): string[] {
    if (text.length <= maxLen) return [text];

    const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
    const raw: string[] = [];
    for (const para of paragraphs) {
      if (para.length <= maxLen) raw.push(para);
      else raw.push(...this.splitOnSentenceBoundaries(para, maxLen));
    }

    // Greedily pack adjacent chunks into bubbles
    const bubbles: string[] = [];
    let cur = "";
    for (const chunk of raw) {
      if (!cur)                                        cur = chunk;
      else if (cur.length + 1 + chunk.length <= maxLen) cur += "\n" + chunk;
      else { bubbles.push(cur); cur = chunk; }
    }
    if (cur) bubbles.push(cur);
    return bubbles.length > 0 ? bubbles : [text];
  }

  // ── Omni-channel launch params ───────────────────────────────────

  /**
   * Detects ?zudobot=1&ctx=TOKEN in the URL — injected by mdw_omni_zdb_chat when a
   * customer taps the deep link sent to them on LINE / Facebook / Instagram / TikTok.
   * Auto-opens the widget and injects the customer's original message so they don't have
   * to type it again.
   */
  private async detectLaunchParams(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    if (params.get("zudobot") !== "1") return;

    this.open();

    const ctxToken = params.get("ctx");
    if (!ctxToken) return;

    await this.delay(600); // let widget settle before first message

    try {
      const res = await fetch(
        `${this.opts.apiUrl}/api/widget/ctx/${encodeURIComponent(ctxToken)}`,
        { method: "GET" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; initialMessage?: string };
      if (data.ok && data.initialMessage) {
        await this.send(data.initialMessage);
      }
    } catch {
      // non-critical — widget still works normally without context
    }
  }

  // ── Send ──────────────────────────────────────────────────────────

  private async send(forcedText?: string) {
    if (this.isSending) return;

    const text = forcedText ?? this.inputEl.value.trim();
    const hasFiles = this.pendingFiles.length > 0;
    if (!text && !hasFiles) return;

    // Edit mode: update existing message instead of sending new
    if (this.editingId && text && !hasFiles) {
      this.applyEdit(text);
      this.inputEl.value = "";
      this.inputEl.style.height = "auto";
      return;
    }

    if (!forcedText) { this.inputEl.value = ""; this.inputEl.style.height = "auto"; }
    this.setSending(true);

    // Capture image previews before uploadPendingFiles() clears them
    const imagePreviews = this.pendingFilePreviews
      .filter(Boolean)
      .filter(src => src.startsWith("data:image/"));

    this.appendUserMessage(
      text || (hasFiles ? "" : ""),
      imagePreviews.length > 0 ? imagePreviews : undefined,
    );
    this.showTyping();

    // Upload files before sending message
    const attachments = await this.uploadPendingFiles();

    const { reply, handoffMode, products, consentRequired } = await sendChatMessage(
      this.opts.embedKey,
      this.opts.apiUrl,
      this.sessionId,
      text || "(ส่งไฟล์แนบ)",
      this.consentGiven === true,
      attachments,
      this.visitorId || undefined,
    );

    // Hold the typing indicator for a natural human-like delay after API responds.
    // This gives the feel that the AI is actually "reading and typing" a reply.
    const bubbles = this.splitIntoBubbles(reply);
    await this.delay(this.calcDisplayDelay(bubbles[0]));

    this.removeTyping();
    this.appendBotMessage(bubbles[0]);

    for (let i = 1; i < bubbles.length; i++) {
      this.showTyping();
      await this.delay(2000);
      this.removeTyping();
      this.appendBotMessage(bubbles[i]);
    }

    // Render product cards below bot message if present
    if (products && products.length > 0) {
      this.appendProductCards(products);
    }

    // Order consent gate (PDPA → T&C) when the AI reaches the confirmation step
    if (consentRequired) {
      this.showOrderConsentGate();
    }

    this.setSending(false);
    this.inputEl.focus();

    if (handoffMode && !this.handoffMode) {
      this.enterHandoffMode();
    }
  }

  // ── Handoff / Polling ─────────────────────────────────────────────

  private enterHandoffMode() {
    this.handoffMode  = true;
    this.lastPollTime = new Date().toISOString();

    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => this.pollAdminMessages(), 3000);
  }

  private exitHandoffMode() {
    this.handoffMode = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.appendBotMessage("✅ การสนทนากับเจ้าหน้าที่จบแล้ว บอทกลับมาพร้อมช่วยเหลือคุณแล้วนะคะ 😊");
  }

  private async pollAdminMessages() {
    const { messages, botStatus } = await pollUpdates(
      this.opts.embedKey,
      this.opts.apiUrl,
      this.sessionId,
      this.lastPollTime,
    );

    if (messages.length > 0) {
      this.lastPollTime = new Date().toISOString();
      for (const msg of messages) {
        this.appendAdminMessage(msg.content);
      }
    }

    if (botStatus === "resolved") {
      this.exitHandoffMode();
    }
  }

  private appendAdminMessage(text: string): HTMLElement {
    const el      = document.createElement("div");
    el.className  = "zd-msg zd-admin";
    el.innerHTML  = renderText(text);
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
    return el;
  }

  // ── Order consent gate (PDPA → T&C) ───────────────────────────────
  private showOrderConsentGate() {
    if (this.messagesEl.querySelector(".zd-consent-gate")) return; // avoid duplicates

    const gate = document.createElement("div");
    gate.className = "zd-consent-gate";
    gate.innerHTML = `
      <p class="zd-cg-title">🔒 ก่อนยืนยันคำสั่งซื้อ</p>
      <p class="zd-cg-text">กรุณาอ่านและให้ความยินยอมการเก็บข้อมูลส่วนบุคคล (PDPA/GDPR) ก่อนนะคะ</p>
      <button class="zd-cg-link" type="button">📄 อ่านนโยบาย PDPA/GDPR</button>
      <div class="zd-cg-actions">
        <button class="zd-cg-btn zd-cg-agree" type="button">ยินยอม</button>
        <button class="zd-cg-btn zd-cg-decline" type="button">ไม่ยินยอม</button>
      </div>
      <div class="zd-cg-msg" style="display:none"></div>
    `;
    this.messagesEl.appendChild(gate);
    this.scrollToBottom();

    gate.querySelector(".zd-cg-link")!.addEventListener("click", () => void this.openLegalModal("DATA_PROCESSING_AGREEMENT"));
    gate.querySelector(".zd-cg-decline")!.addEventListener("click", () => this.handleConsentDecline(gate));
    gate.querySelector(".zd-cg-agree")!.addEventListener("click", () => this.handleConsentAgree(gate));
  }

  private handleConsentDecline(gate: HTMLElement) {
    recordDocConsent(this.opts.embedKey, this.opts.apiUrl, this.sessionId, false, "DATA_PROCESSING_AGREEMENT");
    const msg = gate.querySelector<HTMLElement>(".zd-cg-msg")!;
    msg.style.display = "block";
    msg.textContent = CONSENT_DECLINE_MESSAGE;
    gate.querySelector<HTMLButtonElement>(".zd-cg-agree")!.disabled = true;
    gate.querySelector<HTMLButtonElement>(".zd-cg-decline")!.disabled = true;
  }

  private handleConsentAgree(gate: HTMLElement) {
    recordDocConsent(this.opts.embedKey, this.opts.apiUrl, this.sessionId, true, "DATA_PROCESSING_AGREEMENT");
    this.consentGiven = true;
    // Step 2 — Terms & Conditions
    gate.innerHTML = `
      <p class="zd-cg-title">📜 ข้อกำหนดและเงื่อนไข (Terms &amp; Conditions)</p>
      <p class="zd-cg-text">กรุณาอ่านและยอมรับข้อกำหนดและเงื่อนไขเพื่อดำเนินการต่อ</p>
      <button class="zd-cg-link" type="button">📄 อ่านข้อกำหนดและเงื่อนไข</button>
      <div class="zd-cg-actions">
        <button class="zd-cg-btn zd-cg-agree2" type="button">ยอมรับข้อกำหนด (ตกลง)</button>
      </div>
    `;
    gate.querySelector(".zd-cg-link")!.addEventListener("click", () => void this.openLegalModal("TENANT_TERMS_OF_SERVICE"));
    gate.querySelector(".zd-cg-agree2")!.addEventListener("click", () => {
      recordDocConsent(this.opts.embedKey, this.opts.apiUrl, this.sessionId, true, "TENANT_TERMS_OF_SERVICE");
      gate.remove();
      // Tell the AI the customer consented so the order flow continues.
      void this.send("ฉันยินยอม PDPA และยอมรับข้อกำหนดและเงื่อนไขแล้ว ดำเนินการต่อได้เลยค่ะ");
    });
    this.scrollToBottom();
  }

  // ── White-background legal-document modal ──────────────────────────
  private async openLegalModal(documentType: LegalDocType) {
    const overlay = document.createElement("div");
    overlay.className = "zd-legal-overlay";
    overlay.innerHTML = `
      <div class="zd-legal-modal">
        <div class="zd-legal-head">
          <span>เอกสาร</span>
          <button class="zd-legal-close" type="button" aria-label="ปิด">×</button>
        </div>
        <div class="zd-legal-body"><div class="zd-legal-loading">กำลังโหลด…</div></div>
        <div class="zd-legal-foot"><button class="zd-legal-ok" type="button">ปิด</button></div>
      </div>
    `;
    this.containerEl.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector(".zd-legal-close")!.addEventListener("click", close);
    overlay.querySelector(".zd-legal-ok")!.addEventListener("click", close);

    const body = overlay.querySelector<HTMLElement>(".zd-legal-body")!;
    const doc = await fetchLegalDocument(this.opts.apiUrl, documentType);
    if (!doc) {
      body.innerHTML = `<p class="zd-legal-empty">ไม่พบเอกสาร กรุณาลองใหม่อีกครั้ง</p>`;
      return;
    }
    // Content is trusted HTML (served from our own API/DB).
    body.innerHTML =
      `<h3 class="zd-legal-title">${escapeHtml(doc.title)}</h3>` +
      (doc.version ? `<p class="zd-legal-ver">เวอร์ชัน ${escapeHtml(doc.version)}</p>` : "") +
      `<div class="zd-legal-content">${doc.content}</div>`;
  }
}
