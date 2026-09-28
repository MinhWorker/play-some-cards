import Phaser from 'phaser';
import { currentFrame, FRAME, type Frame } from './frame.js';

/**
 * Points a scene's camera at the frame, now and whenever it changes, and keeps its text sharp:
 * a Text is drawn into its own texture, so it gets the camera's zoom as its resolution. `onChange`
 * runs after a change of the frame (lay the scene out again). Stops when the scene shuts down.
 */
export function followFrame(scene: Phaser.Scene, onChange?: () => void) {
  let resolution = 1;
  const sharpen = (obj: Phaser.GameObjects.GameObject) => {
    if (obj instanceof Phaser.GameObjects.Text) {
      if (obj.style.resolution !== resolution) obj.setResolution(resolution);
    } else if (obj instanceof Phaser.GameObjects.Container) {
      for (const child of obj.list) sharpen(child);
    }
  };
  const apply = () => {
    const frame = (scene.registry.get(FRAME) as Frame | undefined) ?? currentFrame();
    const camera = scene.cameras.main;
    camera
      .setViewport(0, 0, frame.canvas.width, frame.canvas.height)
      .setOrigin(0, 0)
      .setZoom(frame.zoom)
      .setScroll(frame.bleed.left, frame.bleed.top);
    resolution = Math.min(4, Math.max(1, Math.ceil(frame.zoom * 4) / 4));
    for (const obj of scene.children.list) sharpen(obj);
  };
  const onFrame = () => {
    apply();
    onChange?.();
  };
  const onAdded = (obj: Phaser.GameObjects.GameObject) => sharpen(obj);
  apply();
  scene.registry.events.on(`changedata-${FRAME}`, onFrame);
  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.registry.events.off(`changedata-${FRAME}`, onFrame);
    scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
  });
}
