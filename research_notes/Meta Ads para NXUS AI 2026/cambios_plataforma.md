# Meta Ads Platform Changes 2025–2026 (to Nov 2026) and How to Control Them — for NXUS AI (Engagement → Messaging apps: Messenger + IG Direct → ManyChat)

Research date: 2026-11-06. Source quality caveat: Meta's own Help Center pages mostly would not render in the fetch tool (e.g., the "About Advantage+ creative" page https://www.facebook.com/business/help/1720288338140238 returned only its title). Much of what follows comes from third-party blogs (many are SEO/vendor content). Where a claim rests only on such a source it is marked **[3rd-party]**; where sources conflict it is marked **[CONFLICT]**; where I could not verify it, **[UNCONFIRMED]**. Exact UI button labels change often; verify in the account.

---

## 1. Advantage+ campaigns / "Advantage+ on by default" (unified manual + Advantage+ flow): what is forced vs optional, especially for Engagement/Messages

### Takeaway
The 2025 unification applied to **Sales, App and Leads** campaigns (single setup flow with an "Advantage+ ON" state when campaign budget, audience and placements are all automated). I found **no evidence that Engagement → Messaging apps campaigns were folded into the forced Advantage+ flow**; for Engagement, Advantage+ budget/audience/placements remain individually switchable, but the defaults are pre-selected "on" and must be switched off manually at each level.

