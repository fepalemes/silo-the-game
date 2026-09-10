// Small procedural soundscape (no audio files): a low mechanical drone plus
// synthesized footstep/interact blips, entirely generated with WebAudio.
export function createAudio() {
  let ctx = null;
  let master = null;

  function startDrone() {
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.12;
    droneGain.connect(master);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 58;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(droneGain);
    osc1.start();
    osc2.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
  }

  function noiseBuffer(duration) {
    const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function ensureContext() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      startDrone();
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function footstep() {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.08);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 160 + Math.random() * 80;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function interact() {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  return { ensureContext, footstep, interact };
}
