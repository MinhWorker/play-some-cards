import Phaser from 'phaser';
import { titleStyle } from '@/phaser/assets';

const WORDS = ['Chơi', 'Chút', 'Bài'];
const TEXT_SIZE = 84;
const ROPE = 70;

/**
 * The game's name, one word at a time, each floating up and down on its own and pulled up by
 * a little bird on an ivy rope. Lives in the sky scene (between the sky and the
 * clouds) so clouds drift in front of it.
 */
export class Title extends Phaser.GameObjects.Container {
  /** Full width of the title in local units (Container has no size of its own). */
  readonly span: number;
  /** Local y of the birds' top edge (negative, above the text). */
  readonly top: number;
  /** Local y of the text's bottom edge. */
  readonly bottom: number;

  constructor(scene: Phaser.Scene) {
    super(scene);
    const texts = WORDS.map((w) => scene.add.text(0, 0, w, titleStyle(TEXT_SIZE)).setOrigin(0.5));
    const gap = TEXT_SIZE * 0.3;
    this.span = texts.reduce((sum, t) => sum + t.width, 0) + gap * (texts.length - 1);
    const textHeight = texts[0]?.height ?? TEXT_SIZE;
    // Where a rope meets its word: just at the top of the letters (text boxes have padding).
    const textTop = -textHeight / 2 + TEXT_SIZE * 0.35;
    let birdTop = 0;
    let x = -this.span / 2;

    // Every word is pulled up by its own bird.
    texts.forEach((text, i) => {
      const word = scene.add.container(x + text.width / 2, 0);
      x += text.width + gap;
      // Tie the rope above the first letter (C, C, B): the other letters carry diacritics.
      const knotX = -text.width / 2 + TEXT_SIZE * 0.32;
      // -1 left, 0 middle, 1 right: outer ropes lean outward.
      const side = Math.sign(i - (texts.length - 1) / 2);
      const vine = scene.add
        .image(knotX, textTop, 'vine')
        .setOrigin(0.5, 1)
        .setAngle(side * 4);
      // Keep the vine's natural thickness and show only a ROPE-long piece of it.
      const vineScale = 20 / vine.width;
      const piece = Math.min(vine.height, ROPE / vineScale);
      vine.setScale(vineScale).setCrop(0, vine.height - piece, vine.width, piece);
      const bird = scene.add.image(knotX + side * 6, textTop - ROPE, 'bird').setFlipX(i % 2 === 1);
      bird.setScale(80 / bird.width);
      // The feet sit near the bottom of the image; hang the rope from them.
      bird.y -= bird.displayHeight * 0.4;
      birdTop = Math.min(birdTop, bird.y - bird.displayHeight / 2);
      // A magic light orb hides the knot where the rope meets the word.
      const orb = scene.add.image(knotX, textTop, 'orb').setDisplaySize(46, 46);
      word.add([vine, bird, text, orb]);
      // Wings flap: a quick squash.
      scene.tweens.add({
        targets: bird,
        scaleY: bird.scaleY * 0.82,
        duration: 140 + i * 10,
        yoyo: true,
        repeat: -1,
      });
      scene.tweens.add({
        targets: orb,
        scale: orb.scale * 1.15,
        alpha: 0.8,
        duration: 900 + i * 60,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
      this.add(word);

      // Each word floats on its own rhythm.
      scene.tweens.add({
        targets: word,
        y: { from: -6, to: 6 },
        duration: 1300 + i * 370,
        delay: i * 250,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    });

    this.top = birdTop - 6;
    this.bottom = textHeight / 2 + 6;
  }
}
