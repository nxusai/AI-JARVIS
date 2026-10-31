// Lo que la fábrica le pasa a cada reel.

export type Tipo = 'gancho' | 'frase' | 'narrado';
export type Camara = 'empuje' | 'paneo' | 'seguir' | 'orbita';
export type Letras = 'cinetico' | 'estirar';
export type Pieza3D = 'cristal' | 'anillo' | 'ninguna';

export type Palabra = { texto: string; inicio: number; fin: number };

export type ReelProps = {
  tipo: Tipo;
  /** El clip (o una imagen) en public/, por nombre. */
  clip: string;
  esImagen?: boolean;
  /** Desde qué segundo del clip empieza, para que una repetición no se vea igual. */
  desdeSegundo?: number;
  /** Segundos, máximo 10. */
  duracion: number;
  /** El gancho o la frase. */
  texto: string;
  /** Palabras que van en color. */
  resaltar?: string[];
  /** Línea chica al final: "Comenta JARVIS", "Guárdalo para después"… */
  remate?: string;
  /** Usuario de Instagram, abajo. */
  firma?: string;
  camara?: Camara;
  letras?: Letras;
  formas?: boolean;
  pieza3D?: Pieza3D;
  /** Barras de cine, grano y destello de luz. */
  cine?: boolean;
  /** Narración (audio en public/) y sus palabras con tiempos, para los subtítulos. */
  voz?: string;
  palabras?: Palabra[];
  /** Whoosh e impactos, en public/. */
  sonidos?: { whoosh?: string; impacto?: string };
  /** Cambia el color de acento y el movimiento de las formas entre reels. */
  semilla?: number;
};

export const COLORES = {
  fondo: '#050914',
  cian: '#00e5ff',
  azul: '#0a6cff',
  violeta: '#a01cff',
  ambar: '#ffb547',
  texto: '#ffffff',
};

/** El acento de cada reel, para que el feed no se vea igual. */
export const acento = (semilla = 0) => [COLORES.cian, COLORES.ambar, COLORES.violeta, COLORES.cian, '#2fd38a'][Math.abs(semilla) % 5];
