/** Libellés des permissions internes (les clés viennent du serveur). */
export const ORG_PERMISSION_LABELS: Record<string, { label: string; text: string }> = {
  'department.view': { label: 'Tableau de bord du service', text: 'Voir les indicateurs du service' },
  'team.view': { label: 'Espace d’équipe', text: 'Ouvrir l’espace de son équipe' },
  'members.view': { label: 'Voir les membres', text: 'Liste des collaborateurs du périmètre' },
  'members.manage': { label: 'Gérer les membres', text: 'Inviter et changer de position' },
  'tasks.view': { label: 'Voir les tâches', text: 'Tâches selon le périmètre' },
  'tasks.manage': { label: 'Gérer les tâches', text: 'Créer, assigner et supprimer' },
  'strategies.view': { label: 'Voir les stratégies', text: 'Stratégies marketing' },
  'strategies.manage': { label: 'Gérer les stratégies', text: 'Créer, modifier et piloter' },
  'accounts.view': { label: 'Comptes clients', text: 'Portefeuille et demandes' },
  'performance.view': { label: 'Performance', text: 'KPI du périmètre' },
}

export const CLIENT_MODULE_LABELS: Record<string, string> = {
  diagnostic: 'Diagnostic',
  besoins: 'Besoins',
  missions: 'Missions',
  rendezVous: 'Rendez-vous',
  documents: 'Documents',
  messages: 'Messages',
  devis: 'Devis',
  prestataires: 'Prestataires',
  abonnement: 'Abonnement',
  notifications: 'Notifications',
  equipe: 'Équipe',
  results: 'Résultats',
}
