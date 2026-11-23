# Prompt para Claude in Chrome · SQL 11 (renovaciones sin volver a subir todo)

```
Trabaja SOLO en Supabase, organización "Credito y Cobranza", proyecto "credito-cobranza". No abras ni toques ningún otro proyecto u organización. No copies, muestres ni escribas contraseñas ni claves secretas en ningún lado. No cambies ninguna otra configuración.

Objetivo: correr UN archivo SQL en el SQL Editor del proyecto: 11_renovacion_documentos.sql

1. Abre en otra pestaña: https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/11_renovacion_documentos.sql
2. Da clic en "Raw" y pon el archivo COMPLETO, sin cambiar nada, en una consulta nueva del SQL Editor ("New query"). Comprueba que el texto del editor sea igual al archivo (empieza con "-- Sistema de crédito y cobranza · renovaciones sin volver a subir todo" y termina con "as dias_comprobante;").
3. Da clic en "Run". Si aparece "destructive operation" o "Run and enable RLS", elige la opción que corre la consulta (es esperado: cambia una regla de la tabla de documentos; no borra archivos ni datos).
4. Espera el resultado. Si sale un error, DETENTE, no lo arregles y dame el mensaje exacto.

Al final el mismo archivo muestra una fila de verificación. Dame el resultado completo; debe decir: columna_origen 1 · regla_renovacion 1 · dias_comprobante 90.
```
