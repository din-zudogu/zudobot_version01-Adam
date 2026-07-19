(function(){"use strict";function k(o,e="bottom-right"){const t=e==="bottom-left"?"left":"right";return`
    /* ── fnc_zdb_chatbox — LINE-style widget ───────────────────── */
    #zudobot-container *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Sarabun',sans-serif;}

    /* Bubble ──────────────────────────────────────────────────── */
    #zudobot-bubble{
      position:fixed;bottom:24px;${t}:24px;
      width:58px;height:58px;border-radius:50%;
      background:${o};color:#fff;
      border:none;cursor:pointer;font-size:26px;
      box-shadow:0 4px 20px rgba(0,0,0,0.22);
      display:flex;align-items:center;justify-content:center;
      transition:transform 0.25s,box-shadow 0.25s;z-index:999999;
    }
    #zudobot-bubble:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(0,0,0,0.28);}

    /* Unread badge ─────────────────────────────────────────────── */
    #zudobot-badge{
      position:absolute;top:-4px;${t==="right"?"right":"left"}:-4px;
      min-width:20px;height:20px;border-radius:10px;
      background:#ef4444;color:#fff;font-size:11px;font-weight:700;
      display:none;align-items:center;justify-content:center;
      padding:0 5px;border:2px solid #fff;pointer-events:none;
    }
    #zudobot-badge.zd-show{display:flex;}

    /* Preview bubble above badge ──────────────────────────────── */
    #zudobot-preview{
      position:fixed;bottom:90px;${t}:24px;
      max-width:220px;background:#fff;border-radius:12px;
      box-shadow:0 4px 16px rgba(0,0,0,0.18);
      padding:8px 12px;font-size:12px;color:#1e293b;
      display:none;pointer-events:none;z-index:999998;
      line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    #zudobot-preview.zd-show{display:block;}

    /* Chat window — desktop floating ──────────────────────────── */
    #zudobot-window{
      position:fixed;bottom:96px;${t}:24px;
      width:375px;height:580px;max-height:90vh;
      background:#EFF2F5;border-radius:18px;
      box-shadow:0 8px 40px rgba(0,0,0,0.18);
      display:flex;flex-direction:column;
      z-index:999999;overflow:hidden;
      transition:opacity 0.22s,transform 0.22s;
      transform-origin:bottom ${t};
    }
    #zudobot-window.zd-hidden{opacity:0;pointer-events:none;transform:scale(0.92) translateY(12px);}

    /* Mobile: full screen ─────────────────────────────────────── */
    @media(max-width:600px){
      #zudobot-window{
        bottom:0;left:0;right:0;top:0;width:100%;height:100%;max-height:100%;
        border-radius:0;transform-origin:bottom center;
      }
      #zudobot-window.zd-hidden{transform:translateY(100%);}
      #zudobot-bubble{bottom:16px;${t}:16px;}
    }

    /* Header ──────────────────────────────────────────────────── */
    #zudobot-header{
      background:${o};color:#fff;
      padding:12px 14px;display:flex;align-items:center;gap:10px;
      flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.15);
    }
    #zudobot-header .zd-avatar{
      width:36px;height:36px;border-radius:50%;
      background:rgba(255,255,255,0.25);
      display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;
      overflow:hidden;
    }
    #zudobot-header .zd-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
    #zudobot-header .zd-bot-info{flex:1;min-width:0;}
    #zudobot-header .zd-title{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    #zudobot-header .zd-subtitle{font-size:11px;opacity:0.85;display:flex;align-items:center;gap:4px;}
    #zudobot-header .zd-online{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;animation:zd-pulse 2s ease-in-out infinite;}
    @keyframes zd-pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
    #zudobot-close{
      background:none;border:none;color:#fff;cursor:pointer;
      font-size:20px;opacity:0.85;padding:4px;flex-shrink:0;
      transition:opacity 0.2s;
    }
    #zudobot-close:hover{opacity:1;}

    /* Messages area ───────────────────────────────────────────── */
    #zudobot-messages{
      flex:1;overflow-y:auto;padding:12px 12px 8px;
      display:flex;flex-direction:column;gap:4px;
      scroll-behavior:smooth;background:#EFF2F5;
    }
    #zudobot-messages::-webkit-scrollbar{width:4px;}
    #zudobot-messages::-webkit-scrollbar-track{background:transparent;}
    #zudobot-messages::-webkit-scrollbar-thumb{background:#cdd2d8;border-radius:2px;}

    /* Message row wrapper (avatar + bubble + meta) ──────────────── */
    .zd-msg-row{display:flex;align-items:flex-end;gap:6px;margin-bottom:2px;}
    .zd-msg-row.zd-row-bot{flex-direction:row;}
    .zd-msg-row.zd-row-user{flex-direction:row-reverse;}

    /* Bot avatar ──────────────────────────────────────────────── */
    .zd-msg-avatar{
      width:30px;height:30px;border-radius:50%;flex-shrink:0;
      background:${o};display:flex;align-items:center;justify-content:center;
      font-size:16px;overflow:hidden;margin-bottom:16px;
    }
    .zd-msg-avatar img{width:100%;height:100%;object-fit:cover;}
    .zd-msg-avatar.zd-invisible{visibility:hidden;}

    /* Message bubble ──────────────────────────────────────────── */
    .zd-msg{max-width:72%;font-size:14px;line-height:1.55;position:relative;}
    .zd-msg-inner{padding:9px 12px;word-break:break-word;}
    .zd-msg.zd-bot .zd-msg-inner{
      background:#fff;color:#1e293b;
      border-radius:4px 14px 14px 14px;
      box-shadow:0 1px 2px rgba(0,0,0,0.08);
    }
    .zd-msg.zd-user .zd-msg-inner{
      background:${o};color:#fff;
      border-radius:14px 4px 14px 14px;
      box-shadow:0 1px 2px rgba(0,0,0,0.12);
    }
    .zd-msg.zd-admin .zd-msg-inner{
      background:#dcfce7;color:#15803d;
      border-radius:4px 14px 14px 14px;
      border:1px solid #bbf7d0;
    }
    .zd-msg.zd-unsent .zd-msg-inner{
      background:transparent;color:#94a3b8;
      font-style:italic;font-size:12px;
      padding:6px 12px;border:none;box-shadow:none;
    }

    /* Message metadata (timestamp + read) ─────────────────────── */
    .zd-msg-meta{
      display:flex;align-items:center;gap:4px;
      font-size:10px;color:#8a9bb0;margin-top:2px;
      padding:0 2px;
    }
    .zd-msg-row.zd-row-user .zd-msg-meta{justify-content:flex-end;}
    .zd-msg-row.zd-row-bot .zd-msg-meta{justify-content:flex-start;}
    .zd-read-receipt{color:#64b5f6;font-size:10px;}
    .zd-edited-label{font-size:10px;color:#94a3b8;font-style:italic;}

    /* Context menu trigger ─────────────────────────────────────── */
    .zd-msg-menu-btn{
      position:absolute;top:50%;transform:translateY(-50%);
      background:rgba(0,0,0,0.15);border:none;cursor:pointer;
      width:22px;height:22px;border-radius:50%;
      display:none;align-items:center;justify-content:center;
      font-size:12px;color:#fff;flex-shrink:0;
    }
    .zd-msg.zd-user .zd-msg-menu-btn{left:-28px;}
    .zd-msg.zd-bot .zd-msg-menu-btn{right:-28px;}
    .zd-msg-wrapper:hover .zd-msg-menu-btn{display:flex;}
    .zd-msg-wrapper{position:relative;}

    /* Context menu popup ──────────────────────────────────────── */
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

    /* Edit mode bar ───────────────────────────────────────────── */
    #zudobot-edit-bar{
      display:none;align-items:center;gap:8px;
      padding:6px 12px;background:#fff7ed;border-top:2px solid ${o};
      font-size:12px;color:#92400e;flex-shrink:0;
    }
    #zudobot-edit-bar.zd-show{display:flex;}
    #zudobot-edit-bar span{flex:1;}
    #zudobot-edit-cancel{
      background:none;border:none;cursor:pointer;
      color:#ef4444;font-size:18px;padding:0 4px;
    }

    /* Typing indicator ─────────────────────────────────────────── */
    .zd-typing-row{display:flex;align-items:flex-end;gap:6px;}
    .zd-typing{
      display:flex;gap:5px;padding:10px 14px;
      background:#fff;border-radius:4px 14px 14px 14px;
      box-shadow:0 1px 2px rgba(0,0,0,0.08);align-items:center;
    }
    .zd-typing span{
      width:8px;height:8px;border-radius:50%;
      background:${o};opacity:0.75;
      animation:zd-bounce 1.2s ease-in-out infinite;
    }
    .zd-typing span:nth-child(1){animation-delay:0s;}
    .zd-typing span:nth-child(2){animation-delay:0.18s;}
    .zd-typing span:nth-child(3){animation-delay:0.36s;}
    @keyframes zd-bounce{
      0%,70%,100%{transform:translateY(0);opacity:0.55;}
      35%{transform:translateY(-7px);opacity:1;}
    }

    /* Footer / Input ───────────────────────────────────────────── */
    #zudobot-footer{flex-shrink:0;background:#fff;}
    #zudobot-file-preview{padding:0 8px;}
    .zd-file-preview-bar{display:flex;flex-wrap:wrap;gap:4px;padding:4px 0;}
    .zd-file-chip{
      display:flex;align-items:center;gap:4px;
      background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;
      padding:3px 8px;font-size:11px;color:#475569;max-width:180px;
    }
    .zd-file-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .zd-file-remove{
      background:none;border:none;cursor:pointer;font-size:14px;
      color:#94a3b8;padding:0 2px;line-height:1;flex-shrink:0;
    }
    .zd-file-remove:hover{color:#ef4444;}
    .zd-file-thumb{
      position:relative;border-radius:8px;overflow:hidden;
      width:56px;height:56px;flex-shrink:0;cursor:default;
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
      border-radius:10px;object-fit:cover;margin-bottom:4px;cursor:pointer;
    }
    .zd-msg-text{display:block;}
    #zudobot-input-row{
      padding:8px 10px;border-top:1px solid #f1f5f9;
      display:flex;gap:6px;align-items:flex-end;
    }
    #zudobot-attach{
      background:none;border:none;cursor:pointer;font-size:18px;
      padding:6px 4px;color:#94a3b8;flex-shrink:0;transition:color 0.2s;
    }
    #zudobot-attach:hover{color:${o};}
    #zudobot-input{
      flex:1;border:1.5px solid #e2e8f0;border-radius:20px;
      padding:9px 14px;font-size:14px;resize:none;
      outline:none;max-height:100px;line-height:1.45;
      background:#f4f6f8;transition:border-color 0.2s,background 0.2s;
    }
    #zudobot-input:focus{border-color:${o};background:#fff;}
    #zudobot-send{
      width:38px;height:38px;border-radius:50%;
      background:${o};color:#fff;border:none;
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
    #zudobot-msg-count{font-size:11px;color:#94a3b8;}

    /* Misc ─────────────────────────────────────────────────────── */
    #zudobot-offline{
      flex:1;padding:24px 16px;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      text-align:center;color:#64748b;gap:10px;
    }
    #zudobot-offline .zd-offline-icon{font-size:36px;}
    #zudobot-offline .zd-offline-msg{font-size:14px;line-height:1.6;}
    .zd-limit-banner{
      padding:8px 14px;background:#fef3c7;
      font-size:12px;color:#92400e;text-align:center;flex-shrink:0;
    }
    .zd-msg a{color:${o};text-decoration:underline;}
    .zd-msg.zd-bot a{color:${o};}
    #zudobot-logo{
      width:75%;height:auto;object-fit:contain;will-change:transform;display:block;
      animation:zd-logo-spin 60s linear infinite;
    }
    @keyframes zd-logo-spin{
      0%{transform:rotate(0deg);animation-timing-function:cubic-bezier(0.4,0,0.2,1);}
      5%{transform:rotate(360deg);}100%{transform:rotate(360deg);}
    }
    #zudobot-quick-replies{padding:6px 12px 0;display:flex;flex-wrap:wrap;gap:6px;}
    .zd-quick-btn{
      padding:7px 13px;border:1.5px solid #e2e8f0;border-radius:100px;
      background:#fff;color:#475569;font-size:13px;cursor:pointer;
      white-space:nowrap;transition:border-color 0.2s,color 0.2s,background 0.2s;
    }
    .zd-quick-btn:hover{border-color:${o};color:${o};}

    /* Product cards ────────────────────────────────────────────── */
    .zd-product-list{display:flex;flex-direction:column;gap:8px;width:100%;align-self:stretch;}
    .zd-product-card{
      display:flex;gap:10px;background:#fff;
      border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;
      transition:border-color 0.2s,box-shadow 0.2s;
    }
    .zd-product-card:hover{border-color:${o};box-shadow:0 2px 12px rgba(0,0,0,0.08);}
    .zd-product-img{width:72px;height:72px;object-fit:cover;flex-shrink:0;}
    .zd-product-img-placeholder{
      width:72px;height:72px;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;font-size:28px;background:#f8fafc;
    }
    .zd-product-info{flex:1;padding:8px 10px 8px 0;min-width:0;display:flex;flex-direction:column;gap:3px;}
    .zd-product-name{font-size:13px;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;}
    .zd-product-desc{font-size:11px;color:#64748b;line-height:1.4;margin:0;}
    .zd-product-price-row{display:flex;align-items:center;gap:6px;}
    .zd-product-price{font-size:13px;font-weight:700;color:${o};}
    .zd-stock-badge{font-size:10px;background:#fef2f2;color:#dc2626;padding:2px 6px;border-radius:100px;font-weight:600;}
    .zd-product-actions{display:flex;gap:5px;margin-top:2px;flex-wrap:wrap;}
    .zd-product-btn{
      padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;
      cursor:pointer;text-decoration:none;display:inline-block;transition:opacity 0.2s,transform 0.15s;
    }
    .zd-product-btn:hover{opacity:0.85;transform:translateY(-1px);}
    .zd-btn-detail{border:1.5px solid ${o};color:${o};background:transparent;}
    .zd-btn-buy{background:${o};color:#fff;border:1.5px solid ${o};}

    /* Consent screen ────────────────────────────────────────────── */
    .zd-consent-screen{
      display:flex;flex-direction:column;align-items:center;
      padding:20px 16px;text-align:center;gap:10px;
      background:#f8fafc;border-radius:12px;margin:8px 0;
    }
    .zd-consent-icon{font-size:32px;}
    .zd-consent-title{font-size:14px;font-weight:700;color:#1e293b;margin:0;}
    .zd-consent-text{font-size:12px;color:#475569;line-height:1.6;margin:0;}
    .zd-consent-actions{display:flex;gap:8px;width:100%;}
    .zd-consent-btn{
      flex:1;padding:9px;border-radius:10px;font-size:13px;font-weight:600;
      cursor:pointer;border:none;transition:opacity 0.2s;
    }
    .zd-consent-accept{background:${o};color:#fff;}
    .zd-consent-decline{background:#e2e8f0;color:#475569;}
    .zd-consent-btn:hover{opacity:0.85;}
    .zd-consent-note{font-size:10px;color:#94a3b8;margin:0;}
    .zd-privacy-notice .zd-consent-actions,.zd-privacy-notice .zd-consent-note{display:none;}

    #zudobot-powered{text-decoration:none;color:inherit;transition:color 0.2s ease;}
    #zudobot-powered:hover{color:#2563eb;}
  `}async function x(o){if(!(o.headers.get("content-type")??"").includes("application/json"))return null;try{return await o.json()}catch{return null}}async function M(o,e){try{const t=await fetch(`${e}/api/widget/init`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:o})});if(!t.ok)return null;const n=await x(t);return n!=null&&n.ok&&n.config?n.config:null}catch{return null}}async function $(o,e,t){try{const n=new FormData;n.append("file",o),n.append("key",e);const i=await fetch(`${t}/api/widget/upload`,{method:"POST",body:n});if(!i.ok)return null;const s=await i.json();return s!=null&&s.ok&&s.attachment?s.attachment:null}catch{return null}}async function I(o,e,t,n,i,s){try{const d=await fetch(`${e}/api/widget/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:o,sessionId:t,message:n,consentGiven:i,attachments:s})}),l=await x(d);return!d.ok||!l?{reply:"ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งนะคะ 🙏"}:{reply:l.reply??"ขออภัย ไม่สามารถตอบได้ในขณะนี้",blocked:l.blocked,handoffMode:l.handoffMode,products:l.products}}catch{return{reply:"ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งนะคะ 🙏"}}}async function S(o,e,t,n){try{await fetch(`${e}/api/widget/consent`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:o,sessionId:t,given:n})})}catch{}}async function C(o,e,t){try{const n=await fetch(`${e}/api/widget/checkout`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:o,productId:t})});if(!n.ok)return null;const i=await x(n);return i!=null&&i.ok&&i.url?i.url:null}catch{return null}}async function T(o,e,t,n){try{const i=`${e}/api/widget/updates?key=${encodeURIComponent(o)}&sessionId=${encodeURIComponent(t)}&since=${encodeURIComponent(n)}`,s=await fetch(i);return s.ok?await x(s)??{messages:[],botStatus:"handoff_active"}:{messages:[],botStatus:"handoff_active"}}catch{return{messages:[],botStatus:"handoff_active"}}}const B=10*1024*1024,L=3,y=["image/jpeg","image/png","image/gif","image/webp","image/bmp","application/pdf","audio/mpeg","audio/mp4","audio/wav","audio/ogg","audio/webm","video/mp4","video/webm","video/quicktime"],P={image:"🖼️",application:"📄",audio:"🎵",video:"🎬"};function F(){const o="zudobot_sid";let e=sessionStorage.getItem(o);return e||(e=crypto.randomUUID(),sessionStorage.setItem(o,e)),e}function v(o){return`zudobot_consent_${o}`}function U(o){try{const e=localStorage.getItem(v(o));if(e==="given"||e==="declined")return e}catch{}return null}function N(o,e){try{localStorage.setItem(v(o),e)}catch{}}function u(o){return o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function E(o){return o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\[([^\]]+)\]\(([^)]+)\)/g,(e,t,n)=>{try{const i=new URL(n);if(!["http:","https:"].includes(i.protocol))return u(t)}catch{return u(t)}return`<a href="${u(n)}" target="_blank" rel="noopener noreferrer">${t}</a>`}).replace(/\n/g,"<br>")}function O(o,e){return o===-1?"ติดต่อสอบถาม":o===0?"ฟรี":`฿${o.toLocaleString("th-TH")}${e||""}`}function m(o){if(!o)return null;try{const e=new URL(o);return["http:","https:"].includes(e.protocol)?e.href:null}catch{return null}}class _{constructor(e){this.config=null,this.sessionId=F(),this.isOpen=!1,this.isSending=!1,this.handoffMode=!1,this.consentGiven=null,this.pollInterval=null,this.lastPollTime=new Date().toISOString(),this.pendingFiles=[],this.pendingFilePreviews=[],this.msgStore=new Map,this.unreadCount=0,this.editingId=null,this.opts=e}async init(){this.config=await M(this.opts.embedKey,this.opts.apiUrl),this.config||(this.config={botName:"Zudobot",welcomeMessage:"สวัสดีครับ มีอะไรให้ช่วยไหมครับ?",widgetColor:this.opts.color,widgetPosition:this.opts.position,requireConsent:!1});const e=U(this.opts.embedKey);e==="given"&&(this.consentGiven=!0),e==="declined"&&(this.consentGiven=!1),this.mount()}mount(){var s;const e=this.config,t=e.widgetPosition==="bottom-left"?"left":"right",n=document.createElement("style");n.textContent=k(e.widgetColor,e.widgetPosition),document.head.appendChild(n);const i=document.createElement("div");i.id="zudobot-container",i.innerHTML=`
      <div id="zudobot-preview"></div>
      <button id="zudobot-bubble" aria-label="เปิดแชท" style="${t}:24px">
        <img id="zudobot-logo" src="https://zudobotstorage.s3.ap-southeast-2.amazonaws.com/zudobot_single_logo-logo.PNG" alt="" />
        <span id="zudobot-bubble-close" style="display:none;font-size:20px;color:#fff;line-height:1;">✕</span>
        <span id="zudobot-badge"></span>
      </button>
      <div id="zudobot-window" class="zd-hidden" style="${t}:24px">
        <div id="zudobot-header">
          <div class="zd-avatar">
            <img src="https://zudobotstorage.s3.ap-southeast-2.amazonaws.com/zudobot_single_logo-logo.PNG" alt="Zudobot Logo" />
          </div>
          <div class="zd-bot-info">
            <div class="zd-title">${u(e.botName)}</div>
            <div class="zd-subtitle"><span class="zd-online"></span>ออนไลน์ • พร้อมช่วยเหลือ</div>
          </div>
          <button id="zudobot-close" aria-label="ปิด">✕</button>
        </div>
        <div id="zudobot-messages"></div>
        <div id="zudobot-footer">
          <div id="zudobot-edit-bar">
            <span>✏️ กำลังแก้ไขข้อความ</span>
            <button id="zudobot-edit-cancel" aria-label="ยกเลิก">✕</button>
          </div>
          <div id="zudobot-file-preview"></div>
          <div id="zudobot-input-row">
            <input type="file" id="zudobot-file-input" multiple accept="${y.join(",")}" style="display:none" aria-label="แนบไฟล์" />
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
    `,document.body.appendChild(i),this.containerEl=i,document.getElementById("zudobot-bubble").addEventListener("click",()=>this.toggle()),document.getElementById("zudobot-close").addEventListener("click",()=>this.toggle(!1)),this.messagesEl=document.getElementById("zudobot-messages"),this.inputEl=document.getElementById("zudobot-input"),this.sendBtn=document.getElementById("zudobot-send"),this.fileInput=document.getElementById("zudobot-file-input"),this.filePreviewEl=document.getElementById("zudobot-file-preview"),this.badgeEl=document.getElementById("zudobot-badge"),this.previewEl=document.getElementById("zudobot-preview"),this.editBarEl=document.getElementById("zudobot-edit-bar"),(s=document.getElementById("zudobot-edit-cancel"))==null||s.addEventListener("click",()=>this.cancelEdit()),document.addEventListener("click",()=>this.closeContextMenu()),this.sendBtn.addEventListener("click",()=>this.send()),this.inputEl.addEventListener("keydown",d=>{d.key==="Enter"&&!d.shiftKey&&(d.preventDefault(),this.send())}),this.inputEl.addEventListener("input",()=>{this.inputEl.style.height="auto",this.inputEl.style.height=Math.min(this.inputEl.scrollHeight,100)+"px"}),document.getElementById("zudobot-attach").addEventListener("click",()=>{this.fileInput.click()}),this.fileInput.addEventListener("change",()=>{this.handleFileSelect(Array.from(this.fileInput.files??[])),this.fileInput.value=""}),this.inputEl.addEventListener("paste",d=>{var c;const a=Array.from(((c=d.clipboardData)==null?void 0:c.items)??[]).filter(p=>p.type.startsWith("image/"));if(a.length===0)return;d.preventDefault();const r=a.map(p=>p.getAsFile()).filter(Boolean);r.length>0&&this.handleFileSelect(r)}),e.requireConsent&&this.consentGiven===null?this.showConsentScreen():(e.consentText&&this.showPrivacyNotice(e.consentText),this.appendBotMessage(e.welcomeMessage)),this.detectLaunchParams()}showPrivacyNotice(e){const t=document.createElement("div");t.className="zd-consent-screen zd-privacy-notice",t.innerHTML=`
      <div class="zd-consent-icon">🔒</div>
      <p class="zd-consent-title">ความเป็นส่วนตัว</p>
      <p class="zd-consent-text">${u(e)}</p>
    `,this.messagesEl.appendChild(t)}showConsentScreen(){const t=this.config.consentText||"ระบบนี้จะเก็บประวัติการสนทนาเพื่อให้บริการที่ดียิ่งขึ้น กรุณายืนยันความยินยอมก่อนเริ่มสนทนา",n=document.createElement("div");n.id="zudobot-consent",n.className="zd-consent-screen",n.innerHTML=`
      <div class="zd-consent-icon">🔒</div>
      <p class="zd-consent-title">นโยบายความเป็นส่วนตัว</p>
      <p class="zd-consent-text">${u(t)}</p>
      <div class="zd-consent-actions">
        <button id="zd-consent-accept" class="zd-consent-btn zd-consent-accept">ยินยอม</button>
        <button id="zd-consent-decline" class="zd-consent-btn zd-consent-decline">ไม่ยินยอม</button>
      </div>
      <p class="zd-consent-note">หากไม่ยินยอม บอทจะยังตอบได้แต่ไม่บันทึกประวัติ</p>
    `,this.messagesEl.appendChild(n),this.consentEl=n,this.inputEl.disabled=!0,this.sendBtn.disabled=!0,document.getElementById("zd-consent-accept").addEventListener("click",()=>this.handleConsent(!0)),document.getElementById("zd-consent-decline").addEventListener("click",()=>this.handleConsent(!1))}async handleConsent(e){if(this.consentGiven=e,N(this.opts.embedKey,e?"given":"declined"),S(this.opts.embedKey,this.opts.apiUrl,this.sessionId,e),this.consentEl&&(this.consentEl.remove(),this.consentEl=void 0),this.inputEl.disabled=!1,this.sendBtn.disabled=!1,!e){const t=document.createElement("div");t.className="zd-msg zd-bot",t.innerHTML="ℹ️ บอทจะตอบในโหมด <strong>ไม่บันทึกประวัติ</strong> — การสนทนานี้จะไม่ถูกเก็บข้อมูล",this.messagesEl.appendChild(t)}this.appendBotMessage(this.config.welcomeMessage),this.scrollToBottom(),this.inputEl.focus()}toggle(e){this.isOpen=e!==void 0?e:!this.isOpen,document.getElementById("zudobot-window").classList.toggle("zd-hidden",!this.isOpen);const n=document.getElementById("zudobot-logo"),i=document.getElementById("zudobot-bubble-close");n&&(n.style.display=this.isOpen?"none":""),i&&(i.style.display=this.isOpen?"":"none"),this.isOpen&&this.inputEl&&!this.inputEl.disabled&&this.inputEl.focus(),this.isOpen&&this.clearUnread()}clearUnread(){this.unreadCount=0,this.badgeEl&&(this.badgeEl.textContent="0",this.badgeEl.classList.remove("zd-show")),this.previewEl&&this.previewEl.classList.remove("zd-show")}addUnread(e){this.isOpen||(this.unreadCount++,this.badgeEl&&(this.badgeEl.textContent=this.unreadCount>9?"9+":String(this.unreadCount),this.badgeEl.classList.add("zd-show")),this.previewEl&&(this.previewEl.textContent=e.length>40?e.slice(0,40)+"…":e,this.previewEl.classList.add("zd-show")))}open(){this.toggle(!0)}close(){this.toggle(!1)}fmtTime(e){return e.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",hour12:!1})}appendBotMessage(e){const t=crypto.randomUUID(),n=new Date,i=this.config,s=document.createElement("div");s.className="zd-msg-row zd-row-bot";const d=document.createElement("div");d.className="zd-msg-avatar",d.innerHTML=`<img src="https://zudobotstorage.s3.ap-southeast-2.amazonaws.com/zudobot_single_logo-logo.PNG" alt="${u(i.botName)}" />`;const l=document.createElement("div");l.className="zd-msg-wrapper";const a=document.createElement("div");a.className="zd-msg zd-bot",a.dataset.msgId=t;const r=document.createElement("div");r.className="zd-msg-inner",r.innerHTML=E(e),a.appendChild(r),l.appendChild(a);const c=document.createElement("div");c.className="zd-msg-meta",c.innerHTML=`<span class="zd-ts">${this.fmtTime(n)}</span>`,s.appendChild(d);const p=document.createElement("div");p.style.cssText="display:flex;flex-direction:column;max-width:72%;",p.appendChild(l),p.appendChild(c),s.appendChild(p),this.messagesEl.appendChild(s),this.scrollToBottom(),this.markLastUserRead(),this.addUnread(e);const h={id:t,role:"bot",text:e,el:a,rowEl:s,innerEl:r,metaEl:c,imgPreviews:[],unsent:!1,edited:!1,timestamp:n};return this.msgStore.set(t,h),a}markLastUserRead(){let e=null;if(this.msgStore.forEach(n=>{n.role==="user"&&!n.unsent&&(e=n)}),!e)return;const t=e;if(this.msgStore.forEach(n=>{if(n.role==="user"&&n.id!==t.id){const i=n.metaEl.querySelector(".zd-read-receipt");i&&i.remove()}}),!t.metaEl.querySelector(".zd-read-receipt")){const n=document.createElement("span");n.className="zd-read-receipt",n.textContent="อ่านแล้ว",t.metaEl.appendChild(n)}}appendUserMessage(e,t){const n=crypto.randomUUID(),i=new Date,s=t&&t.length>0,d=document.createElement("div");d.className="zd-msg-row zd-row-user";const l=document.createElement("div");l.style.cssText="display:flex;flex-direction:column;align-items:flex-end;max-width:72%;";const a=document.createElement("div");a.className="zd-msg-wrapper";const r=document.createElement("div");r.className=s?"zd-msg zd-user zd-has-img":"zd-msg zd-user",r.dataset.msgId=n;const c=document.createElement("div");c.className="zd-msg-inner";let p="";if(s)for(const g of t)g.startsWith("data:image/")&&(p+=`<img class="zd-msg-img-preview" src="${g}" alt="รูปที่แนบ" />`);e&&(p+=`<span class="zd-msg-text">${u(e)}</span>`),c.innerHTML=p,r.appendChild(c);const h=document.createElement("button");h.className="zd-msg-menu-btn",h.textContent="⋯",h.title="ตัวเลือก",h.addEventListener("click",g=>{g.stopPropagation(),this.showContextMenu(n,g.clientX,g.clientY)}),r.appendChild(h),a.appendChild(r),a.addEventListener("touchstart",()=>{this.longPressTimer=setTimeout(()=>this.showContextMenu(n,0,0,!0),600)},{passive:!0}),a.addEventListener("touchend",()=>{clearTimeout(this.longPressTimer)}),a.addEventListener("touchmove",()=>{clearTimeout(this.longPressTimer)});const f=document.createElement("div");f.className="zd-msg-meta",f.innerHTML=`<span class="zd-ts">${this.fmtTime(i)}</span>`,l.appendChild(a),l.appendChild(f),d.appendChild(l),this.messagesEl.appendChild(d),this.scrollToBottom();const w={id:n,role:"user",text:e,el:r,rowEl:d,innerEl:c,metaEl:f,imgPreviews:t??[],unsent:!1,edited:!1,timestamp:i};this.msgStore.set(n,w)}showContextMenu(e,t,n,i=!1){const s=this.msgStore.get(e);if(!s||s.role!=="user"||s.unsent)return;this.closeContextMenu();const d=document.createElement("div");d.className="zd-ctx-menu",this.ctxMenu=d;const l=[{icon:"✏️",label:"แก้ไขข้อความ",action:()=>this.startEdit(e)},{icon:"📋",label:"คัดลอก",action:()=>{var a;return(a=navigator.clipboard)==null?void 0:a.writeText(s.text).catch(()=>{})}},{sep:!0},{icon:"🗑️",label:"ยกเลิกการส่ง",action:()=>this.unsendMsg(e),danger:!0}];for(const a of l)if("sep"in a){const r=document.createElement("div");r.className="zd-ctx-sep",d.appendChild(r)}else{const r=document.createElement("button");r.className="zd-ctx-item"+(a.danger?" zd-ctx-danger":""),r.innerHTML=`${a.icon} ${u(a.label)}`,r.addEventListener("click",c=>{c.stopPropagation(),a.action(),this.closeContextMenu()}),d.appendChild(r)}if(document.body.appendChild(d),i)d.style.cssText="bottom:80px;left:50%;transform:translateX(-50%);top:auto;";else{const a=window.innerWidth,r=window.innerHeight,c=150,p=140;d.style.left=Math.min(t,a-c-8)+"px",d.style.top=Math.min(n,r-p-8)+"px"}}closeContextMenu(){this.ctxMenu&&(this.ctxMenu.remove(),this.ctxMenu=void 0)}startEdit(e){const t=this.msgStore.get(e);!t||t.unsent||(this.editingId=e,this.inputEl.value=t.text,this.inputEl.focus(),this.editBarEl&&this.editBarEl.classList.add("zd-show"),t.el.style.opacity="0.6")}cancelEdit(){if(this.editingId){const e=this.msgStore.get(this.editingId);e&&(e.el.style.opacity="")}this.editingId=null,this.inputEl.value="",this.editBarEl&&this.editBarEl.classList.remove("zd-show")}applyEdit(e){const t=this.msgStore.get(this.editingId);if(!t)return;t.text=e,t.edited=!0,t.el.style.opacity="";const n=t.innerEl.querySelector(".zd-msg-text");if(n&&(n.textContent=e),!t.metaEl.querySelector(".zd-edited-label")){const i=document.createElement("span");i.className="zd-edited-label",i.textContent="(แก้ไขแล้ว)",t.metaEl.prepend(i)}this.editingId=null,this.editBarEl&&this.editBarEl.classList.remove("zd-show")}unsendMsg(e){var n,i;const t=this.msgStore.get(e);t&&(t.unsent=!0,t.el.className="zd-msg zd-user zd-unsent",t.innerEl.innerHTML="<span>ยกเลิกการส่งข้อความแล้ว</span>",(n=t.el.querySelector(".zd-msg-menu-btn"))==null||n.remove(),(i=t.metaEl.querySelector(".zd-read-receipt"))==null||i.remove())}appendProductCards(e){if(!e||e.length===0)return;const t=document.createElement("div");t.className="zd-product-list";for(const n of e){const i=document.createElement("div");i.className="zd-product-card";const s=n.imageUrl&&m(n.imageUrl)?`<img class="zd-product-img" src="${u(m(n.imageUrl))}" alt="${u(n.name)}" loading="lazy" onerror="this.style.display='none'" />`:'<div class="zd-product-img-placeholder">🛍️</div>',d=O(n.price,n.priceSuffix),l=n.stock!==null&&n.stock!==void 0&&n.stock<=5&&n.stock>0?`<span class="zd-stock-badge">เหลือ ${n.stock} ชิ้น!</span>`:"",a=m(n.productUrl)??null,r=a?`<a class="zd-product-btn zd-btn-detail" href="${u(a)}" target="_blank" rel="noopener noreferrer">ดูรายละเอียด</a>`:"",p=n._id||m(n.stripePaymentLink)||a?`<button class="zd-product-btn zd-btn-buy" data-product-id="${u(n._id??"")}" data-payment-link="${u(n.stripePaymentLink??"")}" data-product-url="${u(n.productUrl??"")}">ซื้อเลย →</button>`:"";i.innerHTML=`
        ${s}
        <div class="zd-product-info">
          <p class="zd-product-name">${u(n.name)}</p>
          ${n.description?`<p class="zd-product-desc">${u(n.description.slice(0,80))}${n.description.length>80?"…":""}</p>`:""}
          <div class="zd-product-price-row">
            <span class="zd-product-price">${u(d)}</span>
            ${l}
          </div>
          <div class="zd-product-actions">
            ${r}
            ${p}
          </div>
        </div>
      `;const h=i.querySelector(".zd-btn-buy");h&&h.addEventListener("click",async()=>{h.disabled=!0,h.textContent="กำลังโหลด...";const f=h.dataset.productId??"",w=h.dataset.paymentLink??"",g=h.dataset.productUrl??"";let b=null;f&&(b=await C(this.opts.embedKey,this.opts.apiUrl,f)),b||(b=m(w)??m(g)),b&&window.open(b,"_blank","noopener,noreferrer"),h.disabled=!1,h.textContent="ซื้อเลย →"}),t.appendChild(i)}this.messagesEl.appendChild(t),this.scrollToBottom()}showTyping(){const e=document.createElement("div");return e.id="zudobot-typing",e.className="zd-msg zd-bot zd-typing",e.innerHTML="<span></span><span></span><span></span>",this.messagesEl.appendChild(e),this.scrollToBottom(),e}removeTyping(){var e;(e=document.getElementById("zudobot-typing"))==null||e.remove()}scrollToBottom(){this.messagesEl.scrollTop=this.messagesEl.scrollHeight}setSending(e){this.isSending=e,this.sendBtn.disabled=e,this.inputEl.disabled=e}handleFileSelect(e){const t=[],n=[];for(const s of e){if(!y.includes(s.type)){t.push(`"${s.name}" ไม่รองรับชนิดไฟล์นี้`);continue}if(s.size>B){t.push(`"${s.name}" ขนาดเกิน 10 MB`);continue}if(this.pendingFiles.length+n.length>=L){t.push("สูงสุด 3 ไฟล์ต่อข้อความ");break}n.push(s)}t.length&&this.appendBotMessage(`⚠️ ${t.join(" · ")}`);const i=this.pendingFiles.length;this.pendingFiles.push(...n),n.forEach((s,d)=>{if(s.type.startsWith("image/")){const l=new FileReader;l.onload=a=>{this.pendingFilePreviews[i+d]=a.target.result,this.renderFilePreview()},l.readAsDataURL(s)}}),this.renderFilePreview()}renderFilePreview(){if(this.filePreviewEl.innerHTML="",this.pendingFiles.length===0)return;const e=document.createElement("div");e.className="zd-file-preview-bar",this.pendingFiles.forEach((t,n)=>{const i=this.pendingFilePreviews[n];if(i){const s=document.createElement("div");s.className="zd-file-thumb",s.innerHTML=`<img src="${i}" alt="${u(t.name)}" />
          <button class="zd-file-remove" data-idx="${n}" aria-label="ลบ">×</button>`,e.appendChild(s)}else{const s=document.createElement("div");s.className="zd-file-chip";const d=P[t.type.split("/")[0]]??"📎";s.innerHTML=`<span>${d} ${u(t.name.length>18?t.name.slice(0,15)+"…":t.name)}</span>
          <button class="zd-file-remove" data-idx="${n}" aria-label="ลบ">×</button>`,e.appendChild(s)}}),e.querySelectorAll(".zd-file-remove").forEach(t=>{t.addEventListener("click",()=>{const n=parseInt(t.dataset.idx??"0",10);this.pendingFiles.splice(n,1),this.pendingFilePreviews.splice(n,1),this.renderFilePreview()})}),this.filePreviewEl.appendChild(e)}async uploadPendingFiles(){if(this.pendingFiles.length===0)return[];const e=[];for(const t of this.pendingFiles)try{const n=await $(t,this.opts.embedKey,this.opts.apiUrl);n&&e.push(n)}catch{this.appendBotMessage(`⚠️ อัปโหลด "${t.name}" ไม่สำเร็จ กรุณาลองใหม่`)}return this.pendingFiles=[],this.pendingFilePreviews=[],this.renderFilePreview(),e}calcDisplayDelay(e){const t=Math.min(e.length*.044,4.5)*1e3,n=.85+Math.random()*.3;return Math.max(800,Math.min(Math.round(t*n),4500))}delay(e){return new Promise(t=>setTimeout(t,e))}splitOnSentenceBoundaries(e,t){const n=/[^.!?\n]*[.!?]+\s*/g,i=[];let s=0,d;for(;(d=n.exec(e))!==null;)i.push(d[0]),s=n.lastIndex;const l=e.slice(s).trim();if(l&&i.push(l),i.length===0)return[e];const a=[];let r="";for(const c of i){const p=c.trim();p&&(r?r.length+1+p.length<=t?r+=" "+p:(a.push(r),r=p):r=p)}return r&&a.push(r),a.length>0?a:[e]}splitIntoBubbles(e,t=150){if(e.length<=t)return[e];const n=e.split(/\n+/).map(l=>l.trim()).filter(Boolean),i=[];for(const l of n)l.length<=t?i.push(l):i.push(...this.splitOnSentenceBoundaries(l,t));const s=[];let d="";for(const l of i)d?d.length+1+l.length<=t?d+=`
`+l:(s.push(d),d=l):d=l;return d&&s.push(d),s.length>0?s:[e]}async detectLaunchParams(){const e=new URLSearchParams(window.location.search);if(e.get("zudobot")!=="1")return;this.open();const t=e.get("ctx");if(t){await this.delay(600);try{const n=await fetch(`${this.opts.apiUrl}/api/widget/ctx/${encodeURIComponent(t)}`,{method:"GET"});if(!n.ok)return;const i=await n.json();i.ok&&i.initialMessage&&await this.send(i.initialMessage)}catch{}}}async send(e){if(this.isSending)return;const t=e??this.inputEl.value.trim(),n=this.pendingFiles.length>0;if(!t&&!n)return;if(this.editingId&&t&&!n){this.applyEdit(t),this.inputEl.value="",this.inputEl.style.height="auto";return}e||(this.inputEl.value="",this.inputEl.style.height="auto"),this.setSending(!0);const i=this.pendingFilePreviews.filter(Boolean).filter(c=>c.startsWith("data:image/"));this.appendUserMessage(t||"",i.length>0?i:void 0),this.showTyping();const s=await this.uploadPendingFiles(),{reply:d,handoffMode:l,products:a}=await I(this.opts.embedKey,this.opts.apiUrl,this.sessionId,t||"(ส่งไฟล์แนบ)",this.consentGiven===!0,s),r=this.splitIntoBubbles(d);await this.delay(this.calcDisplayDelay(r[0])),this.removeTyping(),this.appendBotMessage(r[0]);for(let c=1;c<r.length;c++)this.showTyping(),await this.delay(2e3),this.removeTyping(),this.appendBotMessage(r[c]);a&&a.length>0&&this.appendProductCards(a),this.setSending(!1),this.inputEl.focus(),l&&!this.handoffMode&&this.enterHandoffMode()}enterHandoffMode(){this.handoffMode=!0,this.lastPollTime=new Date().toISOString(),this.pollInterval&&clearInterval(this.pollInterval),this.pollInterval=setInterval(()=>this.pollAdminMessages(),3e3)}exitHandoffMode(){this.handoffMode=!1,this.pollInterval&&(clearInterval(this.pollInterval),this.pollInterval=null),this.appendBotMessage("✅ การสนทนากับเจ้าหน้าที่จบแล้ว บอทกลับมาพร้อมช่วยเหลือคุณแล้วนะคะ 😊")}async pollAdminMessages(){const{messages:e,botStatus:t}=await T(this.opts.embedKey,this.opts.apiUrl,this.sessionId,this.lastPollTime);if(e.length>0){this.lastPollTime=new Date().toISOString();for(const n of e)this.appendAdminMessage(n.content)}t==="resolved"&&this.exitHandoffMode()}appendAdminMessage(e){const t=document.createElement("div");return t.className="zd-msg zd-admin",t.innerHTML=E(e),this.messagesEl.appendChild(t),this.scrollToBottom(),t}}const z="https://zudobot.zudogu.com";function H(o){const e=o==null?void 0:o.trim();if(!e)return z;try{const{protocol:t,hostname:n,origin:i}=new URL(e);if(t!=="http:"&&t!=="https:")return z;const s=n.toLowerCase();if(s==="localhost"||s==="127.0.0.1")return i.replace(/\/$/,"")}catch{return z}return z}function j(){const o=document.currentScript??document.querySelector("script[data-key]");if(!o){console.warn("[Zudobot] Cannot find script tag with data-key.");return}const e=o.getAttribute("data-key");if(!e){console.warn("[Zudobot] data-key is required.");return}const t=H(o.getAttribute("data-api-url")),n=o.getAttribute("data-color")??"#1E5BC6",i=o.getAttribute("data-position")??"bottom-right",s=new _({embedKey:e,apiUrl:t,color:n,position:i});document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>s.init()):s.init(),window.Zudobot=s}j()})();
