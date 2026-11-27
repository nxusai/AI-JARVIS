# Prompt para Claude in Chrome · SQL 14 (sólo mesa autoriza)

```
Trabaja SOLO en Supabase, organización "Credito y Cobranza", proyecto "credito-cobranza". No abras ni toques ningún otro proyecto u organización. No copies, muestres ni escribas contraseñas ni claves secretas en ningún lado. No cambies ninguna otra configuración.

Objetivo: correr UN archivo SQL en el SQL Editor del proyecto: 14_solo_mesa.sql

1. Abre en otra pestaña: https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/14_solo_mesa.sql
2. Da clic en "Raw" y pon el archivo COMPLETO, sin cambiar nada, en una consulta nueva del SQL Editor ("New query"). Comprueba que el texto del editor sea igual al archivo (empieza con "-- Sistema de crédito y cobranza · sólo mesa de control autoriza" y termina con "as mesa_decide_excepciones;").
3. Da clic en "Run". Si aparece "destructive operation" o "Run and enable RLS", elige la opción que corre la consulta (es esperado: cambia permisos y una regla; no borra datos).
4. Espera el resultado. Si sale un error, DETENTE, no lo arregles y dame el mensaje exacto.

Al final el mismo archivo muestra una fila de verificación. Dame el resultado completo; debe decir: mesa_autoriza 2 · otros_autorizan 0 · mesa_decide_excepciones 1.
No guardes la consulta. Cierra la pestaña de GitHub.
```
