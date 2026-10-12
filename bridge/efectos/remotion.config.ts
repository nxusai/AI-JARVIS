import { Config } from '@remotion/cli/config';
// WebGL for the 3D pieces.
Config.setChromiumOpenGlRenderer('angle');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
