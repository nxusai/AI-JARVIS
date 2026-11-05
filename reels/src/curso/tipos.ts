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
  /** Resultado de la herramienta en vez de una grabación: se muestra grande, sin navegador. */
  resultado?: 'imagen' | 'video' | 'audio' | 'chat' | 'telefono' | 'flujo' | 'paquetes';
  /** Paquetes: nombre, precio, qué incluye y cuál se recomienda. */
  paquetes?: { nombre: string; precio: string; incluye: string[]; destacado?: boolean; insignia?: string }[];
  /** Teléfono: la conversación (comentario público, cliente o agente) y el nombre de la cuenta. */
  mensajes?: { de: 'cliente' | 'agente' | 'comentario'; texto: string; boton?: string }[];
  cuenta?: string;
  /** Debajo del nombre de la cuenta (por omisión, 'Agente automático'). */
  subcuenta?: string;
  /** Flujo: los pasos del diagrama. */
  nodos?: { icono: string; titulo: string; sub?: string }[];
  /** Para un chat: lo que se le pide a Claude y su respuesta, línea por línea ('# ' = título). */
  pregunta?: string;
  respuesta?: string[];
  /** Para un resultado de audio: el texto que se oye. */
  texto?: string;
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
  /** Un audio de ejemplo que suena después de la narración (cuadro de la escena). */
  sonido?: { src: string; desde: number };
  pantallas?: Pantalla[];
  /** Final: cuándo (cuadros) se prende cada bloque, y miniaturas. */
  marcas?: number[];
  miniaturas?: string[];
};

export type LeccionProps = {
  curso: string;
  numero: number;
  titulo: string;
  /** La palabra en 3D de la intro. */
  tituloIntro?: string;
  bloques: string[];
  musica: string;
  total: number;
  escenas: Escena[];
};
