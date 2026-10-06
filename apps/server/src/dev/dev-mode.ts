/** Read once at startup; production must never set PSC_DEV. */
export const DEV_MODE = Symbol('DEV_MODE');
export const devModeProvider = { provide: DEV_MODE, useValue: process.env.PSC_DEV === '1' };
