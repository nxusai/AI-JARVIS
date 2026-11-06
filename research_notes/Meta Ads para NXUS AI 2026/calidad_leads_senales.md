# Lead quality and conversion signals for Meta click-to-message ads (Messenger + Instagram Direct): NXUS AI, as of Nov 2026

Context: NXUS AI funnel. The ad (Engagement, Messaging apps, Messenger + IG) leads to a greeting template whose first button sends "INFO". That starts the ManyChat flow "Filtro NXUS". A webhook sends the lead to the CRM (Netlify + Supabase), and an AI voice agent calls and books a Google Meet. Research date: 2026-11-06. Statements tagged [OUTDATED?] or [UNVERIFIED] need checking in Ads Manager.

## 1. Conversions API for Business Messaging: what it is, current status, events, and who can send them

### Takeaway
Conversions API for Business Messaging (CAPI-BM) is Meta's live, documented way to send in-thread conversion events. It uses Graph API v27.0 and supports 14 events, including LeadSubmitted, QualifiedLead and Purchase, for Messenger (page_id + page_scoped_user_id), Instagram (instagram_business_account_id + ig_sid) and WhatsApp. A custom Supabase/Netlify server can send these events. ManyChat sends LeadSubmitted and Purchase natively. CRITICAL: Meta's own doc says ad optimization on these events is NOT supported for Instagram ads (only click-to-Messenger and click-to-WhatsApp). For Instagram the events are reporting/learning signals only, and IG campaigns still optimize for conversations.

### Cited Findings
- Channels: Messenger, Instagram Direct, WhatsApp. Supported events (14): Purchase, LeadSubmitted, InitiateCheckout, AddToCart, ViewContent, OrderCreated, OrderShipped, OrderDelivered, OrderCanceled, OrderReturned, CartAbandoned, **QualifiedLead**, RatingProvided, ReviewProvided. — [Meta Dev: CAPI for Business Messaging onboarding](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging) (fetched 2026-11-06; endpoints shown at v27.0)
- Endpoints:
  - Create or get a dataset: `POST https://graph.facebook.com/v27.0/{PAGE_ID | IG_USER_ID | WABA_ID}/dataset`. This returns the existing dataset_id if one is already linked, and each page can have only one dataset.
  - Send events: `POST https://graph.facebook.com/v27.0/{DATASET_ID}/events`. — [Meta Dev](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)
- Required fields for every event: `action_source: "business_messaging"`, `event_name`, `event_time`, `messaging_channel`, and a top-level `partner_agent`. Optional: `custom_data.currency`, `custom_data.value`. — [Meta Dev](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)
  - Messenger: `messaging_channel: "messenger"`, `user_data: {page_id, page_scoped_user_id}`
  - Instagram: `messaging_channel: "instagram"`, `user_data: {instagram_business_account_id, ig_sid}`
- Permissions:
  - Messenger needs `page_events` (advanced access) plus Marketing API Access Tier.
  - Instagram needs `instagram_manage_events` (advanced access) plus Marketing API Access Tier, with a token from Facebook Login for Business or Instagram API with Unified Login.
  - The page header says Full Access needs 500 Marketing API calls in 15 days, but the channel sections still say 1,500. The page contradicts itself. — [Meta Dev](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)
