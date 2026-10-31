# Fábrica de reels (marca personal)

Tus clips de Drive → 35 reels a la semana (5 al día), de máximo 10 segundos, con gancho o frase, efectos y, a veces, voz. Tú solo pones la canción en tendencia y publicas.

## Cómo funciona
1. Tú subes clips **sin hablar** a Drive, carpeta `1-Crudos`, con número: `1.mp4`, `2.mp4`, `3.mp4`… (nunca repitas un número).
2. Cada semana Claude:
   - baja los clips nuevos,
   - escribe los textos de la semana (`reels/textos/AAAA-MM-DD.json`): ganchos, frases motivacionales, narraciones y llamados a la acción, cada uno con su post,
   - genera las narraciones con Higgsfield (voz de narrador confiable),
   - corre `node fabrica/semana.mjs AAAA-MM-DD --render`,
   - sube todo a `2-Listos/Semana AAAA-MM-DD/<Día>/` y te avisa al celular.
3. Tú publicas en el orden de los números, con la canción en tendencia (al 10–15 % en los narrados).

## Reglas
- **Rotación:** un clip puede repetirse, pero solo después de al menos 4 reels con clips diferentes (`fabrica/rotacion.mjs`). Si hay menos de 5 clips, se separan lo más posible y se avisa.
- Cuando un clip se repite, empieza en otro segundo y lleva otro texto, otra cámara y otros efectos.
- Nunca más de 10 segundos. Sin música (la pones tú); solo whoosh e impactos suaves.

## El día
| Hora | Tipo |
|---|---|
| 09:00 | Gancho |
| 12:00 | Frase motivacional |
| 15:00 | Narrado (días impares) o gancho |
| 18:00 | Frase motivacional |
| 21:00 | Llamado a la acción "Comenta JARVIS" o narrado |

## Efectos (`reels/src/efectos/`)
- `Camara.tsx` — movimientos de cámara fluidos: acercamiento, paneo, cámara que sigue (follow that camera) y órbita, con entrada en zoom rápido y color de cine.
- `Texto.tsx` — tipografía cinética (palabras que caen) y letras que se estiran; subtítulos palabra por palabra para la voz.
- `Formas.tsx` — manchas de luz y aro que se transforman (morphing).
- `Pieza3D.tsx` — cristal o aro en 3D real (Three.js).
- `Cine.tsx` — barras de cine, grano, viñeta, destello de luz y flashes.

## Comandos (dentro de `reels/`)
```bash
npm install
```
```bash
node fabrica/muestras.mjs
```
```bash
node fabrica/semana.mjs 2026-11-02
```
```bash
node fabrica/semana.mjs 2026-11-02 --render
```
Para ver y mover los efectos en vivo en tu Mac:
```bash
npm run estudio
```

Remotion es gratis para personas y empresas de hasta 3 empleados; si NXUS pasa de 3, hace falta su licencia de empresa.
