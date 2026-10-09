/** Read once at startup; production must never set XOMDAO_DEV. */
export const DEV_MODE = Symbol('DEV_MODE');
export const devModeProvider = { provide: DEV_MODE, useValue: process.env.XOMDAO_DEV === '1' };
