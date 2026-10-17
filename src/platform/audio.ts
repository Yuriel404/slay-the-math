import type { GameEvent } from '../core';
import type { AudioPort } from './contracts';

export class WebAudioAdapter implements AudioPort {
  private context: AudioContext | null = null;
  private enabled = false;
  setEnabled(enabled: boolean) { this.enabled = enabled; }
  async unlock() { if (this.enabled) { this.context ??= new AudioContext(); if (this.context.state === 'suspended') await this.context.resume(); } }
  play(event: GameEvent) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const frequencies: Record<string, number> = { 'card-played': 440, 'numbers-generated': 660, 'damage-dealt': 180, 'block-gained': 350, 'battle-won': 880, 'damage-taken': 110 };
    const frequency = frequencies[event.type];
    if (!frequency) return;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain(), time = this.context.currentTime;
    oscillator.type = event.type.includes('damage') ? 'triangle' : 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.045, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    oscillator.connect(gain); gain.connect(this.context.destination); oscillator.start(time); oscillator.stop(time + 0.13);
  }
}
