const defaultCentralHostnames = ['devbank.automatixpay.com', 'devbankstaging.automatixpay.com'];

export function getCentralHostnames() {
  const configured = (process.env.NEXT_PUBLIC_CENTRAL_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return configured.length > 0 ? configured : defaultCentralHostnames;
}

export function isCentralHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return getCentralHostnames().includes(normalized);
}

export function isCurrentCentralHost() {
  if (typeof window === 'undefined') {
    return false;
  }
  return isCentralHostname(window.location.hostname);
}
