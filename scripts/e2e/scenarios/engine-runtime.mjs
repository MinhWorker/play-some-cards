// Real Phaser/Web Audio wiring, including races which deterministic SDK unit clocks cannot cover.
import { resolve } from 'node:path';
import { DESKTOP } from '../lib.mjs';

export const games = [
  'co-ca-ngua',
  'tic-tac-toe',
  'xiangqi',
  'tien-len',
  'mau-binh',
  'co-ty-phu-classic',
];

function wav(seconds = 0.5) {
  const rate = 8000;
  const samples = Math.ceil(rate * seconds);
  const data = Buffer.alloc(44 + samples * 2);
  data.write('RIFF');
  data.writeUInt32LE(data.length - 8, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(samples * 2, 40);
  return data;
}

export default async function run(t) {
  const page = await t.page(DESKTOP);
  await page.goto(`${t.url}/?play=co-ca-ngua&players=2`);
  await page.waitForFunction(() => window.__phaser?.scene.isActive('co-ca-ngua'));
  await page.evaluate(
    async (sdkUrl) => {
      const { SceneRuntime, clientHost } = await import(sdkUrl);
      const scene = window.__phaser.scene.getScene('co-ca-ngua');
      const failures = [];
      const runtime = new SceneRuntime(scene, clientHost(), 'round', (error) =>
        failures.push(String(error)),
      );
      const assert = (value, message) => {
        if (!value) throw new Error(message);
      };
      const at = scene.add.image(20, 20, 'co-ca-ngua/island');
      let callbacks = 0;
      const move = runtime.run(async (fx) => {
        await fx.tween({
          targets: at,
          x: 120,
          duration: 100,
          onComplete: () => {
            callbacks++;
          },
        });
        fx.checkpoint();
        assert(at.x === 120, 'Phaser did not reach tween endpoint');
      });
      runtime.setSpeed(2);
      assert(
        (await move.done).status === 'completed' && callbacks === 1,
        'Tween callback/settlement failed',
      );
      assert(
        scene.tweens.timeScale === 1 && scene.time.timeScale === 1,
        'Global clock was changed',
      );

      const old = runtime.run(async (fx) => {
        await fx.tween({ targets: at, x: 200, duration: 1000 });
      });
      const replacement = runtime.run(async (fx) => {
        await fx.tween({ targets: at, x: 50, duration: 50 });
      });
      assert(
        (await old.done).status === 'cancelled',
        'Target replacement did not cancel its owner',
      );
      assert((await replacement.done).status === 'completed', 'Replacement failed');
      const lost = runtime.run(async (fx) => {
        await fx.tween({ targets: at, x: 80, duration: 1000 });
      });
      at.destroy();
      assert((await lost.done).status === 'cancelled', 'Destroy did not settle tween');

      const proxy = { value: 0 };
      const invalid = runtime.run(async (fx) => {
        await fx.tween({ targets: proxy, value: 1, repeat: -1 });
      });
      assert((await invalid.done).status === 'failed', 'Infinite tween was accepted');
      const broken = runtime.run(async (fx) => {
        await fx.tween({
          targets: proxy,
          value: 1,
          duration: 1,
          onComplete: () => {
            throw new Error('expected callback failure');
          },
        });
      });
      assert((await broken.done).status === 'failed', 'Callback failure was swallowed');
      assert(failures.length === 2, 'Programming failures were not reported once');

      let stoppedTween;
      let stops = 0;
      const stopped = runtime.run(async (fx) => {
        await fx.tween({
          targets: proxy,
          value: 2,
          duration: 1000,
          onStart: (tween) => {
            stoppedTween = tween;
          },
          onStop: () => {
            stops++;
          },
        });
      });
      await runtime.run(async (fx) => {
        await fx.wait(100);
      }).done;
      stoppedTween.stop();
      assert(
        (await stopped.done).status === 'cancelled' && stops === 1,
        'External stop lost its callback or resolved as complete',
      );
      const stopError = runtime.run(async (fx) => {
        await fx.tween({
          targets: proxy,
          value: 3,
          duration: 1000,
          onStart: (tween) => {
            stoppedTween = tween;
          },
          onStop: () => {
            throw new Error('expected stop failure');
          },
        });
      });
      await runtime.run(async (fx) => {
        await fx.wait(100);
      }).done;
      stoppedTween.stop();
      assert(
        (await stopError.done).status === 'failed' && failures.length === 3,
        'External stop callback error was swallowed',
      );

      const key = 'runtime-test-atlas';
      scene.anims.create({
        key,
        frames: [{ key: 'co-ca-ngua/island' }, { key: 'co-ca-ngua/island' }],
        frameRate: 10,
      });
      const sprite = scene.add.sprite(0, 0, 'co-ca-ngua/island');
      const atlas = runtime.run(async (fx) => {
        await fx.animate(sprite, key);
      });
      assert((await atlas.done).status === 'completed', 'Finite atlas did not complete');
      assert(
        sprite.listenerCount('animationcomplete') === 0 &&
          sprite.listenerCount('animationstop') === 0,
        'Atlas listeners leaked',
      );
      const replacedAtlas = runtime.run(async (fx) => {
        await fx.animate(sprite, key);
      });
      const newAtlas = runtime.run(async (fx) => {
        await fx.animate(sprite, key);
      });
      assert((await replacedAtlas.done).status === 'cancelled', 'Atlas replacement kept old owner');
      assert((await newAtlas.done).status === 'completed', 'Old atlas cleanup stopped replacement');
      sprite.destroy();

      // Hold the real render loop while feeding exact deltas to the actual Phaser resources.
      // This distinguishes a mid-flight speed change from scaling durations at construction.
      const game = scene.sys.game;
      game.loop.sleep();
      try {
        runtime.setSpeed(1);
        proxy.value = 0;
        const speedTween = runtime.run(async (fx) => {
          await fx.tween({ targets: proxy, value: 1000, duration: 1000, ease: 'Linear' });
        });
        const tick = (delta) => scene.events.emit('update', 0, delta);
        tick(100);
        tick(100);
        const a = proxy.value;
        tick(100);
        const b = proxy.value;
        runtime.setSpeed(2);
        tick(100);
        const c = proxy.value;
        assert(
          b > a && Math.abs(c - b - (b - a) * 2) < 0.001,
          'Mid-tween speed change restarted or double-scaled motion',
        );
        for (let i = 0; i < 10; i++) tick(100);
        assert((await speedTween.done).status === 'completed', 'Manual-clock tween did not finish');
        runtime.setSpeed(1);
        const speedSprite = scene.add.sprite(0, 0, 'co-ca-ngua/island');
        const speedAtlas = runtime.run(async (fx) => {
          await fx.animate(speedSprite, key);
        });
        const firstFrame = speedSprite.anims.currentFrame.index;
        tick(50);
        assert(speedSprite.anims.currentFrame.index === firstFrame, 'Atlas skipped its slow step');
        runtime.setSpeed(2);
        tick(50);
        assert(
          speedSprite.anims.currentFrame.index !== firstFrame,
          'Mid-atlas speed change was ignored',
        );
        tick(100);
        assert((await speedAtlas.done).status === 'completed', 'Manual-clock atlas did not finish');
        speedSprite.destroy();
      } finally {
        game.loop.wake();
      }

      const wait = runtime.run(async (fx) => {
        await fx.wait(1000);
      });
      scene.scene.pause();
      wait.cancel();
      assert((await wait.done).status === 'cancelled', 'Pause blocked cancellation');
      scene.scene.resume();
      runtime.dispose();
      assert(
        runtime.inspect().resources === 0 &&
          runtime.inspect().motion === 0 &&
          runtime.inspect().waits === 0,
        'Runtime shutdown leaked resources',
      );
    },
    `/@fs${resolve('packages/sdk/src/client/index.ts')}`,
  );

  let requests = 0;
  await page.route('**/runtime-audio-*.wav', async (route) => {
    requests++;
    if (route.request().url().includes('slow')) await new Promise((done) => setTimeout(done, 450));
    await route.fulfill({ contentType: 'audio/wav', body: wav() });
  });
  // This real gesture unlocks the existing app backend.
  await page.mouse.click(5, 5);
  await page.evaluate(async () => {
    const sound = await import('/src/lib/sound.ts');
    const assert = (value, message) => {
      if (!value) throw new Error(message);
    };
    sound.applySound({ music: { volume: 0.5, muted: true }, sfx: { volume: 0.7, muted: false } });
    const url = '/runtime-audio-fast.wav';
    assert(
      (await sound.prepareSoundUrl(url)) === 'ready',
      'Web Audio preparation failed after unlock',
    );
    const a = sound.playSoundUrl(url, { duck: true });
    const b = sound.playSoundUrl(url, { duck: true });
    assert(
      (await a.started).status === 'started' && (await b.started).status === 'started',
      'Cached voices did not start independently',
    );
    assert(sound.soundDiagnostics().ducks === 2, 'Overlapping duck tokens were lost');
    a.stop();
    assert(sound.soundDiagnostics().ducks === 1, 'Stopping one jingle restored music early');
    sound.applySound({ music: { volume: 0, muted: true }, sfx: { volume: 0.7, muted: false } });
    b.stop();
    // Gain changes use an 80 ms Web Audio ramp; inspect after it settles, even on a warm cache.
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert(sound.soundDiagnostics().musicGain < 0.01, 'Duck cleanup restored muted music');
    const cancelled = sound.playSoundUrl('/runtime-audio-slow-cancel.wav');
    cancelled.stop();
    assert(
      (await cancelled.started).status === 'cancelled',
      'Stop-before-decode did not settle start',
    );
    assert(
      (await cancelled.finished).status === 'stopped',
      'Stop-before-decode did not settle finish',
    );
    const late = sound.playSoundUrl('/runtime-audio-slow-late.wav', { maxStartDelayMs: 20 });
    assert((await late.started).status === 'skipped', 'Late audio was played');
    await late.finished;
    sound.applySound({ music: { volume: 0, muted: true }, sfx: { volume: 0.7, muted: true } });
    const muted = sound.playSoundUrl(url);
    assert((await muted.started).status === 'skipped', 'Muted voice was queued');
    await Promise.all([
      sound.prepareSoundUrl('/runtime-audio-coalesce.wav'),
      sound.prepareSoundUrl('/runtime-audio-coalesce.wav'),
    ]);
  });
  await page.waitForTimeout(600);
  const audio = await page.evaluate(async () =>
    (await import('/src/lib/sound.ts')).soundDiagnostics(),
  );
  if (requests !== 4 || audio.voices || audio.pending || audio.ducks)
    throw new Error(`Audio cache/cancellation leak: ${JSON.stringify({ requests, audio })}`);

  await page.evaluate(
    async (sdkUrl) => {
      const { SceneRuntime, clientHost } = await import(sdkUrl);
      const sound = await import('/src/lib/sound.ts');
      sound.applySound({ music: { volume: 0, muted: true }, sfx: { volume: 0.7, muted: false } });
      const host = {
        ...clientHost(),
        assets: () => ({
          images: {},
          atlases: {},
          sounds: { event: '/runtime-audio-slow-epoch.wav' },
        }),
      };
      const runtime = new SceneRuntime(window.__phaser.scene.getScene('co-ca-ngua'), host);
      let eventReady = false;
      const flow = runtime.run(async (fx) => {
        await fx.sound('event', { maxStartDelayMs: 1000 });
        fx.checkpoint();
        eventReady = true;
      });
      runtime.dispose();
      if ((await flow.done).status !== 'cancelled' || eventReady)
        throw new Error('Closed audio epoch continued into event-ready');
      window.__closedAudioEpoch = () => eventReady;
    },
    `/@fs${resolve('packages/sdk/src/client/index.ts')}`,
  );
  await page.waitForTimeout(600);
  const closed = await page.evaluate(async () => ({
    eventReady: window.__closedAudioEpoch(),
    ...(await import('/src/lib/sound.ts')).soundDiagnostics(),
  }));
  if (closed.eventReady || closed.voices || closed.pending || closed.ducks)
    throw new Error('Late decode survived scene shutdown');

  await page.route('**/runtime-preload.txt', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({ body: 'ready' });
  });
  await page.evaluate(
    async (sdkUrl) => {
      const { GameView, SceneDirector } = await import(sdkUrl);
      const game = window.__phaser;
      const board = game.registry.get('board');
      const assert = (value, message) => {
        if (!value) throw new Error(message);
      };
      const created = [];
      let starts = 0;
      let resyncs = 0;
      class Probe extends GameView {
        onCreate(ctx) {
          created.push(ctx.options);
        }
        onStart() {
          starts++;
        }
        onResync() {
          resyncs++;
        }
      }
      let loadResolve;
      let loads = 0;
      const director = new SceneDirector(game, {
        background: new Set(Object.keys(game.scene.keys)),
        load: async () => {
          loads++;
          return await new Promise((resolve) => {
            loadResolve = resolve;
          });
        },
        write: (data) => game.registry.set('board', data),
        push: (data) => game.events.emit('board:props', data),
        onError: (error) => {
          throw error;
        },
      });
      const stale = director.show({
        key: 'runtime-probe',
        instance: 'room-a',
        data: { ...board, options: 'old' },
      });
      const latest = director.show({
        key: 'runtime-probe',
        instance: 'room-b',
        data: { ...board, options: 'latest' },
      });
      loadResolve(Probe);
      assert((await stale).status === 'superseded', 'Stale import was applied');
      assert((await latest).status === 'shown' && loads === 1, 'Scene imports did not coalesce');
      assert(created.join() === 'latest', 'Scene create received stale room data');
      const probe = game.scene.getScene('runtime-probe');
      const oldRuntime = probe.runtime;
      const flow = oldRuntime.run(async (fx) => {
        await fx.wait(1000);
      });
      const nextRound = { ...board, round: board.round + 1, options: 'latest' };
      await director.show({ key: 'runtime-probe', instance: 'room-b', data: nextRound });
      assert(
        (await flow.done).status === 'cancelled',
        'Round changed without cancelling old effects',
      );
      assert(starts === 2, 'New round hook was not called exactly once');
      await director.show({
        key: 'runtime-probe',
        instance: 'room-b',
        data: {
          ...nextRound,
          last: { seq: 3, player: 'none', move: { event: 'add', payload: { amount: 1 } } },
        },
      });
      assert(resyncs === 1, 'Sequence gap did not resync');
      await director.show({
        key: 'runtime-probe',
        instance: 'room-c',
        data: { ...board, options: 'room-c' },
      });
      assert(
        probe === game.scene.getScene('runtime-probe') && probe.runtime !== oldRuntime,
        'Scene instance restart reused its runtime',
      );
      assert(oldRuntime.inspect().resources === 0, 'Previous room resources leaked');
      director.dispose();
      assert(probe.runtime.inspect().resources === 0, 'Director dispose left a runtime alive');
      const preloadCreates = [];
      class PreloadProbe extends GameView {
        preload() {
          super.preload();
          this.load.text('runtime-preload', '/runtime-preload.txt');
        }
        onCreate(ctx) {
          preloadCreates.push(ctx.options);
        }
      }
      let errors = 0;
      const preloader = new SceneDirector(game, {
        background: new Set(Object.keys(game.scene.keys)),
        load: async () => PreloadProbe,
        write: (data) => game.registry.set('board', data),
        push: (data) => game.events.emit('board:props', data),
        onError: () => {
          errors++;
        },
      });
      const loading = preloader.show({
        key: 'runtime-preload-probe',
        instance: 'preload',
        data: { ...board, options: 'old' },
      });
      while (!game.scene.keys['runtime-preload-probe']?.load.isLoading())
        await new Promise((resolve) => setTimeout(resolve, 10));
      const fresh = preloader.show({
        key: 'runtime-preload-probe',
        instance: 'preload',
        data: { ...board, options: 'fresh' },
      });
      assert(
        (await loading).status === 'superseded' && (await fresh).status === 'shown',
        'Same-instance preload update failed',
      );
      assert(preloadCreates.join() === 'fresh', 'Preload used stale registry');
      preloader.dispose();
      // A second loader exercises shutdown during preload rather than merely during import.
      game.cache.text.remove('runtime-preload');
      const pendingPreload = preloader; // disposed directors never restart.
      assert(
        (await pendingPreload.show({ key: null, instance: 'disposed', data: board })).status ===
          'superseded',
        'Disposed director restarted',
      );
      const aborter = new SceneDirector(game, {
        background: new Set(Object.keys(game.scene.keys)),
        load: async () => PreloadProbe,
        write: (data) => game.registry.set('board', data),
        push() {},
        onError: () => {
          errors++;
        },
      });
      const interrupted = aborter.show({
        key: 'runtime-abort-preload',
        instance: 'abort',
        data: { ...board, options: 'cancelled' },
      });
      while (!game.scene.keys['runtime-abort-preload']?.load.isLoading())
        await new Promise((resolve) => setTimeout(resolve, 10));
      aborter.dispose();
      assert((await interrupted).status === 'superseded', 'Dispose did not settle preload');
      await new Promise((resolve) => setTimeout(resolve, 500));
      assert(preloadCreates.join() === 'fresh', 'Disposed preload ran create');
      let failLoad = true;
      const retry = new SceneDirector(game, {
        background: new Set(Object.keys(game.scene.keys)),
        load: () => {
          if (failLoad) throw new Error('expected import failure');
          return Promise.resolve(Probe);
        },
        write: (data) => game.registry.set('board', data),
        push() {},
        onError: () => {
          errors++;
        },
      });
      const retryRequest = { key: 'runtime-retry', instance: 'retry', data: board };
      assert(
        (await retry.show(retryRequest)).status === 'failed' && errors === 1,
        'Sync import failure did not settle',
      );
      failLoad = false;
      assert((await retry.show(retryRequest)).status === 'shown', 'Retry did not recover loader');
      retry.dispose();
      let resolveLate;
      const lateDirector = new SceneDirector(game, {
        background: new Set(Object.keys(game.scene.keys)),
        load: () =>
          new Promise((resolve) => {
            resolveLate = resolve;
          }),
        write: () => {
          throw new Error('Disposed director wrote data');
        },
        push() {},
        onError() {},
      });
      const importTask = lateDirector.show({ key: 'runtime-late', instance: 'gone', data: board });
      lateDirector.dispose();
      resolveLate(Probe);
      assert((await importTask).status === 'superseded', 'Dispose did not settle pending import');
      await Promise.resolve();
      assert(!game.scene.keys['runtime-late'], 'Late import started after disposal');
    },
    `/@fs${resolve('packages/sdk/src/client/index.ts')}`,
  );
  await page.screenshot({ path: t.shot('runtime-verified.png') });
}
