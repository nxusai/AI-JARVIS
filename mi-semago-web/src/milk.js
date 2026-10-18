// Fondo del hero en WebGL: leche que se arremolina sobre azul marino, con vetas de oro que siguen al cursor.
// Se dibuja a media resolución y se pausa fuera de pantalla. Sin WebGL, queda el degradado de CSS.
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `precision highp float;
uniform vec2 r; uniform float t; uniform vec2 m;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; mat2 R = mat2(.8, .6, -.6, .8); for (int i = 0; i < 5; i++) { v += a * n(p); p = R * p * 2.02; a *= .5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / r; vec2 p = (gl_FragCoord.xy - .5 * r) / r.y;
  vec2 mm = (m - .5) * vec2(r.x / r.y, 1.);
  float d = length(p - mm);
  vec2 q = vec2(fbm(p * 1.6 + t * .05), fbm(p * 1.6 - t * .04 + 3.1));
  vec2 w = vec2(fbm(p * 1.4 + 2. * q + vec2(1.7, 9.2) + t * .07 + .4 * exp(-d * 2.5)), fbm(p * 1.4 + 2. * q + vec2(8.3, 2.8) - t * .05));
  float f = fbm(p * 1.2 + 2.4 * w);
  vec3 navy = vec3(.024, .102, .22), deep = vec3(.043, .17, .34), milk = vec3(.98, .965, .93), gold = vec3(.86, .7, .32);
  vec3 c = mix(navy, deep, smoothstep(.2, .8, f));
  float swirl = smoothstep(.62, .95, f + .25 * w.x);
  c = mix(c, milk, swirl * .32);
  float vein = smoothstep(.02, .0, abs(f - .58 - .05 * sin(t * .3))) * (.5 + .5 * w.y);
  c += gold * vein * (.55 + .8 * exp(-d * 3.));
  c += gold * .08 * exp(-d * 4.);
  c *= .75 + .35 * smoothstep(1.3, .1, length(uv - vec2(.7, .55)));
  gl_FragColor = vec4(c, 1.);
}`;

export function milk(canvas, { reduced }) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return false;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VERT); const fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return false;
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(pr, 'r'); const uT = gl.getUniformLocation(pr, 't'); const uM = gl.getUniformLocation(pr, 'm');
  const mouse = { x: 0.7, y: 0.55 }; const cur = { x: 0.7, y: 0.55 };
  const size = () => { const k = Math.min(devicePixelRatio || 1, 2) * 0.5; canvas.width = Math.max(1, canvas.clientWidth * k); canvas.height = Math.max(1, canvas.clientHeight * k); gl.viewport(0, 0, canvas.width, canvas.height); };
  size(); addEventListener('resize', size);
  addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) / r.width; mouse.y = 1 - (e.clientY - r.top) / r.height; });
  const frame = (time) => {
    cur.x += (mouse.x - cur.x) * 0.04; cur.y += (mouse.y - cur.y) * 0.04;
    gl.uniform2f(uR, canvas.width, canvas.height); gl.uniform1f(uT, reduced ? 12 : time); gl.uniform2f(uM, cur.x, cur.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  canvas.classList.add('on');
  return frame;
}
