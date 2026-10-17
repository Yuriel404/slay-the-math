import { catalog } from '../content/catalog';
import { DesktopSaveRepository, isDesktop } from '../platform/desktop';
import { IndexedDbSaveRepository } from '../platform/storage';
import { GameEventBus } from '../platform/contracts';
import { WebAudioAdapter } from '../platform/audio';
import { createSession } from './session';

export const events = new GameEventBus();
export const audio = new WebAudioAdapter();
events.subscribe(event => audio.play(event));
/**
 * One session, two hosts. The desktop build stores saves as JSON documents via
 * the Rust host; the browser build keeps IndexedDB. Nothing above this line
 * knows which one is active.
 */
export const desktop = isDesktop();
export const useSession = createSession(
  catalog,
  desktop ? new DesktopSaveRepository(catalog) : new IndexedDbSaveRepository(catalog),
  events,
);
