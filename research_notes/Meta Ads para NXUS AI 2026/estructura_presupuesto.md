# Meta Ads campaign structure and budgeting for click-to-message and B2B / high-ticket lead gen (2025-2026), applied to NXUS AI

Research date: 2026-11-06. Scope: structure, budget, learning phase, optimization goals, ads per ad set, scaling, MX/USA split, retargeting, case studies.
Caveat on sources: Meta's own Help Center pages (learning phase, Advantage campaign budget) could not be fetched directly in this session (the page body did not load). Meta's rules below are therefore taken from practitioners who quote Meta, mainly Jon Loomer. Many search results came from vendor blogs (LeadEnforce, respond.io, Coinis, Madgicx, Novoads). These are flagged where they are relied on.

Plan being evaluated: one campaign per country (MX $12/day, USA $20/day), one broad ad set each, 3 video ads (hooks A/B/C), Engagement → Messaging apps, ManyChat qualifying in Messenger/IG DM.

## 1. CBO vs ABO, consolidation, and creative-testing structures (small budgets)

### Takeaway
In 2025-2026 the consensus is to simplify: one campaign per goal, broad ad sets, and put the testing effort into ads. With one ad set per campaign, CBO vs ABO makes no difference to delivery, so NXUS's single-ad-set structure is consistent with current guidance. A separate creative-testing campaign is not justified at $12-20/day.

