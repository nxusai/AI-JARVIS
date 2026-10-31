import { Config } from '@remotion/cli/config';
// WebGL para las piezas 3D.
Config.setChromiumOpenGlRenderer('angle');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
