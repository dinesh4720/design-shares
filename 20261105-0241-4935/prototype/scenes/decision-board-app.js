export default function ({ el }) {
  if (!el || el.__decisionBoard) return;
  el.__decisionBoard = true;
  const doc = el.ownerDocument;
  const P = 'decision-board-prototype';

  // ---------- DOM helpers
  const hasCls = (n, name, loose) => [...n.classList].some((c) => c.endsWith('__' + name) || (loose && new RegExp('__' + name + '-\\d+$').test(c)));
  const QA = (root, name) => {
    if (!root) return [];
    const all = [...root.querySelectorAll('[class*="__' + name + '"]')];
    const exact = all.filter((n) => hasCls(n, name));
    return exact.length ? exact : all.filter((n) => hasCls(n, name, true));
  };
  const Q = (root, name) => QA(root, name)[0] || null;
  const I = (root, comp) => (root ? root.querySelector('[data-instance-of="' + comp + '"]') : null);
  const IA = (root, comp) => (root ? [...root.querySelectorAll('[data-instance-of="' + comp + '"]')] : []);
  const IS = (root, pre) => (root ? [...root.querySelectorAll('[data-instance-of^="' + pre + '"]')] : []);
  const T = (n, s) => { if (n) n.textContent = s; };
  const vis = (n, v) => { if (n) n.style.display = v ? '' : 'none'; };
  const on = (n, ev, fn) => { if (n) n.addEventListener(ev, fn); };
  const act = (n, fn, label) => {
    if (!n) return;
    n.style.cursor = 'pointer';
    if (n.tagName !== 'BUTTON') {
      n.tabIndex = 0;
      n.setAttribute('role', 'button');
      on(n, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); } });
    }
    if (label) n.setAttribute('aria-label', label);
    on(n, 'click', fn);
  };
  const fill = (n) => { n.style.width = 'auto'; n.style.alignSelf = 'stretch'; n.style.flexShrink = '0'; return n; };
  const noDot = (s) => String(s || '').replace(/[.?!]\s*$/, '');
  const lc = (s) => (/^[A-Z][a-z]/.test(s || '') ? s[0].toLowerCase() + s.slice(1) : s || '');
  const firstSentence = (s) => { const m = String(s || '').match(/^.*?[.?!](\s|$)/); return (m ? m[0] : s || '').trim(); };
  const offsetIn = (n, anc) => { let y = 0; while (n && n !== anc) { y += n.offsetTop; n = n.offsetParent; } return y; };
  const flash = (n) => { if (!n) return; n.classList.remove('p-flash'); void n.offsetWidth; n.classList.add('p-flash'); setTimeout(() => n.classList.remove('p-flash'), 1300); };

  function showLayer(n, ms, from) {
    if (!n) return;
    clearTimeout(n.__t);
    n.style.display = '';
    n.style.pointerEvents = 'auto';
    n.style.transition = 'none';
    n.style.opacity = '0';
    n.style.transform = from || 'none';
    void n.offsetWidth;
    n.style.transition = 'opacity ' + ms + 'ms ease-out, transform ' + ms + 'ms ease-out';
    n.style.opacity = '1';
    n.style.transform = 'none';
  }
  function hideLayer(n, ms, to) {
    if (!n) return;
    clearTimeout(n.__t);
    n.style.pointerEvents = 'none';
    n.style.transition = 'opacity ' + ms + 'ms ease-in, transform ' + ms + 'ms ease-in';
    n.style.opacity = '0';
    if (to) n.style.transform = to;
    n.__t = setTimeout(() => { n.style.display = 'none'; }, ms + 20);
  }

  // ---------- elements
  const bv = I(el, 'board-desktop');
  const top = I(bv, 'top-bar');
  const main = Q(bv, 'main');
  const loadingMain = Q(el, 'board-main-loading');
  const emptyMain = Q(el, 'board-main-empty');
  const dv = Q(el, 'decision-view');
  const io = Q(el, 'inbox-overlay');
  const menu = Q(el, 'project-menu');
  const toastEl = Q(el, 'toast');
  const tplBox = Q(el, 'templates');

  const picker = Q(top, 'project-picker');
  const projName = Q(top, 'project-name');
  const topActions = Q(top, 'top-actions');
  const importBtn = I(topActions, 'button-ghost');
  const inboxBtn = I(topActions, 'button-agent-inbox');
  const themeBtn = I(topActions, 'icon-button');
  const inboxCount = Q(inboxBtn, 'count');
  const inboxNum = Q(inboxBtn, 'number');

  const headCount = Q(main, 'need-you-count');
  const headText = Q(main, 'headline-text');
  const stat = (name) => { const s = Q(main, name); return { el: s, v: Q(s, 'value'), l: Q(s, 'label') }; };
  const stReview = stat('to-review-stat'), stActive = stat('active-stat'), stWait = stat('waiting-notes-stat');
  const search = I(main, 'search-field');
  const areaRow = Q(main, 'area-filters');
  const chips = IS(areaRow, 'filter-chip');
  const cols = { review: Q(main, 'needs-review-column'), accepted: Q(main, 'accepted-column'), closed: Q(main, 'replaced-or-rejected-column') };

  const hdr = I(dv, 'decision-header');
  const hdrActions = Q(hdr, 'header-actions');
  const backBtn = I(hdr, 'button-ghost');
  const escKey = Q(hdr, 'esc-key');
  const rejectBtn = I(hdrActions, 'button-secondary');
  const acceptBtn = I(hdrActions, 'button-primary');
  const acceptedState = I(hdrActions, 'button-accepted-state');
  const vp = Q(dv, 'page-viewport');
  const banner = Q(dv, 'waiting-banner');
  const noDet = Q(dv, 'no-details-yet');
  const docEl = I(dv, 'decision-document-d-018');
  const S = (name) => Q(docEl, name);
  const secs = { situation: S('what-was-happening-section'), how: S('how-it-works-section'), options: S('options-section'), reasons: S('reasons'), why: S('why-section'), give: S('give-up-section'), change: S('change-our-mind-section'), files: S('files-section'), notes: S('notes-section') };
  const flow0 = S('flow-diagram');
  const diagramCanvas = S('diagram-canvas');
  const optTable = S('options-table');
  const filesTable = S('files-table');
  const meta = S('decision-meta');
  const [mWritten, mDot1, mDecided, mDot2, mLink] = meta ? [...meta.children] : [];
  const mLinkText = S('replaces-text');

  const panel = I(dv, 'discussion-panel');
  const pHeader = Q(panel, 'panel-header');
  const pClose = I(pHeader, 'icon-button');
  const pSub = Q(panel, 'panel-subtitle');
  const pBody = Q(panel, 'panel-body');
  const dpt = I(panel, 'discussed-point');
  const dptSection = Q(dpt, 'point-section');
  const dptQuote = Q(dpt, 'point-quote');
  const dptShow = Q(dpt, 'show-on-page');
  const starters = Q(panel, 'starters');
  const thread = Q(panel, 'thread');
  const msgs = Q(panel, 'messages');
  const composer = I(panel, 'chat-composer');
  const cHint = Q(composer, 'composer-hint');
  const stopBtn = I(composer, 'stop-button');
  const sendBtn = I(composer, 'send-button');
  const sumBtn = I(panel, 'summarize-for-agent-button');
  const sumLabel = Q(sumBtn, 'label');
  const sumHint = Q(panel, 'summarize-hint');

  const scrim = Q(io, 'scrim');
  const ip = I(io, 'agent-inbox-panel');
  const iClose = I(Q(ip, 'inbox-header'), 'icon-button');
  const iSub = Q(ip, 'inbox-subtitle');
  const iActions = Q(ip, 'inbox-actions');
  const copyAllBtn = I(iActions, 'button-primary');
  const markAllBtn = I(iActions, 'button-secondary');
  const iList = Q(ip, 'inbox-list');
  const iEmpty = Q(ip, 'inbox-empty');
  const iEmptyMeta = Q(iEmpty, 'empty-meta');
  const iLoading = Q(ip, 'inbox-loading');

  const toastText = Q(toastEl, 'toast-text');
  const toastAct = Q(toastEl, 'toast-action');
  const toastActLabel = Q(toastEl, 'toast-action-label');
  const menuItems = { 'patient-portal': Q(menu, 'project-item-patient-portal'), 'clinic-scheduler': Q(menu, 'project-item-clinic-scheduler') };

  // ---------- templates
  const tpl = (k) => tplBox.querySelector(':scope > [data-instance-of="' + k + '"]');
  const mk = (k) => tpl(k).cloneNode(true);
  const emptyNoteTpl = Q(tplBox, 'empty-column-note-template');

  // ---------- styles
  const css = doc.createElement('style');
  const R = '.' + P + ' ';
  css.textContent = [
    R + '.p-card{cursor:pointer;transition:box-shadow .15s ease-out}',
    R + '.p-card:hover{box-shadow:inset 0 0 0 1px var(--line-strong)}',
    R + '.p-flash{animation:p-flash 1.2s ease-out}',
    '@keyframes p-flash{0%{box-shadow:inset 0 0 0 2px var(--proposed),0 0 0 4px var(--proposed-soft)}100%{box-shadow:inset 0 0 0 1px var(--line),0 0 0 0 transparent}}',
    R + '.p-point{cursor:pointer;transition:box-shadow .15s ease-out,background-color .15s ease-out}',
    R + '.p-point:hover{box-shadow:inset 0 0 0 1px var(--line-strong)}',
    R + '.p-point [data-instance-of="discuss-icon-button"],' + R + '.p-row [data-instance-of="discuss-icon-button"]{visibility:hidden}',
    R + '.p-point:hover [data-instance-of="discuss-icon-button"],' + R + '.p-row:hover [data-instance-of="discuss-icon-button"]{visibility:visible}',
    R + '.p-point [data-instance-of="discussing-chip"]{display:none}',
    R + '.p-point.is-on{background-color:var(--proposed-soft);box-shadow:inset 0 0 0 1px var(--proposed)}',
    R + '.p-point.is-on [data-instance-of="discussing-chip"]{display:flex}',
    R + '.p-point.is-on [data-instance-of="discuss-icon-button"]{display:none}',
    R + '.p-row{cursor:pointer;transition:background-color .15s ease-out}',
    R + '.p-row:hover{background-color:var(--sunken)}',
    R + '.p-row.is-on{box-shadow:inset 0 0 0 1px var(--proposed)}',
    R + ':is([data-instance-of="button-ghost"],[data-instance-of="button-secondary"],[data-instance-of="icon-button"],[data-instance-of="button-agent-inbox"],[data-instance-of="summarize-for-agent-button"],[data-instance-of="stop-button"],[data-instance-of="filter-chip"],[data-instance-of="starter-question"]){cursor:pointer;transition:background-color .12s ease-out}',
    R + ':is([data-instance-of="button-ghost"],[data-instance-of="button-secondary"],[data-instance-of="icon-button"],[data-instance-of="button-agent-inbox"],[data-instance-of="summarize-for-agent-button"],[data-instance-of="stop-button"],[data-instance-of="filter-chip"],[data-instance-of="starter-question"]):hover{background-color:var(--sunken)}',
    R + ':is([data-instance-of="button-primary"],[data-instance-of="send-button"]){cursor:pointer;transition:opacity .12s ease-out}',
    R + ':is([data-instance-of="button-primary"],[data-instance-of="send-button"]):hover{opacity:.86}',
    R + '[data-instance-of="discuss-button"]{cursor:pointer;transition:background-color .12s ease-out}',
    R + '[data-instance-of="discuss-button"]:hover{background-color:var(--sunken)}',
    R + '.p-link{cursor:pointer}',
    R + '.p-link:hover{text-decoration:underline}',
    R + '.p-mi{cursor:pointer;transition:background-color .12s ease-out}',
    R + '.p-mi:hover{background-color:var(--sunken)}',
    R + '.p-toast-act:hover{background-color:color-mix(in srgb,var(--on-primary) 16%,transparent)}',
    R + '.p-input{border:0;outline:0;background:transparent;padding:0;margin:0;min-width:0;color:var(--ink);resize:none;box-shadow:none}',
    R + '.p-input::placeholder{color:var(--muted);opacity:1}',
    R + '[data-instance-of="search-field"]:focus-within{box-shadow:inset 0 0 0 1px var(--ink)}',
    R + '[data-instance-of="chat-composer"]{cursor:text}',
    R + '[data-instance-of="chat-composer"]:focus-within{box-shadow:inset 0 0 0 1px var(--line-strong)}',
    R + ':focus-visible{outline:2px solid var(--proposed);outline-offset:2px}',
    R + '.p-input:focus-visible{outline:none}',
    R + '.p-off{opacity:.45;pointer-events:none}',
    R + '.p-think{color:var(--muted)}',
    R + '.p-skel{animation:p-skel 1.2s ease-in-out infinite}',
    '@keyframes p-skel{0%,100%{opacity:1}50%{opacity:.55}}',
    '@media (prefers-reduced-motion: reduce){' + R + '*{transition:none!important;animation:none!important}}',
  ].join('\n');
  doc.head.appendChild(css);

  // ---------- data
  const DEC = [
    { id: 'D-025', p: 'patient-portal', hidden: true, area: 'data', status: 'proposed', needs: true, age: 'Just now', written: 'just now', title: 'Show lab results only after a doctor signs them', sentence: 'Show a lab result to the patient only after a doctor has read and signed it.', situation: 'Results reach the portal the moment the lab sends them, often before a doctor has seen them.', flow: [['who', 'Lab sends a result'], ['store', 'Hold it until signed', 1], ['step', 'Doctor signs it'], ['result', 'Show it to the patient']], why: ['Patients get hard news with a doctor\'s note, not alone.', 'Doctors asked for it after two complaints.'], give: ['Patients may wait up to a day longer.'], change: ['Patients call the clinic about late results.'], files: [['src/labs/release.ts', 'Holds new results until a doctor signs them']] },
    { id: 'D-024', area: 'auth', status: 'proposed', needs: true, age: '12 min ago', written: '12 min ago', title: 'Log doctors out after 15 minutes idle', sentence: 'Sign doctors out of shared clinic computers after 15 minutes without a click or key press.', cardOnly: true },
    { id: 'D-023', area: 'data', status: 'proposed', needs: true, age: '40 min ago', written: '40 min ago', title: 'Store allergy notes as structured fields', sentence: 'Save each allergy as an item picked from a list, with how severe it is, instead of one free-text note.', situation: 'Allergies are one long free-text note today, so the app can\'t warn when a new drug clashes.', flow: [['who', 'Doctor adds an allergy'], ['step', 'Pick it from the list', 1], ['store', 'Save it as a coded allergy', 1], ['result', 'Warn about clashing drugs']], options: [['Free text, as today', ['Fast to type'], ['The app can\'t read it']], ['Structured fields', ['Clash warnings work', 'Same words everywhere'], ['Rare allergies may be missing'], 1]], why: ['Doctors can pick from a list.', 'Drug clash warnings need coded allergies.'], give: ['Old notes need a one-time move.', 'Rare allergies need a fallback.'], change: ['Doctors say picking is slower than typing.'], files: [['src/allergies/schema.ts', 'Adds allergy, severity and reaction fields'], ['scripts/move-allergy-notes.ts', 'Moves old free-text notes into the new fields']] },
    { id: 'D-022', area: 'api', status: 'proposed', age: '2 h ago', written: '2 h ago', title: 'Keep the old /v1/patients API for now', sentence: 'Keep /v1/patients working next to /v2 until the mobile app has moved over.', situation: 'The mobile app still calls /v1/patients. Turning it off now would break the app for every patient.', flow: [['who', 'Mobile app calls /v1'], ['step', 'Run the /v2 code', 1], ['step', 'Reshape it to the old format', 1], ['result', 'App gets the reply it expects']], options: [['Turn off /v1 now', ['Less code to keep'], ['Breaks the mobile app']], ['Keep /v1 next to /v2', ['Nothing breaks'], ['Two versions to test'], 1]], why: ['The mobile app still uses /v1.', '/v1 can reuse the /v2 code.'], give: ['Two versions to test for a while.'], change: ['The mobile app moves to /v2.'], files: [['src/api/v1/patients.ts', 'Calls the /v2 code and reshapes the reply']] },
    { id: 'D-021', area: 'jobs', status: 'proposed', age: '3 h ago', written: '3 h ago', title: 'Send appointment reminders from a queue', sentence: 'Put each reminder in a job queue, so a slow text provider never slows down booking.', situation: 'Reminders are sent while the booking page waits. When the text provider is slow, booking takes up to 8 seconds.', flow: [['who', 'Patient books a visit'], ['store', 'Add a reminder job', 1], ['step', 'Worker sends the text', 1], ['result', 'Patient gets a reminder']], why: ['Booking stays fast when texts are slow.', 'Failed texts can be sent again.'], give: ['One more service to run and watch.'], files: [['src/jobs/reminders.ts', 'Adds the reminder worker'], ['src/booking/confirm.ts', 'Adds a job instead of sending the text']] },
    { id: 'D-020', area: 'ui', status: 'proposed', age: 'Yesterday', written: 'yesterday', title: 'Load the patient timeline in pages of 50', sentence: 'Show the newest 50 events in the patient timeline, and load more when the doctor scrolls.', cardOnly: true },
    { id: 'D-019', area: 'auth', status: 'accepted', age: 'Today', written: 'today', decided: 'today', title: 'Sign in with the hospital\'s single sign-on', sentence: 'Let staff sign in with the hospital\'s single sign-on instead of a separate portal password.', situation: 'Staff keep one more password for the portal, and many reset it every month.', why: ['One password fewer for every doctor and nurse.', 'Staff who leave lose access the same day.'], give: ['Nobody can sign in if the hospital system is down.'], change: ['The hospital system goes down more than once a month.'], files: [['src/auth/sso.ts', 'Adds the hospital sign-in flow'], ['src/auth/session.ts', 'Starts a session from the hospital sign-in']] },
    { id: 'D-018', area: 'caching', status: 'accepted', age: 'Yesterday', written: 'on Nov 3', decided: 'on Nov 4', replaces: 'D-016', title: 'Cache patient lookups in Redis', sentence: 'Use one shared Redis cache with a 5-minute expiry for patient lookups.', situation: 'A patient lookup takes about 400 ms. Doctors open the same patient many times in a few minutes.', flow: 'd018', options: [['No cache', ['Always fresh'], ['Slow screens', 'More load on the EHR']], ['In-memory cache per server', ['No new service to run'], ['4 servers hold 4 different copies']], ['Shared Redis cache', ['All servers see the same data', 'Fast'], ['One more service to run'], 1]], why: ['We run 4 servers. One shared cache keeps them in sync.', 'Most lookups become about 80 times faster.'], give: ['Data can be up to 5 minutes old.', 'Redis must be monitored.'], change: ['Users report old allergy or medication data.'], files: [['src/cache/patients.ts', 'Adds a read-through cache: check Redis first, then the EHR'], ['config/redis.ts', 'Adds the Redis connection settings']] },
    { id: 'D-017', area: 'data', status: 'accepted', age: 'Nov 3', written: 'on Nov 2', decided: 'on Nov 3', title: 'Write an audit entry every time a record is opened', sentence: 'Write who opened which patient record, and when, to a log that nobody can edit.', situation: 'Hospital rules ask us to show who looked at a record. Today we only log changes.', flow: [['who', 'Someone opens a record'], ['step', 'Show the record'], ['store', 'Add an audit entry', 1]], why: ['Hospital rules ask for it.', 'It helps spot people who look without a reason.'], give: ['About 2 GB more storage each month.'], files: [['src/audit/log.ts', 'Adds the audit log writer'], ['src/records/open.ts', 'Writes an entry each time a record opens']] },
    { id: 'D-015', area: 'api', status: 'accepted', age: 'Nov 2', written: 'on Nov 1', decided: 'on Nov 2', title: 'Send all dates with a time zone', sentence: 'Send every date in the API with its time-zone offset, like 2026-11-02T09:00+01:00.', situation: 'A clinic in another time zone saw its visits one hour off.', options: [['Plain local times', ['Short and easy to read'], ['Wrong for clinics in other time zones']], ['Times with an offset', ['Always clear which time is meant'], ['Every client must update'], 1]], why: ['Clinics in two time zones use the app.'], give: ['Every client must update how it reads dates.'], files: [['src/api/dates.ts', 'Adds the offset to every date']] },
    { id: 'D-014', area: 'ui', status: 'accepted', age: 'Nov 1', written: 'on Oct 31', decided: 'on Nov 1', title: 'Show times in the clinic\'s time zone', sentence: 'Show every visit time in the clinic\'s own time zone, not the viewer\'s.', why: ['A visit at 9:00 means 9:00 at the clinic.'], give: ['Staff working from home see clinic time, not their own.'], files: [['src/ui/time.tsx', 'Formats times in the clinic\'s time zone']] },
    { id: 'D-012', area: 'jobs', status: 'accepted', age: 'Oct 30', written: 'on Oct 29', decided: 'on Oct 30', title: 'Retry failed lab imports 3 times, then alert', sentence: 'Retry a failed lab import 3 times, 5 minutes apart, then alert the on-call engineer.', situation: 'Lab imports fail a few times a week, mostly for a minute or two.', flow: [['who', 'Lab import fails'], ['step', 'Wait 5 minutes, try again', 1], ['check', 'Failed 3 times?'], ['result', 'Alert the on-call engineer']], why: ['Most failures fix themselves within minutes.'], give: ['A real outage is noticed 15 minutes later.'], files: [['src/jobs/lab-import.ts', 'Adds the retries and the alert']] },
    { id: 'D-016', area: 'caching', status: 'replaced', age: 'Nov 4', written: 'on Nov 1', decided: 'on Nov 4', replacedBy: 'D-018', title: 'Cache patient lookups in each server\'s memory', sentence: 'Keep recently opened patients in each server\'s own memory for 5 minutes.', why: ['No new service to run.'], give: ['4 servers hold 4 different copies.'], files: [['src/cache/memory.ts', 'Adds an in-memory cache']] },
    { id: 'D-013', area: 'data', status: 'rejected', age: 'Nov 2', written: 'on Nov 1', decided: 'on Nov 2', title: 'Store lab results as PDF files only', sentence: 'Keep lab results only as the PDF files the lab sends.', why: ['Least work for us.'], give: ['No charts of results over time.', 'Results can\'t be searched.'] },
    { id: 'D-011', area: 'api', status: 'rejected', age: 'Oct 29', written: 'on Oct 28', decided: 'on Oct 29', title: 'Use GraphQL for the patient API', sentence: 'Move the patient API from REST to GraphQL.', options: [['Keep REST', ['The team knows it well'], ['Clients get fields they don\'t need']], ['GraphQL', ['Clients ask for only what they need'], ['New tools for the whole team', 'Caching gets harder'], 1]], why: ['Clients ask for only the fields they need.'], give: ['New tools and skills for the whole team.', 'Caching gets harder.'] },
  ];
  DEC.forEach((d, i) => { d.p = d.p || 'patient-portal'; d.t = 0; d.n = parseInt(d.id.slice(2), 10); });
  const byId = (id) => DEC.find((d) => d.id === id);

  const NOTES = [
    { d: 'D-018', key: 'What we give up|Data can be up to 5 minutes old.', status: 'waiting', summary: 'Allergy and medication data must never be up to 5 minutes old.', change: 'Cache only basic patient details. Always fetch allergies and medications from the EHR.', next: 'Split the patient record into a cached part and a live part.', questions: 'Does the EHR tell us when a record changes?' },
    { d: 'D-023', key: 'Why this one|Doctors can pick from a list.', status: 'waiting', summary: 'Doctors still need free text for rare allergies that are not in the list.', change: 'Keep the list, and add an \'Other\' field with free text.', next: 'Add an optional free-text field to the allergy form.', questions: 'Should \'Other\' entries be checked by a pharmacist?' },
    { d: 'D-022', key: 'Change our mind if|The mobile app moves to /v2.', status: 'waiting', summary: 'The old API can go once the mobile app stops calling it.', change: 'Add an end date: remove /v1 by March 1.', next: 'Log every /v1 call so we can see who still uses it.', questions: 'Who owns the next mobile app release?' },
    { d: 'D-018', key: 'Options compared|In-memory cache per server', status: 'sent', summary: 'In-memory caching was ruled out because 4 servers would each hold a different copy.', change: 'None. Keep the shared Redis cache.', next: 'Add a short code comment in src/cache/patients.ts that says why.', questions: 'Does the EHR tell us when a record changes?' },
    { d: 'D-015', key: 'Options compared|Plain local times', status: 'sent', summary: 'Plain local times look fine until a clinic is in another time zone.', change: 'None. Keep times with an offset.', next: 'Add a test with a clinic in another time zone.', questions: '' },
  ];
  NOTES.forEach((n, i) => { n.id = 'n' + i; n.p = 'patient-portal'; });

  const CHATS = {
    'D-018|What we give up|Data can be up to 5 minutes old.': { done: 4, m: [
      { f: 'you', t: 'What could go wrong here?' },
      { f: 'claude', t: 'The main risk is old safety data. If a doctor adds an allergy, another doctor could see the old record for up to 5 minutes. Names and addresses change rarely, so they are fine to cache.' },
      { f: 'you', t: 'Can we cache only the safe parts?' },
      { f: 'claude', t: 'Yes. Split the record: cache name, age and contacts for 5 minutes, and always fetch allergies and medications from the EHR. The patient screen still opens in about 5 ms. The allergy list takes about 400 ms.' }] },
    'D-023|Why this one|Doctors can pick from a list.': { done: 2, m: [
      { f: 'you', t: 'What if the allergy is not in the list?' },
      { f: 'claude', t: 'Then the doctor is stuck today. Most systems add an \'Other\' field with free text, so rare allergies are still saved. Those entries just don\'t get clash warnings.' }] },
    'D-022|Change our mind if|The mobile app moves to /v2.': { done: 2, m: [
      { f: 'you', t: 'When will the mobile app move?' },
      { f: 'claude', t: 'The decision doesn\'t say. Without a date, /v1 tends to stay forever. Logging every /v1 call would show when it is safe to remove.' }] },
  };

  const REPLIES = {
    'D-024': { simpler: 'When a doctor walks away from a shared clinic computer, it signs them out after 15 minutes with no clicks or typing. The next person can\'t see their patients.', wrong: 'A doctor reading a long record without clicking could be signed out mid-way. A half-written note would be lost unless the app saves drafts.', better: 'A common middle ground: lock the screen after 15 minutes and sign out fully after an hour. A badge tap or PIN unlocks it, so no work is lost.', example: 'Dr. Lee opens a patient at 9:00 and walks away. At 9:14 the screen shows a 1-minute warning. At 9:15 she is signed out, and her draft note is kept.', other: 'The agent only wrote the card, so there is no reasoning yet. If you summarize this chat, it will add the details before it goes on.' },
    'D-023': { simpler: 'Instead of typing allergies as free text, doctors pick each one from a list and say how bad it is. Then the app can warn when a new drug clashes.', wrong: 'Rare allergies may not be in the list. Old free-text notes also need moving, and some of them won\'t match a list item.', better: 'Keep the list, and add an \'Other\' field for anything that isn\'t in it. You get clash warnings for most cases and don\'t lose rare ones.', example: 'A doctor picks Penicillin, severity Severe. Later someone prescribes amoxicillin, and the app warns that it is in the same family.' },
    'D-022': { simpler: 'The mobile app still uses the old /v1 address. We keep it working by passing those calls to the new /v2 code until the app is updated.', wrong: 'Old versions tend to stay forever. Without an end date, we keep testing two versions long after the app has moved.', better: 'Keep /v1, but set an end date and log every call. Once the logs show no /v1 calls for two weeks, remove it.', example: 'The app asks /v1 for patient 42. We fetch patient 42 through the /v2 code and reshape the reply into the old format, so the app sees no change.' },
    'D-025': { simpler: 'Patients see a lab result only after their doctor has read and signed it, so hard news comes with a doctor\'s note.', wrong: 'Patients may wait longer, up to a day if the doctor is busy. Some will call the clinic to ask where their result is.', better: 'Release normal results right away, and hold only the results the lab marks as abnormal until a doctor signs them.', example: 'The lab sends a blood test at 10:00. Dr. Shah signs it at 14:00 with a short note. The patient sees both at 14:00.' },
  };
  const SUMS = {
    'D-024': { summary: 'Signing out after 15 minutes is right for shared computers, but doctors must not lose a half-written note.', change: 'Show a 1-minute warning first, and keep unsaved notes as drafts.', next: 'Add the warning and save drafts every 30 seconds.', questions: 'Should the emergency room use a shorter time?' },
    'D-023': { summary: 'Coded allergies are worth it, as long as old notes move over safely.', change: 'None. Keep structured fields.', next: 'Move old notes with a script, and flag the ones it can\'t match.', questions: 'Who checks the notes the script can\'t match?' },
    'D-022': { summary: 'Passing /v1 calls to the /v2 code keeps the app working with little extra code.', change: 'None. Keep /v1 until the app moves.', next: 'Add a test that compares /v1 and /v2 replies for the same patient.', questions: '' },
    'D-025': { summary: 'Holding results makes sense for abnormal ones, but normal results can go out at once.', change: 'Hold only the results the lab marks as abnormal.', next: 'Read the lab\'s abnormal flag and release normal results right away.', questions: 'Does every lab send the abnormal flag?' },
    'D-021': { summary: 'A queue keeps booking fast even when the text provider is slow.', change: 'None.', next: 'Retry a failed reminder twice, then mark it as failed.', questions: 'What happens to a reminder still in the queue after the visit?' },
    'D-020': { summary: 'Pages of 50 keep the timeline fast for patients with long histories.', change: 'Load the newest events first.', next: 'Add a Load older button at the end of the list.', questions: '' },
  };
  const EMPTY_COPY = { review: 'New cards wait here for you. The ones marked Needs you come first.', accepted: 'Decisions you accept go here. Agents follow them.', closed: 'Decisions you turn down, or newer ones replace, move here.' };
  const MOON = '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>';
  const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>';

  // ---------- state
  const state = { project: 'patient-portal', area: null, q: '', view: 'board', cur: null, point: null, panel: false, inbox: false, menu: false, busy: false, timer: 0, lastSent: '', inboxLoaded: false, loading: false, importing: false };
  const cardEls = new Map();
  const keyEls = new Map();

  const colOf = (d) => (d.status === 'proposed' ? 'review' : d.status === 'accepted' ? 'accepted' : 'closed');
  const projectDecs = () => DEC.filter((d) => d.p === state.project && !d.hidden);
  const notesFor = (id) => NOTES.filter((n) => n.d === id).sort((a, b) => (a.status === b.status ? 0 : a.status === 'waiting' ? -1 : 1));
  const waiting = () => NOTES.filter((n) => n.p === state.project && n.status === 'waiting');
  const pointLabel = (key) => { const [s, t] = key.split('|'); return s + ': ' + noDot(t); };
  const chatOf = (key) => { const k = state.cur + '|' + key; return CHATS[k] || (CHATS[k] = { m: [], done: 0 }); };
  const chipCount = (id, key) => { const c = CHATS[id + '|' + key]; return NOTES.filter((n) => n.d === id && n.key === key).length + (c && c.m.length > c.done ? 1 : 0); };

  // ---------- setup
  [dv, io, menu, toastEl, loadingMain, emptyMain].forEach((n) => { if (n) { n.style.display = 'none'; n.style.opacity = '0'; n.style.pointerEvents = 'none'; } });
  tplBox.style.display = 'none';
  Object.values(cols).forEach((c) => { c.style.overflowY = 'auto'; IS(c, 'decision-card').forEach((n) => n.remove()); });
  vp.style.position = 'relative';
  vp.style.overflowY = 'auto';
  banner.style.marginBottom = '16px';
  noDet.style.marginTop = '48px';
  pBody.style.overflowY = 'auto';
  iList.style.overflowY = 'auto';
  msgs.innerHTML = '';
  loadingMain.classList.add('p-skel');
  toastEl.style.left = '50%';
  toastEl.style.top = 'auto';
  toastEl.style.bottom = '24px';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  toastAct.classList.add('p-toast-act');
  panel.style.transition = 'margin-right 260ms cubic-bezier(.2,.8,.2,1)';
  panel.style.marginRight = '-' + (panel.offsetWidth || 440) + 'px';
  panel.style.visibility = 'hidden';
  const rejectedState = mk('button-accepted-state');
  hdrActions.insertBefore(rejectedState, acceptBtn);
  const flowGen = doc.createElement('div');
  flowGen.style.cssText = 'display:none;align-items:center;width:100%;';
  diagramCanvas.insertBefore(flowGen, S('legend-divider'));
  [mLink].forEach((n) => n && n.classList.add('p-link'));
  Object.values(menuItems).forEach((n) => n && n.classList.add('p-mi'));

  const sph = Q(search, 'placeholder');
  const si = doc.createElement('input');
  si.type = 'text';
  si.className = sph.className + ' p-input';
  si.placeholder = sph.textContent;
  si.setAttribute('aria-label', 'Search decisions');
  si.style.flex = '1 1 0';
  si.style.width = '100%';
  sph.replaceWith(si);
  const shortcut = Q(search, 'shortcut');
  search.style.cursor = 'text';

  const cph = Q(composer, 'composer-placeholder');
  const ta = doc.createElement('textarea');
  ta.className = cph.className + ' p-input';
  ta.placeholder = cph.textContent;
  ta.rows = 1;
  ta.setAttribute('aria-label', 'Ask about this point');
  ta.style.cssText = 'display:block;width:100%;white-space:pre-wrap;overflow-y:hidden;';
  cph.replaceWith(ta);
  const autosize = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; ta.style.overflowY = ta.scrollHeight > 120 ? 'auto' : 'hidden'; };

  // ---------- theme
  const themeSvg = themeBtn.querySelector('svg');
  function setTheme(m) {
    el.setAttribute('data-mode', m);
    el.querySelectorAll('[data-mode]').forEach((n) => n.setAttribute('data-mode', m));
    if (themeSvg) { themeSvg.innerHTML = m === 'dark' ? SUN : MOON; themeSvg.setAttribute('aria-label', m === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); }
    themeBtn.setAttribute('aria-label', m === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    try { localStorage.setItem('decision-board-theme', m); } catch (e) {}
  }
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('decision-board-theme'); } catch (e) {}
  setTheme(savedTheme || el.getAttribute('data-mode') || 'light');
  act(themeBtn, () => setTheme(el.getAttribute('data-mode') === 'dark' ? 'light' : 'dark'));

  // ---------- board
  function setGlyph(host, status) {
    const g = host.querySelector('[data-instance-of^="status-glyph"]');
    if (g && g.getAttribute('data-instance-of') !== 'status-glyph-' + status) g.replaceWith(mk('status-glyph-' + status));
  }
  function cardEl(d) {
    let c = cardEls.get(d.id);
    if (!c) {
      c = fill(mk('decision-card-needs-you'));
      c.classList.add('p-card');
      c.dataset.id = d.id;
      act(c, () => openDecision(d.id));
      cardEls.set(d.id, c);
    }
    const closed = d.status === 'rejected' || d.status === 'replaced';
    const n = notesFor(d.id).length;
    Q(c, 'needs-you-edge').style.backgroundColor = d.needs && d.status === 'proposed' ? '' : 'transparent';
    setGlyph(c, d.status);
    T(Q(c, 'card-id'), d.id);
    T(Q(I(c, 'area-tag'), 'area'), d.area);
    T(Q(c, 'card-age'), d.age);
    const title = Q(c, 'card-title');
    T(title, d.title);
    title.style.color = closed ? 'var(--muted)' : '';
    vis(I(c, 'needs-you-badge'), d.needs && d.status === 'proposed');
    const nc = I(c, 'notes-count');
    vis(nc, n > 0);
    T(Q(nc, 'count'), n);
    const rb = Q(c, 'card-replaced-by');
    vis(rb, !!d.replacedBy && d.status === 'replaced');
    if (d.replacedBy) T(Q(rb, 'replaced-by-text'), 'Replaced by ' + d.replacedBy);
    vis(Q(c, 'card-footer'), (d.needs && d.status === 'proposed') || n > 0 || (d.replacedBy && d.status === 'replaced'));
    c.setAttribute('aria-label', d.id + ': ' + d.title);
    return c;
  }
  const matches = (d) => (!state.area || d.area === state.area) && (!state.q || (d.id + ' ' + d.title + ' ' + d.area).toLowerCase().includes(state.q));
  function renderBoard() {
    const list = projectDecs();
    const needs = list.filter((d) => d.needs && d.status === 'proposed').length;
    T(headCount, needs);
    vis(headCount, needs > 0);
    T(headText, needs === 0 ? 'Nothing needs you right now' : needs === 1 ? 'decision needs you' : 'decisions need you');
    const nReview = list.filter((d) => d.status === 'proposed').length;
    const nActive = list.filter((d) => d.status === 'accepted').length;
    const nWait = waiting().length;
    T(stReview.v, nReview);
    T(stActive.v, nActive);
    T(stWait.v, nWait);
    T(stWait.l, nWait === 1 ? 'note waiting for the agent' : 'notes waiting for the agent');
    T(inboxNum, nWait);
    vis(inboxCount, nWait > 0);
    const filtered = !!(state.area || state.q);
    for (const k of Object.keys(cols)) {
      const col = cols[k];
      IS(col, 'decision-card').forEach((n) => n.remove());
      col.querySelectorAll('.p-empty').forEach((n) => n.remove());
      const items = list.filter((d) => colOf(d) === k && matches(d)).sort((a, b) => (k === 'review' ? (b.needs ? 1 : 0) - (a.needs ? 1 : 0) : 0) || b.t - a.t || b.n - a.n);
      items.forEach((d) => col.appendChild(cardEl(d)));
      T(Q(col, 'column-count'), items.length);
      if (!items.length) {
        const e = fill(emptyNoteTpl.cloneNode(true));
        e.classList.add('p-empty');
        T(Q(e, 'empty-text'), filtered ? 'Nothing here matches.' : EMPTY_COPY[k]);
        col.appendChild(e);
      }
    }
    const count = DEC.filter((d) => d.p === 'patient-portal' && !d.hidden).length;
    T(Q(menuItems['patient-portal'], 'project-item-meta'), count + ' decisions');
  }
  function setChip(ch, sel) {
    const from = sel ? 'filter-chip' : 'filter-chip-selected', to = sel ? 'filter-chip-selected' : 'filter-chip';
    [ch, ...ch.querySelectorAll('*')].forEach((n) => [...n.classList].forEach((c) => { if (c === from || c.startsWith(from + '__')) n.classList.replace(c, to + c.slice(from.length)); }));
    ch.setAttribute('data-instance-of', to);
    ch.setAttribute('aria-pressed', sel ? 'true' : 'false');
  }
  const chipName = (ch) => (Q(ch, 'label') || ch).textContent.trim();
  function renderChips() { chips.forEach((ch) => setChip(ch, state.area ? chipName(ch) === state.area : chipName(ch) === 'All')); }
  chips.forEach((ch) => act(ch, () => { const a = chipName(ch); state.area = a === 'All' || state.area === a ? null : a; renderChips(); renderBoard(); }));
  on(search, 'click', () => si.focus());
  on(si, 'input', () => { state.q = si.value.trim().toLowerCase(); vis(shortcut, !si.value); renderBoard(); });
  on(si, 'keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); if (si.value) { si.value = ''; state.q = ''; vis(shortcut, true); renderBoard(); } else si.blur(); }
    if (e.key === 'Enter') { const c = cols.review.querySelector('.p-card') || cols.accepted.querySelector('.p-card') || cols.closed.querySelector('.p-card'); if (c) openDecision(c.dataset.id); }
  });
  act(stWait.el, () => openInbox(), 'Open the Agent inbox');

  function boardLoading(ms, then) {
    state.loading = true;
    main.style.visibility = 'hidden';
    vis(emptyMain, false);
    showLayer(loadingMain, 120);
    setTimeout(() => {
      state.loading = false;
      hideLayer(loadingMain, 160);
      const empty = !projectDecs().length;
      if (empty) { main.style.visibility = 'hidden'; showLayer(emptyMain, 200, 'translateY(6px)'); }
      else { vis(emptyMain, false); main.style.visibility = ''; main.style.opacity = '0'; main.style.transition = 'none'; void main.offsetWidth; main.style.transition = 'opacity 200ms ease-out'; main.style.opacity = '1'; }
      renderBoard();
      if (then) then();
    }, ms);
  }

  // ---------- project menu
  function openMenu() { state.menu = true; showLayer(menu, 140, 'translateY(-4px)'); picker.setAttribute('aria-expanded', 'true'); }
  function closeMenu() { if (!state.menu) return; state.menu = false; hideLayer(menu, 100); picker.setAttribute('aria-expanded', 'false'); }
  act(picker, () => (state.menu ? closeMenu() : openMenu()), 'Switch project');
  on(doc, 'mousedown', (e) => { if (state.menu && !menu.contains(e.target) && !picker.contains(e.target)) closeMenu(); });
  Object.entries(menuItems).forEach(([name, item]) => act(item, () => switchProject(name)));
  function switchProject(name) {
    closeMenu();
    if (name === state.project) return;
    state.project = name;
    state.area = null;
    state.q = '';
    si.value = '';
    vis(shortcut, true);
    renderChips();
    T(projName, name);
    Object.entries(menuItems).forEach(([k, it]) => { const ic = Q(it, 'current-icon'); if (ic) ic.style.opacity = k === name ? '1' : '0'; });
    state.inboxLoaded = false;
    renderInbox();
    boardLoading(650);
  }

  // ---------- import
  function runImport() {
    if (state.importing) return;
    state.importing = true;
    const lab = Q(importBtn, 'label');
    T(lab, 'Importing…');
    boardLoading(900, () => {
      state.importing = false;
      T(lab, 'Import decisions');
      const n = byId('D-025');
      if (state.project === 'patient-portal' && n.hidden) {
        n.hidden = false;
        n.t = Date.now();
        renderBoard();
        flash(cardEls.get('D-025'));
        toast('Imported 1 new decision: D-025', 'Open it', () => openDecision('D-025'));
      } else toast(state.project === 'patient-portal' ? 'No new decisions in .claude/decisions' : 'No decision files in clinic-scheduler yet');
    });
  }
  act(importBtn, runImport);
  act(I(emptyMain, 'button-primary'), runImport);

  // ---------- decision page
  function renderHeader(d) {
    T(Q(hdr, 'header-id'), d.id);
    const old = hdr.querySelector('[data-instance-of^="status-pill"]');
    if (old) old.replaceWith(mk('status-pill-' + d.status));
    T(Q(I(hdr, 'area-tag'), 'area'), d.area);
    vis(rejectBtn, d.status === 'proposed' || d.status === 'accepted');
    vis(acceptBtn, d.status === 'proposed' || d.status === 'rejected');
    vis(acceptedState, d.status === 'accepted');
    vis(rejectedState, d.status === 'rejected');
  }
  function buildFlow(flow) {
    flowGen.innerHTML = '';
    flow.forEach(([type, text, isNew], i) => {
      if (i) {
        const a = mk(flow[i - 1][0] === 'check' ? 'flow-arrow-right-yes' : 'flow-arrow-right');
        a.style.width = '40px'; a.style.flex = 'none'; a.style.position = 'relative'; a.style.left = 'auto'; a.style.top = 'auto';
        flowGen.appendChild(a);
      }
      const comp = { who: 'flow-box-who-starts-it', step: isNew ? 'flow-box-step-new' : 'flow-box-step', check: 'flow-box-check', store: isNew ? 'flow-box-data-store-new' : 'flow-box-data-store', result: 'flow-box-result' }[type];
      const b = mk(comp);
      b.style.width = 'auto'; b.style.flex = '1 1 0'; b.style.minWidth = '0'; b.style.position = 'relative'; b.style.left = 'auto'; b.style.top = 'auto';
      T(Q(b, 'box-text'), text);
      flowGen.appendChild(b);
    });
  }
  function setChat(host, id, key) {
    const n = chipCount(id, key);
    const chip = I(host, 'chat-chip');
    vis(chip, n > 0);
    T(Q(chip, 'chat-count'), n);
  }
  function pointEl(d, section, text) {
    const n = fill(mk('point-block'));
    n.classList.add('p-point');
    T(Q(n, 'point-text'), text);
    const key = section + '|' + text;
    n.dataset.key = key;
    keyEls.set(key, n);
    setChat(n, d.id, key);
    act(n, () => discuss({ section, text, key }), 'Discuss: ' + text);
    return n;
  }
  function optEl(d, o) {
    const [name, good, bad, picked] = o;
    const r = fill(mk(picked ? 'option-row-picked' : 'option-row'));
    r.classList.add('p-row');
    T(Q(r, 'option-name'), name);
    [['good', good], ['bad', bad]].forEach(([k, arr]) => [1, 2].forEach((i) => { T(Q(r, k + '-' + i + '-text'), arr[i - 1] || ''); vis(Q(r, k + '-' + i), !!arr[i - 1]); }));
    const key = 'Options compared|' + name;
    r.dataset.key = key;
    keyEls.set(key, r);
    setChat(r, d.id, key);
    act(r, () => discuss({ section: 'Options compared', text: name, key }), 'Discuss option: ' + name);
    return r;
  }
  function renderDoc(d) {
    keyEls.clear();
    vis(banner, d.needs && d.status === 'proposed');
    T(S('decision-title'), d.title);
    T(mWritten, 'Written by Claude Code ' + d.written);
    const dec = d.status === 'accepted' ? 'Accepted by you ' + d.decided : d.status === 'rejected' ? 'Rejected by you ' + d.decided : '';
    T(mDecided, dec);
    vis(mDecided, !!dec);
    vis(mDot1, !!dec);
    const link = d.status === 'replaced' && d.replacedBy ? ['Replaced by ' + d.replacedBy + ' ' + d.decided, d.replacedBy] : d.replaces ? ['Replaces ' + d.replaces, d.replaces] : null;
    vis(mLink, !!link);
    vis(mDot2, !!link);
    if (link) { T(mLinkText, link[0]); mLink.dataset.to = link[1]; }
    T(S('decision-sentence'), d.sentence);
    vis(secs.situation, !!d.situation);
    T(S('situation-text'), d.situation || '');
    vis(secs.how, !!d.flow);
    if (d.flow === 'd018') { vis(flow0, true); flowGen.style.display = 'none'; }
    else if (d.flow) { vis(flow0, false); buildFlow(d.flow); flowGen.style.display = 'flex'; }
    IS(optTable, 'option-row').forEach((r) => r.remove());
    (d.options || []).forEach((o) => optTable.appendChild(optEl(d, o)));
    vis(secs.options, !!(d.options && d.options.length));
    const RS = [['why', 'Why this one'], ['give', 'What we give up'], ['change', 'Change our mind if']];
    RS.forEach(([k, label]) => { const sec = secs[k]; IS(sec, 'point-block').forEach((n) => n.remove()); (d[k] || []).forEach((t) => sec.appendChild(pointEl(d, label, t))); vis(sec, !!(d[k] && d[k].length)); });
    vis(secs.reasons, RS.some(([k]) => d[k] && d[k].length));
    IA(filesTable, 'file-row').forEach((r) => r.remove());
    (d.files || []).forEach(([p, c]) => { const r = fill(mk('file-row')); T(Q(r, 'file-path'), p); T(Q(r, 'file-change'), c); filesTable.appendChild(r); });
    vis(secs.files, !!(d.files && d.files.length));
    IA(secs.notes, 'note-card').forEach((n) => n.remove());
    const ns = notesFor(d.id);
    ns.forEach((n) => secs.notes.appendChild(noteEl(n)));
    vis(secs.notes, ns.length > 0);
    vis(noDet, !!d.cardOnly);
    markOn();
  }
  function openDecision(id) {
    const d = byId(id);
    if (!d) return;
    closeMenu();
    if (state.inbox) closeInbox();
    if (state.panel) closePanel();
    state.cur = id;
    state.view = 'decision';
    renderHeader(d);
    renderDoc(d);
    vp.scrollTop = 0;
    showLayer(dv, 200, 'translateY(8px)');
    setTimeout(() => backBtn.focus({ preventScroll: true }), 60);
  }
  function backToBoard() {
    if (state.panel) closePanel();
    state.view = 'board';
    hideLayer(dv, 150);
    renderBoard();
    const c = cardEls.get(state.cur);
    if (c) setTimeout(() => { c.focus({ preventScroll: true }); flash(c); }, 160);
  }
  act(backBtn, backToBoard);
  act(escKey, backToBoard, 'Back to the board');
  act(mLink, () => openDecision(mLink.dataset.to));
  function decide(status) {
    const d = byId(state.cur);
    const prev = { status: d.status, needs: d.needs, decided: d.decided, t: d.t, age: d.age };
    const waitingAgent = d.needs && d.status === 'proposed';
    d.status = status;
    d.needs = false;
    d.decided = 'just now';
    d.t = Date.now();
    d.age = 'Just now';
    renderHeader(d);
    renderDoc(d);
    renderBoard();
    const tail = status === 'accepted' ? (waitingAgent ? 'Claude Code will go on.' : 'Agents will follow it.') : (waitingAgent ? 'Claude Code will try another way.' : 'Agents won\'t use it.');
    toast(d.id + ' ' + status + '. ' + tail, 'Undo', () => {
      Object.assign(d, prev);
      if (state.view === 'decision' && state.cur === d.id) { renderHeader(d); renderDoc(d); }
      renderBoard();
    });
  }
  act(acceptBtn, () => decide('accepted'));
  act(rejectBtn, () => decide('rejected'));
  const SECMAP = [['the-decision-section', 'The decision', (d) => d.sentence], ['what-was-happening-section', 'What was happening', (d) => d.situation], ['how-it-works-section', 'How it works', () => 'The diagram of how it works'], ['options-section', 'Options compared', () => 'All the options'], ['why-section', 'Why this one', (d) => (d.why || []).join(' ')], ['give-up-section', 'What we give up', (d) => (d.give || []).join(' ')], ['change-our-mind-section', 'Change our mind if', (d) => (d.change || []).join(' ')], ['files-section', 'Files', () => 'The files this changes']];
  SECMAP.forEach(([cls, label, fn]) => {
    const sec = S(cls);
    const b = sec && I(sec, 'discuss-button');
    act(b, (e) => { e.stopPropagation(); const text = fn(byId(state.cur)); discuss({ section: label, text, key: label + '|' + text, el: sec }); }, 'Discuss ' + label.toLowerCase());
  });
  act(I(noDet, 'button-secondary'), () => { const d = byId(state.cur); discuss({ section: 'The decision', text: d.sentence, key: 'The decision|' + d.sentence, el: S('the-decision-section') }); });

  // ---------- discussion
  function markOn() {
    el.querySelectorAll('.is-on').forEach((n) => n.classList.remove('is-on'));
    if (state.panel && state.point) { const n = keyEls.get(state.point.key); if (n) n.classList.add('is-on'); }
  }
  function openPanel() {
    if (state.panel) return;
    state.panel = true;
    panel.style.visibility = 'visible';
    clearTimeout(panel.__t);
    requestAnimationFrame(() => { panel.style.marginRight = '0px'; });
  }
  function closePanel() {
    if (!state.panel) return;
    if (state.busy) stopAnswer();
    state.panel = false;
    panel.style.marginRight = '-' + (panel.offsetWidth || 440) + 'px';
    panel.__t = setTimeout(() => { if (!state.panel) panel.style.visibility = 'hidden'; }, 280);
    markOn();
  }
  function discuss(p) {
    const d = byId(state.cur);
    if (state.busy) stopAnswer();
    state.point = p;
    T(pSub, d.id + ' · ' + d.title);
    T(dptSection, p.section);
    T(dptQuote, p.text);
    openPanel();
    renderThread();
    markOn();
    setTimeout(() => ta.focus({ preventScroll: true }), 280);
  }
  function msgEl(m) {
    const n = fill(mk(m.f === 'you' ? 'chat-message-you' : 'chat-message-claude'));
    const t = Q(n, 'message-text');
    T(t, m.t || 'Thinking…');
    if (!m.t) t.classList.add('p-think');
    m.el = t;
    return n;
  }
  function renderThread() {
    const c = chatOf(state.point.key);
    msgs.innerHTML = '';
    c.m.forEach((m) => msgs.appendChild(msgEl(m)));
    vis(starters, !c.m.length);
    vis(thread, c.m.length > 0);
    updateSummarize();
    pBody.scrollTop = pBody.scrollHeight;
  }
  function updateSummarize() {
    if (!state.point) return;
    const c = chatOf(state.point.key);
    const last = c.m[c.m.length - 1];
    const can = !state.busy && c.m.length > c.done && last && last.f === 'claude';
    sumBtn.classList.toggle('p-off', !can);
    sumBtn.setAttribute('aria-disabled', can ? 'false' : 'true');
    T(sumHint, can ? 'Claude writes a short note and puts it in the Agent inbox.' : c.m.length && c.done >= c.m.length ? 'Summarized. Ask more to write another note.' : 'You can summarize once you\'ve talked it through.');
  }
  function setBusy(b) {
    state.busy = b;
    vis(stopBtn, b);
    vis(sendBtn, !b);
    T(cHint, b ? 'Claude is answering…' : 'Enter to send · Shift + Enter for a new line');
    updateSummarize();
  }
  function replyFor(d, p, q) {
    const kind = /simpl|plain|mean|explain/i.test(q) ? 'simpler' : /wrong|risk|break|fail|bad|danger|worry/i.test(q) ? 'wrong' : /better|instead|other|alternative|option/i.test(q) ? 'better' : /example|show me/i.test(q) ? 'example' : 'other';
    const own = REPLIES[d.id] && REPLIES[d.id][kind];
    if (own) return own;
    const tail = { 'What we give up': ' is the cost the agent accepted for it.', 'Change our mind if': ' is the sign that would make the agent rethink it.', 'Why this one': ' is one reason the agent picked it.', 'Options compared': ' is one of the options the agent weighed.' }[p.section];
    if (kind === 'simpler') return 'Put simply: ' + d.sentence + (tail ? ' “' + noDot(p.text) + '”' + tail : '');
    if (kind === 'wrong') return d.give && d.give.length ? 'The main risk the agent saw: ' + lc(d.give[0]) + (d.change && d.change.length ? ' It would change course if ' + lc(d.change[0]) : ' It didn\'t say what would make it change course, so that is worth asking.') : 'The agent didn\'t list any downsides for this one. Ask it to add them before you accept.';
    if (kind === 'better') {
      const o = d.options || [];
      const pk = o.find((x) => x[3]);
      const alt = o.find((x) => !x[3]);
      return pk && alt ? 'The agent compared ' + o.length + ' options and picked “' + pk[0] + '” because ' + lc(noDot(pk[1][0])) + '. The closest other choice is “' + alt[0] + '”: ' + lc(noDot(alt[1][0])) + ', but ' + lc(noDot(alt[2][0])) + '.' : 'The agent didn\'t compare other options here. Ask it to add at least one, so you can see what was ruled out.';
    }
    if (kind === 'example') return Array.isArray(d.flow) ? 'Here is how it plays out: ' + d.flow.map((f) => lc(f[1])).join(', then ') + '.' : 'Here is a small example: ' + (d.situation || d.sentence);
    return 'From the decision: ' + ((d.why && d.why[0]) || d.sentence) + ' If that doesn\'t answer it, summarize this chat and the agent will answer in the decision.';
  }
  function send(text) {
    text = (text || '').trim();
    if (!text || state.busy || !state.point) return;
    const c = chatOf(state.point.key);
    c.m.push({ f: 'you', t: text });
    ta.value = '';
    autosize();
    const words = replyFor(byId(state.cur), state.point, text).split(' ');
    const m = { f: 'claude', t: '' };
    c.m.push(m);
    renderThread();
    setBusy(true);
    refreshChips();
    let i = 0;
    const tick = () => {
      i++;
      m.t = words.slice(0, i).join(' ');
      if (m.el) { m.el.textContent = m.t; m.el.classList.remove('p-think'); }
      pBody.scrollTop = pBody.scrollHeight;
      if (i < words.length) state.timer = setTimeout(tick, 24 + Math.random() * 36);
      else setBusy(false);
    };
    state.timer = setTimeout(tick, 650);
  }
  function stopAnswer() {
    clearTimeout(state.timer);
    const c = state.point && chatOf(state.point.key);
    const last = c && c.m[c.m.length - 1];
    if (last && last.f === 'claude') { if (!last.t) last.t = 'Stopped.'; else last.t += ' …'; if (last.el) { last.el.textContent = last.t; last.el.classList.remove('p-think'); } }
    setBusy(false);
  }
  function refreshChips() { keyEls.forEach((n, key) => setChat(n, state.cur, key)); }
  on(ta, 'input', autosize);
  on(ta, 'keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(ta.value); } });
  on(composer, 'click', (e) => { if (!e.target.closest('button')) ta.focus(); });
  act(sendBtn, () => send(ta.value), 'Send');
  act(stopBtn, stopAnswer, 'Stop');
  IA(starters, 'starter-question').forEach((s) => act(s, () => send(Q(s, 'question').textContent)));
  act(pClose, closePanel, 'Close the discussion');
  act(dptShow, () => {
    const n = keyEls.get(state.point.key) || state.point.el;
    if (!n) return;
    vp.scrollTo({ top: Math.max(0, offsetIn(n, vp) - 96), behavior: 'smooth' });
    flash(n);
  });
  function summarize() {
    if (!state.point || state.busy) return;
    const d = byId(state.cur);
    const p = state.point;
    const c = chatOf(p.key);
    if (!(c.m.length > c.done)) return;
    const recent = c.m.slice(c.done);
    const lastYou = (recent.filter((m) => m.f === 'you').pop() || {}).t || '';
    const lastClaude = (recent.filter((m) => m.f === 'claude').pop() || {}).t || '';
    const s = SUMS[d.id] && !d.sumUsed ? SUMS[d.id] : { summary: firstSentence(lastClaude) || 'Talked it through with Claude.', change: 'None yet. Keep the decision as it is.', next: 'Explain “' + noDot(p.text) + '” in plain words in the decision.', questions: /\?$/.test(lastYou) ? lastYou : '' };
    d.sumUsed = true;
    NOTES.unshift({ id: 'n' + Date.now(), p: d.p, d: d.id, key: p.key, status: 'waiting', summary: s.summary, change: s.change, next: s.next, questions: s.questions });
    c.done = c.m.length;
    const top = vp.scrollTop;
    renderDoc(d);
    vp.scrollTop = top;
    renderBoard();
    renderInbox();
    updateSummarize();
    T(sumLabel, 'Note added');
    setTimeout(() => T(sumLabel, 'Summarize for agent'), 1600);
    toast('Note added to the Agent inbox', 'Open inbox', openInbox);
  }
  act(sumBtn, summarize);

  // ---------- notes and inbox
  function noteText(n) {
    const d = byId(n.d);
    return ['Note for the coding agent · ' + d.id + ' ' + d.title, 'About: ' + pointLabel(n.key), 'Summary: ' + n.summary, n.change && 'Change to the decision: ' + n.change, n.next && 'Next step: ' + n.next, n.questions && 'Open questions: ' + n.questions].filter(Boolean).join('\n');
  }
  function copyText(text, lab, orig) {
    const done = () => { T(lab, 'Copied'); setTimeout(() => T(lab, orig), 1600); };
    try {
      navigator.clipboard.writeText(text).then(done, () => { fallbackCopy(text); done(); });
    } catch (e) { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    try { const t = doc.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0;'; doc.body.appendChild(t); t.select(); doc.execCommand('copy'); t.remove(); } catch (e) {}
  }
  function noteEl(n) {
    const c = fill(mk('note-card'));
    const d = byId(n.d);
    T(Q(c, 'note-id'), d.id);
    T(Q(c, 'note-decision-title'), d.title);
    T(Q(c, 'note-point'), pointLabel(n.key));
    [['summary', n.summary], ['change-to-the-decision', n.change], ['next-step', n.next], ['open-questions', n.questions]].forEach(([f, v]) => { vis(Q(c, f + '-field'), !!v); T(Q(c, f + '-value'), v || ''); });
    const acts = Q(c, 'note-actions');
    if (n.status === 'sent') {
      const w = I(c, 'note-status-waiting');
      if (w) w.replaceWith(mk('note-status-sent'));
      vis(acts, false);
    }
    const copyB = I(acts, 'button-secondary');
    const markB = I(acts, 'button-ghost');
    act(copyB, (e) => { e.stopPropagation(); copyText(noteText(n), Q(copyB, 'label'), 'Copy for agent'); });
    act(markB, (e) => { e.stopPropagation(); markSent([n], c); });
    return c;
  }
  function renderInbox() {
    IA(iList, 'note-card').forEach((n) => n.remove());
    const w = waiting();
    if (state.inbox && !state.inboxLoaded) {
      vis(iLoading, true); vis(iEmpty, false); vis(iActions, false);
      T(iSub, 'Loading notes…');
      return;
    }
    vis(iLoading, false);
    w.forEach((n) => iList.insertBefore(noteEl(n), iEmpty));
    vis(iEmpty, !w.length);
    vis(iActions, w.length > 0);
    T(iSub, w.length ? w.length + (w.length === 1 ? ' note' : ' notes') + ' waiting to go to the coding agent' : 'All caught up');
    T(iEmptyMeta, state.lastSent ? 'Last note sent ' + state.lastSent : state.project === 'patient-portal' ? 'Last note sent on Nov 4' : 'No notes sent yet');
  }
  function markSent(ns, card) {
    const prev = ns.map((n) => [n, n.status]);
    const apply = () => {
      ns.forEach((n) => { n.status = 'sent'; });
      state.lastSent = 'just now';
      renderInbox();
      renderBoard();
      if (state.view === 'decision') { const top = vp.scrollTop; renderDoc(byId(state.cur)); vp.scrollTop = top; }
      toast(ns.length > 1 ? ns.length + ' notes marked as sent' : 'Marked as sent to the agent', 'Undo', () => {
        prev.forEach(([n, s]) => { n.status = s; });
        renderInbox();
        renderBoard();
        if (state.view === 'decision') { const top = vp.scrollTop; renderDoc(byId(state.cur)); vp.scrollTop = top; }
      });
    };
    if (card && state.inbox && iList.contains(card)) { card.style.transition = 'opacity 160ms ease-in, transform 160ms ease-in'; card.style.opacity = '0'; card.style.transform = 'translateX(12px)'; setTimeout(apply, 170); }
    else apply();
  }
  function openInbox() {
    if (state.inbox) return;
    closeMenu();
    state.inbox = true;
    renderInbox();
    showLayer(io, 180);
    ip.style.transition = 'none';
    ip.style.transform = 'translateX(24px)';
    void ip.offsetWidth;
    ip.style.transition = 'transform 240ms cubic-bezier(.2,.8,.2,1)';
    ip.style.transform = 'none';
    if (!state.inboxLoaded) setTimeout(() => { state.inboxLoaded = true; renderInbox(); }, 500);
    setTimeout(() => iClose.focus({ preventScroll: true }), 60);
  }
  function closeInbox() {
    if (!state.inbox) return;
    state.inbox = false;
    ip.style.transition = 'transform 160ms ease-in';
    ip.style.transform = 'translateX(24px)';
    hideLayer(io, 160);
  }
  act(inboxBtn, openInbox);
  act(iClose, closeInbox, 'Close the Agent inbox');
  on(scrim, 'click', closeInbox);
  act(copyAllBtn, () => copyText(waiting().map(noteText).join('\n\n'), Q(copyAllBtn, 'label'), 'Copy all for agent'));
  act(markAllBtn, () => markSent(waiting()));

  // ---------- toast
  let toastFn = null, toastTimer = 0;
  function toast(msg, action, fn) {
    T(toastText, msg);
    vis(toastAct, !!action);
    if (action) T(toastActLabel, action);
    toastFn = fn || null;
    clearTimeout(toastTimer);
    clearTimeout(toastEl.__t);
    toastEl.style.display = '';
    toastEl.style.pointerEvents = 'auto';
    toastEl.style.transition = 'none';
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translate(-50%, 8px)';
    void toastEl.offsetWidth;
    toastEl.style.transition = 'opacity 180ms ease-out, transform 180ms ease-out';
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translate(-50%, 0)';
    toastTimer = setTimeout(hideToast, 5000);
  }
  function hideToast() { hideLayer(toastEl, 140, 'translate(-50%, 8px)'); }
  act(toastAct, () => { const f = toastFn; hideToast(); if (f) f(); });

  // ---------- keyboard
  on(doc, 'keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.menu) { closeMenu(); picker.focus(); }
      else if (state.inbox) closeInbox();
      else if (state.panel) closePanel();
      else if (state.view === 'decision') backToBoard();
      else return;
      e.preventDefault();
      return;
    }
    const typing = /INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '');
    if (e.key === '/' && !typing && state.view === 'board' && !state.inbox) { e.preventDefault(); si.focus(); }
  });

  // ---------- fit the window height
  const win = doc.defaultView;
  function fit() {
    const r = el.getBoundingClientRect();
    const s = r.width / (el.offsetWidth || 1440) || 1;
    const topOff = Math.max(0, (r.top + win.scrollY) / s);
    const H = Math.max(640, Math.min(1600, Math.floor(win.innerHeight / s - topOff)));
    el.style.height = H + 'px';
    [bv, dv, io, scrim].forEach((n) => { if (n) n.style.height = H + 'px'; });
    [loadingMain, emptyMain].forEach((n) => { if (n) n.style.height = H - 56 + 'px'; });
    if (ip) ip.style.height = H - 32 + 'px';
  }
  fit();
  on(win, 'resize', fit);

  // ---------- start
  setBusy(false);
  renderChips();
  renderBoard();
  renderInbox();
  boardLoading(700);
}
