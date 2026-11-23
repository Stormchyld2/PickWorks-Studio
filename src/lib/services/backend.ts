/**
 * The native core in the desktop app; in the development browser preview, an
 * in-memory stand-in so the screens can be built and checked. Production
 * builds outside the desktop app get the real client, which reports that the
 * desktop app is needed.
 */
import { core, inTauri, type CoreApi } from './core-client';
import { createPreviewCore } from './preview-core';

export const preview = import.meta.env.DEV && !inTauri() ? createPreviewCore() : null;

export const backend: CoreApi = preview ?? core;

// Lets the screenshot script seed demo students in the browser preview.
if (preview && typeof window !== 'undefined') (window as unknown as { __pwPreview: typeof preview }).__pwPreview = preview;
