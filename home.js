(() => {
  // Keep this browser gate in lockstep with SharedTopicRoundCodec and the
  // social preview service's same_five_token validator.
  const isCanonicalRoundToken = (token) => {
    if (
      typeof token !== 'string' ||
      token.length < 20 ||
      token.length > 768 ||
      !/^r1_[A-Za-z0-9_-]+$/.test(token)
    ) {
      return false;
    }

    let payload;
    try {
      const body = token.slice(3);
      const base64 = body.replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (base64.length % 4)) % 4);
      const binary = atob(`${base64}${padding}`);
      const bytes = Uint8Array.from(binary, (value) => value.charCodeAt(0));
      const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      payload = JSON.parse(json);
    } catch (_error) {
      return false;
    }

    const fields = ['t', 'd', 'g', 'p', 'c', 'k', 'm'];
    if (
      payload === null ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      Object.keys(payload).length !== fields.length ||
      fields.some(
        (field) => !Object.prototype.hasOwnProperty.call(payload, field),
      ) ||
      typeof payload.t !== 'string' ||
      payload.t.length === 0 ||
      payload.t.length > 80 ||
      Array.from(payload.t).length > 80 ||
      payload.t.trim() !== payload.t ||
      /[\x00-\x1f\x7f\u2028\u2029]/.test(payload.t) ||
      typeof payload.d !== 'string' ||
      payload.d.length > 128 ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(payload.d) ||
      typeof payload.g !== 'string' ||
      !/^[a-f0-9]{64}$/.test(payload.g) ||
      typeof payload.p !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(payload.p) ||
      typeof payload.k !== 'string' ||
      payload.k.length > 96 ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(payload.k) ||
      !Number.isInteger(payload.m) ||
      ![0, 1, 2, 3].includes(payload.m) ||
      !Array.isArray(payload.c) ||
      payload.c.length !== 5 ||
      payload.c.some(
        (position) =>
          !Number.isInteger(position) || position < 0 || position >= 30,
      ) ||
      new Set(payload.c).size !== 5
    ) {
      return false;
    }

    const canonical = JSON.stringify({
      t: payload.t,
      d: payload.d,
      g: payload.g,
      p: payload.p,
      c: payload.c,
      k: payload.k,
      m: payload.m,
    });
    const bytes = new TextEncoder().encode(canonical);
    let binary = '';
    for (const value of bytes) binary += String.fromCharCode(value);
    const encoded = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `r1_${encoded}` === token;
  };

  const parameters = new URLSearchParams(window.location.search);
  const knownKeys = ['round', 'challenge', 'braintrust', 'channel', 'invite'];
  if (knownKeys.some((key) => parameters.getAll(key).length > 1)) return;

  const linkKeys = ['round', 'challenge', 'braintrust', 'channel'];
  const presentLinkKeys = linkKeys.filter((key) => parameters.has(key));
  if (presentLinkKeys.length !== 1) return;

  const linkKey = presentLinkKeys[0];
  const id = parameters.get(linkKey);
  const validId = linkKey === 'round'
    ? isCanonicalRoundToken(id)
    : /^[A-Za-z0-9_-]{16,64}$/.test(id ?? '');
  if (!validId) return;

  const invite = parameters.get('invite');
  if (linkKey === 'braintrust') {
    if (invite === null || !/^[A-Za-z0-9_-]{32,96}$/.test(invite)) return;
  } else if (invite !== null) {
    return;
  }
  window.location.replace(`/play/${window.location.search}${window.location.hash}`);
})();
