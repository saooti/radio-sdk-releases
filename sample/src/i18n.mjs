const catalogs = {
  fr: {
    diagnostics: 'Diagnostic',
    diagnosticsLoading: 'Collecte du diagnostic…', diagnosticsError: 'Impossible de récupérer le diagnostic. Réessayez.',
    logs: 'Logs', debugLogs: 'Logs détaillés', exportBasic: 'Exporter basic.log', exportDebug: 'Exporter debug.log',
    logError: 'Impossible de modifier ou d’exporter les logs.', logSaved: 'Logs exportés.',
    radio: 'Radio', refresh: 'Rafraîchir', player: 'Lecteur', speakers: 'Contrôles d’enceintes',
    versions: 'Versions du SDK et du lecteur', restarting: 'Redémarrage de la radio…',
    restartError: 'Impossible de redémarrer la radio. Réessayez ou redémarrez l’application.',
    startupError: 'Impossible de démarrer les services radio. Réessayez ou redémarrez l’application.'
  },
  en: {
    diagnostics: 'Diagnostics',
    diagnosticsLoading: 'Collecting diagnostics…', diagnosticsError: 'Could not retrieve diagnostics. Try again.',
    logs: 'Logs', debugLogs: 'Detailed logs', exportBasic: 'Export basic.log', exportDebug: 'Export debug.log',
    logError: 'Could not change or export logs.', logSaved: 'Logs exported.',
    radio: 'Radio', refresh: 'Refresh', player: 'Player', speakers: 'Speaker controls',
    versions: 'SDK and player versions', restarting: 'Restarting radio…',
    restartError: 'Could not restart the radio. Try again or restart the application.',
    startupError: 'Could not start the radio services. Try again or restart the application.'
  },
  it: {
    diagnostics: 'Diagnostica',
    diagnosticsLoading: 'Raccolta della diagnostica…', diagnosticsError: 'Impossibile recuperare la diagnostica. Riprova.',
    logs: 'Log', debugLogs: 'Log dettagliati', exportBasic: 'Esporta basic.log', exportDebug: 'Esporta debug.log',
    logError: 'Impossibile modificare o esportare i log.', logSaved: 'Log esportati.',
    radio: 'Radio', refresh: 'Aggiorna', player: 'Lettore', speakers: 'Controlli degli altoparlanti',
    versions: 'Versioni SDK e lettore', restarting: 'Riavvio della radio…',
    restartError: 'Impossibile riavviare la radio. Riprova o riavvia l’applicazione.',
    startupError: 'Impossibile avviare i servizi radio. Riprova o riavvia l’applicazione.'
  }
};

export function getSampleMessages(locale) { return catalogs[locale]; }
