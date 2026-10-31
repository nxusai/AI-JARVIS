# Build instructions for Claude in Chrome: the same lead filter on Facebook (Messenger)

You are working in Eduardo's ManyChat account **NXUS AI** (https://app.manychat.com), in his own logged-in Chrome tab. Eduardo is watching. The Instagram version already works and is **Live**: **Filtro NXUS** and **INFO comentarios**. Build the same thing for the **Facebook Page** (Messenger), as two **new** automations. The full Instagram spec is in https://github.com/nxusai/AI-JARVIS/blob/claude/jarvis-project-setup-gs6uu2/docs/manychat-construccion.md: read it first; everything below says only what changes.

## Ground rules
- **Do not change, unpublish or rename the Instagram automations** (Filtro NXUS, INFO comentarios). Only read them to copy texts and settings.
- **Never type passwords or keys.** In the two External Requests, leave the `x-manychat-clave` header value empty: Eduardo types it (it is the same key the Instagram automations use).
- **Do not click Set Live** until Eduardo says so. Report in Spanish after each part. If something doesn't match, stop and ask Eduardo.

## Part 0 — Check the channel
1. **Settings → Channels → Messenger**: confirm the NXUS AI Facebook Page is connected. If it is not, stop and tell Eduardo (he connects it himself).
2. If ManyChat offers a way to **duplicate** an automation into another channel, tell Eduardo before using it; otherwise build from scratch as below.

## Part 1 — "Filtro NXUS · Facebook"
**Automation → + New Automation → + Start From Scratch → blank.** Name: `Filtro NXUS · Facebook`. Build it exactly like Filtro NXUS (parts 1 to 7 of manychat-construccion.md, with the current texts you see in the Instagram automation — they were adjusted after that file was written, so the Instagram automation wins when they differ), with these changes:
- Every message node is **Messenger**, not Instagram.
- Triggers: **Messenger → User sends a message**: (1) keyword `INFO` (rule *Message contains*), (2) **Recognize the intention of a message** with the same intention text as Instagram.
- The first Actions step: Set User Field `canal` = `facebook`; `fuente` = `Facebook DM` (keep the same Condition "fuente is unknown" before it, like Instagram).
- AI Step: same Goal, Context and tasks as the Instagram one; channel Messenger.
- Aviso 1 a HQ and Aviso 2 a HQ: identical (same URL, body, response mapping), header value empty.
- Everything else (language question, questions, consent text word for word, final messages, 23-hour expiry, no SMS/email/WhatsApp opt-ins) is identical.

## Part 2 — "INFO comentarios · Facebook"
1. New automation from scratch, name `INFO comentarios · Facebook`.
2. **+ New Trigger → Facebook → User comments on your post** → any post → keyword `INFO` → only first-level comments → public replies (the same three texts as Instagram) → Save.
3. First step: a **Messenger** message marked as **Comment Reply** (mandatory on Facebook), with only one text and one quick reply button `Empezar / Start`, same text as the Instagram private reply.
4. The button leads to Actions: `canal` = `facebook`, `fuente` = `Facebook comentario`.
5. Then **Start Automation** → it can only pick published automations, so leave it empty until Filtro NXUS · Facebook is Live; tell Eduardo.

## Part 3 — Report
In Spanish: what you built, what differs from Instagram, and remind Eduardo to (1) type the key in both External Request headers, (2) Set Live Filtro NXUS · Facebook, (3) pick it in Start Automation of INFO comentarios · Facebook and Set Live that one too.
