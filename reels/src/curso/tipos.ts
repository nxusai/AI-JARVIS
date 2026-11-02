// Lo que cursos/leccion.mjs le pasa a una lección ya armada (todo en cuadros, a 30 fps).

export type Palabra = { texto: string; inicio: number; fin: number };

export type Pantalla = {
  /** Grabación (.webm) o captura (.png) en public/. */
  src: string;
  esImagen?: boolean;
  /** Segundo de la grabación donde empieza (ya con la página cargada). */
  desde: number;
  /** 1 = normal; menos = más lento, para que la grabación alcance. */
  velocidad?: number;
  /** Cuadro de la escena donde entra y cuántos dura. */
  inicio: number;
  dur: number;
  etiqueta: string;
  descripcion?: string;
  url?: string;
  /** Acercamiento a una zona (en % de la pantalla), desde/hasta en cuadros de la pantalla. */
  zoom?: { x: number; y: number; escala: number; desde: number; hasta: number };
};

export type Escena = {
  tipo: 'intro' | 'pantallas' | 'final';
  inicio: number;
  dur: number;
  voz: string;
  /** Cuadro de la escena donde empieza la voz. */
  vozDesde: number;
  /** Palabras con tiempos en segundos, relativos al inicio de la escena. */
  palabras: Palabra[];
  bloque?: { numero: number; nombre: string };
  pantallas?: Pantalla[];
  /** Final: cuándo (cuadros) se prende cada bloque, y miniaturas. */
  marcas?: number[];
  miniaturas?: string[];
};

export type LeccionProps = {
  curso: string;
  numero: number;
  titulo: string;
  bloques: string[];
  musica: string;
  total: number;
  escenas: Escena[];
};
