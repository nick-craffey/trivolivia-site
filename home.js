(() => {
  const parameters = new URLSearchParams(window.location.search);
  const knownKeys = ['challenge', 'braintrust', 'channel', 'invite'];
  if (knownKeys.some((key) => parameters.getAll(key).length > 1)) return;

  const linkKeys = ['challenge', 'braintrust', 'channel'];
  const presentLinkKeys = linkKeys.filter((key) => parameters.has(key));
  if (presentLinkKeys.length !== 1) return;

  const id = parameters.get(presentLinkKeys[0]);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id ?? '')) return;

  const invite = parameters.get('invite');
  if (
    invite !== null &&
    (presentLinkKeys[0] !== 'braintrust' ||
      !/^[A-Za-z0-9_-]{32,96}$/.test(invite))
  ) {
    return;
  }
  window.location.replace(`/play/${window.location.search}${window.location.hash}`);
})();