### Cited Findings
- Loomer (Aug 2025, updated Dec 2025): use one campaign per goal, keep ad sets broad, avoid multiple ad sets for targeting purposes, and use Advantage+ defaults. "The heavy lifting happens at the ad level." — [Jon Loomer, Meta Andromeda](https://www.jonloomer.com/meta-andromeda/)
- Meta (April 2025 blog, quoted by Loomer): "the focus has shifted from niche targeting to creative diversification." — [Jon Loomer, Meta Andromeda](https://www.jonloomer.com/meta-andromeda/)
- Practitioner summaries of Andromeda say successful advertisers "consolidate aggressively - fewer campaigns per objective, fewer ad sets per campaign, broader targeting." One vendor test reported that a single ad set with 25 diverse creatives produced 17% more conversions at 16% lower cost than a 5-ad-set structure. This is a single unverified vendor test. — [PPC Hero, Meta Campaign Structure in Andromeda Era](https://ppchero.com/?p=31064); [Dataslayer, 83 Meta changes 2025](https://www.dataslayer.ai/blog/meta-ads-changes-2025-83-updates-that-changed-facebook-advertising-forever)
- Heath Media's position (undated page): "For most advertisers and in most circumstances, Campaign Budget Optimization is going to work the best." — [Heath Media, CBO vs ABO](https://heathmedia.co.uk/?p=554973)
- Counterpoint: some 2026 guides recommend ABO for small-budget testing, arguing that "on a small budget, CBO is mostly reacting to noise." One B2B SaaS guide argues low conversion volume should keep you in ABO longer. — [Podvector, CBO vs ABO for small budget testing](https://podvector.ai/articles/ads/scaling-and-diagnosis/meta-ads-cbo-vs-abo-for-small-budget-testing); [GrowthSpree, CBO vs ABO for B2B SaaS 2026](https://www.growthspreeofficial.com/blogs/meta-cbo-vs-abo-b2b-saas-2026.md)
- A secondary summary of a 2026 Ben Heath video advises small-budget accounts to "keep the account simple: let automatic placements and the algorithm hunt for cheap conversions instead of hand-managing every ad set." — [echai.ventures summary of Ben Heath](https://echai.ventures/startingup/from/ben-heath-youtube)

### Inferences
- With one ad set per campaign, CBO and ABO deliver the same way. The debate only matters if NXUS later adds a second ad set, such as retargeting or Spanish-US.
- At $12-20/day, any split (several ad sets, or a separate testing campaign) divides already thin data. Keeping one ad set per country and testing creatives inside it is the right call.
- Separate campaigns per country are reasonable here. The two markets have different currencies, costs per result, languages, and probably creative. Separate budgets also guarantee MX is not starved by the US, or the reverse.

### Gaps
- Could not load Meta's official Advantage campaign budget help page to confirm current default behavior or minimums in 2026.
- No 2025-2026 controlled study on CBO vs ABO specifically for messaging objectives.

## 2. Learning phase: event threshold, resets, "Learning limited", small budgets

### Takeaway
The standard rule is still about 50 optimization events per ad set within 7 days. A lower threshold of 10 events within up to 3 days has been reported, but only in tests or for specific objectives (purchase, app installs). NXUS's budget will almost certainly sit in "Learning limited", and current expert guidance says that is acceptable, not fatal.

### Cited Findings
- Loomer (Oct 15, 2025): the common exit benchmark is 50 optimized events in 7 days. Ad sets that miss it show "Learning Limited," but "exiting learning isn't a death sentence." He calls the learning phase "just a label," notes the algorithm is always learning, and says good results can happen during learning. Significant edits can send an ad set back into learning: new ads, ad changes, targeting updates, or large budget increases. — [Jon Loomer podcast, "The learning phase is just a label"](https://pubcast.jonloomer.com/the-learning-phase-is-just-a-label/)
- Loomer (2025 short post, snippet only because the page returned 403): some advertisers saw Ads Manager track progress toward 10 conversions over up to 3 days instead of 50 over 7. "As far as I can tell, all of Meta's documentation still reflects 50 conversions and seven days." — [Jon Loomer, Is the Learning Phase Changing?](https://www.jonloomer.com/qvt/is-the-learning-phase-changing/)
- Madgicx (last updated June 9, 2024) says Meta lowered the threshold from 50 to 10 only for purchase-optimized and mobile-app-install campaigns, and not in all accounts. This is outdated (2024) and does not cover messaging. — [Madgicx](https://madgicx.com/blog/meta-lowers-learning-phase-requirement-for-select-campaigns)
- A 2026 agency guide still cites "about 50 optimization events within a 7-day window, per Meta's Business Help Center." — [Jetfuel Agency, 2026](https://jetfuel.agency/what-is-the-meta-ads-learning-phase-how-to-exit-it-faster-in-2026/)
- Loomer (July 2026, lead generation guide): "aim for at least 50 optimized events per ad set per week," and avoid structural changes that intentionally lower that number, especially early on. — [Jon Loomer, Meta Ads Lead Generation](https://www.jonloomer.com/meta-ads-lead-generation/)
- Adding ads no longer reliably resets learning. Loomer added one new ad to an ad set that already ran 22 ads and nothing happened, although Meta's Help Center still says new ads can reset learning. — [Dataslayer, 83 Meta changes 2025](https://www.dataslayer.ai/blog/meta-ads-changes-2025-83-updates-that-changed-facebook-advertising-forever)

### Inferences
- Example math: at $12/day ($84/week), exiting learning on 50 conversations needs a cost per conversation of about $1.68. At $20/day ($140/week), it needs about $2.80. That may be reachable in Mexico but is unlikely for a premium B2B audience in the US. If NXUS switches to optimizing for qualified leads, 50 per week is out of reach at either budget.
- Practical rule: expect "Learning limited", judge on cost per qualified lead and booked diagnostic, and avoid unnecessary edits during the first 7 days.

### Gaps
- No official Meta confirmation of the 10-event threshold for messaging or lead objectives as of Nov 2026.

## 3. Minimum viable daily budget for messaging (MX, USA), budget = X × target CPR, and how long to wait

### Takeaway
Meta has no official minimum for messaging that is relevant at these levels. Practitioner rules size each ad set's daily budget at about 2x the target cost per result, or at 50 × cost per result ÷ 7 if the goal is to exit learning. No reliable 2025-2026 cost-per-conversation benchmark for Mexico or the US was found. NXUS must measure its own.

### Cited Findings
- Rule of thumb for ABO: about 2x the target cost per result per day per ad set, run for 3 to 5 days. Rule for exiting learning: daily budget of 50 × cost per result ÷ 7. Both are practitioner rules, not Meta rules. — [Ryze, Meta ads minimum budget guide](https://www.get-ryze.ai/blog/meta-ads-minimum-budget-guide-starting-budget); [GrowthSpree, Meta Ads Budget for B2B SaaS 2026](https://www.growthspreeofficial.com/blogs/meta-ads-budget-b2b-saas-2026.md)
- LATAM vendor guidance (Spanish): there is no mandatory minimum, but start with at least $5-10 USD/day. Expect to need $300-500/month in LATAM for useful data and $1,000-3,000/month to optimize in markets like Mexico. Mexico CPC was about $0.35 for e-commerce and $0.80 for financial services. The figures are unsourced and the vendor's dates are inconsistent. — [Novoads, ¿Cuánto cuesta la publicidad en Meta?](https://novoads.ai/es/blog/cuanto-cuesta-publicidad-en-meta)
- HubSpot España gives CPM ranges of 2-8 USD by country and sector, with no Mexico breakdown. — [HubSpot ES, Meta Ads guide](https://blog.hubspot.es/marketing/meta-ads?1-star=1)
- Meta-wide 2025-2026 averages: CPC $0.62 and cost per lead $10.17, not broken out by country or messaging. — [Stackmatix, Meta Advertising Cost 2026](https://www.stackmatix.com/blog/meta-advertising-cost)
- Meta counts a "messaging conversation started" when someone messages the business for the first time, or after at least 7 days of inactivity, attributed to the ad. — [LeadEnforce](https://leadenforce.com/blog/how-to-find-the-right-metrics-for-click-to-message-ads-in-meta-ads-manager)

### Inferences
- NXUS's plan ($360/month MX, $600/month USA) sits near the bottom of the vendor's "useful data" band for LATAM and below typical US recommendations. It can work for click-to-message, but judging success needs patience.
- Suggested judging window: do not cut or edit before 7 days, and evaluate at about 14 days or when spend reaches 3-5x the target cost per qualified lead, whichever comes later. For example, with a target of $40 per qualified US lead, judge after about $120-200 of spend. This is an inference from the rules of thumb above, not a sourced rule.

### Gaps
- No credible 2025-2026 benchmark for cost per messaging conversation in Mexico City or the US for B2B services. Benchmarks must be built from NXUS's first 2-4 weeks of data.

## 4. Optimization goal: conversations vs leads vs conversions; Engagement vs Leads objective for quality

### Takeaway
Engagement with "Maximize number of conversations" optimizes for chat starts, which tends to bring cheap, low-intent chats. The stronger 2025-2026 practice is to send a qualification event from ManyChat to Meta through the Conversions API (LeadSubmitted when the ManyChat qualifier passes) and, once volume allows, optimize toward that event. Exact Ads Manager labels for messaging under the Leads objective are inconsistent across sources and should be verified in the account.

### Cited Findings
- "Maximize the number of conversations" is a performance goal under the Engagement objective with Messaging Apps as the conversion location. — [Actionera, click-to-direct ad for engagement](https://actionera.freshdesk.com/support/solutions/articles/69000872654-how-to-create-a-meta-click-to-direct-ctx-ad-for-engagement)
- Sources disagree on what the Leads objective offers for messaging:
  - Some list Messenger, Instagram, and WhatsApp as conversion locations. — [Coax](https://coax.com.au/channel/lead-ads); [Adsuploader](https://adsuploader.com/blog/how-to-create-facebook-lead-ads)
  - Loomer (July 2026) says the default conversion location is "Website and Instant Forms" and describes Messenger, Instagram, and WhatsApp as follow-up channels after an instant form. — [Jon Loomer, Meta Ads Lead Generation](https://www.jonloomer.com/meta-ads-lead-generation/)
  - One guide says to choose Engagement, not Leads, for a ManyChat-style chat funnel. — [Rework, Meta Ads WhatsApp funnel](https://resources.rework.com/guides/chat-funnel-setup/meta-ads-whatsapp-funnel)
  - An agency says the standalone Messages objective no longer exists and Leads is normally the stronger starting point. — [OnePPC Agency, Messenger Ads](https://oneppcagency.co.uk/facebook-ads/messenger-ads/)
- Meta extended the Leads objective to click-to-WhatsApp, positioned as a way to nurture higher-quality leads through messaging. — [Search Engine Land](https://searchengineland.com/meta-new-lead-generation-tools-facebook-instgram-434411); [Rework](https://resources.rework.com/news/chat-conversational/meta-click-to-whatsapp-performance-marketer)
- A click-to-message lead can be counted on the click or chat start alone, so Meta "doesn't know what a good lead looks like" without extra signals. — [respond.io, How to improve Meta lead quality](https://respond.io/blog/how-to-improve-meta-lead-quality)
- Cheap conversations can mask poor qualification. In one consultation example, chats came from "students, freelancers, competitors, or businesses too small for the offer." LeadEnforce recommends tracking cost per qualified conversation and cost per booked call, and moving the optimization event toward qualified leads, then purchases, as data grows (vendor opinion). — [LeadEnforce, cost per message can hide weak sales efficiency](https://leadenforce.com/blog/why-cost-per-message-can-hide-weak-sales-efficiency-in-messaging-ads); [LeadEnforce, more messages ≠ better](https://leadenforce.com/blog/why-more-messages-do-not-always-mean-better-click-to-message-ads)
- ManyChat supports the Conversions API natively. Connect it in Settings → Ads Optimization (Messenger/Instagram) with a Dataset ID and access token, then add the action "Send event to Meta Conversions API" at the conversion point in the flow. A community post says only LeadSubmitted and Purchase events are sent. — [ManyChat Help, CAPI integration](https://help.manychat.com/hc/en-us/articles/14580897414300-Conversions-API-CAPI-integration); [ManyChat community](https://community.manychat.com/general-q-a-43/ads-optimization-3661)
- Whether Meta ads can be optimized for a custom ManyChat event was asked in the ManyChat community in March 2025 and left unanswered. — [ManyChat community](https://community.manychat.com/general-q-a-43/can-i-optimize-fb-campaigns-for-mc-custom-conversion-event-5545)
- For forms, the "conversion leads" (quality) goal needs CRM data sent back through the Conversions API. A vendor reports about 19% lower cost per quality lead with it. Meta-reported figures (16% lower cost per quality lead; 21% higher lead-to-quality rate) are cited inconsistently across sources. — [Coinis](https://coinis.com/how-to/best-way-to-set-facebook-ads-objective-for-leads); [Search Engine Land](https://searchengineland.com/?p=432797); [LeadEnforce](https://leadenforce.com/blog/how-to-leverage-meta-advantage-lead-campaigns-for-higher-quality-leads)
- Loomer: don't assume a quality problem before data shows one. Fix internal follow-up first (response speed, booking ease), and use value rules to lower bids for groups that produce poor leads. Downstream-event optimization is worth it only with enough volume. — [Jon Loomer, Meta Ads Lead Generation](https://www.jonloomer.com/meta-ads-lead-generation/)

### Inferences
- Recommended path for NXUS:
  1. Start with Engagement → Messaging apps → Maximize conversations, because 50 qualified leads per week is impossible at this budget.
  2. From day one, fire LeadSubmitted through ManyChat CAPI when a lead passes qualification (decision-maker, restaurant chain or company size, budget, booked call). Fire it again or use Purchase-like events for "diagnostic booked."
  3. When qualified events reach about 10-20 per week, test a Leads or Sales campaign optimized for that CAPI event in Messenger/IG, if the account offers that combination.
- Put qualification inside ManyChat early (buttons such as "how many locations?") so tire-kickers drop out cheaply.

### Gaps
- Could not confirm from Meta documentation whether, in Nov 2026, the Leads objective with a Messenger/Instagram destination can optimize for a CAPI LeadSubmitted event from ManyChat. Verify in Ads Manager.
- No head-to-head data comparing lead quality from Engagement-conversations and Leads-messaging.

## 5. Ads per ad set, adding creatives, avoiding learning resets

### Takeaway
Meta removed its "no more than 6 ads per ad set" guidance in early 2025. Andromeda rewards meaningfully different concepts, not three hook variants of one video. At NXUS's budget, about 3-6 genuinely different ads per ad set is a sensible ceiling. More than that spreads too little spend per ad.

### Cited Findings
- Meta once recommended "no more than six ads" per ad set and removed the recommendation in February 2025. Loomer runs an ad set with 50 ads but advises "at least two or three ads per ad set," noting that 50 doesn't guarantee results. Diversity means different concepts, angles, formats, and personas, "not near-duplicates." — [Jon Loomer, Meta Andromeda](https://www.jonloomer.com/meta-andromeda/)
- HunchAds: Andromeda can handle more ads "only when budget supports proper learning," and diversification means different engagement patterns, not only visual differences. — [HunchAds, Meta Andromeda explained](https://www.hunchads.com/blog/meta-andromeda-explained)
- Practitioner ranges vary widely: 6-8 minimum and 15-25 optimal for accounts spending $5K+/month, 8-15+, or 25-50. — [Dataslayer](https://www.dataslayer.ai/blog/meta-ads-changes-2025-83-updates-that-changed-facebook-advertising-forever); [Generaxion](https://www.generaxion.com/get-inspired/meta-andromeda/)
- Adding one ad to a 22-ad ad set did not reset learning in Loomer's test. One source suggests batching new creative launches, for example monthly. — [Dataslayer](https://www.dataslayer.ai/blog/meta-ads-changes-2025-83-updates-that-changed-facebook-advertising-forever); [Scoreify](https://scoreify.beehiiv.com/p/meta-s-andromeda-update-everything-you-need-to-know-about-changes-in-ad-delivery-and-what-works-best)

### Inferences
- Three hooks on the same body may count as near-duplicates under Andromeda. Better: make hooks A/B/C different angles, for example pain (lost revenue or operations chaos), proof or case, and the founder or offer ("free 30-min diagnostic"). Add one static or carousel format.
- Add new ads in batches of 2-3 every 2-3 weeks, into the same ad set, rather than duplicating ad sets. Pause clear losers only after each ad has had meaningful spend, roughly 1-2x the target cost per qualified lead.

### Gaps
- No Meta-published number for ideal ads per ad set at low budgets.

## 6. Scaling: vertical vs horizontal, bid strategies for small accounts

### Takeaway
The "≤20% every 3-4 days" budget rule is practitioner folklore, not Meta documentation, but it is still the safe default. For small accounts, use Highest volume (no cap) until there is stable data. A cost-per-result goal or bid cap can choke delivery on thin budgets.

### Cited Findings
- No official Meta 20% threshold exists. It is a practitioner rule of thumb. Guides suggest raising budgets by no more than 20% every 3-4 days, or by under 10% per day while near learning. Duplicating an ad set to scale horizontally re-enters learning and can compete in the same auction. — [Relevant Audience, How to scale without resetting learning](https://www.relevantaudience.com/facebook-ads/how-to-scale-facebook-ads/); [GrowWithSakib, budget scaling framework](https://growwithsakib.com/how-to-scale-meta-ads/); [LeadEnforce](https://leadenforce.com/blog/the-right-way-to-increase-ad-budgets-without-resetting-learning)
- Loomer: high-performing ad sets can take bigger budget increases without triggering learning. Don't avoid important changes out of fear of learning. — [Jon Loomer podcast, Oct 2025](https://pubcast.jonloomer.com/the-learning-phase-is-just-a-label/)

### Inferences
- NXUS scaling path: once cost per qualified lead is acceptable for about 2 weeks, raise budget by 20-30% every 3-4 days (vertical). Add horizontal pieces (Spanish-US ad set, retargeting) only once the base campaign spends more than about $30-50/day.
- Bid strategy: Highest volume. Consider a cost-per-result goal only after 30+ results show a stable cost.

### Gaps
- No 2025-2026 sourced data on bid caps or cost caps for messaging objectives at small budgets.

## 7. Split MX vs USA; Spanish vs English; language targeting

### Takeaway
Splitting by country is justified. Language targeting is a hard constraint in Advantage+ Audience and matches the user's Facebook language setting. In the US, NXUS's ICP is mostly English-language business owners, so leave the language field empty or English and write copy in English. A Spanish-US ad set is optional later.

### Cited Findings
- Loomer: in Advantage+ Audience, location, minimum age, excluded custom audiences, and languages are hard constraints. Meta will not deliver outside them. — [Jon Loomer, Ultimate Guide to Meta Ads Targeting](https://www.jonloomer.com/meta-ads-targeting/)
- Language targeting at the ad set level reaches users whose Facebook language is set to that language, even if the ad copy differs. You can add Spanish text versions that override automatic translation. — [SaveMyLeads, Meta ads language targeting](https://savemyleads.com/blog/other/meta-ads-language-targeting); [Coinis, translate Facebook ad to Spanish](https://coinis.com/how-to/translate-facebook-ad-to-spanish)
- Meta's Ads Guide (quoted secondhand): language targeting is "most valuable when your target audience speaks a language not commonly spoken in your target location." — [Coinis, target by language](https://coinis.com/how-to/target-by-language-on-facebook-ads)
- March 2026: Advantage+ added AI language localization (dubbing) for video ads. — [Digital Applied, Advantage+ March 2026](https://www.digitalapplied.com/blog/meta-advantage-plus-march-2026-ai-dubbing-music-persona)

### Inferences
- Mexico: leave language empty (the market is Spanish by default) and use Spanish creative. Target premium neighborhoods with a pin radius plus Advantage+ Audience. Many affluent CDMX users set Facebook to English, so a Spanish language filter would wrongly exclude them.
- USA: English creative, no language filter. If Hispanic restaurant owners become a target, add a separate Spanish-language ad set once the budget allows.

### Gaps
- No official 2026 Meta page confirming language-field behavior. No data on how CDMX premium users set their app language.

## 8. Retargeting for messaging campaigns at small budgets

### Takeaway
No 2025-2026 source was found that specifically evaluates retargeting (messaged, video viewers, IG engagers) for small-budget click-to-message. Given consolidation guidance, a separate retargeting ad set at $12-20/day is likely premature.

### Cited Findings
- Consolidation guidance favors fewer ad sets, and Advantage+ already serves warm audiences inside broad ad sets. — [Jon Loomer, Meta Andromeda](https://www.jonloomer.com/meta-andromeda/)
- Loomer: avoid structural changes that lower events per ad set, especially early. — [Jon Loomer, Meta Ads Lead Generation](https://www.jonloomer.com/meta-ads-lead-generation/)

### Inferences
- Phase 2, after base spend reaches about $30-50/day per country: a small retargeting ad set (about 10-20% of budget) aimed at people who messaged but did not book, 50%+ video viewers, and IG engagers in the last 30-60 days, with proof or case-study creative. Before that, use ManyChat follow-up sequences, within Meta's 24-hour messaging window, as free "retargeting."
- Exclude people who already booked a diagnostic (a custom audience from CAPI or a ManyChat tag) to avoid wasted spend.

### Gaps
- No sourced 2025-2026 data on retargeting performance for messaging campaigns.

## 9. Case studies: B2B and service firms using click-to-message

### Takeaway
No published 2025-2026 case study was found reporting cost per qualified consultation for an agency or B2B firm using click-to-message. The available examples are older and vendor-reported.

### Cited Findings
- Cardinal Logistics (US transportation, recruiting) used Messenger and got 1.8x more quality leads at a 55% lower cost per qualified lead. This is older and from Meta's developer page. — [Meta for Developers, Messenger lead generation](https://developers.facebook.com/products/messenger/lead-generation/)
- HubSpot webinar test (B2B): Messenger ads cost about 70% less per lead than newsfeed lead ads. This is older and measured raw leads, not qualified leads. — [Customers.ai, Facebook Messenger ads examples](https://customers.ai/blog/facebook-messenger-ads-example)
- Customers.ai (vendor): cost per lead fell from $150-250 (traffic ads) to $3-6 with Messenger ads. This is a vendor self-report. — [IoT ONE case summary](https://leaders.iotone.com/case-study/scaling-leads-and-reducing-cpa-by-97-with-facebook-ads-and-chatbots-a-case-study-on-customers.ai-inc/c2511)
- Reddit r/FacebookAds (Jan 2026): a $5/day B2B lead campaign got 10 leads at $12 CPL, but about 60% were low quality (not decision-makers). — [Reddit snapshot](https://reddit.sentinel-team.org/subreddits/FacebookAds/snapshots/2026-01-31T03%3A41%3A34.699195Z)

### Inferences
- Expect cheap raw conversations but a low qualified rate. Plan around cost per booked diagnostic, not cost per conversation.

### Gaps
- No recent, independent case study for agency or high-ticket service click-to-message ads in Mexico or LATAM.

## Overall verdict on the NXUS plan (inferences, based on the findings above)
- Keep: one campaign per country, one broad ad set each, separate budgets, Engagement → Messaging apps → Maximize conversations to start, and Highest volume bidding.
- Change:
  - (a) Make the 3 videos different concepts, not just different hooks. Add a 4th format (static or carousel) if possible.
  - (b) Set up ManyChat CAPI LeadSubmitted when a lead qualifies, plus an event for "diagnostic booked," from day one.
  - (c) Add qualifying buttons early in the ManyChat flow.
  - (d) Don't touch the campaigns for 7 days, and judge at about 14 days on cost per qualified lead and cost per booked diagnostic.
  - (e) Accept "Learning limited."
  - (f) Do not apply a language filter in Mexico.
  - (g) Delay retargeting and a creative-testing campaign until budgets are about $30-50/day.
  - (h) Scale by 20-30% every 3-4 days once results are stable.
  - (i) Consider shifting some US budget to Mexico if Mexico's cost per qualified lead is much lower, since $20/day in the US may be too thin for premium B2B audiences.
