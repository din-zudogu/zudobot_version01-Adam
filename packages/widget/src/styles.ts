export function getStyles(themeColor: string, position: "bottom-right" | "bottom-left" = "bottom-right"): string {
  const side = position === "bottom-left" ? "left" : "right";
  return `
    /* ── Zudobot Widget — LINE-style UI ────────────────────────── */
    #zudobot-container *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Sarabun',sans-serif;}

    /* ── Balloon button ────────────────────────────────────────── */
    #zudobot-bubble{
      position:fixed;bottom:24px;${side}:24px;
      width:58px;height:58px;border-radius:50%;
      background:${themeColor};color:#fff;
      border:none;cursor:grab;
      box-shadow:0 4px 20px rgba(0,0,0,0.22);
      display:flex;align-items:center;justify-content:center;
      transition:transform 0.25s,box-shadow 0.25s;z-index:999999;
    }
    #zudobot-bubble:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(0,0,0,0.28);}
    #zudobot-bubble.zd-dragging{cursor:grabbing!important;transform:scale(1.05);transition:none;}
    body.zd-drag-active{user-select:none;}

    /* Unread badge ─────────────────────────────────────────────── */
    #zudobot-badge{
      position:absolute;top:-4px;${side === "right" ? "right" : "left"}:-4px;
      min-width:20px;height:20px;border-radius:10px;
      background:#ef4444;color:#fff;font-size:11px;font-weight:700;
      display:none;align-items:center;justify-content:center;
      padding:0 5px;border:2px solid #fff;pointer-events:none;
    }
    #zudobot-badge.zd-show{display:flex;}

    /* Preview bubble above badge ──────────────────────────────── */
    #zudobot-preview{
      position:fixed;bottom:90px;${side}:24px;
      max-width:220px;background:#fff;border-radius:12px;
      box-shadow:0 4px 16px rgba(0,0,0,0.18);
      padding:8px 12px;font-size:12px;color:#1e293b;
      display:none;pointer-events:none;z-index:999998;
      line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    #zudobot-preview.zd-show{display:block;}

    /* ── Chat window — desktop / tablet panel ──────────────────── */
    #zudobot-window{
      position:fixed;bottom:96px;${side}:24px;
      width:375px;height:600px;max-height:90vh;
      background:#EDE8DF;border-radius:18px;
      box-shadow:0 8px 40px rgba(0,0,0,0.2);
      display:flex;flex-direction:column;
      z-index:999999;overflow:hidden;
      transition:opacity 0.22s,transform 0.22s;
      transform-origin:bottom ${side};
    }
    #zudobot-window.zd-hidden{opacity:0;pointer-events:none;transform:scale(0.92) translateY(12px);}

    /* ── Mobile: full-screen slide-up (< 768px) ────────────────── */
    @media(max-width:767px){
      #zudobot-window{
        bottom:0;left:0;right:0;top:0;
        width:100%;height:100%;max-height:100%;
        border-radius:0;
        transform-origin:bottom center;
        transition:transform 0.3s cubic-bezier(0.4,0,0.2,1),opacity 0.3s;
      }
      #zudobot-window.zd-hidden{
        opacity:1;
        transform:translateY(100%);
      }
      #zudobot-bubble{bottom:16px;${side}:16px;}
      /* Mobile: show back arrow, hide chevron */
      .zd-ico-min{display:none!important;}
      .zd-ico-back{display:inline!important;}
    }

    /* ── Header ────────────────────────────────────────────────── */
    #zudobot-header{
      background:${themeColor};color:#fff;
      padding:10px 14px;display:flex;align-items:center;gap:10px;
      flex-shrink:0;cursor:grab;
    }
    #zudobot-window.zd-dragging,#zudobot-window.zd-dragging *{cursor:grabbing!important;}
    #zudobot-header .zd-avatar{
      width:38px;height:38px;border-radius:50%;
      background:rgba(255,255,255,0.25);
      display:flex;align-items:center;justify-content:center;
      overflow:hidden;flex-shrink:0;
    }
    #zudobot-header .zd-avatar img{width:100%;height:100%;object-fit:cover;}
    #zudobot-header .zd-bot-info{flex:1;min-width:0;}
    #zudobot-header .zd-title{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    #zudobot-header .zd-subtitle{font-size:11px;opacity:0.85;display:flex;align-items:center;gap:4px;}
    #zudobot-header .zd-online{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;animation:zd-pulse 2s ease-in-out infinite;}
    @keyframes zd-pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}

    /* Minimize / back button */
    #zudobot-close{
      background:rgba(255,255,255,0.18);border:none;color:#fff;cursor:pointer;
      width:32px;height:32px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;transition:background 0.2s;
      font-size:18px;
    }
    #zudobot-close:hover{background:rgba(255,255,255,0.32);}
    /* desktop: chevron-down = minimize; mobile: back arrow (swapped via media query) */
    .zd-ico-min{display:inline;line-height:1;}
    .zd-ico-back{display:none;line-height:1;}

    /* ── Messages area (LINE warm background) ──────────────────── */
    #zudobot-messages{
      flex:1;overflow-y:auto;padding:10px 12px 6px;
      display:flex;flex-direction:column;gap:2px;
      scroll-behavior:smooth;background:#EDE8DF;
    }
    #zudobot-messages::-webkit-scrollbar{width:4px;}
    #zudobot-messages::-webkit-scrollbar-track{background:transparent;}
    #zudobot-messages::-webkit-scrollbar-thumb{background:#c5bfb0;border-radius:2px;}

    /* ── Message row (LINE layout) ─────────────────────────────── */
    .zd-msg-row{display:flex;align-items:flex-end;gap:6px;margin-bottom:4px;}
    .zd-msg-row.zd-row-bot{flex-direction:row;}
    .zd-msg-row.zd-row-user{flex-direction:row-reverse;}

    /* Column wrapper */
    .zd-msg-col{display:flex;flex-direction:column;max-width:78%;}
    .zd-msg-col.zd-col-user{align-items:flex-end;}

    /* Bubble + time side-by-side (LINE style) */
    .zd-bubble-time{display:flex;align-items:flex-end;gap:5px;}
    .zd-row-bot .zd-bubble-time{flex-direction:row;}
    .zd-row-user .zd-bubble-time{flex-direction:row-reverse;}

    /* Bot avatar ──────────────────────────────────────────────── */
    .zd-msg-avatar{
      width:32px;height:32px;border-radius:50%;flex-shrink:0;
      background:${themeColor};
      display:flex;align-items:center;justify-content:center;
      overflow:hidden;margin-bottom:20px;
    }
    .zd-msg-avatar img{width:100%;height:100%;object-fit:cover;}
    .zd-msg-avatar.zd-invisible{visibility:hidden;}

    /* ── Bubbles ─────────────────────────────────────────────── */
    .zd-msg{font-size:14px;line-height:1.55;position:relative;max-width:260px;}
    .zd-msg-inner{padding:9px 13px;word-break:break-word;}
    /* Incoming (bot) — white, left tail */
    .zd-msg.zd-bot .zd-msg-inner{
      background:#fff;color:#1e293b;
      border-radius:4px 18px 18px 18px;
      box-shadow:0 1px 2px rgba(0,0,0,0.08);
    }
    /* Outgoing (user) — theme color, right tail */
    .zd-msg.zd-user .zd-msg-inner{
      background:${themeColor};color:#fff;
      border-radius:18px 4px 18px 18px;
      box-shadow:0 1px 2px rgba(0,0,0,0.12);
    }
    .zd-msg.zd-admin .zd-msg-inner{
      background:#dcfce7;color:#15803d;
      border-radius:4px 18px 18px 18px;
      border:1px solid #bbf7d0;
    }
    .zd-msg.zd-unsent .zd-msg-inner{
      background:transparent;color:#94a3b8;
      font-style:italic;font-size:12px;padding:4px 12px;
      border:none;box-shadow:none;
    }

    /* ── Message meta — time beside bubble (LINE style) ────────── */
    .zd-msg-meta{
      font-size:10px;color:#8a9bb0;
      white-space:nowrap;padding-bottom:3px;min-width:34px;
      display:flex;flex-direction:column;gap:2px;
    }
    .zd-row-user .zd-msg-meta{align-items:flex-end;}
    .zd-row-bot  .zd-msg-meta{align-items:flex-start;}
    .zd-read-receipt{color:#64b5f6;font-size:10px;}
    .zd-edited-label{font-size:10px;color:#94a3b8;font-style:italic;}

    /* ── Context menu trigger ──────────────────────────────────── */
    .zd-msg-menu-btn{
      position:absolute;top:50%;transform:translateY(-50%);
      background:rgba(0,0,0,0.15);border:none;cursor:pointer;
      width:22px;height:22px;border-radius:50%;
      display:none;align-items:center;justify-content:center;
      font-size:12px;color:#fff;flex-shrink:0;
    }
    .zd-msg.zd-user .zd-msg-menu-btn{left:-28px;}
    .zd-msg.zd-bot  .zd-msg-menu-btn{right:-28px;}
    .zd-msg-wrapper:hover .zd-msg-menu-btn{display:flex;}
    .zd-msg-wrapper{position:relative;}

    /* ── Context menu popup ────────────────────────────────────── */
    .zd-ctx-menu{
      position:fixed;z-index:9999999;
      background:#fff;border-radius:10px;
      box-shadow:0 4px 20px rgba(0,0,0,0.18);
      overflow:hidden;min-width:130px;
    }
    .zd-ctx-item{
      display:flex;align-items:center;gap:8px;
      padding:11px 16px;font-size:14px;color:#1e293b;
      cursor:pointer;transition:background 0.15s;border:none;
      background:none;width:100%;text-align:left;
    }
    .zd-ctx-item:hover{background:#f1f5f9;}
    .zd-ctx-item.zd-ctx-danger{color:#ef4444;}
    .zd-ctx-item.zd-ctx-danger:hover{background:#fef2f2;}
    .zd-ctx-sep{height:1px;background:#f1f5f9;}

    /* ── Edit bar ──────────────────────────────────────────────── */
    #zudobot-edit-bar{
      display:none;align-items:center;gap:8px;
      padding:6px 12px;background:#fff7ed;border-top:2px solid ${themeColor};
      font-size:12px;color:#92400e;flex-shrink:0;
    }
    #zudobot-edit-bar.zd-show{display:flex;}
    #zudobot-edit-bar span{flex:1;}
    #zudobot-edit-cancel{background:none;border:none;cursor:pointer;color:#ef4444;font-size:18px;padding:0 4px;}

    /* ── Typing indicator ──────────────────────────────────────── */
    .zd-typing-row{display:flex;align-items:flex-end;gap:6px;}
    .zd-typing{
      display:flex;gap:5px;padding:10px 14px;
      background:#fff;border-radius:4px 18px 18px 18px;
      box-shadow:0 1px 2px rgba(0,0,0,0.08);align-items:center;
    }
    .zd-typing span{
      width:8px;height:8px;border-radius:50%;
      background:${themeColor};opacity:0.75;
      animation:zd-bounce 1.2s ease-in-out infinite;
    }
    .zd-typing span:nth-child(1){animation-delay:0s;}
    .zd-typing span:nth-child(2){animation-delay:0.18s;}
    .zd-typing span:nth-child(3){animation-delay:0.36s;}
    @keyframes zd-bounce{
      0%,70%,100%{transform:translateY(0);opacity:0.55;}
      35%{transform:translateY(-7px);opacity:1;}
    }

    /* ── Footer / Input (LINE style) ───────────────────────────── */
    #zudobot-footer{flex-shrink:0;background:#fff;border-top:1px solid #e8e2d8;}
    #zudobot-file-preview{padding:0 8px;}
    .zd-file-preview-bar{display:flex;flex-wrap:wrap;gap:4px;padding:4px 0;}
    .zd-file-chip{
      display:flex;align-items:center;gap:4px;
      background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;
      padding:3px 8px;font-size:11px;color:#475569;max-width:180px;
    }
    .zd-file-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .zd-file-remove{background:none;border:none;cursor:pointer;font-size:14px;color:#94a3b8;padding:0 2px;line-height:1;flex-shrink:0;}
    .zd-file-remove:hover{color:#ef4444;}
    .zd-file-thumb{
      position:relative;border-radius:8px;overflow:hidden;
      width:56px;height:56px;flex-shrink:0;
      border:1px solid #e2e8f0;background:#f8fafc;
    }
    .zd-file-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
    .zd-file-thumb .zd-file-remove{
      position:absolute;top:2px;right:2px;
      background:rgba(0,0,0,0.55);color:#fff;border-radius:50%;
      width:16px;height:16px;font-size:10px;line-height:16px;text-align:center;padding:0;
    }
    .zd-msg.zd-user.zd-has-img .zd-msg-inner{padding:6px;}
    .zd-msg-img-preview{
      display:block;max-width:200px;max-height:180px;
      border-radius:10px;object-fit:cover;margin-bottom:4px;
    }
    .zd-msg-text{display:block;}
    #zudobot-input-row{
      padding:8px 10px;
      display:flex;gap:6px;align-items:flex-end;
    }
    #zudobot-attach{
      background:none;border:none;cursor:pointer;font-size:18px;
      padding:6px 4px;color:#94a3b8;flex-shrink:0;transition:color 0.2s;
    }
    #zudobot-attach:hover{color:${themeColor};}
    #zudobot-input{
      flex:1;border:1.5px solid #e8e2d8;border-radius:22px;
      padding:9px 14px;font-size:14px;resize:none;
      outline:none;max-height:100px;line-height:1.45;
      background:#f7f3ef;transition:border-color 0.2s,background 0.2s;
    }
    #zudobot-input:focus{border-color:${themeColor};background:#fff;}
    #zudobot-send{
      width:38px;height:38px;border-radius:50%;
      background:${themeColor};color:#fff;border:none;
      cursor:pointer;font-size:16px;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;transition:opacity 0.2s,transform 0.2s;
    }
    #zudobot-send:hover{transform:scale(1.08);}
    #zudobot-send:disabled{opacity:0.45;cursor:not-allowed;transform:none;}
    #zudobot-meta{
      padding:3px 14px 8px;
      display:flex;justify-content:center;align-items:center;
    }

    /* ── Misc ───────────────────────────────────────────────────── */
    .zd-msg a{color:${themeColor};text-decoration:underline;}
    .zd-msg.zd-bot a{color:${themeColor};}
    #zudobot-logo{
      width:75%;height:auto;object-fit:contain;display:block;
      animation:zd-logo-spin 60s linear infinite;
    }
    @keyframes zd-logo-spin{
      0%{transform:rotate(0deg);animation-timing-function:cubic-bezier(0.4,0,0.2,1);}
      5%{transform:rotate(360deg);}100%{transform:rotate(360deg);}
    }
    #zudobot-powered{text-decoration:none;color:inherit;transition:color 0.2s;}
    #zudobot-powered:hover{color:#2563eb;}

    /* ── Product cards ──────────────────────────────────────────── */
    .zd-product-list{display:flex;flex-direction:column;gap:8px;width:100%;align-self:stretch;}
    .zd-product-card{
      display:flex;gap:10px;background:#fff;
      border:1.5px solid #e8e2d8;border-radius:14px;overflow:hidden;
      transition:border-color 0.2s,box-shadow 0.2s;
    }
    .zd-product-card:hover{border-color:${themeColor};box-shadow:0 2px 12px rgba(0,0,0,0.08);}
    .zd-product-img{width:72px;height:72px;object-fit:cover;flex-shrink:0;}
    .zd-product-img-placeholder{
      width:72px;height:72px;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;font-size:28px;background:#f8fafc;
    }
    .zd-product-info{flex:1;padding:8px 10px 8px 0;min-width:0;display:flex;flex-direction:column;gap:3px;}
    .zd-product-name{font-size:13px;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;}
    .zd-product-desc{font-size:11px;color:#64748b;line-height:1.4;margin:0;}
    .zd-product-price-row{display:flex;align-items:center;gap:6px;}
    .zd-product-price{font-size:13px;font-weight:700;color:${themeColor};}
    .zd-stock-badge{font-size:10px;background:#fef2f2;color:#dc2626;padding:2px 6px;border-radius:100px;font-weight:600;}
    .zd-product-actions{display:flex;gap:5px;margin-top:2px;flex-wrap:wrap;}
    .zd-product-btn{
      padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;
      cursor:pointer;text-decoration:none;display:inline-block;transition:opacity 0.2s,transform 0.15s;
    }
    .zd-product-btn:hover{opacity:0.85;transform:translateY(-1px);}
    .zd-btn-detail{border:1.5px solid ${themeColor};color:${themeColor};background:transparent;}
    .zd-btn-buy{background:${themeColor};color:#fff;border:1.5px solid ${themeColor};}

    /* ── Consent screen ─────────────────────────────────────────── */
    .zd-consent-screen{
      display:flex;flex-direction:column;align-items:center;
      padding:20px 16px;text-align:center;gap:10px;
      background:#f8f4ef;border-radius:12px;margin:8px 0;
    }
    .zd-consent-icon{font-size:32px;}
    .zd-consent-title{font-size:14px;font-weight:700;color:#1e293b;margin:0;}
    .zd-consent-text{font-size:12px;color:#475569;line-height:1.6;margin:0;}
    .zd-consent-actions{display:flex;gap:8px;width:100%;}
    .zd-consent-btn{
      flex:1;padding:9px;border-radius:10px;font-size:13px;font-weight:600;
      cursor:pointer;border:none;transition:opacity 0.2s;
    }
    .zd-consent-accept{background:${themeColor};color:#fff;}
    .zd-consent-decline{background:#e2e8f0;color:#475569;}
    .zd-consent-btn:hover{opacity:0.85;}
    .zd-consent-note{font-size:10px;color:#94a3b8;margin:0;}
    .zd-privacy-notice .zd-consent-actions,.zd-privacy-notice .zd-consent-note{display:none;}

    /* ── Order consent gate (PDPA → T&C) ── */
    .zd-consent-gate{
      margin:8px 0;padding:14px;border:1px solid #e2e8f0;border-radius:14px;
      background:#fff;display:flex;flex-direction:column;gap:8px;
    }
    .zd-cg-title{font-size:13px;font-weight:700;color:#1e293b;margin:0;}
    .zd-cg-text{font-size:12px;color:#475569;line-height:1.6;margin:0;}
    .zd-cg-link{
      align-self:flex-start;background:none;border:none;padding:0;cursor:pointer;
      font-size:12px;font-weight:600;color:${themeColor};text-decoration:underline;
    }
    .zd-cg-actions{display:flex;gap:8px;width:100%;margin-top:2px;}
    .zd-cg-btn{flex:1;padding:9px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:opacity .2s;}
    .zd-cg-btn:hover{opacity:.85;}
    .zd-cg-btn:disabled{opacity:.45;cursor:not-allowed;}
    .zd-cg-agree,.zd-cg-agree2{background:${themeColor};color:#fff;}
    .zd-cg-decline{background:#e2e8f0;color:#475569;}
    .zd-cg-msg{font-size:12px;font-weight:600;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:9px;line-height:1.5;}

    /* ── White-background legal document modal ── */
    .zd-legal-overlay{
      position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;padding:16px;
    }
    .zd-legal-modal{
      background:#fff;border-radius:16px;width:100%;max-width:520px;max-height:86vh;
      display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.3);
    }
    .zd-legal-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#374151;}
    .zd-legal-close{background:none;border:none;font-size:22px;line-height:1;color:#9ca3af;cursor:pointer;}
    .zd-legal-body{flex:1;overflow-y:auto;padding:18px 18px;background:#fff;color:#1f2937;font-size:13px;line-height:1.7;}
    .zd-legal-loading,.zd-legal-empty{text-align:center;color:#94a3b8;padding:24px 0;}
    .zd-legal-title{font-size:15px;font-weight:700;color:#111827;margin:0 0 2px;}
    .zd-legal-ver{font-size:11px;color:#9ca3af;margin:0 0 12px;}
    .zd-legal-content h3{font-size:13px;font-weight:700;color:#111827;margin:14px 0 4px;}
    .zd-legal-content ul{padding-left:18px;margin:4px 0;list-style:disc;}
    .zd-legal-content p{margin:4px 0;}
    .zd-legal-foot{padding:10px 16px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;}
    .zd-legal-ok{background:${themeColor};color:#fff;border:none;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;}
  `;
}
