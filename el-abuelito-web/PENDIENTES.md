# Pendientes · El Abuelito

Sitio en línea: https://www.abuelitoinc.com (proyecto `el-abuelito` en Vercel; DNS en Squarespace).

## IA del Abuelito
- [ ] Sacar la llave en https://console.anthropic.com (**API Keys → Create Key**) y cargar saldo en **Billing**.
- [ ] En Vercel → proyecto **el-abuelito** → **Settings → Environment Variables**: agregar `ANTHROPIC_API_KEY`.
- [ ] **Deployments** → los tres puntitos del último deploy → **Redeploy**.
- [ ] Probar que el chat conteste con la IA real. Hoy contesta el asistente local (`/api/chat` responde 503 «AI not configured»).

## Confirmar con el cliente
- [ ] Correo de contacto: `contacto@abuelitocheese.com` o `gerardom@abuelitocheese.com`.
- [ ] ¿Siguen vendiendo los 12 productos del sitio viejo que no están en Bolt? (Panela con Jalapeño, Tortilla de Nixtamal, Caja Mixta de Postres, Pudín, entre otros).
- [ ] Fechas reales para la línea del tiempo de la historia.
- [ ] ¿El formulario de contacto debe llegarles directo, en vez de abrir el correo?
- [ ] Revisión legal de los textos de calidad, por el caso de listeria de 2026.

## Dominio y correo (abuelitoinc.com)
- [x] Nameservers de vuelta a Squarespace; A `@` → 216.198.79.1 y CNAME `www` → Vercel. Sitio con HTTPS.
- [x] Correo de Google intacto (MX de Google + SPF). DKIM publicado.
- [ ] En https://admin.google.com/ac/apps/gmail/authenticateemail hacer clic en **Start authentication** (si dice "Not authenticating").
- [ ] Agregar DMARC: TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:CORREO@abuelitoinc.com` (falta saber el correo).
- [ ] Definir el correo para invoices y adeudos, y ponerlo en el sitio.

## Lanzamiento
- [ ] Pasar la cuenta de Vercel al plan Pro (es un sitio comercial).
