const truthyValues = new Set(['1', 'true', 'yes', 'on']);

function readEnv(name: string) {
  return process.env[name]?.trim().toLowerCase() ?? '';
}

export function isCentralPlatformMode() {
  const platformMode = readEnv('PLATFORM_MODE');
  if (platformMode === 'central') {
    return true;
  }
  const centralEnabled = readEnv('CENTRAL_PLATFORM');
  if (truthyValues.has(centralEnabled)) {
    return true;
  }
  const centralEnabledLegacy = readEnv('CENTRAL_PLATFORM_ENABLED');
  return truthyValues.has(centralEnabledLegacy);
}
