/**
 * Valide que toutes les variables d'environnement requises sont définies
 * et qu'elles ne contiennent pas de valeurs par défaut dangereuses
 */
export function validateEnvironment(): void {
  const errors: string[] = [];

  // Variables d'environnement requises
  const required = [
    'MONGODB_URI',
    'JWT_SECRET',
    'COOKIE_SECRET',
    'SESSION_SECRET',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'BACKEND_URL'
  ];

  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Variable d'environnement manquante: ${key}`);
    }
  }

  // Vérifier que les secrets ne sont pas les valeurs par défaut dangereuses
  const dangerousDefaults = [
    { key: 'JWT_SECRET', dangerous: ['supersecret'] },
    { key: 'COOKIE_SECRET', dangerous: ['supersecret'] },
    { key: 'SESSION_SECRET', dangerous: ['supersecretsupersecretsupersecretsupersecret'] }
  ];

  for (const { key, dangerous } of dangerousDefaults) {
    const value = process.env[key];
    if (value && dangerous.includes(value)) {
      errors.push(`${key} utilise une valeur par défaut dangereuse. Changez-la en production!`);
    }
  }

  // Vérifier que les secrets ont une longueur minimale
  const minLengths = [
    { key: 'JWT_SECRET', minLength: 32 },
    { key: 'COOKIE_SECRET', minLength: 32 },
    { key: 'SESSION_SECRET', minLength: 32 }
  ];

  for (const { key, minLength } of minLengths) {
    const value = process.env[key];
    if (value && value.length < minLength) {
      errors.push(`${key} doit avoir au moins ${minLength} caractères (actuellement: ${value.length})`);
    }
  }

  // En production, les secrets par défaut ne sont pas acceptés
  if (process.env.NODE_ENV === 'production' && errors.length > 0) {
    console.error('❌ ERREURS DE CONFIGURATION EN PRODUCTION:');
    errors.forEach(err => console.error(`  - ${err}`));
    throw new Error('Configuration invalide en production. Voir les erreurs ci-dessus.');
  }

  // En développement, afficher des avertissements
  if (process.env.NODE_ENV !== 'production' && errors.length > 0) {
    console.warn('⚠️  AVERTISSEMENTS DE CONFIGURATION:');
    errors.forEach(err => console.warn(`  - ${err}`));
  }
}
