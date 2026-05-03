
/**
 * Utilité pour déclencher un événement de synchronisation de stockage de manière compatible.
 * Évite les erreurs "Illegal constructor" sur certains environnements.
 */
export const dispatchStorageEvent = () => {
  try {
    // Tentative moderne avec CustomEvent
    let event;
    try {
      event = new CustomEvent('microfox_storage', {
        detail: { timestamp: Date.now() }
      });
    } catch (e) {
      // Fallback sur document.createEvent pour les environnements plus anciens ou restreints
      event = document.createEvent('CustomEvent');
      event.initCustomEvent('microfox_storage', true, true, { timestamp: Date.now() });
    }
    window.dispatchEvent(event);
  } catch (e) {
    console.error('Erreur lors du dispatch de l\'événement de stockage:', e);
  }
};
