import solutions6 from '../../../data/solutions-6.json';
import solutions7 from '../../../data/solutions-7.json';
import valid6 from '../../../data/valid-6.json';
import valid7 from '../../../data/valid-7.json';
import { registerWordList } from './index';

/**
 * Registers the 6- and 7-letter lists. Importing this module has the side
 * effect; that is deliberate, so the app can `await import('.../words/all')`
 * at the Act III boundary and the sim can import it at the top.
 */
registerWordList(solutions6, valid6);
registerWordList(solutions7, valid7);

export const LONG_WORDS_REGISTERED = true;
