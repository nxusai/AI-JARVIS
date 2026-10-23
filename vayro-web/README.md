# VAYRO · Food built for the way you live

Website for **VAYRO**, a premium, high-protein food brand. One page with scroll animations
(GSAP + Lenis), designed for phones, tablets and desktop, in **English and Spanish**
(EN/ES toggle; it follows the visitor's browser language on first visit).

## Sections

| Section | What it does |
|---|---|
| **Loader + hero** | The V mark assembles, then "Food built for the way you live." The Fresh Cheese lid floats, tilts with the mouse and rotates away on scroll |
| **Marquee** | Real food / Modern life / Made for more… speeds up with scroll |
| **This is VAYRO** | Manifesto that lights up word by word, plus three brand pillars |
| **Line-up · Chapter 01: Cheese** | The 5 SKUs with their real labels. Horizontal pinned scroll on desktop, swipe on phones. Ends with a "Chapter 02" card so the brand reads as bigger than cheese |
| **Product drawer** | Sizes, overview, recipes, a full Nutrition Facts panel and ingredients, all taken from the labels |
| **Nutrition** | Counters (up to 10g protein, up to 30% DV calcium, 0g added sugar, ≤4g carbs) and a "Build your fuel" calculator |
| **Lifestyle** | Train / Prep / Live panels with parallax |
| **Recipes** | 6 recipes with filters (pre-workout, post-workout, meal prep, family) and a full recipe view |
| **Story & philosophy** | The meaning of the V mark and the brand values |
| **Community** | #MadeForMore grid linking to Instagram |
| **Retailers** | Formats (12 oz retail, 2–3 lb club, 5 lb foodservice) and a wholesale form |
| **Where to buy** | ZIP search (reads `stores` in `src/data.js`) and "Request VAYRO at your store" |
| **Join + contact** | Newsletter and contact form |

Also included: SEO structured data (Organization + Products), share image, favicon/app icons,
keyboard access, and "reduce motion" support.

## Editing content

Almost everything lives in **`src/data.js`**: emails, social links, form endpoints, products
and nutrition, recipes, stores and the gallery. Anything marked `CONFIRM` is a placeholder.
Spanish text is in **`src/i18n.js`**; English text is in `index.html`.

- **Forms:** with no endpoint set, each form opens the visitor's email app with the message
  filled in. Paste a Formspree/Netlify/CRM URL into `site.forms` to receive submissions directly.
- **Stores:** add entries to `stores` and the ZIP search starts returning them (matched by the
  first three digits of the ZIP).
- **Images:** product shots are in `public/img/products/` (the approved labels applied to the
  real product photos; the label's grey areas are clear windows that show the cheese), lifestyle photos in `public/img/life/` (Unsplash License). Replace a file with
  one of the same name to swap it.

## Run it

```bash
npm install
npm run dev       # local development
npm run build     # production build in dist/
npm run preview   # serve the build
```

Deploys as-is to Netlify (`netlify.toml`) or Vercel (`vercel.json`).
