/**
 * @file Synthetic Discord preload for child-process acceptance
 * @description Replaces fetch only in the test child; no request can reach the real Discord service.
 * @module tests/stdio-peer
 */
globalThis.fetch = async (input, init): Promise<Response> => {
  const path = new URL(String(input)).pathname;
  if (init?.method !== 'GET') throw new Error('Unexpected mutation in read-only test.');
  if (path === '/api/v10/users/@me') {
    return Response.json({ id: '123456789012345670', bot: true, username: 'synthetic' });
  }
  if (path === '/api/v10/channels/123456789012345679') {
    return Response.json({ id: '123456789012345679', guild_id: '123456789012345678', type: 0, name: 'test' });
  }
  if (path === '/api/v10/channels/123456789012345679/messages') {
    return Response.json([{ id: '123456789012345680', channel_id: '123456789012345679',
      author: { id: '123456789012345671' }, content: 'synthetic subprocess fixture', timestamp: '2026-10-10T00:00:00Z' }]);
  }
  return Response.json({}, { status: 404 });
};
