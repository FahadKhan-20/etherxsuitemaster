// Generated from design-artifacts/EtherX Meet Room.dc.html. Regenerate with node scripts/port-meeting-reference.cjs.
import { Fragment } from "react";
import etherxLogo from '../../assets/etherx_logo_header.png';
import ReferenceTile from "./ReferenceTile";
import "../../styles/reference-room.css";
export const REFERENCE_ICONS={
  hand: 'M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L6 14', people: 'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6', share: 'M3 4h18v13H3zM8 21h8M12 17v4M9 10l3-3 3 3M12 7v7',
  rec: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', invite: 'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6', wb: 'M3 4h18v12H3zM8 20l4-4 4 4M7 12l3-3 2 2 4-4',
  perf: 'M13 2L4 14h7l-1 8 9-12h-7z', full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', agenda: 'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h8M8 12h8M8 16h5',
  cc: 'M3 5h18v14H3zM10 10a2 2 0 1 0 0 4M17 10a2 2 0 1 0 0 4', poll: 'M5 20V10M12 20V4M19 20v-7', file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6',
  video: 'M3 5h18v12H3zM8 21h8M12 17v4', audio: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', noise: 'M2 12h2M6 8v8M10 5v14M14 8v8M18 10v4',
  bg: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6', stats: 'M3 3v18h18M7 15l4-4 3 3 5-6', settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  keys: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', feedback: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12zM9 11h.01M12 11h.01M15 11h.01',
};
export const REFERENCE_BINDINGS=[
  "youtubeRef",
  "ackRec",
  "addAgenda",
  "addOpt",
  "admitAll",
  "agendaDraft",
  "agendaProgress",
  "agendaRows",
  "b",
  "bgOptions",
  "brClose",
  "brCounts",
  "brDurations",
  "brNote",
  "brOn",
  "brOpen",
  "brPill",
  "brRooms",
  "brSetup",
  "brShuffle",
  "camList",
  "camOff",
  "camOn",
  "camTitle",
  "canAddOpt",
  "canMod",
  "canRejoin",
  "capColor",
  "capLine",
  "capWho",
  "captions",
  "chatLocked",
  "chatOpen",
  "chromeOp",
  "closeModal",
  "closePanel",
  "codeLabel",
  "copyCode",
  "copyLink",
  "doLeave",
  "downloadNotes",
  "draft",
  "elapsed",
  "emojis",
  "endForAll",
  "fbForm",
  "fbSent",
  "fbText",
  "fileRef",
  "files",
  "filterOptions",
  "footY",
  "gridCols",
  "gridRows",
  "handRows",
  "handTitle",
  "hasFiles",
  "hasHands",
  "hasMediaErr",
  "hasWaiting",
  "headerPadR",
  "inCount",
  "inviteCodeLabel",
  "inviteCopyCode",
  "inviteCopyLink",
  "inviteEmail",
  "inviteLink",
  "inviteLinkLabel",
  "invited",
  "isAgenda",
  "isBgTab",
  "isBreakout",
  "isChat",
  "isFeedback",
  "isFiles",
  "isHost",
  "isInvite",
  "isMedia",
  "isNotes",
  "isPeople",
  "isPolls",
  "isProfile",
  "isSettings",
  "isShortcuts",
  "isToggles",
  "kindOpts",
  "knockAdmit",
  "knockDeny",
  "knockMore",
  "knockName",
  "launchPoll",
  "leaveClick",
  "linkShort",
  "locked",
  "mediaAudioRef",
  "mediaErr",
  "mediaKindTitle",
  "mediaPh",
  "mediaSrc",
  "mediaUrl",
  "mediaVideoRef",
  "menuCam",
  "menuLeave",
  "menuMic",
  "menuMore",
  "menuReact",
  "messages",
  "micDead",
  "micList",
  "micLive",
  "micTitle",
  "modalOpen",
  "moreRight",
  "moreSections",
  "mt",
  "mutedHint",
  "myInitials",
  "myName",
  "name",
  "netBars",
  "netLabel",
  "noMatches",
  "noiseFg",
  "noiseLabel",
  "notes",
  "notesSummary",
  "onAgendaDraft",
  "onAgendaKey",
  "onDraft",
  "onDraftKey",
  "onFb",
  "onFiles",
  "onInviteEmail",
  "onInviteKey",
  "onMediaKey",
  "onMediaUrl",
  "onName",
  "onNotes",
  "onPollQ",
  "onQ",
  "openAudioSettings",
  "openBgSettings",
  "openBreakout",
  "openCamMenu",
  "openChat",
  "openEnd",
  "openMicMenu",
  "openMore",
  "openPeople",
  "openReact",
  "openVideoSettings",
  "overlay",
  "overlaySub",
  "overlayTitle",
  "pLeft",
  "pTop",
  "pW",
  "panelOpen",
  "panelTitle",
  "peopleBadge",
  "peopleBadgeBg",
  "peopleBadgeFg",
  "peopleRows",
  "pickFiles",
  "pollOptInputs",
  "pollQ",
  "polls",
  "previewAv",
  "previewBg",
  "previewFilter",
  "previewMirror",
  "previewRef",
  "previewRight",
  "previewVid",
  "previews",
  "ptt",
  "q",
  "quickTiles",
  "reactLeft",
  "recLabel",
  "reconnecting",
  "recording",
  "rejoin",
  "roleLabel",
  "roomCode",
  "roomTitle",
  "roomy",
  "rxRef",
  "sendChat",
  "sendFb",
  "sendInvite",
  "shortcuts",
  "showConsent",
  "showKnock",
  "spkList",
  "stagePadR",
  "stars",
  "startMedia",
  "stop",
  "stopMedia",
  "tab",
  "tabSelects",
  "tabToggles",
  "tabs",
  "tiles",
  "toasts",
  "toggleCam",
  "toggleHand",
  "toggleMic",
  "toggleNoise",
  "togglePresent",
  "unmuteNow",
  "unread",
  "waitRows",
  "wb",
  "wide"
];
export default function ReferenceRoomView({v}) { return <div className="exmeet-reference" data-meeting-theme="dark" ref={v.rootRef}>

<div style={{"height": "100vh","display": "flex","flexDirection": "column","background": "#0b0a08"}}>
<header style={{"flexShrink": "0","display": "grid","gridTemplateColumns": "1fr auto 1fr","alignItems": "center","gap": "16px","padding": "12px " + String(v.headerPadR) + " 12px 20px","opacity": v.chromeOp,"transition": "opacity 300ms ease"}}>
<div style={{"display": "flex","alignItems": "center"}}>
<img src={etherxLogo} alt="EtherX Meet" style={{"height": "32px","width": "auto","display": "block"}} />
</div>
<div style={{"display": "flex","alignItems": "center","gap": "10px"}}>
<div style={{"display": "flex","alignItems": "center","gap": "12px","height": "40px","padding": "0 8px 0 16px","borderRadius": "999px","background": "#13110e","border": "1px solid #2e2a21","fontSize": "14px"}}>
{(v.wide) && <><span style={{"fontWeight": "600","whiteSpace": "nowrap"}}>{v.roomTitle}</span><span style={{"width": "1px","height": "16px","background": "#2e2a21"}}></span></>}
<button aria-label={"Copy room code"} onClick={v.copyCode} title={"Copy room code"} style={{"display": "flex","alignItems": "center","gap": "8px","border": "0","background": "transparent","color": "#d8d1c1","fontFamily": "'JetBrains Mono',monospace","fontSize": "13px","cursor": "pointer","padding": "4px 6px","borderRadius": "8px"}} className="dc-0">
<span style={{"whiteSpace": "nowrap"}}>{v.codeLabel}</span>
<svg width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#8a8373"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}><rect x={"9"} y={"9"} width={"12"} height={"12"} rx={"2"}></rect><path d={"M5 15V5a2 2 0 0 1 2-2h10"}></path></svg>
</button>
<span style={{"width": "1px","height": "16px","background": "#2e2a21"}}></span>
<span style={{"fontFamily": "'JetBrains Mono',monospace","fontSize": "13px","color": "#d8d1c1","paddingRight": "8px"}}>{v.elapsed}</span>
</div>
{(v.recording) && <>
<div style={{"display": "flex","alignItems": "center","gap": "7px","height": "32px","padding": "0 12px","borderRadius": "999px","whiteSpace": "nowrap","flexShrink": "0","background": "#3a1716","color": "#ff8a83","fontSize": "12px","fontWeight": "600","letterSpacing": "0.06em"}}><span style={{"width": "8px","height": "8px","borderRadius": "50%","background": "#ff4b42"}}></span>{v.recLabel}</div>
</>}
{(v.brOn) && <>
<button onClick={v.openBreakout} style={{"whiteSpace": "nowrap","flexShrink": "0","display": "flex","alignItems": "center","gap": "7px","height": "32px","padding": "0 12px","borderRadius": "999px","border": "1px solid #3a3424","background": "#1d1a12","color": "#ecd389","font": "inherit","fontSize": "12px","fontWeight": "600","cursor": "pointer"}}><svg width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}><rect x={"3"} y={"3"} width={"8"} height={"8"} rx={"1.5"}></rect><rect x={"13"} y={"3"} width={"8"} height={"8"} rx={"1.5"}></rect><rect x={"3"} y={"13"} width={"8"} height={"8"} rx={"1.5"}></rect><rect x={"13"} y={"13"} width={"8"} height={"8"} rx={"1.5"}></rect></svg>{v.brPill}</button>
</>}
{(v.locked) && <>
<div title={"Room is locked"} style={{"whiteSpace": "nowrap","flexShrink": "0","display": "flex","alignItems": "center","gap": "6px","height": "32px","padding": "0 12px","borderRadius": "999px","background": "#1d1a12","border": "1px solid #3a3424","color": "#ecd389","fontSize": "12px","fontWeight": "600"}}><svg width={"12"} height={"12"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.2"} strokeLinecap={"round"} strokeLinejoin={"round"}><rect x={"5"} y={"11"} width={"14"} height={"10"} rx={"2"}></rect><path d={"M8 11V7a4 4 0 0 1 8 0v4"}></path></svg>{"Locked"}</div>
</>}
</div>
<div style={{"display": "flex","alignItems": "center","justifyContent": "flex-end","gap": "12px"}}>
<div title={v.netLabel} style={{"display": "flex","alignItems": "center","gap": "8px","fontSize": "12px","color": "#a49c8a"}}>
<div style={{"display": "flex","alignItems": "flex-end","gap": "2px","height": "13px"}}>
{(v.netBars || []).map((nb,index)=><Fragment key={nb?.key || nb?.id || index}><span style={{"width": "3px","borderRadius": "1px","height": nb.h,"background": nb.c}}></span></Fragment>)}
</div>
{(v.wide) && <><span style={{"whiteSpace": "nowrap"}}>{v.netLabel}</span></>}
</div>
<div style={{"display": "flex","alignItems": "center","gap": "8px","height": "36px","padding": "0 12px 0 4px","borderRadius": "999px","background": "#13110e","border": "1px solid #26231c"}}>
<span style={{"width": "28px","height": "28px","borderRadius": "50%","background": "#2a2519","color": "#d9b54a","fontSize": "12px","fontWeight": "700","display": "flex","alignItems": "center","justifyContent": "center"}}>{v.myInitials}</span>
<span style={{"fontSize": "13px","fontWeight": "500","whiteSpace": "nowrap","maxWidth": "140px","overflow": "hidden","textOverflow": "ellipsis"}}>{v.myName}</span>
</div>
</div>
</header>
<div style={{"flex": "1","minHeight": "0","position": "relative","padding": "0 " + String(v.stagePadR) + " 0 16px"}}>
<div style={{"position": "relative","height": "100%","display": "grid","gridTemplateColumns": v.gridCols,"gridTemplateRows": v.gridRows,"gap": "10px"}}>
{(v.tiles || []).map(t=><ReferenceTile key={t.key} person={t}>{t=><>
<div data-tile={t.key} onClick={t.click} style={{"position": "relative","minHeight": "0","minWidth": "0","gridColumn": t.col,"gridRow": t.row,"borderRadius": t.radius,"overflow": "hidden","background": t.bg,"border": "2px solid " + String(t.ring),"boxShadow": t.glow,"filter": t.freeze,"display": "flex","flexDirection": "column","gap": "18px","alignItems": "center","justifyContent": "center","cursor": "pointer","transition": "border-color 200ms, box-shadow 160ms ease, filter 400ms ease"}}>
{(t.isScreen) && <>
<video ref={t.videoRef} autoPlay={true} muted={true} playsInline={true} style={{"position": "absolute","inset": "0","width": "100%","height": "100%","objectFit": "contain","background": "#050504"}}></video>
{(t.screenFallback) && <>
<div style={{"position": "absolute","inset": "0","display": "flex","flexDirection": "column","alignItems": "center","justifyContent": "center","gap": "10px","background": "#0e0d0b","textAlign": "center","padding": "24px"}}>
<svg width={"40"} height={"40"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#d9b54a"} strokeWidth={"1.5"} strokeLinecap={"round"} strokeLinejoin={"round"}><rect x={"3"} y={"4"} width={"18"} height={"13"} rx={"2"}></rect><path d={"M8 21h8M12 17v4M9 10l3-3 3 3M12 7v7"}></path></svg>
<span style={{"fontSize": "18px","fontWeight": "600"}}>{t.screenTitle}</span>
<span style={{"fontSize": "13px","color": "#8a8373"}}>{t.screenFallbackNote}</span>
</div>
</>}
<div style={{"position": "absolute","left": "12px","top": "12px","padding": "5px 10px","borderRadius": "8px","background": "#d9b54a","color": "#1a1608","fontSize": "12px","fontWeight": "600"}}>{t.screenLabel}</div>
</>}
{(t.isMedia) && <>
{(t.isYouTube) && <>
<div ref={v.youtubeRef} style={{"position": "absolute","inset": "0","background": "#050504"}}></div>
</>}
{(t.isVideoMedia) && <>
<video ref={v.mediaVideoRef} controls={true} autoPlay={true} playsInline={true} style={{"position": "absolute","inset": "0","width": "100%","height": "100%","objectFit": "contain","background": "#050504"}}></video>
</>}
{(t.isAudioMedia) && <>
<div style={{"display": "flex","flexDirection": "column","alignItems": "center","gap": "16px","padding": "24px","width": "100%","maxWidth": "520px"}}>
<svg width={"44"} height={"44"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#d9b54a"} strokeWidth={"1.5"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M9 18V5l12-2v13"}></path><circle cx={"6"} cy={"18"} r={"3"}></circle><circle cx={"18"} cy={"16"} r={"3"}></circle></svg>
<span style={{"fontSize": "14px","color": "#a49c8a","maxWidth": "100%","overflow": "hidden","textOverflow": "ellipsis","whiteSpace": "nowrap"}}>{v.mediaSrc}</span>
<audio ref={v.mediaAudioRef} controls={true} autoPlay={true} style={{"width": "100%"}}></audio>
</div>
</>}
<div style={{"position": "absolute","left": "12px","top": "12px","display": "flex","gap": "8px","alignItems": "center"}}>
<span style={{"padding": "5px 10px","borderRadius": "8px","background": "#d9b54a","color": "#1a1608","fontSize": "12px","fontWeight": "600"}}>{"Shared with everyone"}</span>
<button disabled={!v.canMod} onClick={v.stopMedia} style={{"padding": "5px 10px","borderRadius": "8px","border": "0","background": "rgba(11,10,8,0.75)","color": "#f3eee2","font": "inherit","fontSize": "12px","fontWeight": "600","cursor": "pointer"}}>{"Stop sharing"}</button>
</div>
</>}
{(t.isPerson) && <>
{(t.showVid) && <>
<video ref={t.videoRef} autoPlay={true} muted={true} playsInline={true} style={{"position": "absolute","inset": "0","width": "100%","height": "100%","objectFit": "cover","filter": t.vfilter,"transform": t.vflip}}></video>
</>}
{(t.showAv) && <>
<div style={{"width": "clamp(48px,22%,120px)","aspectRatio": "1","borderRadius": "50%","background": "#2a2519","display": "flex","alignItems": "center","justifyContent": "center","fontSize": "clamp(18px,2.4vw,40px)","fontWeight": "600","color": "#d9b54a"}}>{t.initials}</div>
</>}
{(t.invite) && <>
<div className="room-empty-invite" data-video={t.showVid}>
<div style={{"display": "flex","flexDirection": "column","gap": "6px"}}>
<div className="room-empty-title">{"Your meeting is ready"}</div>
<div className="room-empty-description">{"Invite people to join you."}</div>
</div>
<div className="room-empty-link">
<span title={v.inviteLink}>{v.inviteLink}</span>
<button onClick={v.copyLink}>{v.linkShort === 'Copy' ? 'Copy link' : v.linkShort}</button>
</div>
</div>
</>}
{(t.hand) && <>
<div style={{"position": "absolute","top": "10px","left": "10px","padding": "4px 9px","borderRadius": "7px","background": "#d9b54a","color": "#1a1608","fontSize": "12px","fontWeight": "600"}}>{t.handLabel}</div>
</>}
{(t.showName) && <>
<div style={{"position": "absolute","left": "10px","bottom": "10px","display": "flex","alignItems": "center","gap": "7px","padding": "5px 9px","borderRadius": "9px","background": "rgba(11,10,8,0.65)","fontSize": "13px","maxWidth": "calc(100% - 20px)"}}>
{(t.muted) && <><svg width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#e0605a"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"} style={{"flexShrink": "0"}}><path d={"M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.3 5.5M12 18v3M3 3l18 18"}></path></svg></>}
<span style={{"overflow": "hidden","textOverflow": "ellipsis","whiteSpace": "nowrap"}}>{t.name}</span>{(t.meter) && <><span style={{"flexShrink": "0","display": "flex","alignItems": "flex-end","gap": "2px","height": "12px"}}>{(t.bars || []).map((br,index)=><Fragment key={br?.key || br?.id || index}><span style={{"width": "3px","borderRadius": "2px","background": "#d9b54a","height": br,"transition": "height 140ms"}}></span></Fragment>)}</span></>}
{(t.hasBadge) && <><span style={{"flexShrink": "0","padding": "1px 6px","borderRadius": "5px","background": "#2a2414","color": "#ecd389","fontSize": "11px","fontWeight": "600"}}>{t.badge}</span></>}
</div>
</>}
</>}
</div>
</>}</ReferenceTile>)}
</div>
<div style={{"position": "absolute","top": "12px","right": "28px","display": "flex","flexDirection": "column","alignItems": "flex-end","gap": "8px","pointerEvents": "none","zIndex": "3"}}>
{(v.toasts || []).map((n,index)=><Fragment key={n?.key || n?.id || index}>
<div data-toast={n.id} style={{"display": "flex","alignItems": "center","gap": "10px","padding": "8px 14px 8px 8px","borderRadius": "999px","background": "rgba(26,23,18,0.94)","border": "1px solid #3a3424","boxShadow": "0 10px 30px rgba(0,0,0,0.4)","fontSize": "13px"}}>
<span style={{"width": "26px","height": "26px","borderRadius": "50%","background": "#2a2519","color": "#d9b54a","fontSize": "11px","fontWeight": "700","display": "flex","alignItems": "center","justifyContent": "center"}}>{n.initials}</span>
<span >{n.text}</span>
</div>
</Fragment>)}
</div>
{(v.showKnock) && <>
<div style={{"position": "absolute","top": "12px","left": "50%","transform": "translateX(-50%)","zIndex": "12","display": "flex","alignItems": "center","gap": "12px","padding": "8px 8px 8px 14px","borderRadius": "14px","background": "#1a1712","border": "1px solid #3a3424","boxShadow": "0 12px 30px rgba(0,0,0,0.5)","fontSize": "14px"}}>
<span ><span style={{"fontWeight": "600"}}>{v.knockName}</span><span style={{"color": "#a49c8a"}}>{v.knockMore}</span></span>
<button onClick={v.knockDeny} style={{"height": "32px","padding": "0 12px","borderRadius": "9px","border": "1px solid #3a3424","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "13px","cursor": "pointer"}}>{"Deny"}</button>
<button onClick={v.knockAdmit} style={{"height": "32px","padding": "0 12px","borderRadius": "9px","border": "0","background": "#d9b54a","color": "#1a1608","font": "inherit","fontSize": "13px","fontWeight": "600","cursor": "pointer"}}>{"Admit"}</button>
</div>
</>}
{(v.ptt) && <>
<div style={{"position": "absolute","bottom": "16px","left": "50%","transform": "translateX(-50%)","zIndex": "4","display": "flex","alignItems": "center","gap": "8px","padding": "8px 14px","borderRadius": "999px","background": "#d9b54a","color": "#1a1608","fontSize": "13px","fontWeight": "600"}}><span style={{"width": "8px","height": "8px","borderRadius": "50%","background": "#1a1608"}}></span>{"Talking while muted. Release Space to mute."}</div>
</>}
</div>
{(v.captions) && <>
<div style={{"flexShrink": "0","display": "flex","justifyContent": "center","padding": "10px 16px 0"}}>
<div style={{"maxWidth": "760px","padding": "10px 16px","borderRadius": "10px","background": "rgba(0,0,0,0.8)","fontSize": "16px","lineHeight": "1.45","textAlign": "center","textWrap": "pretty"}}><span style={{"color": "#d9b54a","fontWeight": "600"}}>{v.capWho}</span><span style={{"color": v.capColor}}>{v.capLine}</span></div>
</div>
</>}
<footer style={{"flexShrink": "0","display": "flex","justifyContent": "center","padding": "12px 16px 16px","opacity": v.chromeOp,"transform": v.footY,"transition": "opacity 300ms ease, transform 300ms ease"}}>
<div style={{"position": "relative","display": "flex","alignItems": "center","gap": "4px","padding": "8px","borderRadius": "18px","background": "#100f0c","border": "1px solid #26231c","flexWrap": "nowrap","justifyContent": "center"}}>
<div style={{"display": "flex","borderRadius": "12px","background": v.b.mic.bg,"color": v.b.mic.fg}}>
<button aria-label={v.micTitle} disabled={v.hostMuted} onClick={v.toggleMic} title={v.micTitle} style={{"width": "44px","height": "44px","border": "0","background": "transparent","color": "inherit","display": "flex","alignItems": "center","justifyContent": "center","cursor": "pointer"}}>
{(v.micLive) && <><svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><rect x={"9"} y={"3"} width={"6"} height={"11"} rx={"3"}></rect><path d={"M5 11a7 7 0 0 0 14 0M12 18v3"}></path></svg></>}
{(v.micDead) && <><svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18"}></path></svg></>}
</button>
<button aria-label={"Audio settings"} onClick={v.openMicMenu} title={"Audio settings"} style={{"width": "20px","height": "44px","border": "0","borderLeft": "1px solid rgba(255,255,255,0.08)","background": "transparent","color": "inherit","display": "flex","alignItems": "center","justifyContent": "center","cursor": "pointer","padding": "0"}}><svg width={"12"} height={"12"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.4"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M6 15l6-6 6 6"}></path></svg></button>
</div>
<div style={{"display": "flex","borderRadius": "12px","background": v.b.cam.bg,"color": v.b.cam.fg}}>
<button aria-label={v.camTitle} onClick={v.toggleCam} title={v.camTitle} style={{"width": "44px","height": "44px","border": "0","background": "transparent","color": "inherit","display": "flex","alignItems": "center","justifyContent": "center","cursor": "pointer"}}>
{(v.camOn) && <><svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><rect x={"3"} y={"6"} width={"13"} height={"12"} rx={"2"}></rect><path d={"M16 10l5-3v10l-5-3z"}></path></svg></>}
{(v.camOff) && <><svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M16 16v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2M10 6h5a1 1 0 0 1 1 1v3l5-3v10M3 3l18 18"}></path></svg></>}
</button>
<button aria-label={"Video settings"} onClick={v.openCamMenu} title={"Video settings"} style={{"width": "20px","height": "44px","border": "0","borderLeft": "1px solid rgba(255,255,255,0.08)","background": "transparent","color": "inherit","display": "flex","alignItems": "center","justifyContent": "center","cursor": "pointer","padding": "0"}}><svg width={"12"} height={"12"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.4"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M6 15l6-6 6 6"}></path></svg></button>
</div>
<span style={{"width": "1px","height": "28px","background": "#26231c","margin": "0 6px"}}></span>
{(v.roomy) && <><button aria-label={"Share screen"} onClick={v.togglePresent} title={"Share screen"} style={{"width": "44px","height": "44px","borderRadius": "12px","border": "0","background": v.b.share.bg,"color": v.b.share.fg,"display": "flex","alignItems": "center","justifyContent": "center","cursor": "pointer"}} className="dc-1"><svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><rect x={"3"} y={"4"} width={"18"} height={"13"} rx={"2"}></rect><path d={"M8 21h8M12 17v4M9 10l3-3 3 3M12 7v7"}></path></svg></button>
</>}
<span style={{"width": "1px","height": "28px","background": "#26231c","margin": "0 6px"}}></span>
{(v.roomy) && <><button aria-label={"Reactions"} onClick={v.openReact} title={"Reactions"} style={{"width": "44px","height": "44px","borderRadius": "12px","border": "0","background": v.b.react.bg,"color": v.b.react.fg,"display": "flex","alignItems": "center","justifyContent": "center","cursor": "pointer"}} className="dc-2"><svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><circle cx={"12"} cy={"12"} r={"9"}></circle><path d={"M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"}></path></svg></button></>}
<button aria-label={"Chat (C)"} onClick={v.openChat} title={"Chat (C)"} style={{"position": "relative","width": "44px","height": "44px","borderRadius": "12px","border": "0","background": v.b.chat.bg,"color": v.b.chat.fg,"display": "flex","alignItems": "center","justifyContent": "center","cursor": "pointer"}} className="dc-3"><svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"}></path></svg>{(v.unread) && <><span style={{"position": "absolute","top": "9px","right": "9px","width": "8px","height": "8px","borderRadius": "50%","background": "#d9b54a"}}></span></>}</button>
{(v.roomy) && <><button aria-label={v.handTitle} onClick={v.toggleHand} title={v.handTitle} style={{"width": "44px","height": "44px","borderRadius": "12px","border": "0","background": v.b.hand.bg,"color": v.b.hand.fg,"display": "flex","alignItems": "center","justifyContent": "center","cursor": "pointer"}} className="dc-4"><svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"}></path><path d={"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L6 14"}></path></svg></button>
<button aria-label={"Participants"} onClick={v.openPeople} title={"Participants"} style={{"position": "relative","width": "44px","height": "44px","borderRadius": "12px","border": "0","background": v.b.people.bg,"color": v.b.people.fg,"display": "flex","alignItems": "center","justifyContent": "center","cursor": "pointer"}} className="dc-5"><svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><circle cx={"9"} cy={"8"} r={"3.5"}></circle><path d={"M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"}></path></svg><span style={{"position": "absolute","top": "3px","right": "2px","minWidth": "16px","height": "16px","padding": "0 4px","borderRadius": "8px","background": v.peopleBadgeBg,"color": v.peopleBadgeFg,"fontSize": "10px","fontWeight": "700","display": "flex","alignItems": "center","justifyContent": "center"}}>{v.peopleBadge}</span></button>
</>}
<button aria-label={"More options"} onClick={v.openMore} title={"More options"} style={{"width": "44px","height": "44px","borderRadius": "12px","border": "0","background": v.b.more.bg,"color": v.b.more.fg,"display": "flex","alignItems": "center","justifyContent": "center","cursor": "pointer"}} className="dc-6"><svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"currentColor"}><circle cx={"5"} cy={"12"} r={"1.7"}></circle><circle cx={"12"} cy={"12"} r={"1.7"}></circle><circle cx={"19"} cy={"12"} r={"1.7"}></circle></svg></button>
<span style={{"width": "1px","height": "28px","background": "#26231c","margin": "0 6px"}}></span>
<button aria-label={"Leave call (Ctrl/⌘ + E)"} onClick={v.leaveClick} title={"Leave call (Ctrl/⌘ + E)"} style={{"height": "44px","padding": "0 18px","borderRadius": "12px","border": "0","background": "#d8443d","color": "#fff","display": "flex","alignItems": "center","gap": "8px","font": "inherit","fontSize": "14px","fontWeight": "600","cursor": "pointer"}} className="dc-7"><svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M3 15.5c5-4.7 13-4.7 18 0l-2.2 2.3-3.3-1.4v-2.6c-2.3-.8-4.7-.8-7 0v2.6l-3.3 1.4z"}></path></svg>{"Leave"}</button>
{(v.menuMic) && <>
<div role="menu" data-pop={"menu"} style={{"position": "absolute","left": "0","bottom": "calc(100% + 10px)","width": "290px","padding": "6px","borderRadius": "14px","background": "#1a1712","border": "1px solid #2e2a21","boxShadow": "0 20px 40px rgba(0,0,0,0.55)","display": "flex","flexDirection": "column","zIndex": "10"}}>
<span style={{"padding": "8px 12px 4px","fontSize": "11px","letterSpacing": "0.2em","color": "#7d7666"}}>{"MICROPHONE"}</span>
{(v.micList || []).map((d,index)=><Fragment key={d?.key || d?.id || index}><button onClick={d.pick} style={{"display": "flex","alignItems": "center","gap": "10px","padding": "9px 12px","borderRadius": "10px","border": "0","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "14px","textAlign": "left","cursor": "pointer"}} className="dc-8"><svg width={"14"} height={"14"} viewBox={"0 0 24 24"} fill={"none"} stroke={d.check} strokeWidth={"2.4"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M5 12l5 5L20 7"}></path></svg>{d.label}</button></Fragment>)}
<span style={{"padding": "8px 12px 4px","fontSize": "11px","letterSpacing": "0.2em","color": "#7d7666"}}>{"SPEAKER"}</span>
{(v.spkList || []).map((d,index)=><Fragment key={d?.key || d?.id || index}><button onClick={d.pick} style={{"display": "flex","alignItems": "center","gap": "10px","padding": "9px 12px","borderRadius": "10px","border": "0","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "14px","textAlign": "left","cursor": "pointer"}} className="dc-9"><svg width={"14"} height={"14"} viewBox={"0 0 24 24"} fill={"none"} stroke={d.check} strokeWidth={"2.4"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M5 12l5 5L20 7"}></path></svg>{d.label}</button></Fragment>)}
<span style={{"height": "1px","background": "#2e2a21","margin": "6px 4px"}}></span>
<button onClick={v.toggleNoise} style={{"display": "flex","alignItems": "center","justifyContent": "space-between","padding": "9px 12px","borderRadius": "10px","border": "0","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "14px","cursor": "pointer"}} className="dc-10"><span >{"Noise suppression"}</span><span style={{"fontSize": "12px","color": v.noiseFg}}>{v.noiseLabel}</span></button>
<button onClick={v.openAudioSettings} style={{"padding": "9px 12px","borderRadius": "10px","border": "0","background": "transparent","color": "#d9b54a","font": "inherit","fontSize": "14px","fontWeight": "500","textAlign": "left","cursor": "pointer"}} className="dc-11">{"Audio settings"}</button>
</div>
</>}
{(v.menuCam) && <>
<div role="menu" data-pop={"menu"} style={{"position": "absolute","left": "68px","bottom": "calc(100% + 10px)","width": "290px","padding": "6px","borderRadius": "14px","background": "#1a1712","border": "1px solid #2e2a21","boxShadow": "0 20px 40px rgba(0,0,0,0.55)","display": "flex","flexDirection": "column","zIndex": "10"}}>
<span style={{"padding": "8px 12px 4px","fontSize": "11px","letterSpacing": "0.2em","color": "#7d7666"}}>{"CAMERA"}</span>
{(v.camList || []).map((d,index)=><Fragment key={d?.key || d?.id || index}><button onClick={d.pick} style={{"display": "flex","alignItems": "center","gap": "10px","padding": "9px 12px","borderRadius": "10px","border": "0","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "14px","textAlign": "left","cursor": "pointer"}} className="dc-12"><svg width={"14"} height={"14"} viewBox={"0 0 24 24"} fill={"none"} stroke={d.check} strokeWidth={"2.4"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M5 12l5 5L20 7"}></path></svg>{d.label}</button></Fragment>)}
<span style={{"height": "1px","background": "#2e2a21","margin": "6px 4px"}}></span>
<button onClick={v.openBgSettings} style={{"padding": "9px 12px","borderRadius": "10px","border": "0","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "14px","textAlign": "left","cursor": "pointer"}} className="dc-13">{"Backgrounds and filters"}</button>
<button onClick={v.openVideoSettings} style={{"padding": "9px 12px","borderRadius": "10px","border": "0","background": "transparent","color": "#d9b54a","font": "inherit","fontSize": "14px","fontWeight": "500","textAlign": "left","cursor": "pointer"}} className="dc-14">{"Video settings"}</button>
</div>
</>}
{(v.menuReact) && <>
<div role="menu" data-pop={"menu"} style={{"position": "absolute","left": v.reactLeft,"bottom": "calc(100% + 10px)","display": "flex","gap": "4px","padding": "6px","borderRadius": "999px","background": "#1a1712","border": "1px solid #2e2a21","boxShadow": "0 20px 40px rgba(0,0,0,0.55)","zIndex": "10"}}>
{(v.emojis || []).map((e,index)=><Fragment key={e?.key || e?.id || index}><button onClick={e.send} style={{"width": "44px","height": "44px","borderRadius": "50%","border": "0","background": "transparent","fontSize": "24px","cursor": "pointer","lineHeight": "1"}} className="dc-15">{e.emo}</button></Fragment>)}
</div>
</>}
{(v.menuMore) && <>
<div role="menu" data-pop={"menu"} style={{"position": "absolute","right": v.moreRight,"bottom": "calc(100% + 10px)","width": "min(480px, calc(100vw - 32px))","maxHeight": "calc(100vh - 150px)","overflow": "auto","padding": "16px","borderRadius": "18px","background": "#0f0e0b","border": "1px solid #2e2a21","boxShadow": "0 24px 60px rgba(0,0,0,0.6)","display": "flex","flexDirection": "column","gap": "16px","zIndex": "10"}}>
<div style={{"display": "flex","alignItems": "center","gap": "10px"}}>
<span style={{"width": "32px","height": "32px","borderRadius": "50%","background": "#2a2519","color": "#d9b54a","fontSize": "12px","fontWeight": "700","display": "flex","alignItems": "center","justifyContent": "center"}}>{v.myInitials}</span>
<span style={{"flex": "1","display": "flex","flexDirection": "column","gap": "1px"}}><span style={{"fontSize": "14px","fontWeight": "600"}}>{v.myName}</span><span style={{"fontSize": "12px","color": "#8a8373"}}>{v.roleLabel}</span></span>
</div>
<div style={{"display": "grid","gridTemplateColumns": "repeat(auto-fill,minmax(104px,1fr))","gap": "8px"}}>
{(v.quickTiles || []).map((q,index)=><Fragment key={q?.key || q?.id || index}>
<button onClick={q.run} style={{"display": "flex","flexDirection": "column","alignItems": "flex-start","justifyContent": "space-between","gap": "12px","height": "76px","padding": "12px","borderRadius": "14px","border": "1px solid " + String(q.border),"background": q.bg,"color": q.fg,"font": "inherit","textAlign": "left","cursor": "pointer"}} className="dc-16">
<svg width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={q.d}></path></svg>
<span style={{"fontSize": "13px","fontWeight": "500","lineHeight": "1.2"}}>{q.label}</span>
</button>
</Fragment>)}
</div>
{(v.moreSections || []).map((g,index)=><Fragment key={g?.key || g?.id || index}>
<div style={{"display": "flex","flexDirection": "column","gap": "4px"}}>
<span style={{"padding": "0 4px 4px","fontSize": "11px","letterSpacing": "0.2em","color": "#7d7666"}}>{g.title}</span>
<div style={{"display": "grid","gridTemplateColumns": "repeat(2,minmax(0,1fr))","gap": "2px 6px"}}>
{(g.items || []).map((m,index)=><Fragment key={m?.key || m?.id || index}>
<button onClick={m.run} style={{"display": "flex","alignItems": "center","gap": "10px","minWidth": "0","height": "38px","padding": "0 10px","borderRadius": "10px","border": "0","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "13px","textAlign": "left","cursor": "pointer"}} className="dc-17">
<svg width={"15"} height={"15"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#a49c8a"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"} style={{"flexShrink": "0"}}><path d={m.d}></path></svg>
<span style={{"flex": "1","minWidth": "0","overflow": "hidden","textOverflow": "ellipsis","whiteSpace": "nowrap"}}>{m.label}</span>
{(m.hasExtra) && <><span style={{"flexShrink": "0","fontSize": "11px","fontWeight": "600","color": "#d9b54a"}}>{m.extra}</span></>}
</button>
</Fragment>)}
</div>
</div>
</Fragment>)}
</div>
</>}
{(v.menuLeave) && <>
<div role="menu" data-pop={"menu"} style={{"position": "absolute","right": "0","bottom": "calc(100% + 10px)","width": "260px","padding": "6px","borderRadius": "14px","background": "#1a1712","border": "1px solid #2e2a21","boxShadow": "0 20px 40px rgba(0,0,0,0.55)","display": "flex","flexDirection": "column","zIndex": "10"}}>
<button onClick={v.doLeave} style={{"display": "flex","flexDirection": "column","alignItems": "flex-start","gap": "2px","padding": "10px 12px","borderRadius": "10px","border": "0","background": "transparent","color": "#f3eee2","font": "inherit","textAlign": "left","cursor": "pointer"}} className="dc-18"><span style={{"fontSize": "14px","fontWeight": "500"}}>{"Leave meeting"}</span><span style={{"fontSize": "12px","color": "#8a8373"}}>{"The meeting continues without you"}</span></button>
{(v.isHost) && <>
<button onClick={v.openEnd} style={{"display": "flex","flexDirection": "column","alignItems": "flex-start","gap": "2px","padding": "10px 12px","borderRadius": "10px","border": "0","background": "transparent","color": "#ff8a83","font": "inherit","textAlign": "left","cursor": "pointer"}} className="dc-19"><span style={{"fontSize": "14px","fontWeight": "600"}}>{"End meeting for all"}</span><span style={{"fontSize": "12px","color": "#8a8373"}}>{"Review notes before everyone is removed"}</span></button>
</>}
</div>
</>}
</div>
</footer>
</div>
<div ref={v.rxRef} style={{"position": "fixed","left": "24px","bottom": "96px","width": "280px","height": "0","pointerEvents": "none","zIndex": "15"}}></div>
<div style={{"position": "fixed","top": "64px","left": "0","right": "0","zIndex": "13","display": "flex","flexDirection": "column","alignItems": "center","gap": "8px","pointerEvents": "none"}}>
{(v.reconnecting) && <>
<div data-pop={"menu"} style={{"display": "flex","alignItems": "center","gap": "10px","padding": "8px 14px","borderRadius": "999px","background": "#2a1a10","border": "1px solid #5a3a1c","color": "#f2b880","fontSize": "13px","fontWeight": "500"}}><span style={{"width": "8px","height": "8px","borderRadius": "50%","background": "#f2b880"}}></span>{"Connection unstable. Reconnecting…"}</div>
</>}
{(v.showConsent) && <>
<div data-pop={"menu"} style={{"pointerEvents": "auto","display": "flex","alignItems": "center","gap": "14px","maxWidth": "calc(100vw - 32px)","padding": "10px 10px 10px 16px","borderRadius": "14px","background": "#2a1513","border": "1px solid #5a2420","boxShadow": "0 12px 30px rgba(0,0,0,0.5)","fontSize": "14px","color": "#f3d6d3"}}>
<span style={{"width": "9px","height": "9px","flexShrink": "0","borderRadius": "50%","background": "#ff4b42"}}></span>
<span style={{"textWrap": "pretty"}}>{"This meeting is being recorded. By staying, you agree to be recorded."}</span>
<button onClick={v.ackRec} style={{"flexShrink": "0","height": "32px","padding": "0 14px","borderRadius": "9px","border": "0","background": "#f3eee2","color": "#1a1608","font": "inherit","fontSize": "13px","fontWeight": "600","cursor": "pointer"}}>{"Got it"}</button>
</div>
</>}
</div>
{(v.mutedHint) && <>
<div style={{"position": "fixed","left": "0","right": "0","bottom": "96px","zIndex": "13","display": "flex","justifyContent": "center","pointerEvents": "none"}}>
<div data-pop={"menu"} style={{"pointerEvents": "auto","display": "flex","alignItems": "center","gap": "12px","padding": "8px 8px 8px 14px","borderRadius": "14px","background": "#1a1712","border": "1px solid #3a3424","boxShadow": "0 12px 30px rgba(0,0,0,0.5)","fontSize": "14px"}}>
<span >{"You're muted. Hold "}<span style={{"padding": "2px 7px","borderRadius": "6px","background": "#24201a","fontFamily": "'JetBrains Mono',monospace","fontSize": "12px","color": "#ecd389"}}>{"Space"}</span>{" to talk."}</span>
<button onClick={v.unmuteNow} style={{"height": "32px","padding": "0 12px","borderRadius": "9px","border": "0","background": "#d9b54a","color": "#1a1608","font": "inherit","fontSize": "13px","fontWeight": "600","cursor": "pointer"}}>{"Unmute"}</button>
</div>
</div>
</>}
<div style={{"position": "fixed","right": v.previewRight,"bottom": "96px","zIndex": "12","display": "flex","flexDirection": "column","alignItems": "flex-end","gap": "8px","maxWidth": "320px"}}>
{(v.previews || []).map((pv,index)=><Fragment key={pv?.key || pv?.id || index}>
<button data-pop={"menu"} onClick={v.openChat} style={{"display": "flex","gap": "10px","alignItems": "flex-start","padding": "10px 14px 10px 10px","borderRadius": "14px","border": "1px solid #2e2a21","background": "rgba(26,23,18,0.96)","boxShadow": "0 12px 30px rgba(0,0,0,0.45)","color": "#f3eee2","font": "inherit","textAlign": "left","cursor": "pointer"}}>
<span style={{"flexShrink": "0","width": "28px","height": "28px","borderRadius": "50%","background": "#2a2519","color": "#d9b54a","fontSize": "11px","fontWeight": "700","display": "flex","alignItems": "center","justifyContent": "center"}}>{pv.initials}</span>
<span style={{"display": "flex","flexDirection": "column","gap": "2px","minWidth": "0"}}><span style={{"fontSize": "12px","fontWeight": "600","color": "#d9b54a"}}>{pv.who}</span><span style={{"fontSize": "13px","lineHeight": "1.4","color": "#e8e2d3","textWrap": "pretty"}}>{pv.text}</span></span>
</button>
</Fragment>)}
</div>
{(v.panelOpen) && <>
<aside aria-label={v.panelTitle} data-pop={"panel"} style={{"position": "fixed","top": v.pTop,"left": v.pLeft,"right": "12px","bottom": "92px","width": v.pW,"zIndex": "8","display": "flex","flexDirection": "column","borderRadius": "18px","background": "#13110e","border": "1px solid #26231c","overflow": "hidden","boxShadow": "0 20px 50px rgba(0,0,0,0.45)"}}>
<div style={{"display": "flex","alignItems": "center","justifyContent": "space-between","padding": "14px 12px 14px 18px","borderBottom": "1px solid #221f19"}}>
<span style={{"fontSize": "16px","fontWeight": "600"}}>{v.panelTitle}</span>
<button aria-label={"Close (Esc)"} onClick={v.closePanel} title={"Close (Esc)"} style={{"width": "32px","height": "32px","borderRadius": "8px","border": "0","background": "transparent","color": "#8a8373","fontSize": "20px","cursor": "pointer"}} className="dc-20">{"×"}</button>
</div>
{(v.isChat) && <>
<div style={{"display": "flex","alignItems": "center","gap": "8px","margin": "12px 16px 0","padding": "8px 12px","borderRadius": "10px","background": "#16201a","color": "#8fd8a8","fontSize": "12px"}}>
<svg width={"14"} height={"14"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"}></path><path d={"M9 12l2 2 4-4"}></path></svg>{"Messages shared with everyone"}</div>
<div style={{"flex": "1","minHeight": "0","overflow": "auto","padding": "16px","display": "flex","flexDirection": "column","gap": "16px"}}>
{(v.messages || []).map((m,index)=><Fragment key={m?.key || m?.id || index}>
<div style={{"display": "flex","gap": "10px"}}>
<span style={{"flexShrink": "0","width": "30px","height": "30px","borderRadius": "50%","background": "#2a2519","color": "#d9b54a","fontSize": "11px","fontWeight": "700","display": "flex","alignItems": "center","justifyContent": "center"}}>{m.initials}</span>
<div style={{"display": "flex","flexDirection": "column","gap": "3px","minWidth": "0"}}>
<div style={{"display": "flex","gap": "6px","alignItems": "center"}}>
<span style={{"fontSize": "13px","fontWeight": "600","color": m.color}}>{m.who}</span>
<svg width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"#6fcf8f"}><path d={"M12 2l2.4 2.2 3.2-.4.9 3.1 2.9 1.5-1 3.1 1 3.1-2.9 1.5-.9 3.1-3.2-.4L12 22l-2.4-2.2-3.2.4-.9-3.1-2.9-1.5 1-3.1-1-3.1 2.9-1.5.9-3.1 3.2.4z"}></path><path d={"M8.5 12l2.5 2.5 4.5-5"} stroke={"#0b0a08"} strokeWidth={"2"} fill={"none"} strokeLinecap={"round"} strokeLinejoin={"round"}></path></svg>
<span style={{"fontSize": "11px","color": "#6f685a"}}>{m.time}</span>
</div>
<div style={{"fontSize": "14px","lineHeight": "1.45","color": "#e8e2d3","textWrap": "pretty","overflowWrap": "anywhere"}}>{m.text}</div>
</div>
</div>
</Fragment>)}
</div>
{(v.chatOpen) && <>
<div style={{"padding": "12px","borderTop": "1px solid #221f19","display": "flex","gap": "8px"}}>
<input value={v.draft} onChange={v.onDraft} onKeyDown={v.onDraftKey} placeholder={"Send a message to everyone"} style={{"flex": "1","minWidth": "0","height": "42px","padding": "0 14px","borderRadius": "12px","background": "#0e0d0a","border": "1px solid #2e2a21","color": "#f3eee2","font": "inherit","fontSize": "14px","outline": "none"}} className="dc-21"/>
<button aria-label={"Send"} onClick={v.sendChat} title={"Send"} style={{"width": "42px","height": "42px","borderRadius": "12px","border": "0","background": "#d9b54a","color": "#1a1608","cursor": "pointer","display": "flex","alignItems": "center","justifyContent": "center"}}><svg width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2.2"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M5 12h14M13 6l6 6-6 6"}></path></svg></button>
</div>
</>}
{(v.chatLocked) && <>
<div style={{"padding": "14px 16px","borderTop": "1px solid #221f19","fontSize": "13px","color": "#8a8373","textAlign": "center"}}>{"The host has turned off chat for participants"}</div>
</>}
</>}
{(v.isPeople) && <>
<div style={{"padding": "12px 16px 4px"}}>
<div style={{"display": "flex","alignItems": "center","gap": "8px","height": "40px","padding": "0 12px","borderRadius": "12px","background": "#0e0d0a","border": "1px solid #2e2a21"}}>
<svg width={"15"} height={"15"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#7d7666"} strokeWidth={"2"} strokeLinecap={"round"}><circle cx={"11"} cy={"11"} r={"7"}></circle><path d={"M21 21l-4.3-4.3"}></path></svg>
<input value={v.q} onChange={v.onQ} placeholder={"Search participants"} style={{"flex": "1","minWidth": "0","border": "0","background": "transparent","color": "#f3eee2","font": "inherit","fontSize": "14px","outline": "none"}}/>
</div>
</div>
<div style={{"flex": "1","minHeight": "0","overflow": "auto","padding": "8px 8px 16px","display": "flex","flexDirection": "column","gap": "14px"}}>
{(v.hasWaiting) && <>
<div style={{"display": "flex","flexDirection": "column","gap": "4px"}}>
<div style={{"display": "flex","justifyContent": "space-between","alignItems": "center","padding": "4px 8px"}}>
<span style={{"fontSize": "11px","letterSpacing": "0.2em","color": "#d9b54a"}}>{"WAITING ROOM"}</span>
<button onClick={v.admitAll} style={{"border": "0","background": "transparent","color": "#d9b54a","font": "inherit","fontSize": "12px","fontWeight": "600","cursor": "pointer"}}>{"Admit all"}</button>
</div>
{(v.waitRows || []).map((w,index)=><Fragment key={w?.key || w?.id || index}>
<div style={{"display": "flex","alignItems": "center","gap": "10px","padding": "8px","borderRadius": "10px","background": "#1a1712"}}>
<span style={{"width": "32px","height": "32px","borderRadius": "50%","background": "#2a2519","color": "#d9b54a","fontSize": "12px","fontWeight": "700","display": "flex","alignItems": "center","justifyContent": "center"}}>{w.initials}</span>
<span style={{"flex": "1","minWidth": "0","display": "flex","flexDirection": "column","gap": "1px"}}><span style={{"fontSize": "14px"}}>{w.name}</span><span style={{"fontSize": "12px","color": "#8a8373","overflow": "hidden","textOverflow": "ellipsis","whiteSpace": "nowrap"}}>{w.email}</span><span style={{"fontSize": "11px","color": "#6f685a"}}>{w.since}</span></span>
<button onClick={w.deny} style={{"height": "30px","padding": "0 10px","borderRadius": "8px","border": "1px solid #3a3424","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "12px","cursor": "pointer"}}>{"Deny"}</button>
<button onClick={w.admit} style={{"height": "30px","padding": "0 10px","borderRadius": "8px","border": "0","background": "#d9b54a","color": "#1a1608","font": "inherit","fontSize": "12px","fontWeight": "600","cursor": "pointer"}}>{"Admit"}</button>
</div>
</Fragment>)}
</div>
</>}
{(v.hasHands) && <>
<div style={{"display": "flex","flexDirection": "column","gap": "2px"}}>
<span style={{"padding": "4px 8px","fontSize": "11px","letterSpacing": "0.2em","color": "#a49c8a"}}>{"RAISED HANDS · IN ORDER"}</span>
{(v.handRows || []).map((h,index)=><Fragment key={h?.key || h?.id || index}>
<div style={{"display": "flex","alignItems": "center","gap": "10px","padding": "8px"}}>
<span style={{"width": "24px","height": "24px","borderRadius": "7px","background": "#d9b54a","color": "#1a1608","fontSize": "12px","fontWeight": "700","display": "flex","alignItems": "center","justifyContent": "center"}}>{h.num}</span>
<span style={{"flex": "1","minWidth": "0","fontSize": "14px"}}>{h.name}</span>
{(h.canLower) && <><button onClick={h.lower} style={{"height": "28px","padding": "0 10px","borderRadius": "8px","border": "1px solid #3a3424","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "12px","cursor": "pointer"}}>{"Lower"}</button></>}
</div>
</Fragment>)}
</div>
</>}
<div style={{"display": "flex","flexDirection": "column","gap": "2px"}}>
<span style={{"padding": "4px 8px","fontSize": "11px","letterSpacing": "0.2em","color": "#a49c8a"}}>{v.inCount}</span>
{(v.peopleRows || []).map((p,index)=><Fragment key={p?.key || p?.id || index}>
<div style={{"display": "flex","flexDirection": "column","borderRadius": "12px","background": p.rowBg}}>
<button onClick={p.toggle} style={{"display": "flex","alignItems": "center","gap": "10px","padding": "8px","border": "0","borderRadius": "12px","background": "transparent","color": "#f3eee2","font": "inherit","textAlign": "left","cursor": "pointer"}} className="dc-22">
<span style={{"flexShrink": "0","width": "34px","height": "34px","borderRadius": "50%","background": "#2a2519","color": "#d9b54a","fontSize": "12px","fontWeight": "700","display": "flex","alignItems": "center","justifyContent": "center"}}>{p.initials}</span>
<span style={{"flex": "1","minWidth": "0","display": "flex","alignItems": "center","gap": "6px","fontSize": "14px"}}><span style={{"overflow": "hidden","textOverflow": "ellipsis","whiteSpace": "nowrap"}}>{p.name}</span>{(p.hasBadge) && <><span style={{"flexShrink": "0","padding": "1px 6px","borderRadius": "5px","background": "#2a2414","color": "#ecd389","fontSize": "11px","fontWeight": "600"}}>{p.badge}</span></>}</span>
{(p.hand) && <><span style={{"fontSize": "11px","fontWeight": "600","color": "#d9b54a"}}>{p.handLabel}</span></>}
{(p.muted) && <><svg width={"15"} height={"15"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#e0605a"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.3 5.5M12 18v3M3 3l18 18"}></path></svg></>}
<svg width={"14"} height={"14"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#7d7666"} strokeWidth={"2"} strokeLinecap={"round"} strokeLinejoin={"round"} style={{"transform": p.chev,"transition": "transform 150ms"}}><path d={"M6 9l6 6 6-6"}></path></svg>
</button>
{(p.open) && <>
<div style={{"display": "flex","flexDirection": "column","gap": "10px","padding": "2px 10px 12px 52px"}}>
<div style={{"display": "grid","gridTemplateColumns": "1fr 1fr","gap": "6px 12px"}}>
{(p.stats || []).map((st,index)=><Fragment key={st?.key || st?.id || index}>
<div style={{"display": "flex","flexDirection": "column","gap": "1px"}}><span style={{"fontSize": "11px","color": "#7d7666"}}>{st.l}</span><span style={{"fontSize": "13px","fontFamily": "'JetBrains Mono',monospace","color": "#e8e2d3"}}>{st.v}</span></div>
</Fragment>)}
</div>
{(p.canAct) && <>
<div style={{"display": "flex","flexWrap": "wrap","gap": "6px"}}>
<button onClick={p.mute} style={{"height": "30px","padding": "0 10px","borderRadius": "8px","border": "1px solid #3a3424","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "12px","cursor": "pointer"}} className="dc-23">{p.muteLabel}</button>
{(p.canCohost) && <><button onClick={p.cohost} style={{"height": "30px","padding": "0 10px","borderRadius": "8px","border": "1px solid #3a3424","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "12px","cursor": "pointer"}} className="dc-24">{p.cohostLabel}</button></>}
<button onClick={p.remove} style={{"height": "30px","padding": "0 10px","borderRadius": "8px","border": "1px solid #4a2320","background": "transparent","color": "#ff8a83","font": "inherit","fontSize": "12px","cursor": "pointer"}} className="dc-25">{"Remove"}</button>
</div>
</>}
</div>
</>}
</div>
</Fragment>)}
{(v.noMatches) && <><div style={{"padding": "16px 8px","fontSize": "13px","color": "#7d7666"}}>{"No one matches that search"}</div></>}
</div>
</div>
</>}
{(v.isAgenda) && <>
<div style={{"padding": "12px 18px 0","fontSize": "13px","color": "#a49c8a"}}>{v.agendaProgress}</div>
<div style={{"flex": "1","minHeight": "0","overflow": "auto","padding": "10px 10px","display": "flex","flexDirection": "column","gap": "4px"}}>
{(v.agendaRows || []).map((a,index)=><Fragment key={a?.key || a?.id || index}>
<div style={{"display": "flex","alignItems": "center","gap": "12px","padding": "10px 8px","borderRadius": "10px"}} className="dc-26">
<button disabled={!v.canMod} aria-label={"Mark "+a.text+" covered"} onClick={a.toggle} style={{"flexShrink": "0","width": "20px","height": "20px","borderRadius": "6px","border": "1.5px solid " + String(a.boxBorder),"background": a.box,"display": "flex","alignItems": "center","justifyContent": "center","cursor": "pointer","padding": "0"}}><svg width={"12"} height={"12"} viewBox={"0 0 24 24"} fill={"none"} stroke={a.tick} strokeWidth={"3"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M5 12l5 5L20 7"}></path></svg></button>
<span style={{"flex": "1","minWidth": "0","fontSize": "14px","color": a.fg,"textDecoration": a.deco}}>{a.text}</span>
<button aria-label={"Remove"} disabled={!v.canMod} onClick={a.remove} title={"Remove"} style={{"border": "0","background": "transparent","color": "#6f685a","cursor": "pointer","fontSize": "18px","lineHeight": "1"}} className="dc-27">{"×"}</button>
</div>
</Fragment>)}
</div>
{(v.canMod) && <><div style={{"padding": "12px","borderTop": "1px solid #221f19","display": "flex","gap": "8px"}}>
<input value={v.agendaDraft} onChange={v.onAgendaDraft} onKeyDown={v.onAgendaKey} placeholder={"Add an agenda item"} style={{"flex": "1","minWidth": "0","height": "42px","padding": "0 14px","borderRadius": "12px","background": "#0e0d0a","border": "1px solid #2e2a21","color": "#f3eee2","font": "inherit","fontSize": "14px","outline": "none"}} className="dc-28"/>
<button onClick={v.addAgenda} style={{"height": "42px","padding": "0 16px","borderRadius": "12px","border": "0","background": "#d9b54a","color": "#1a1608","font": "inherit","fontSize": "14px","fontWeight": "600","cursor": "pointer"}}>{"Add"}</button>
</div></>}
</>}
{(v.isPolls) && <>
<div style={{"flex": "1","minHeight": "0","overflow": "auto","padding": "16px","display": "flex","flexDirection": "column","gap": "18px"}}>
{(v.canMod) && <><div style={{"display": "flex","flexDirection": "column","gap": "8px","padding": "14px","borderRadius": "14px","background": "#0e0d0a","border": "1px solid #26231c"}}>
<span style={{"fontSize": "11px","letterSpacing": "0.2em","color": "#a49c8a"}}>{"NEW POLL"}</span>
<input value={v.pollQ} onChange={v.onPollQ} placeholder={"Ask a question"} style={{"height": "40px","padding": "0 12px","borderRadius": "10px","background": "#13110e","border": "1px solid #2e2a21","color": "#f3eee2","font": "inherit","fontSize": "14px","outline": "none"}} className="dc-29"/>
{(v.pollOptInputs || []).map((o,index)=><Fragment key={o?.key || o?.id || index}>
<input value={o.value} onChange={o.onChange} placeholder={o.ph} style={{"height": "36px","padding": "0 12px","borderRadius": "10px","background": "transparent","border": "1px dashed #3a3424","color": "#f3eee2","font": "inherit","fontSize": "13px","outline": "none"}} className="dc-30"/>
</Fragment>)}
<div style={{"display": "flex","justifyContent": "space-between","alignItems": "center","marginTop": "4px"}}>
{(v.canAddOpt) && <><button onClick={v.addOpt} style={{"border": "0","background": "transparent","color": "#d9b54a","font": "inherit","fontSize": "13px","cursor": "pointer","padding": "0"}}>{"+ Add option"}</button></>}
<button onClick={v.launchPoll} style={{"marginLeft": "auto","height": "36px","padding": "0 14px","borderRadius": "10px","border": "0","background": "#d9b54a","color": "#1a1608","font": "inherit","fontSize": "13px","fontWeight": "600","cursor": "pointer"}}>{"Launch poll"}</button>
</div>
</div></>}
{(v.polls || []).map((pl,index)=><Fragment key={pl?.key || pl?.id || index}>
<div style={{"display": "flex","flexDirection": "column","gap": "10px"}}>
<div style={{"display": "flex","justifyContent": "space-between","gap": "10px","alignItems": "baseline"}}>
<span style={{"fontSize": "15px","fontWeight": "600","textWrap": "pretty"}}>{pl.q}</span>
<span style={{"flexShrink": "0","fontSize": "12px","fontWeight": "600","color": pl.statusFg}}>{pl.status}</span>
</div>
{(pl.opts || []).map((op,index)=><Fragment key={op?.key || op?.id || index}>
<button disabled={op.disabled} onClick={op.vote} style={{"position": "relative","overflow": "hidden","display": "flex","justifyContent": "space-between","alignItems": "center","height": "40px","padding": "0 12px","borderRadius": "10px","border": "1px solid " + String(op.border),"background": "transparent","color": "#f3eee2","font": "inherit","fontSize": "14px","cursor": "pointer","textAlign": "left"}}>
<span style={{"position": "absolute","left": "0","top": "0","bottom": "0","width": op.w,"background": op.bar,"transition": "width 300ms ease"}}></span>
<span style={{"position": "relative"}}>{op.t}</span>
<span style={{"position": "relative","fontSize": "12px","fontFamily": "'JetBrains Mono',monospace","color": "#a49c8a"}}>{op.pct}</span>
</button>
</Fragment>)}
<div style={{"display": "flex","justifyContent": "space-between","alignItems": "center"}}>
<span style={{"fontSize": "12px","color": "#7d7666"}}>{pl.total}</span>
{(pl.canEnd) && <><button onClick={pl.end} style={{"height": "30px","padding": "0 12px","borderRadius": "8px","border": "1px solid #3a3424","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "12px","cursor": "pointer"}}>{"End poll"}</button></>}
</div>
</div>
</Fragment>)}
</div>
</>}
{(v.isFiles) && <>
<div style={{"padding": "16px 16px 8px"}}>
<button onClick={v.pickFiles} style={{"width": "100%","height": "72px","borderRadius": "14px","border": "1px dashed #4a4230","background": "#0e0d0a","color": "#e8e2d3","font": "inherit","fontSize": "14px","cursor": "pointer","display": "flex","alignItems": "center","justifyContent": "center","gap": "10px"}} className="dc-31">
<svg width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#d9b54a"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M12 15V3M7 8l5-5 5 5M4 21h16"}></path></svg>{"Share files with everyone\n        "}</button>
<input ref={v.fileRef} type={"file"} multiple={true} onChange={v.onFiles} style={{"display": "none"}}/>
</div>
<div style={{"flex": "1","minHeight": "0","overflow": "auto","padding": "4px 8px 16px","display": "flex","flexDirection": "column","gap": "2px"}}>
{(v.files || []).map((f,index)=><Fragment key={f?.key || f?.id || index}>
<div style={{"display": "flex","alignItems": "center","gap": "10px","padding": "10px 8px","borderRadius": "10px"}} className="dc-32">
<svg width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#a49c8a"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"} style={{"flexShrink": "0"}}><path d={"M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6"}></path></svg>
<div style={{"flex": "1","minWidth": "0","display": "flex","flexDirection": "column","gap": "2px"}}>
<span style={{"fontSize": "14px","overflow": "hidden","textOverflow": "ellipsis","whiteSpace": "nowrap"}}>{f.name}</span>
<span style={{"fontSize": "12px","color": "#7d7666"}}>{String(f.size) + " · " + String(f.by)}</span>
</div>
<a href={f.url} download={f.name} onClick={f.download} style={{"fontSize": "13px","fontWeight": "600"}}>{"Download"}</a>
<button aria-label={"Remove"} disabled={!v.canMod} onClick={f.remove} title={"Remove"} style={{"border": "0","background": "transparent","color": "#6f685a","cursor": "pointer","fontSize": "18px","lineHeight": "1"}} className="dc-33">{"×"}</button>
</div>
</Fragment>)}
{(v.hasFiles) && <></>}
</div>
</>}
</aside>
</>}
{(v.modalOpen) && <>
<div onClick={v.closeModal} style={{"position": "fixed","inset": "0","zIndex": "20","background": "rgba(6,5,4,0.72)","backdropFilter": "blur(6px)","display": "flex","alignItems": "center","justifyContent": "center","padding": "24px"}}>
{(v.isSettings) && <>
<div role="dialog" aria-modal="true" aria-label={v.modalTitle} ref={v.dialogRef} data-pop={"modal"} onClick={v.stop} style={{"width": "100%","maxWidth": "820px","height": "min(600px, calc(100vh - 48px))","display": "grid","gridTemplateColumns": "200px minmax(0,1fr)","borderRadius": "22px","background": "#0f0e0b","border": "1px solid #26231c","overflow": "hidden","boxShadow": "0 30px 80px rgba(0,0,0,0.6)"}}>
<nav style={{"display": "flex","flexDirection": "column","gap": "2px","padding": "20px 12px","borderRight": "1px solid #1d1a14","background": "#0c0b09"}}>
<span style={{"padding": "0 10px 14px","fontSize": "18px","fontWeight": "600"}}>{"Settings"}</span>
{(v.tabs || []).map((tb,index)=><Fragment key={tb?.key || tb?.id || index}>
<button onClick={tb.pick} style={{"height": "38px","padding": "0 12px","borderRadius": "10px","border": "0","background": tb.bg,"color": tb.fg,"font": "inherit","fontSize": "14px","textAlign": "left","cursor": "pointer"}} className="dc-34">{tb.label}</button>
</Fragment>)}
</nav>
<div style={{"display": "flex","flexDirection": "column","minHeight": "0"}}>
<div style={{"display": "flex","justifyContent": "space-between","alignItems": "center","padding": "18px 18px 8px 28px"}}>
<span style={{"fontSize": "20px","fontWeight": "600"}}>{v.tab}</span>
<button aria-label={"Close"} onClick={v.closeModal} title={"Close"} style={{"width": "34px","height": "34px","borderRadius": "9px","border": "0","background": "transparent","color": "#8a8373","fontSize": "20px","cursor": "pointer"}} className="dc-35">{"×"}</button>
</div>
<div style={{"flex": "1","minHeight": "0","overflow": "auto","padding": "8px 28px 28px","display": "flex","flexDirection": "column","gap": "18px"}}>
{(v.tabSelects || []).map((se,index)=><Fragment key={se?.key || se?.id || index}>
<label style={{"display": "flex","flexDirection": "column","gap": "8px"}}>
<span style={{"fontSize": "13px","color": "#a49c8a"}}>{se.label}</span>
<select value={se.value} onChange={se.onChange} style={{"height": "44px","padding": "0 12px","borderRadius": "12px","background": "#13110e","border": "1px solid #2e2a21","color": "#f3eee2","font": "inherit","fontSize": "14px","outline": "none","cursor": "pointer"}}>
{(se.options || []).map((op,index)=><Fragment key={op?.key || op?.id || index}><option value={op.value}>{op.label}</option></Fragment>)}
</select>
</label>
</Fragment>)}
<div style={{"display": "flex","flexDirection": "column"}}>
{(v.tabToggles || []).map(t=><ReferenceTile key={t.key} person={t}>{t=><>
<button role="switch" aria-checked={t.knob === "18px"} aria-label={t.label} onClick={t.flip} style={{"display": "flex","alignItems": "center","justifyContent": "space-between","gap": "16px","padding": "14px 0","border": "0","borderBottom": "1px solid #1d1a14","background": "transparent","color": "#f3eee2","font": "inherit","textAlign": "left","cursor": "pointer","width": "100%"}}>
<span style={{"display": "flex","flexDirection": "column","gap": "3px"}}><span style={{"fontSize": "14px","fontWeight": "500"}}>{t.label}</span><span style={{"fontSize": "12px","color": "#8a8373"}}>{t.desc}</span></span>
<span style={{"flexShrink": "0","position": "relative","width": "38px","height": "22px","borderRadius": "11px","background": t.track,"transition": "background 150ms"}}><span style={{"position": "absolute","top": "2px","left": t.knob,"width": "18px","height": "18px","borderRadius": "50%","background": "#ffffff","transition": "left 150ms"}}></span></span>
</button>
</>}</ReferenceTile>)}
</div>
{(v.isBgTab) && <>
<div style={{"position": "relative","aspectRatio": "16/9","maxHeight": "220px","borderRadius": "14px","overflow": "hidden","background": v.previewBg,"display": "flex","alignItems": "center","justifyContent": "center"}}>
{(v.previewVid) && <><video ref={v.previewRef} autoPlay={true} muted={true} playsInline={true} style={{"position": "absolute","inset": "0","width": "100%","height": "100%","objectFit": "cover","filter": v.previewFilter,"transform": v.previewMirror ? 'scaleX(-1)' : 'none'}}></video></>}
{(v.previewAv) && <><span style={{"width": "84px","height": "84px","borderRadius": "50%","background": "#2a2519","color": "#d9b54a","fontSize": "30px","fontWeight": "600","display": "flex","alignItems": "center","justifyContent": "center"}}>{v.myInitials}</span></>}
</div>
<div style={{"display": "flex","flexDirection": "column","gap": "10px"}}>
<span style={{"fontSize": "13px","color": "#a49c8a"}}>{"Background"}</span>
<div style={{"display": "grid","gridTemplateColumns": "repeat(auto-fill,minmax(96px,1fr))","gap": "10px"}}>
{(v.bgOptions || []).map((o,index)=><Fragment key={o?.key || o?.id || index}>
<button onClick={o.pick} style={{"display": "flex","flexDirection": "column","gap": "6px","padding": "0","border": "0","background": "transparent","color": "#d8d1c1","font": "inherit","fontSize": "12px","cursor": "pointer","textAlign": "left"}}>
<span style={{"height": "58px","borderRadius": "10px","background": o.css,"border": "2px solid " + String(o.ring)}}></span>{o.label}</button>
</Fragment>)}
</div>
</div>
<div style={{"display": "flex","flexDirection": "column","gap": "10px"}}>
<span style={{"fontSize": "13px","color": "#a49c8a"}}>{"Video filter"}</span>
<div style={{"display": "flex","flexWrap": "wrap","gap": "8px"}}>
{(v.filterOptions || []).map((o,index)=><Fragment key={o?.key || o?.id || index}>
<button onClick={o.pick} style={{"height": "34px","padding": "0 14px","borderRadius": "999px","border": "1px solid " + String(o.ring),"background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "13px","cursor": "pointer"}}>{o.label}</button>
</Fragment>)}
</div>
</div>
</>}
{(v.isProfile) && <>
<div style={{"display": "flex","alignItems": "center","gap": "16px"}}>
<span style={{"width": "64px","height": "64px","borderRadius": "50%","background": "#2a2519","color": "#d9b54a","fontSize": "22px","fontWeight": "600","display": "flex","alignItems": "center","justifyContent": "center"}}>{v.myInitials}</span>
<label style={{"flex": "1","display": "flex","flexDirection": "column","gap": "8px"}}>
<span style={{"fontSize": "13px","color": "#a49c8a"}}>{"Display name"}</span>
<input value={v.name} onChange={v.onName} style={{"height": "44px","padding": "0 14px","borderRadius": "12px","background": "#13110e","border": "1px solid #2e2a21","color": "#f3eee2","font": "inherit","fontSize": "15px","outline": "none"}} className="dc-36"/>
</label>
</div>
</>}
{(v.isShortcuts) && <>
<div style={{"display": "flex","flexDirection": "column"}}>
{(v.shortcuts || []).map((k,index)=><Fragment key={k?.key || k?.id || index}>
<div style={{"display": "flex","justifyContent": "space-between","alignItems": "center","padding": "12px 0","borderBottom": "1px solid #1d1a14"}}>
<span style={{"fontSize": "14px","color": "#e8e2d3"}}>{k.d}</span>
<span style={{"padding": "4px 10px","borderRadius": "7px","background": "#1d1a14","border": "1px solid #2e2a21","fontFamily": "'JetBrains Mono',monospace","fontSize": "12px","color": "#ecd389"}}>{k.k}</span>
</div>
</Fragment>)}
</div>
</>}
</div>
</div>
</div>
</>}
{(v.isToggles) && <>
<div role="dialog" aria-modal="true" aria-label={v.modalTitle} ref={v.dialogRef} data-pop={"modal"} onClick={v.stop} style={{"width": "100%","maxWidth": "480px","padding": "24px","borderRadius": "22px","background": "#0f0e0b","border": "1px solid #26231c","boxShadow": "0 30px 80px rgba(0,0,0,0.6)","display": "flex","flexDirection": "column","gap": "6px"}}>
<div style={{"display": "flex","justifyContent": "space-between","alignItems": "center"}}><span style={{"fontSize": "20px","fontWeight": "600"}}>{v.mt.title}</span><button aria-label="Close dialog" onClick={v.closeModal} style={{"width": "34px","height": "34px","borderRadius": "9px","border": "0","background": "transparent","color": "#8a8373","fontSize": "20px","cursor": "pointer"}}>{"×"}</button></div>
<span style={{"fontSize": "14px","color": "#a49c8a","marginBottom": "8px"}}>{v.mt.desc}</span>
{(v.mt.toggles || []).map(t=><ReferenceTile key={t.key} person={t}>{t=><>
<button role="switch" aria-checked={t.knob === "18px"} aria-label={t.label} onClick={t.flip} style={{"display": "flex","alignItems": "center","justifyContent": "space-between","gap": "16px","padding": "14px 0","border": "0","borderBottom": "1px solid #1d1a14","background": "transparent","color": "#f3eee2","font": "inherit","textAlign": "left","cursor": "pointer","width": "100%"}}>
<span style={{"display": "flex","flexDirection": "column","gap": "3px"}}><span style={{"fontSize": "14px","fontWeight": "500"}}>{t.label}</span><span style={{"fontSize": "12px","color": "#8a8373"}}>{t.desc}</span></span>
<span style={{"flexShrink": "0","position": "relative","width": "38px","height": "22px","borderRadius": "11px","background": t.track,"transition": "background 150ms"}}><span style={{"position": "absolute","top": "2px","left": t.knob,"width": "18px","height": "18px","borderRadius": "50%","background": "#ffffff","transition": "left 150ms"}}></span></span>
</button>
</>}</ReferenceTile>)}
</div>
</>}
{(v.isInvite) && <>
<div role="dialog" aria-modal="true" aria-label={v.modalTitle} ref={v.dialogRef} data-pop={"modal"} onClick={v.stop} style={{"width": "100%","maxWidth": "480px","padding": "24px","borderRadius": "22px","background": "#0f0e0b","border": "1px solid #26231c","boxShadow": "0 30px 80px rgba(0,0,0,0.6)","display": "flex","flexDirection": "column","gap": "18px"}}>
<div style={{"display": "flex","justifyContent": "space-between","alignItems": "center"}}><span style={{"fontSize": "20px","fontWeight": "600"}}>{"Invite people"}</span><button aria-label="Close dialog" onClick={v.closeModal} style={{"width": "34px","height": "34px","borderRadius": "9px","border": "0","background": "transparent","color": "#8a8373","fontSize": "20px","cursor": "pointer"}}>{"×"}</button></div>
<div style={{"display": "flex","flexDirection": "column","gap": "8px"}}>
<span style={{"fontSize": "13px","color": "#a49c8a"}}>{"Meeting link"}</span>
<div style={{"display": "flex","alignItems": "center","gap": "8px","padding": "6px 6px 6px 14px","borderRadius": "12px","background": "#13110e","border": "1px solid #26231c"}}>
<span style={{"flex": "1","minWidth": "0","fontFamily": "'JetBrains Mono',monospace","fontSize": "13px","color": "#d8d1c1","overflow": "hidden","textOverflow": "ellipsis","whiteSpace": "nowrap"}}>{v.inviteLink}</span>
<button onClick={v.inviteCopyLink} style={{"height": "34px","padding": "0 12px","borderRadius": "9px","border": "0","background": "#d9b54a","color": "#1a1608","font": "inherit","fontSize": "13px","fontWeight": "600","cursor": "pointer"}}>{v.inviteLinkLabel}</button>
</div>
</div>
<div style={{"display": "flex","alignItems": "center","justifyContent": "space-between","gap": "12px"}}>
<span style={{"display": "flex","flexDirection": "column","gap": "2px"}}><span style={{"fontSize": "13px","color": "#a49c8a"}}>{"Room code"}</span><span style={{"fontFamily": "'JetBrains Mono',monospace","fontSize": "15px"}}>{v.roomCode}</span></span>
<button onClick={v.inviteCopyCode} style={{"height": "34px","padding": "0 12px","borderRadius": "9px","border": "1px solid #3a3424","background": "transparent","color": "#d9b54a","font": "inherit","fontSize": "13px","fontWeight": "600","cursor": "pointer"}}>{v.inviteCodeLabel}</button>
</div>
<div style={{"display": "flex","flexDirection": "column","gap": "8px"}}>
<span style={{"fontSize": "13px","color": "#a49c8a"}}>{"Invite by email"}</span>
<div style={{"display": "flex","gap": "8px"}}>
<input value={v.inviteEmail} onChange={v.onInviteEmail} onKeyDown={v.onInviteKey} placeholder={"name@company.com"} style={{"flex": "1","minWidth": "0","height": "42px","padding": "0 14px","borderRadius": "12px","background": "#13110e","border": "1px solid #2e2a21","color": "#f3eee2","font": "inherit","fontSize": "14px","outline": "none"}} className="dc-37"/>
<button onClick={v.sendInvite} style={{"height": "42px","padding": "0 16px","borderRadius": "12px","border": "1px solid #3a3424","background": "#1a1712","color": "#e8e2d3","font": "inherit","fontSize": "14px","fontWeight": "500","cursor": "pointer"}}>{"Send"}</button>
</div>
{(v.invited || []).map((iv,index)=><Fragment key={iv?.key || iv?.id || index}>
<div style={{"display": "flex","justifyContent": "space-between","fontSize": "13px","padding": "4px 2px"}}><span >{iv.e}</span><span style={{"color": "#6fcf8f"}}>{iv.status}</span></div>
</Fragment>)}
</div>
</div>
</>}
{(v.isMedia) && <>
<div role="dialog" aria-modal="true" aria-label={v.modalTitle} ref={v.dialogRef} data-pop={"modal"} onClick={v.stop} style={{"width": "100%","maxWidth": "480px","padding": "24px","borderRadius": "22px","background": "#0f0e0b","border": "1px solid #26231c","boxShadow": "0 30px 80px rgba(0,0,0,0.6)","display": "flex","flexDirection": "column","gap": "16px"}}>
<div style={{"display": "flex","justifyContent": "space-between","alignItems": "center"}}><span style={{"fontSize": "20px","fontWeight": "600"}}>{v.mediaKindTitle}</span><button aria-label="Close dialog" onClick={v.closeModal} style={{"width": "34px","height": "34px","borderRadius": "9px","border": "0","background": "transparent","color": "#8a8373","fontSize": "20px","cursor": "pointer"}}>{"×"}</button></div>
<div style={{"display": "flex","gap": "4px","padding": "3px","borderRadius": "10px","background": "#0a0908","alignSelf": "flex-start"}}>
{(v.kindOpts || []).map((k,index)=><Fragment key={k?.key || k?.id || index}><button onClick={k.pick} style={{"height": "32px","padding": "0 14px","borderRadius": "8px","border": "0","background": k.bg,"color": k.fg,"font": "inherit","fontSize": "13px","fontWeight": "500","cursor": "pointer"}}>{k.label}</button></Fragment>)}
</div>
<input value={v.mediaUrl} onChange={v.onMediaUrl} onKeyDown={v.onMediaKey} placeholder={v.mediaPh} style={{"height": "44px","padding": "0 14px","borderRadius": "12px","background": "#13110e","border": "1px solid #2e2a21","color": "#f3eee2","font": "inherit","fontSize": "14px","outline": "none"}} className="dc-38"/>
{(v.hasMediaErr) && <><span style={{"fontSize": "13px","color": "#ff8a83"}}>{v.mediaErr}</span></>}
<span style={{"fontSize": "13px","color": "#8a8373"}}>{"Everyone in the meeting will see and hear it in sync."}</span>
<button onClick={v.startMedia} style={{"height": "46px","borderRadius": "12px","border": "0","background": "#d9b54a","color": "#1a1608","font": "inherit","fontSize": "15px","fontWeight": "600","cursor": "pointer"}}>{"Share with everyone"}</button>
</div>
</>}
{(v.isFeedback) && <>
<div role="dialog" aria-modal="true" aria-label={v.modalTitle} ref={v.dialogRef} data-pop={"modal"} onClick={v.stop} style={{"width": "100%","maxWidth": "440px","padding": "24px","borderRadius": "22px","background": "#0f0e0b","border": "1px solid #26231c","boxShadow": "0 30px 80px rgba(0,0,0,0.6)","display": "flex","flexDirection": "column","gap": "16px"}}>
<div style={{"display": "flex","justifyContent": "space-between","alignItems": "center"}}><span style={{"fontSize": "20px","fontWeight": "600"}}>{"Leave feedback"}</span><button aria-label="Close dialog" onClick={v.closeModal} style={{"width": "34px","height": "34px","borderRadius": "9px","border": "0","background": "transparent","color": "#8a8373","fontSize": "20px","cursor": "pointer"}}>{"×"}</button></div>
{(v.fbForm) && <>
<span style={{"fontSize": "14px","color": "#a49c8a"}}>{"How is the call quality?"}</span>
<div style={{"display": "flex","gap": "6px"}}>
{(v.stars || []).map((st,index)=><Fragment key={st?.key || st?.id || index}><button aria-label={st.label} onClick={st.set} style={{"width": "44px","height": "44px","border": "0","background": "transparent","color": st.fg,"fontSize": "30px","lineHeight": "1","cursor": "pointer","padding": "0"}}>{"★"}</button></Fragment>)}
</div>
<textarea value={v.fbText} onChange={v.onFb} placeholder={"Anything we should know? (optional)"} style={{"minHeight": "96px","padding": "12px 14px","borderRadius": "12px","background": "#13110e","border": "1px solid #2e2a21","color": "#f3eee2","font": "inherit","fontSize": "14px","resize": "vertical","outline": "none"}} className="dc-39"></textarea>
<button onClick={v.sendFb} style={{"height": "44px","borderRadius": "12px","border": "0","background": "#d9b54a","color": "#1a1608","font": "inherit","fontSize": "15px","fontWeight": "600","cursor": "pointer"}}>{"Send feedback"}</button>
</>}
{(v.fbSent) && <><span style={{"fontSize": "15px","color": "#6fcf8f"}}>{"Thanks. Your feedback was sent."}</span></>}
</div>
</>}
{(v.isBreakout) && <>
<div role="dialog" aria-modal="true" aria-label={v.modalTitle} ref={v.dialogRef} data-pop={"modal"} onClick={v.stop} style={{"width": "100%","maxWidth": "560px","maxHeight": "calc(100vh - 48px)","overflow": "auto","padding": "24px","borderRadius": "22px","background": "#0f0e0b","border": "1px solid #26231c","boxShadow": "0 30px 80px rgba(0,0,0,0.6)","display": "flex","flexDirection": "column","gap": "18px"}}>
<div style={{"display": "flex","justifyContent": "space-between","alignItems": "center"}}><span style={{"fontSize": "20px","fontWeight": "600"}}>{"Breakout rooms"}</span><button aria-label="Close dialog" onClick={v.closeModal} style={{"width": "34px","height": "34px","borderRadius": "9px","border": "0","background": "transparent","color": "#8a8373","fontSize": "20px","cursor": "pointer"}}>{"×"}</button></div>
{(v.brSetup) && <>
<div style={{"display": "flex","flexWrap": "wrap","gap": "24px"}}>
<div style={{"display": "flex","flexDirection": "column","gap": "8px"}}><span style={{"fontSize": "13px","color": "#a49c8a"}}>{"Rooms"}</span>
<div style={{"display": "flex","gap": "4px","padding": "3px","borderRadius": "10px","background": "#0a0908"}}>{(v.brCounts || []).map((c,index)=><Fragment key={c?.key || c?.id || index}><button onClick={c.pick} style={{"width": "44px","height": "34px","borderRadius": "8px","border": "0","background": c.bg,"color": c.fg,"font": "inherit","fontSize": "14px","fontWeight": "500","cursor": "pointer"}}>{c.label}</button></Fragment>)}</div>
</div>
<div style={{"display": "flex","flexDirection": "column","gap": "8px"}}><span style={{"fontSize": "13px","color": "#a49c8a"}}>{"Duration"}</span>
<div style={{"display": "flex","gap": "4px","padding": "3px","borderRadius": "10px","background": "#0a0908"}}>{(v.brDurations || []).map((c,index)=><Fragment key={c?.key || c?.id || index}><button onClick={c.pick} style={{"height": "34px","padding": "0 12px","borderRadius": "8px","border": "0","background": c.bg,"color": c.fg,"font": "inherit","fontSize": "14px","fontWeight": "500","cursor": "pointer"}}>{c.label}</button></Fragment>)}</div>
</div>
</div>
</>}
<div style={{"display": "grid","gridTemplateColumns": "repeat(auto-fill,minmax(150px,1fr))","gap": "10px"}}>
{(v.brRooms || []).map((r,index)=><Fragment key={r?.key || r?.id || index}>
<div style={{"display": "flex","flexDirection": "column","gap": "8px","padding": "12px","borderRadius": "14px","background": "#13110e","border": "1px solid #26231c"}}>
<span style={{"fontSize": "13px","fontWeight": "600","color": "#ecd389"}}>{r.name}</span>
{(r.members || []).map((m,index)=><Fragment key={m?.key || m?.id || index}><span style={{"fontSize": "13px","color": "#e8e2d3"}}>{m}</span></Fragment>)}
{(r.empty) && <><span style={{"fontSize": "12px","color": "#6f685a"}}>{"No one yet"}</span></>}
</div>
</Fragment>)}
</div>
<span style={{"fontSize": "13px","color": "#8a8373"}}>{v.brNote}</span>
<div style={{"display": "flex","gap": "10px","justifyContent": "flex-end"}}>
{(v.brSetup) && <>
<button onClick={v.brShuffle} style={{"height": "44px","padding": "0 16px","borderRadius": "12px","border": "1px solid #3a3424","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "14px","cursor": "pointer"}}>{"Shuffle"}</button>
<button onClick={v.brOpen} style={{"height": "44px","padding": "0 18px","borderRadius": "12px","border": "0","background": "#d9b54a","color": "#1a1608","font": "inherit","fontSize": "14px","fontWeight": "600","cursor": "pointer"}}>{"Open rooms"}</button>
</>}
{(v.brOn) && <>
<button onClick={v.brClose} style={{"height": "44px","padding": "0 18px","borderRadius": "12px","border": "0","background": "#d8443d","color": "#fff","font": "inherit","fontSize": "14px","fontWeight": "600","cursor": "pointer"}}>{"Close all rooms"}</button>
</>}
</div>
</div>
</>}
{(v.isNotes) && <>
<div role="dialog" aria-modal="true" aria-label={v.modalTitle} ref={v.dialogRef} data-pop={"modal"} onClick={v.stop} style={{"width": "100%","maxWidth": "560px","maxHeight": "calc(100vh - 48px)","overflow": "auto","padding": "24px","borderRadius": "22px","background": "#0f0e0b","border": "1px solid #26231c","boxShadow": "0 30px 80px rgba(0,0,0,0.6)","display": "flex","flexDirection": "column","gap": "18px"}}>
<div style={{"display": "flex","justifyContent": "space-between","alignItems": "center"}}><span style={{"fontSize": "20px","fontWeight": "600"}}>{"Meeting notes"}</span><button aria-label="Close dialog" onClick={v.closeModal} style={{"width": "34px","height": "34px","borderRadius": "9px","border": "0","background": "transparent","color": "#8a8373","fontSize": "20px","cursor": "pointer"}}>{"×"}</button></div>
<div style={{"display": "grid","gridTemplateColumns": "repeat(auto-fill,minmax(140px,1fr))","gap": "10px"}}>
{(v.notesSummary || []).map((ns,index)=><Fragment key={ns?.key || ns?.id || index}>
<div style={{"display": "flex","flexDirection": "column","gap": "3px","padding": "12px","borderRadius": "12px","background": "#13110e","border": "1px solid #221f19"}}><span style={{"fontSize": "12px","color": "#7d7666"}}>{ns.l}</span><span style={{"fontSize": "15px","fontWeight": "600"}}>{ns.v}</span></div>
</Fragment>)}
</div>
<label style={{"display": "flex","flexDirection": "column","gap": "8px"}}>
<span style={{"fontSize": "13px","color": "#a49c8a"}}>{"Notes and action items"}</span>
<textarea value={v.notes} onChange={v.onNotes} style={{"minHeight": "160px","padding": "12px 14px","borderRadius": "12px","background": "#13110e","border": "1px solid #2e2a21","color": "#f3eee2","font": "inherit","fontSize": "14px","lineHeight": "1.5","resize": "vertical","outline": "none"}} className="dc-40"></textarea>
</label>
<div style={{"display": "flex","gap": "10px","flexWrap": "wrap"}}>
<button onClick={v.downloadNotes} style={{"height": "44px","padding": "0 16px","borderRadius": "12px","border": "1px solid #3a3424","background": "transparent","color": "#e8e2d3","font": "inherit","fontSize": "14px","fontWeight": "500","cursor": "pointer"}}>{"Download notes"}</button>
<button aria-label="Close dialog" onClick={v.closeModal} style={{"marginLeft": "auto","height": "44px","padding": "0 16px","borderRadius": "12px","border": "0","background": "transparent","color": "#a49c8a","font": "inherit","fontSize": "14px","cursor": "pointer"}}>{"Cancel"}</button>
<button onClick={v.endForAll} style={{"height": "44px","padding": "0 18px","borderRadius": "12px","border": "0","background": "#d8443d","color": "#fff","font": "inherit","fontSize": "14px","fontWeight": "600","cursor": "pointer"}}>{"End meeting for all"}</button>
</div>
</div>
</>}
</div>
</>}
{(v.wb) && <>
{v.wb && v.whiteboard}
</>}
{(v.overlay) && <>
<div style={{"position": "fixed","inset": "0","zIndex": "50","background": "#0b0a08","display": "flex","alignItems": "center","justifyContent": "center","padding": "24px"}}>
<div style={{"width": "100%","maxWidth": "420px","display": "flex","flexDirection": "column","alignItems": "center","gap": "20px","textAlign": "center"}}>
<div style={{"display": "flex","flexDirection": "column","gap": "6px"}}><span style={{"fontSize": "30px","fontWeight": "600"}}>{v.overlayTitle}</span><span style={{"fontSize": "14px","color": "#8a8373"}}>{v.overlaySub}</span></div>
{(v.fbForm) && <>
<div style={{"display": "flex","flexDirection": "column","alignItems": "center","gap": "8px"}}>
<span style={{"fontSize": "14px","color": "#a49c8a"}}>{"How was the call?"}</span>
<div style={{"display": "flex","gap": "4px"}}>{(v.stars || []).map((st,index)=><Fragment key={st?.key || st?.id || index}><button aria-label={st.label} onClick={st.set} style={{"width": "40px","height": "40px","border": "0","background": "transparent","color": st.fg,"fontSize": "28px","lineHeight": "1","cursor": "pointer","padding": "0"}}>{"★"}</button></Fragment>)}</div>
<button onClick={v.sendFb} style={{"border": "0","background": "transparent","color": "#d9b54a","font": "inherit","fontSize": "14px","fontWeight": "600","cursor": "pointer"}}>{"Submit rating"}</button>
</div>
</>}
{(v.fbSent) && <><span style={{"fontSize": "14px","color": "#6fcf8f"}}>{"Thanks for the feedback"}</span></>}
<div style={{"display": "flex","gap": "10px"}}>
{(v.canRejoin) && <><button onClick={v.rejoin} style={{"height": "46px","padding": "0 20px","borderRadius": "12px","border": "0","background": "#d9b54a","color": "#1a1608","font": "inherit","fontSize": "15px","fontWeight": "600","cursor": "pointer"}}>{"Rejoin"}</button></>}
<a href={v.lobbyUrl} style={{"height": "46px","padding": "0 20px","borderRadius": "12px","border": "1px solid #3a3424","color": "#e8e2d3","fontSize": "15px","fontWeight": "500","display": "flex","alignItems": "center"}}>{"Back to home"}</a>
</div>
</div>
</div>
</>}</div>; }