- **Optimization scope:** "Purchase optimization is available for ads that click to Messenger and WhatsApp." "Instagram ad optimization is not supported. Instagram ad campaigns can be optimized for conversations instead." — [Meta Dev](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)
- Meta does NOT deduplicate these events, so the advertiser must deduplicate. Events should cover in-thread interactions only. Website conversions belong in the web CAPI. — [Meta Dev](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)
- The PSID is the user's identifier in a user-to-Page conversation and is exposed through the Messages webhook. The same person on a second Page has a different PSID, so the PSID only matches together with its page_id. — [Meta Dev onboarding](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging); [Datahash click-to-messenger](https://www.datahash.com/docs/signals/sources/messaging-ads/click-to-messenger-ads/)
- The older "Events API for Business Messaging" (`page_activities` endpoint, `lead_submitted` custom event) carries a deprecation notice. [OUTDATED]: don't build on it. — [Meta Dev: Messaging Events API](https://developers.secure.facebook.com/docs/messenger-platform/analytics/messaging-events-api)
- **ManyChat native support:**
  - Setup: Settings > Instagram/Messenger > Ads Optimization. Paste the Dataset ID and access token. The token must belong to the same Messenger/IG account.
  - In a flow: +Action > Ads Optimization > "Send event to Meta Conversions API".
  - Events: **LeadSubmitted**, auto-fired when a Data Collection step captures an email or phone, and **Purchase**, fired by the Buy Button after Stripe/PayPal confirmation. Community posts say only these two events are available. — [ManyChat Help: CAPI integration](https://help.manychat.com/hc/en-us/articles/14580897414300-Conversions-API-CAPI-integration) (page returned 403 to fetch; details from search snippets); [ManyChat Community: Ads Optimization](https://community.manychat.com/general-q-a-43/ads-optimization-3661)
- ManyChat support told a user (Nov 2025) that CAPI only works with **Engagement campaigns with message destinations**, not Sales/Leads campaigns. Meta support told the same user the events feed reporting only. After checking the docs, the user concluded CAPI-BM does not optimize Click-to-Instagram. A moderator disagreed generally. The question is unresolved. — [ManyChat Community thread, Nov 1–4 2025](https://community.manychat.com/general-q-a-43/meta-support-says-capi-will-not-optimise-engagement-campaigns-are-they-wrong-7753)
- An older community post (about 1.5 years old) said that for IG DM campaigns "you have no way to optimize the campaign for the event that we send from ManyChat." — [ManyChat Community](https://community.manychat.com/general-q-a-43/meta-ads-campaign-optimization-by-conversion-event-5831)
- Zapier offers ManyChat-tag-to-Facebook-Conversions zaps (sending Purchase on tag) as a no-code alternative. — [Zapier](https://zapier.com/apps/facebook-conversions/integrations/manychat/1220997/send-facebook-conversion-events-for-new-tagged-manychat-users)

### Inferences
- **Recommended split for NXUS:**
  - ManyChat's native action fires **LeadSubmitted** when phone/email are captured in "Filtro NXUS".
  - The Supabase/Netlify server fires **QualifiedLead** when the AI call qualifies the lead or the meeting is booked, and **Purchase** (with value in MXN/USD) when a client signs.
  - The server needs to store `page_id` + PSID (Messenger) or `ig business account id` + IGSID (Instagram). ManyChat can pass these in the webhook payload; the ManyChat "user id" field is the PSID for Messenger contacts, but verify this in the payload.
  - The server also needs its own Meta app with `page_events` / `instagram_manage_events` advanced access. This is a real hurdle: app review and Marketing API tier. Alternatives are Zapier/Make, or a CRM partner integration.
- Use an event_id or a Supabase unique constraint (lead_id + event_name) to deduplicate, because Meta won't.
- Messenger placement: these events can drive optimization (purchase optimization for CTM is documented). Instagram placement: events help reporting and possibly broader learning, but per Meta's docs they cannot be the optimization target. Consider separate ad sets per destination (Messenger-only vs Instagram-only) so the Messenger ad set can use a conversion goal.

### Gaps
- No official Meta page confirms whether QualifiedLead (vs Purchase) can be selected as the optimization target for click-to-Messenger. The doc names only "Purchase optimization" explicitly.
- The ManyChat help page couldn't be fetched (403). It's unconfirmed whether ManyChat now supports custom event names such as QualifiedLead in late 2026.

## 2. Optimizing messaging campaigns for leads/purchases instead of conversations

### Takeaway
Meta offers ad-set performance goals that "maximize the number of leads or purchases acquired through messaging." Vendors report better lead quality when optimizing for conversions rather than conversations. However, the documented requirement is that you first send the conversion events (CAPI-BM), and Instagram Direct is excluded from event-based optimization. No official minimum event volume for messaging was found.

### Cited Findings
- Within the ad set you can choose a performance goal "that will help to maximize the number of leads or purchases acquired through messaging". Meta says campaigns can be measured on leads or purchases made after starting a Messenger conversation. — [Social Media Today, Meta click-to-messaging tips (2025)](https://www.socialmediatoday.com/news/meta-shares-click-to-messaging-ad-tips/745595/)
- Meta deck: advertisers must send purchase signals (Purchase events through the business-messaging Events API) before they can optimize Click-to-Messenger ads for purchases. Eligible advertisers can then select "Messaging conversions" for the Messenger placement. [OUTDATED?]: this is an older deck from the Events API era. — [Scribd copy of Meta deck](https://www.scribd.com/document/630300700/Messaging-Conversion-Optimization)
- Respond.io (published 2026-02-20, updated 2026-11-04) recommends "maximize conversions" over "maximize conversations", because Meta counts every message starter as a lead. Its own CTM ads switched and saw higher-quality leads and more SQLs. These are vendor anecdotes without methodology. — [Respond.io: How to improve Meta lead quality](https://respond.io/blog/how-to-improve-meta-lead-quality)
- Meta's "conversion leads" performance goal (optimize for CRM-stage quality using CAPI) is "currently only available for instant forms". — [Meta Business: Lead ads with forms](https://www.facebook.com/business/ads/ad-objectives/lead-generation/lead-ads-with-forms)
- Jon Loomer: "Leads" tells Meta to get as many submissions as possible, while "Conversion Leads" prioritizes users likely to become customers. — [Jon Loomer: lead filtering](https://www.jonloomer.com/lead-filtering-quality-of-meta-lead-ads/)
- Third-party claim: conversion leads requires about 200 leads/month. Not found in Meta docs. [UNVERIFIED] — [LeadsBridge guide](https://leadsbridge.com/blog/conversion-leads-optimization-facebook/)
- Click-to-chat ads can run under Traffic, Engagement, Leads or Sales objectives with a performance goal chosen after. — [Respond.io: Meta Business accounts help](https://respond.io/help/integrations/meta-business-accounts)
- Meta's Marketing API: Messenger ads for Leads use the OUTCOME_LEADS objective, with an automated Q&A "lead generation" chat template. — [Meta Dev: Click to Messenger](https://developers.secure.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-messenger/); [Meta Dev: Messaging ads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads)
- ManyChat's Facebook Ads trigger is only available for Traffic, Engagement and Sales campaigns, not Leads. — [ManyChat Help: Facebook Ads Trigger](https://help.manychat.com/hc/en-us/articles/14281372007196-Facebook-Ads-Trigger) (via search snippet)

### Inferences
- With ManyChat as the bot, NXUS can't use the Leads-objective native Messenger lead template, because the ManyChat ads trigger doesn't support Leads campaigns. Realistic options:
  - (a) Engagement > Messaging apps, goal "Maximize conversations", plus CAPI events for reporting and learning (current setup).
  - (b) A Messenger-only ad set on Sales/Engagement with a messaging purchase/lead goal, once Purchase/LeadSubmitted events flow.
  - (c) Test a Meta-native Leads + Messenger template, with qualifying and disqualifying questions, without ManyChat.
- The general Meta learning-phase rule (about 50 optimization events per ad set per week) likely applies too. A high-ticket B2B offer won't hit that with Purchase, so LeadSubmitted or QualifiedLead is the realistic optimization event. [UNVERIFIED for messaging specifically]

### Gaps
- No official minimum event volume for messaging conversion goals was found.
- The exact name and availability in the Nov 2026 Ads Manager UI of the "leads via messaging" performance goal (e.g. "Maximize number of leads" with a Messenger destination) was not confirmed against a Meta Help Center page. Check in Ads Manager.

## 3. Greeting/message template best practices and friction

### Takeaway
Meta's native templates support a greeting plus questions (quick replies), and the Leads template can disqualify by answer. The pattern recommended across vendors is to answer instantly and ask the same short qualifying sequence every time, saving the answers to fields. More friction lowers volume but raises quality. No controlled public data quantifying the cost effect was found.

### Cited Findings
- Meta's messaging-ad template setup: "Complete your Greeting and Questions". Ads for lead generation use "an automated question and answer flow in Messenger", where businesses can set disqualifying questions to rank leads. — [Meta Dev: Messaging ads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads); [ChatArchitect: create template for ads that click to message](https://support.chatarchitect.com/books/meta-whatsapp-business-platform/page/create-a-new-template-for-ads-that-click-to-message)
- The "Generate Leads" template asks questions first rather than offering canned answers, and "FB actually gives you the option to disqualify people depending on how they answer". — [LYFE Marketing: Facebook Messenger ads](https://www.lyfemarketing.com/blog/facebook-messenger-ads/)
- Respond.io's guidance:
  - Greet immediately with an AI agent that asks the same short sequence of qualifying questions.
  - Save answers to contact fields and hand off only when the criteria are met.
  - Treat greetings-only and one-word replies as unqualified until screened.
  - Vendor case results: EMAX Beauté cut spam leads 60% in two weeks; JU Productions cut cost per qualified lead 47.2%. — [Respond.io (2026)](https://respond.io/blog/how-to-improve-meta-lead-quality)
- Poor message flow turns purchase-optimized Messenger ads into empty chats. Flow design matters as much as the bid goal. — [LeadEnforce blog](https://leadenforce.com/blog/how-poor-message-flow-turns-purchase-optimized-messenger-ads-into-empty-chats)
- The Instant Form "Message for Leads" vs "Message for Non-Leads" sections (lead filtering) let you exit non-qualified users gracefully. This is a forms feature, but the idea transfers to chat. — [Jon Loomer](https://www.jonloomer.com/lead-filtering-quality-of-meta-lead-ads/)
- Meta (2023, LATAM): Q&A flows in Ads Manager for click-to-chat lead ads; CRM + CAPI + conversion-leads goal to optimize quality. [OUTDATED?: 2023] — [Meta LTAM newsroom](https://about.fb.com/ltam/news/2023/11/ayudando-a-las-empresas-a-crecer-con-nuevas-herramientas-de-generacion-de-leads-funciones-de-ia-y-alianzas-de-crm/amp/)

### Inferences (practical for "Filtro NXUS")
- Put a qualifying button in the greeting template itself. Example: buttons "Tengo 2+ sucursales / Empresa 20+ empleados → INFO", "Tengo un solo local", "Solo estoy curioseando". The non-qualified branch gets a polite resource (video or PDF) and no call. This keeps CAPI LeadSubmitted clean.
- Order the questions as a gate: segment and size (number of branches or employees) → city/country → service → then the personal data (name, phone, email) → explicit consent for the AI call. Only fire LeadSubmitted after consent plus phone, so that "lead" means callable and in-ICP.
- Don't rely on ManyChat's auto LeadSubmitted on any phone/email capture if early steps collect contact info before qualifying. Move contact capture after the gate, or use the manual "Send event" action instead.

### Gaps
- No public controlled data on how many template questions or how much friction changes cost per conversation vs cost per qualified lead.

## 4. Filtering tire-kickers: copy, targeting, exclusions

### Takeaway
The sources favor qualifying in the creative and the first chat step, then feeding quality signals back. No source gave hard numbers for disqualifying copy in messaging ads specifically. The tactics below are practitioner consensus.

### Cited Findings
- Optimizing for messages attracts people who message but don't buy. Break results down by campaign, ad set and ad to find the creatives that attract spam or low-intent traffic. — [Respond.io (2026)](https://respond.io/blog/how-to-improve-meta-lead-quality)
- Jon Loomer (podcast, Jan 27 2026): "You can control lead quality from Meta ads" (the title's argument is to use friction, filters and quality signals). — [Jon Loomer pubcast, 2026-01-27](https://pubcast.jonloomer.com/you-can-control-lead-quality-from-meta-ads/)
- Lead filtering in forms and qualifying questions (budget, timeline, location) are the standard levers. — [Jon Loomer](https://www.jonloomer.com/lead-filtering-quality-of-meta-lead-ads/); [Straight North: 9 tactics](https://www.straightnorth.com/blog/lead-generation-on-meta-9-proven-tactics-for-delivering-high-quality-leads/)

### Inferences (NXUS rules)
- Copy: "Solo para cadenas de restaurantes con 2+ sucursales o empresas con 20+ empleados en CDMX (Polanco, Lomas, Santa Fe, Condesa/Roma, Del Valle, Pedregal) y EE. UU." Add "No es para negocios que inician." Signal the investment level without a price, e.g. "Implementación empresarial; inversión acorde a operaciones multi-sucursal." Use a B2B visual: owner or manager in an operations setting, not consumer style.
- Location: use "People living in this location" (not "living in or recently in") and radius pins on premium neighborhoods. Separate ad sets for MX and US, with Spanish and English creatives.
- Age 28–65+. Exclude current clients and past disqualified leads with custom audiences (upload hashed phones/emails from Supabase), plus engagers who already messaged without qualifying.
- Advantage+ audience will broaden targeting, so qualification has to come from copy, the chat gate, and CAPI quality signals.

### Gaps
- No 2025–2026 source with measured effects of "not for small businesses" copy on CPL or quality in messaging ads.

## 5. Common problems: spam/bots, out-of-zone leads, one-message ghosts, speed-to-lead

### Takeaway
Spam, greeting-only replies and ghosting are typical with "maximize conversations". The fixes are an automated screen before any human or AI-call resources are spent, and very fast follow-up. Speed-to-lead evidence is strong in direction, but the famous multipliers come from 2007–2012 studies.

### Cited Findings
- AI qualification filters out greetings-only and one-word replies, with vendor-reported 60% spam reduction (EMAX Beauté). — [Respond.io](https://respond.io/blog/how-to-improve-meta-lead-quality)
- The MIT/InsideSales Lead Response Management study (2007, James Oldroyd) found that calling within 5 minutes vs 30 minutes gave 100x the odds of contact and 21x the odds of qualifying. [OLD: 2007] — cited via [Teamgate lead response time study](https://teamgate.com/blog/lead-response-time-study); [Kixie](https://www.kixie.com/sales-blog/speed-to-lead-response-time-statistics-that-drive-conversions/)
- Velocify (2012, about 3.5M leads, 400+ companies): responding within 1 minute gave a +391% conversion lift. [OLD: 2012] — via [Kixie](https://www.kixie.com/sales-blog/speed-to-lead-response-time-statistics-that-drive-conversions/)
- InsideSales 2021 (5.7M inbound leads): conversion was about 8x higher when the first call came within 5 minutes. — via [Martal: Speed to Lead 2.0](https://martal.ca/speed-to-lead-lb)
- Aloware 2026 benchmark: 5-minute responders convert at about 21% vs 2.3% for next-day responders, and only about 7% of B2B teams respond within 5 minutes. Methodology unverified. — [Aloware 2026 benchmarks](https://aloware.com/blog/lead-response-time-benchmarks)
- Only about 3% of companies respond within 5 minutes. — [Neil Patel](https://neilpatel.com/marketing-stats/response-time-new-leads/)

### Inferences
- NXUS's immediate AI call is aligned with the evidence. Still, add guardrails:
  - Call only after explicit consent plus a validated phone (E.164 format, country code matching the selected country).
  - If there's no answer, send a chat follow-up inside the messaging window plus SMS/WhatsApp, and retry the call within minutes.
- Out-of-zone leads: ask city/neighborhood as a button choice and discard or redirect out-of-zone answers before the call. Optionally geofence through the phone country code.
- One-message ghosts: ManyChat "no reply" reminders inside the window (e.g. at 15 min and 3 h). See section 6 for window rules.

### Gaps
- No Meta-specific data on speed-to-lead for click-to-message leads.

## 6. ManyChat-specific: ad triggers, ad detection, tagging by ad, 24h/7-day windows and tags

### Takeaway
ManyChat connects a flow to an ad through its Facebook/Instagram Ads Trigger (the replacement for the old "JSON growth tool" approach). There is no native field that stores the ad_id, so the reliable method is one trigger/automation per ad (or ad set) that sets a tag or custom field. Messaging windows: 24h standard. Since 28 Sep 2026, click-to-Messenger/Direct ad conversations reportedly get a window of up to 7 days. The Human Agent tag (7 days) is for human replies only.

### Cited Findings
- ManyChat Ads Trigger: link an automation to an ad in Ads Manager (choose "Partner App" as message type). Once an automation is linked to an active ad, it can't be modified. — [ManyChat Community (Mar 2026)](https://community.manychat.com/general-q-a-43/track-the-ad-id-for-my-dm-ads-campaign-10466); [ManyChat Help: Facebook Ads Trigger](https://help.manychat.com/hc/en-us/articles/14281372007196-Facebook-Ads-Trigger)
- There is no native ManyChat field that captures the ad ID. Workaround: a separate Instagram/Facebook Ads trigger per ad (or ad set), saving the source to a tag or custom field at flow start. — [ManyChat Community: which ad](https://community.manychat.com/general-q-a-43/is-there-a-way-to-see-what-ad-id-someone-entered-my-flow-from-9271); [ManyChat Community](https://community.manychat.com/general-q-a-43/how-do-i-know-from-which-ad-someone-sent-me-a-message-9253)
- The ManyChat API doesn't accept the PSID as a subscriber ID; getInfo and setCustomFieldByName require the internal contact_id. — [ManyChat Community: contact id and psid](https://community.manychat.com/general-q-a-43/contact-id-and-psid-6008)
- Meta's referral webhook for ads (`source: "ADS"`, `type: "OPEN_THREAD"`) includes `ad_id`, an optional `ref`, and `ads_context_data` {ad_title, photo_url, post_id}. That page doesn't document Instagram. — [Meta Dev: messaging_referrals](https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/messaging_referrals)
- No evidence was found of a formal deprecation notice for ManyChat's "JSON growth tool". Current docs and community point to Ads Triggers. — [search, ManyChat Community](https://community.manychat.com/general-q-a-43/how-to-track-meta-ads-1116)
- 24-hour standard window, reset by each user message. Outside it, a message tag is needed. — [singhamandeep.com, Meta messaging window explainer](https://singhamandeep.com/?p=1404)
- HUMAN_AGENT tag: manual replies up to 7 days after the user's last message. Automated messages don't qualify. App Review is needed, and scripted use violates policy. — [Chatwoot (Apr 2025)](https://www.chatwoot.com/hc/user-guide/articles/1745225158-what-is-human-agent-tag-in-instagram-messenger-channel); [KeyCRM](https://help.keycrm.app/en/communications-sms-email-instagram-telegram-viber-marketplace-chats-telephony/response-timeframes-on-facebook-and-instagram); [singhamandeep.com](https://singhamandeep.com/?p=1404)
- **New (28 Sep 2026, per Meta Messenger Platform changelog as reported by Spur, published 7 Oct 2026):**
  - Conversations started from Click-to-Messenger or Click-to-Direct ads get a standard window that "may last up to 7 days" from the user's first message after the ad click, and it "may contain promotional content". Automation is allowed.
  - Organic DMs, story replies, comments and m.me/ig.me links stay at 24h.
  - Meta doesn't guarantee the full 7 days or say whether later messages extend the window.
  - The first message carries `referral.source: ADS`. — [Spur: 7-day messaging window](https://www.spurnow.com/en/blogs/instagram-messenger-ads-7-day-messaging-window) (secondary; verify in the Meta changelog)
- ManyChat's help center also describes a 7-day window beginning after the initial 24h on Messenger/IG. This is likely the Human Agent rule; the sources describe different windows. — [ManyChat Help article 23358636027932](https://help.manychat.com/hc/en-us/articles/23358636027932)

### Inferences
- Attribution in ManyChat: create one Ads Trigger automation per ad (A, B, C). Each runs a first step "Add tag ad_A" plus a custom field `nxus_ad = "A_<adname>_<date>"`, then jumps into the shared "Filtro NXUS" flow. Include `nxus_ad`, the ManyChat contact id, the PSID/IGSID, page_id or IG account id, and the channel in the CRM webhook.
- Since triggers are locked once the ad is live, build a new ad and trigger for each creative variation rather than editing.
- With the 7-day ad window (if confirmed), ManyChat follow-ups to ghosted leads on day 2–6 can be automated without tags. Still treat 24h as the safe default until verified.

### Gaps
- Not verified directly on Meta's changelog (only via Spur). Whether ManyChat exposes the referral `ad_id` in late 2026 is also unconfirmed.

## 7. Attribution: which ad drove meetings and clients; reading messaging columns

### Takeaway
Meta's columns stop at the conversation. Ad-to-meeting-to-client attribution has to come from (a) a tag or field per ad in ManyChat carried into Supabase, and (b) CAPI-BM events (LeadSubmitted, QualifiedLead, Purchase) that show up in Ads Manager per ad. Join the CRM stages to spend per ad to get cost per qualified lead, cost per meeting and CAC.

### Cited Findings
- Track lifecycle stages (new, qualified, paid, won, lost) and break outcomes down by campaign, ad group and ad. — [Respond.io](https://respond.io/blog/how-to-improve-meta-lead-quality)
- The referral webhook carries `ad_id` and `ads_context_data.ad_title`. A custom webhook listener (outside ManyChat) could log it per PSID. — [Meta Dev: messaging_referrals](https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/messaging_referrals)
- "Messaging conversations started" counts each unique user who starts a chat after clicking the ad. One secondary source says interactions within 7 days count as one conversation. [UNVERIFIED; that source discusses WhatsApp] — [Reach.tools blog](https://reach.tools/?p=3337)
- CAPI-BM events tie to the ad via PSID/IGSID plus page or account. — [Meta Dev](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)

### Inferences
- Ad names work as UTMs: name ads as `NXUS_MX_Rest2plus_A_hook-ahorro_2026-11`. Set the ManyChat field from the per-ad trigger and mirror it in the Supabase `leads.ad_ref` column.
- Weekly report columns to read per ad:
  - Amount spent
  - Messaging conversations started
  - Cost per messaging conversation started
  - Messaging first reply (definition not verified)
  - LeadSubmitted / QualifiedLead / Purchase from CAPI (custom columns)
  - CRM-side meetings booked and closed won
- Judge creatives on cost per QualifiedLead or meeting, not cost per conversation.

### Gaps
- No official Meta definition found for "Messaging first reply" or the exact window behind "Messaging conversations started" for Messenger/IG. Check the column tooltip in Ads Manager.