### Cited Findings
- May 29 / Jun 3, 2025: Meta extended the "streamlined Advantage+ setup" to Sales and App campaigns; the API exposes `advantage_state` = ADVANTAGE_PLUS_SALES / ADVANTAGE_PLUS_APP / DISABLED, and "ON" means the campaign "reached an optimal level of automation" (budget + audience + placements automated). — [Meta for Developers, Jun 3, 2025](https://developers.facebook.com/blog/post/2025/06/03/advantage-plus-campaign-experience-for-sales-and-app/)
- Early 2025 (Feb–Mar): Meta removed the need to choose a "setup" (manual vs Advantage+) for Leads and Sales; Advantage+ leads campaigns rolled out globally; Advantage+ Shopping renamed Advantage+ Sales. — [Meta Brazil newsroom, Feb 2025](https://about.fb.com/br/news/2025/02/impulsione-o-desempenho-da-sua-campanha-com-os-novos-recursos-de-ia-do-advantage-e-recomendacoes-testadas-e-comprovadas/amp/); [SwipeInsight summary](https://web.swipeinsight.app/posts/meta-updates-leads-and-sales-campaign-setup-flow-to-prioritize-ai-driven-targeting-15144) [3rd-party]
- Oct 8, 2025: Marketing API v24.0 blocks creation of legacy ASC/AAC campaigns; Feb 18, 2026 v25.0 continues; May 19, 2026: no API version can create or edit legacy ASC/AAC campaigns (everything goes through the unified Advantage+ structure). — [Meta for Developers, Oct 8, 2025](https://developers.facebook.com/blog/post/2025/10/08/upcoming-asc-and-aac-mapi-deprecation-migration-options-to-advantage-plus/); [Meta OCC 2026](https://developers.facebook.com/docs/marketing-api/out-of-cycle-changes/occ-2026/) (as summarized by [adwize.ai](https://adwize.ai/blog/meta-ads-updates))
- "Campaign budget optimization" is now called **Advantage+ campaign budget** ("formerly campaign budget optimization"). — [Meta Advantage+ budget page](https://www.facebook.com/business/ads/meta-advantage-plus/budget)
- 2026 guides state Sales, App and Leads default to Advantage+ and that manual and Advantage+ creation flows were merged into one interface with AI optimization as default. — [hawky.ai](https://hawky.ai/blog/meta-ads-updates-2026); [1clickreport, 2026](https://www.1clickreport.com/blog/meta-advantage-plus-campaign-setup-2026) [3rd-party]
- Advantage+ placements are "typically preselected at the ad set level when you create a campaign," and Advantage+ settings reappear after duplicating ads, replacing creative or changing format. — [JumpFly, Aug 6, 2026](https://www.jumpfly.com/blog/metas-advantage-settings-why-they-keep-reappearing-and-how-to-stay-in-control/)
- Searches found no source documenting Engagement/Messages campaigns moved into the unified "Advantage+ ON" flow. A 2025 guide notes standard (non-Advantage+) campaign types still fit "when you need traffic or engagement objectives and full control over targeting." — [LeadEnforce](https://leadenforce.com/blog/fuel-app-growth-with-meta-advantage-app-campaigns) [3rd-party]

### Inferences
- For NXUS AI's Engagement → Messaging apps campaign, the three "Advantage+" levers are still independent switches: (1) Campaign: **Advantage+ campaign budget** on/off; (2) Ad set: **Advantage+ audience** vs "Switch to original audience options"; (3) Ad set: **Advantage+ placements** vs **Manual placements**; (4) Ad: **Advantage+ creative** enhancements. Recommended for a small, control-oriented advertiser: one campaign, budget at ad set level (Advantage+ campaign budget OFF) if testing 2+ audiences, otherwise irrelevant; review all three levels before publishing and after every duplicate/edit.
- If Meta ever routes Messages ads into the Leads/Sales "Advantage+" flow (e.g., "Leads → Messaging apps"), the "Advantage+ ON" badge will only appear if all three automations are on; switching any off returns to the manual-like state.

### Gaps
- No Meta primary source found confirming the exact 2026 Engagement-objective setup screen; verify in Ads Manager whether an "Advantage+ campaign" toggle appears at campaign level for Engagement.

---

## 2. Advantage+ creative enhancements: full list, defaults, auto-enable reports, how to disable

### Takeaway
Enhancements are **per-ad, per-feature** opt-ins/opt-outs (since API v22.0, Jan 2025, the bundled "Standard enhancements" toggle was split into individual features). Many default to ON in Ads Manager, they re-enable after duplicating/editing, and there were credible 2025 reports of toggles flipping back on. An account-level "Creative features" setting reportedly exists (Ad account settings → Creative features / untick "Test new creative features"), but sources **[CONFLICT]** on whether it is a true master switch.

### Cited Findings
- Enhancement list reported in 2026 guides (standard set, default-on per the source): **Visual touch-ups**, **Site links**, **Relevant comments**, **Add catalog items**, **Enhance CTA**, **Text improvements**, **Add overlays**, **Music**, **Image animation / 3D animation**, **Expand image (image expansion)**; opt-in "test" set: **background generation**, image expansion variants (requires accepting standard enhancements first); plus **headline text in ad images** (generated text variants inside the image) seen live ~Jul 27, 2026 and on by default. — [SparkUGC, updated Oct 1, 2026](https://www.sparkugc.com/resources/advantage-plus-creative-best-practices-2026) citing [Leapbuzz](https://leapbuzz.com/blog/meta-advantage-plus-creative-ai/) [3rd-party]
- Other listed enhancements: brightness/contrast, text combinations (re-arranging copy across fields), catalog overlays (price/promo badges), music converting a static image into a short video. — [Volume Creatives, Nov 3, 2025, upd. Jun 2, 2026](https://volumecreatives.com/blog/turn-off-advantage-plus-enhancements) [3rd-party, vendor]
- Jun 28, 2026: Meta added **image animation, video filters and video uncrop** as Advantage+ creative features (API `degrees_of_freedom_spec` / `creative_features_spec`). — [Meta OCC 2026 changelog](https://developers.facebook.com/docs/marketing-api/out-of-cycle-changes/occ-2026/) (via [adwize.ai](https://adwize.ai/blog/meta-ads-updates))
- Jan 21, 2025 (Marketing API v22.0): blanket "standard enhancements" opt-in/out deprecated; each feature has `enroll_status` OPT_IN / OPT_OUT. — [Meta Developers: Standard Enhancements](https://developers.facebook.com/docs/marketing-api/advantage-catalog-ads/standard-enhancements/)
- Dynamic Media default switched to OPT_IN for Advantage+ catalog ads from Sep 1, 2025 (catalog-only; not relevant to NXUS). — [SwipeInsight](https://web.swipeinsight.app/posts/marketing-api-updates-dynamic-media-default-opt-in-settings-19067) [3rd-party]
- Auto-enable reports: Business Insider (Oct 2025) reported Advantage+ creative enhancements are default-on and three advertisers said toggles were automatically switched back "on" after they had turned them off; True Classic's top ad was replaced by an AI image of an elderly woman (ran 3 days); REI was auto-enrolled in a feature generating an "inaccurate" and "inappropriate" image. Meta said advertisers using full image generation can review images before running and reportedly built an internal dashboard to confirm enhancements were off for big advertisers. — [Business Insider, Oct 2025 (mirror)](https://hn.jakechampion.name/reader/https://www.businessinsider.com/meta-ai-generating-bizarre-ads-advantage-plus-2025-10); [Shopifreaks](https://www.shopifreaks.com/meta-advantage-is-forcing-unwanted-ai-creative-on-brands/)
- Settings that "reappear": enhancements may be selected again after replacing creative, changing format, duplicating an ad or editing; Meta adds new enhancement options so old reviews don't cover new ones; turning off one option does not disable the others. — [JumpFly, Aug 6, 2026](https://www.jumpfly.com/blog/metas-advantage-settings-why-they-keep-reappearing-and-how-to-stay-in-control/)
- **Ad-level path**: Ad → "Advantage+ creative" section (in the creative/media area) → expand the list (often labelled per-enhancement, sometimes in "Advanced preview") → turn off each item; some enhancements can only be turned off in **Advanced preview**; bulk: select ads in Ads tab → menu beside **Edit**. — [Volume Creatives](https://volumecreatives.com/answers/how-to-turn-off-advantage-plus-creative-enhancements); [adsuploader](https://adsuploader.com/blog/advantage-plus-creative-enhancements) [3rd-party]
- **Account-level path**: "Navigate to **Ad account settings** in your Meta Business Manager and select **Creative features**." — [JumpFly, Aug 6, 2026](https://www.jumpfly.com/blog/metas-advantage-settings-why-they-keep-reappearing-and-how-to-stay-in-control/); "Advertising settings → Advantage+ creative → untick **Test new enhancements**" — [Volume Creatives](https://volumecreatives.com/blog/turn-off-advantage-plus-enhancements). **[CONFLICT]**: other guides say "Meta does not currently offer a single account-level switch for all Advantage+ creative optimizations." — [alexneiman.com](https://alexneiman.com/advantage-plus-creative-opt-out-decision-framework/); a user report says an account-level setting can override ad-level opt-outs. — [SwipeInsight](https://web.swipeinsight.app/posts/turn-off-adv-creatives-in-facebook-ads-due-to-account-setting-issue-2452)
- March 2026: one practitioner claims opt-out preferences now persist across future campaigns (cites Meta Business Help, no link). — [via search summary of adsuploader/inflowave](https://adsuploader.com/blog/advantage-plus-creative-enhancements) **[UNCONFIRMED]**
- Jun 1, 2026: AI-content disclosure rules — content generated outside Meta with C2PA metadata is auto-labelled; otherwise must be declared. — [SparkUGC](https://www.sparkugc.com/resources/advantage-plus-creative-best-practices-2026) [3rd-party]
- Meta's own claim: Advantage+ creative image generation features gave ~11% higher CTR and 7.6% higher conversion rate on average. — [Meta, Apr 22, 2025](https://www.facebook.com/business/news/the-creative-advantage-unlocking-the-power-of-diversification-with-meta-andromeda)

### Inferences
- Recommended for NXUS AI (premium B2B, brand-sensitive, owner dislikes auto-changes): **turn OFF all** text improvements, add overlays, music, image animation/3D, expand image/background generation, AI-generated video, translations, relevant comments, site links (site links are irrelevant to a Messenger destination and could send people to the website instead of the chat), enhance CTA, headline-in-image. Only **Visual touch-ups / brightness & contrast** and **auto-crop to placement (format optimization)** are low-risk; even these can be off if the creative is produced per-placement (1:1/4:5 + 9:16). Also untick account-level **Creative features → Test new creative features/enhancements** if present.
- Process: after every duplicate/new ad, reopen the Advantage+ creative list and the Advanced preview; spot-check live ads weekly via ad preview "See how your ad may appear".

### Gaps
- Could not load Meta's Help Center page to confirm the exact current label list or which enhancements apply to Messaging-destination ads (translations, AI video, "Add overlays" availability per objective unconfirmed).
- No Reddit thread directly fetched; auto-enable evidence comes from trade press.

---

## 3. Andromeda, GEM, Lattice

### Takeaway
Andromeda (rolled out 2024, publicized 2025) is Meta's ad **retrieval** stage that picks candidate ads from a much larger pool; GEM (Generative Ads Recommendation Model) and Lattice are the downstream ranking models. Practical effect: creative variety now does the "targeting" — narrow interests matter less, distinct creative concepts matter more.

### Cited Findings
- Andromeda is Meta's next-gen model that runs more complex models to decide which ads to show; it raised ad quality 8%; Meta says creative diversification is now a key lever for finding audiences instead of narrow demographic/interest targeting; recommends a wide range of creatives with different themes, messages and visuals. — [Meta for Business, Apr 22, 2025](https://www.facebook.com/business/news/the-creative-advantage-unlocking-the-power-of-diversification-with-meta-andromeda)
- Meta's ranking post on AI innovation (Andromeda, GEM, Lattice) — [Meta, Mar 27, 2025](https://www.facebook.com/business/news/ai-innovation-in-metas-ads-ranking-driving-advertiser-performance)
- Jan 2026: Meta said Andromeda runs on Nvidia, AMD and MTIA chips; Jul 2026: first generative model added to ads retrieval; Q2 2026 gains credited to user-understanding models and GEM. — [adwize.ai summary](https://adwize.ai/blog/meta-ads-updates) [3rd-party summary of Meta statements]
- Price per ad up 6% YoY Q4 2025; up 12% YoY in Q1 and Q2 2026. — [Meta Q4 2025 results](https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Fourth-Quarter-and-Full-Year-2025-Results/default.aspx); [Q2 2026 results](https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Second-Quarter-2026-Results/default.aspx)

### Inferences
- For NXUS AI: the strongest "targeting" left is (a) hard location, (b) creative that self-selects the audience (call out "dueños de cadenas de restaurantes en Polanco/Santa Fe", show restaurant-ops pain points, price-tier signals). Run 3–6 genuinely different concepts (founder video, case result, pain-point static, demo of AI agent, UGC-style testimonial) in one ad set rather than many near-identical variants.
- Andromeda doesn't need Advantage+ creative enhancements; diversity can be made manually, preserving control.

### Gaps
- No primary Meta documentation fetched for "Lattice" specifics in 2026.

---

## 4. Detailed targeting changes and Advantage+ audience vs original audience

### Takeaway
Interest/behavior **exclusions are gone** (2025); many interests were removed/merged (notably Jan 15, 2026). Under Advantage+ audience, interests/lookalikes/custom audiences are **suggestions**; only location, minimum age, and custom-audience exclusions are hard. Switching to original audience options lets you hard-restrict age/gender/custom audiences, but detailed targeting may still be expanded ("Advantage detailed targeting") for many performance goals.

### Cited Findings
- Detailed targeting exclusions removed from new ad sets (reported Mar 31, 2025 for ad sets, Jun 10, 2025 for boosted posts); custom-audience exclusions unaffected; Meta cited a test with 22.6% lower median cost per conversion without exclusions. — [Wicked Reports](https://www.wickedreports.com/blog/meta-removes-detailed-targeting-exclusions-from-ad-campaigns) [3rd-party]; dates **[CONFLICT]**: another source says exclusions fully removed Jan 31, 2026 — [kecg.co](https://kecg.co/blog/meta-ads-targeting/)
- Jan 15, 2026: Meta removed dozens of detailed-interest categories; ads relying on removed interests stopped delivering. — [adlibrary](https://adlibrary.com/posts/meta-interest-targeting-removed); [Conversios](https://www.conversios.io/blog/meta-advantage-audience-vs-detailed-targeting-2026-guide/) [3rd-party]. Niche interests merged into broader umbrellas. — [LeadEnforce](https://leadenforce.com/blog/interest-targeting-on-facebook-what-still-works-and-what-doesnt). Claim of "thousands removed as of June 2026" — [kecg.co](https://kecg.co/blog/meta-ads-targeting/) **[UNCONFIRMED]**
- Jon Loomer (Mar 24, 2026): Location = hard control (cannot isolate residents vs travelers); Age = hard only as a minimum (18–25), range is a suggestion; Gender = suggestion unless Advantage+ audience is off; custom-audience **exclusions** = hard (imperfect); custom audiences, lookalikes, detailed targeting = suggestions; with Advantage+ off you can strictly restrict age, gender and custom audiences, but detailed targeting is "always a suggestion for 11 of the most common performance goals" and lookalikes for nine. — [Jon Loomer, Mar 24, 2026](https://www.jonloomer.com/meta-ads-targeting-2026/)

### Inferences
- Path: Ad set → Audience → **Advantage+ audience** (default) → link **"Switch to original audience options"** (confirm "Use original audience"). In original options, if a checkbox "Advantage detailed targeting" / "Reach people beyond your detailed targeting selections" appears and is editable, uncheck it; for engagement-type goals it may be forced on.
- Recommendation for NXUS AI: Use **original audience options** with: precise locations (see §5), age 30–65 hard, language Spanish (MX ads) / English (US ads), and **a custom-audience exclusion** of existing clients/people who already messaged (e.g., "People who messaged your Page/IG in last 90 days" engagement audience). Detailed targeting: a few owner/decision-maker signals (e.g., "Business owners", "Restaurant owners/Food service", "Small business owners", "Facebook Page admins", "Restaurateur" job titles) treated as soft. Alternatively A/B against Advantage+ audience with the same location; keep the cheaper cost per *qualified* booked diagnostic, not per conversation.

### Gaps
- Could not confirm from Meta which exact goals (including "Conversations" for Messaging apps) are in the "always-suggestion" list of 11.

---

## 5. Location targeting (Mexico pins/radius, postal codes, residents vs recently-in, leakage)

### Takeaway
The four location-type options were consolidated in **April 2023** (not 2025): Ads Manager no longer lets you choose "People living in this location" only; it reaches people "living in or recently in" the area. Location remains a hard constraint even under Advantage+ audience, but it includes travelers/commuters, so out-of-zone or non-resident users will appear. Minimum radius figures are **[CONFLICT]**.

### Cited Findings
- Location-type options ("Living in", "Recently in", "Traveling in", "Everyone") removed; single behaviour now. — [Jon Loomer](https://www.jonloomer.com/big-change-to-meta-ads-location-targeting/); [Search Engine Land](https://searchengineland.com/new-update-to-meta-ads-location-targeting-404124) (2023)
- Location is a hard control but cannot isolate residents vs travelers; "Including a local area means reaching some people you didn't intend to reach." — [Jon Loomer, Mar 24, 2026](https://www.jonloomer.com/meta-ads-targeting-2026/)
- Minimum radius: 1 mile/1.6 km for dropped pin per one 2026 blog — [thread-transfer, Jun 17, 2026](https://thread-transfer.com/blog/2026-06-17-meta-ads-location-targeting-radius-minimum/); others say ~1 km pin / ~16–17 km around a city, or 10 miles minimum around cities. **[CONFLICT/UNCONFIRMED]** (no Meta doc found)
- Reports of leads coming from outside service area (US local business). — [Martial Arts Professional](https://www.martialartsprofessional.com/facebook-leads-outside-service-area-location-targeting/) [3rd-party]
- Sep 2026: Meta listed location fees of 2–5% in six countries (check whether Mexico included). — [Meta Help Center 1238737454289085](https://www.facebook.com/business/help/1238737454289085) (via [adwize.ai](https://adwize.ai/blog/meta-ads-updates)) **[UNCONFIRMED which countries]**

### Inferences
- For NXUS AI: drop pins with the smallest allowed radius (try 1–2 km) centred on Polanco, Santa Fe, Roma Sur, Coyoacán, Lindavista, Zona Esmeralda/La Cúspide; or use Mexican **postal codes** (C.P.) where Ads Manager accepts them (e.g., Polanco 11550/11560/11510, Santa Fe 05348/05349/01219 — verify each in the search box). Because "recently in" includes office workers, Polanco/Santa Fe will reach executives who work there (beneficial for business-owner targeting). Qualify geography inside ManyChat (ask the colonia/city and business size) since leakage cannot be prevented.
- Keep separate ad sets/campaigns for MX and USA (different language, currency, time zone).

### Gaps
- Official Meta minimum radius for Mexico and postal-code support in Mexico not confirmed.

---

## 6. Placements (Audience Network, Messenger, Threads, Reels)

### Takeaway
Advantage+ placements is the default; you can still choose **Manual placements** and untick Audience Network, Threads, etc. A 2025–2026 change adds "Allow limited spending to excluded placements" (up to 5% each) — reportedly for Sales/Leads; uncheck it. Account-level placement controls can block Audience Network. Threads ads went global (Jan 2026) and are included under Advantage+ placements. Instagram Explore feed placement retired in API v26.0 (Jul 29, 2026; all versions Oct 27, 2026).

### Cited Findings
- Ad set → Placements → Manual placements / "Show more settings" → **Placement controls** → uncheck placements. Checkbox **"Allow limited spending to excluded placements"** on by default after exclusions; up to 5% of budget per excluded placement; reported for Sales and Leads objectives. Account-level: **Advertising settings (gear) → Placement controls → "My business can only advertise on specific placements"** → uncheck Audience Network/Marketplace/Right column → Review changes → Apply (up to 48 h; overrides ad set, no 5% leakage; auction only). — [TheOptimizer, 2026](https://theoptimizer.io/blog/meta-ads-placement-control-in-2026-how-to-actually-block-placements-its-not-as-simple-anymore) [3rd-party, vendor]
- Threads ads expanded to all remaining countries (announced with Q4 2025 results Jan 28, 2026); Threads ads available worldwide by Q2 2026; Apr 21, 2026 Threads ads from existing posts. — [Meta Q4 2025 results](https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Fourth-Quarter-and-Full-Year-2025-Results/default.aspx); [PPC Land](https://ppc.land/meta-finally-brings-threads-ads-to-every-user-after-yearlong-testing-phase/); [JumpFly](https://www.jumpfly.com/blog/threads-ads-go-global-what-meta-advertisers-need-to-know/)
- Jul 29, 2026: Instagram Explore feed placement retired in Marketing API v26.0; applies to all versions from Oct 27, 2026. — [Meta Developers v26.0](https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/)
- Messaging placements: Messenger Inbox, Messenger Stories, Sponsored Messages — low-volume. — [AiSensy](https://m.aisensy.com/blog/meta-ads/) [3rd-party]

### Inferences
- Recommendation for Messaging apps (Messenger + IG): Manual placements = Facebook Feed, Instagram Feed, Instagram Stories, Instagram Reels, Facebook Reels/Stories, Messenger Inbox (optional), Instagram profile feed. **Exclude Audience Network** (useless for chat; accidental clicks) and Threads (destination can't open Messenger/IG DM natively — **[UNCONFIRMED]**), Marketplace, Right column, Search results. Also set account-level placement control to block Audience Network so it never comes back. Uncheck "Allow limited spending to excluded placements" if shown.

### Gaps
- Not confirmed whether the 5%-to-excluded-placements checkbox appears for Engagement/Messaging ad sets.

---

## 7. 2025–2026 changes specific to click-to-message ads

### Takeaway
No major documented change to the Engagement → Messaging apps performance goals was found for 2026. Relevant adjacent changes: Meta **Business Agent** (Jun 3, 2026) — an AI that answers/books in Messenger and WhatsApp (Instagram rolling out), opt-in via facebook.com/business/ai, free now, paid later; Meta AI business assistant "agentic actions" (Oct 6, 2026) that can create campaigns/change targeting/budgets **only with approval**; attribution change (Mar 3, 2026) limited to website/in-store conversions.

### Cited Findings
- Meta Business Agent: answers questions, books appointments, qualifies leads, closes sales, team member can step in; activate at facebook.com/business/ai#conversations; free to start, moving to paid subscription "in the coming months"; no mention of click-to-message ads or auto-enablement. — [Meta, Jun 3, 2026](https://www.facebook.com/business/news/conversations-2026-introducing-meta-business-agent)
- Oct 6, 2026: Meta tests agentic actions in its AI business assistant (create campaigns, update targeting, change budgets from chat, staged for approval). — [adsuploader / adadvisor roundups](https://adsuploader.com/blog/meta-ads-updates); [goodmorningco](https://goodmorningco.com/blog/meta-ads-update-october-2026) [3rd-party]
- Mar 3, 2026: click-through attribution counts link clicks only for website/in-store conversions; 1-day engage-through added to default column. — [Meta, Mar 3, 2026](https://www.facebook.com/business/news/click-attribution)
- Jul 16 / Apr 29, 2026: Ads MCP server / AI connectors for managing ads from AI apps. — [Meta Developers](https://developers.facebook.com/blog/post/2026/07/16/meta-ads-mcp-server/); [Meta, Apr 29, 2026](https://www.facebook.com/business/news/meta-ads-ai-connectors)
- Lead objective added to click-to-WhatsApp ads (Leads → Messaging) — [Rework](https://resources.rework.com/news/chat-conversational/meta-click-to-whatsapp-performance-marketer) [3rd-party; WhatsApp-specific]

### Inferences
- **Conflict risk with ManyChat**: if Meta Business AI/Business Agent or Meta's "Instant reply"/"Frequently asked questions"/"Away message" automations (Meta Business Suite → Inbox → Automations) are switched on for the Page or IG account, they can answer before ManyChat's flow. Keep Business Agent **off** for the Page/IG, and leave Ads Manager message template (ad level "Message template" / "Chat builder") minimal and matched to ManyChat's trigger (use ManyChat "Facebook Ads JSON" growth tool or ad-ID trigger). Do not enable Meta AI in the inbox.
- Performance goal: Engagement → Messaging apps → **"Maximize number of conversations"** is the standard; if available, **"Maximize number of leads" in messaging (Leads objective → Messaging apps, requires conversation-qualification/purchase signal events)** can be tested later once ManyChat sends lead events (via CAPI for Business Messaging). Mark this test as optional.
- The new Meta AI agentic assistant only acts with approval; do not grant it access to the account if the owner wants zero automatic changes. Also review "Opportunity score" recommendations and do not "Apply" auto-recommendations.

### Gaps
- No primary source found for 2026 changes to the "Conversations" performance goal itself, Instant Forms inside Messenger, or whether Business Agent auto-enables on Pages in Mexico/USA.

---

## 8. Budget policy/default changes

### Takeaway
Meta may spend **up to 75% above the daily budget** on a given day, capped at **7× daily budget per week** (calendar week). This rollout began **Nov 2023** (not 2025). It cannot be turned off; the only hard caps are a **campaign spending limit** or **account spending limit**, or using a lifetime budget.

### Cited Findings
- "We may spend up to 75% over your daily budget. On a weekly basis, we won't spend more than 7 times your daily budget" (previously 25%); article dated Nov 2, 2023; rolling out; no opt-out mentioned. — [Jon Loomer, Nov 2, 2023](https://www.jonloomer.com/updates-to-meta-ads-budgeting/); [Social Media Today](https://www.socialmediatoday.com/news/meta-changes-ad-budgets-charges-for-campaigns/758359/)
- Advantage+ campaigns moved from min/max ad set budget limits to an "average ad set spend limit." — [Jon Loomer QVT](https://www.jonloomer.com/qvt/ad-set-spending-limits-change/)
- Overspend glitch (AdExchanger): Meta said advertisers would not be charged if no impression occurred. — [AdExchanger](https://www.adexchanger.com/online-advertising/this-is-what-caused-metas-overspending-glitch) (date not confirmed)

### Inferences
- Recommendation: set **Account spending limit** (Billing & payments → Payment settings → Account spending limit) to the monthly maximum, and/or Campaign → Budget & schedule → **Campaign spending limit**. Daily budget e.g. MXN 200–400 per ad set; expect daily swings up to +75%.

### Gaps
- No 2025–2026 change to the 75% rule found.
