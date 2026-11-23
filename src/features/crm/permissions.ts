/** Libellés des permissions CRM attribuables aux agents (les clés viennent du serveur). */
export const PERMISSION_LABELS: Record<string, { label: string; hint: string }> = {
  'dashboard.view': { label: 'Tableau de bord', hint: 'Voir ses indicateurs et son activité.' },
  'contacts.view': { label: 'Voir les contacts', hint: 'Bases, contacts et activité partagés par toute l’équipe CRM.' },
  'contacts.create': { label: 'Créer des contacts', hint: 'Ajouter un contact dans une de ses bases.' },
  'contacts.edit': { label: 'Modifier les contacts', hint: 'Coordonnées, statut, notes, tags, rappels.' },
  'contacts.export': { label: 'Exporter les contacts', hint: 'Télécharger ses contacts en CSV ou Excel.' },
  'calls.create': { label: 'Enregistrer des appels', hint: 'Résultat, notes et rappel programmé.' },
  'calls.edit': { label: 'Modifier ses appels', hint: 'Corriger le résultat ou les notes d’un appel.' },
  'appointments.view': { label: 'Voir les rendez-vous', hint: 'Calendrier, liste et carte de ses rendez-vous.' },
  'appointments.create': { label: 'Prendre des rendez-vous', hint: 'Créer un rendez-vous pour un contact.' },
  'appointments.edit': { label: 'Gérer ses rendez-vous', hint: 'Confirmer, reporter, annuler, marquer réalisé.' },
  'map.view': { label: 'Carte géographique', hint: 'Voir ses contacts, rendez-vous et zones sur la carte.' },
  'campaigns.view': { label: 'Voir ses campagnes', hint: 'Campagnes qui lui sont assignées.' },
  'reports.view': { label: 'Rapports', hint: 'Statistiques de son propre périmètre.' },
  'notifications.view': { label: 'Notifications', hint: 'Recevoir les alertes et rappels.' },
}

export const NOTIFICATION_LABELS: Record<string, string> = {
  'appointment.created': 'Nouveau rendez-vous',
  'appointment.confirmed': 'Rendez-vous confirmé',
  'appointment.cancelled': 'Rendez-vous annulé',
  'appointment.rescheduled': 'Rendez-vous reporté',
  'callback.reminder': 'Rappel à effectuer',
  'database.assigned': 'Base assignée',
  'contacts.assigned': 'Contacts assignés',
  'campaign.assigned': 'Campagne assignée',
  'campaign.started': 'Campagne démarrée',
  'campaign.completed': 'Campagne terminée',
  'user.created': 'Compte créé',
  'agent.alert': 'Alerte d’activité',
  'import.completed': 'Import terminé',
  'import.failed': 'Import échoué',
}
