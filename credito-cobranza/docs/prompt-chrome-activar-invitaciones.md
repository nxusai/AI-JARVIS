Vas a ayudarme a activar las invitaciones por correo de mi sistema. Trabaja SOLO en:
- Supabase: organización "Credito y Cobranza", proyecto "credito-cobranza".
- Netlify: sitio "credito-cobranza-demo".
No abras ni toques otros proyectos, sitios u organizaciones. No cambies nada que no esté en esta lista.

REGLA DE SEGURIDAD MÁS IMPORTANTE:
Hay una clave secreta de Supabase (empieza con "sb_secret_"). Tú NUNCA la revelas, la copias, la lees, la escribes, la pegas ni la muestras en el chat o en capturas. Ese manejo lo hago yo con mis manos. Cuando llegue ese momento, te DETIENES, me explicas exactamente qué hacer y esperas a que te escriba "listo". Mientras yo trabajo con la clave no tomes capturas de pantalla ni leas la página. Cuando te diga "listo", sigue sin leer el valor de ningún campo.

Cada vez que me pidas hacer algo, dime en pasos numerados: en qué pestaña estoy, qué botón o campo busco (con el texto exacto que veré), qué copio o qué escribo, y de dónde sale. Después espera mi "listo".

PASO A — Revisar la dirección del sitio en Supabase (lo haces tú)
1. Abre el proyecto "credito-cobranza" → Authentication → URL Configuration.
2. Revisa que "Site URL" sea exactamente: https://credito-cobranza-demo.netlify.app
   Si es otra cosa, cámbiala a esa y guarda.
3. En "Redirect URLs", si no está https://credito-cobranza-demo.netlify.app/** agrégala y guarda.
   No borres ninguna que ya exista.
4. Dime qué había y qué cambiaste (si cambiaste algo).

PASO B — Dejar listas las dos pantallas (lo haces tú)
1. En una pestaña de Supabase abre: Project Settings → API Keys. Quédate en la sección donde aparecen las "Secret keys". NO des clic para revelar ni copiar.
2. En otra pestaña de Netlify abre el sitio "credito-cobranza-demo" → Site configuration → Environment variables.
   Revisa si ya existe una variable llamada SUPABASE_SECRET_KEY. Si existe, sólo dímelo y salta al PASO D.
3. Da clic en "Add a variable" → "Add a single variable".
4. En el campo "Key" escribe exactamente: SUPABASE_SECRET_KEY
5. Si aparece la casilla "Contains secret values", márcala. Si no aparece o pide pagar, déjala así y dímelo.
6. Deja "Scopes" y los "Values" en lo que venga por defecto ("All scopes" / "Same value for all deploy contexts"). No escribas nada en el campo del valor.
7. DETENTE y pásame al PASO C.

PASO C — Esto lo hago YO (tú sólo me guías y esperas)
Explícame estos pasos y espera mi "listo" sin mirar la pantalla:
1. Ir a la pestaña de Supabase (API Keys), buscar la Secret key llamada "default" (empieza con sb_secret_) y dar clic en el ícono de copiar. Si sólo hay un botón para revelarla, revelarla y copiarla.
2. Ir a la pestaña de Netlify, dar clic en el campo del valor (Value) de SUPABASE_SECRET_KEY, pegar con Ctrl+V (Cmd+V en Mac) y dar clic en "Create variable".
3. Escribirte "listo".

PASO D — Publicar de nuevo el sitio (lo haces tú)
1. En Netlify, sitio "credito-cobranza-demo" → Deploys → "Trigger deploy" → "Deploy site".
2. Espera a que el deploy diga "Published" (o "Ready"). Si falla, DETENTE y dame el error.

PASO E — Comprobar (lo haces tú; sólo lectura)
1. Abre en una pestaña nueva: https://credito-cobranza-demo.netlify.app/.netlify/functions/invitar
2. Dime el texto exacto que aparece:
   - Si dice "Método no permitido." → la clave ya quedó. Así debe ser.
   - Si dice "Las invitaciones aún no están activadas en el servidor." → la clave no quedó. Revisa en Environment variables que el nombre sea exactamente SUPABASE_SECRET_KEY (sin espacios), pero no abras ni leas su valor. Dime lo que veas.

PASO F — Primera invitación de prueba (la hago YO)
Explícame:
1. Entrar a https://credito-cobranza-demo.netlify.app con mi usuario.
2. Ir a Administración → Usuarios → "Invitar usuario".
3. Poner un nombre, un correo mío distinto al que uso para entrar, cargo "Consulta / auditoría", ámbito "Toda la empresa", y dar "Enviar invitación".
4. Abrir ese correo y dar clic al enlace. Me lleva al sistema para crear la contraseña.
Recuérdame que el correo puede tardar unos minutos o caer en spam, y que Supabase sólo manda pocos correos por hora mientras no se configure un servicio propio de correo.

Al final dame un resumen corto: qué cambiaste en cada paso y qué texto salió en el PASO E. No incluyas ninguna clave.
