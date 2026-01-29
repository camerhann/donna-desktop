/**
 * Chat IPC Handlers
 */
const { ipcMain } = require('electron');

function registerChatHandlers(dependencies) {
  const { getChatManager, activeStreams, getMainWindow } = dependencies;

  ipcMain.handle('chat:createSession', (event, config) => {
    const manager = getChatManager();
    const session = manager.createSession(config);
    return { success: true, session: { id: session.id, name: session.name, provider: session.provider, model: session.model } };
  });

  ipcMain.handle('chat:getSession', (event, { sessionId }) => {
    if (!sessionId) return { success: false, error: 'Missing session ID' };
    const manager = getChatManager();
    const session = manager.getSession(sessionId);
    if (session) return { success: true, session: session.toJSON() };
    return { success: false, error: 'Session not found' };
  });

  ipcMain.handle('chat:listSessions', () => { const manager = getChatManager(); return manager.listSessions(); });

  ipcMain.handle('chat:deleteSession', (event, { sessionId }) => {
    if (!sessionId) return { success: false, error: 'Missing session ID' };
    const manager = getChatManager();
    const success = manager.deleteSession(sessionId);
    return { success };
  });

  ipcMain.handle('chat:renameSession', (event, { sessionId, name }) => {
    if (!sessionId || !name) return { success: false, error: 'Missing session ID or name' };
    const manager = getChatManager();
    const success = manager.renameSession(sessionId, name);
    return { success };
  });

  ipcMain.handle('chat:updateSession', (event, { sessionId, updates }) => {
    if (!sessionId) return { success: false, error: 'Missing session ID' };
    const manager = getChatManager();
    const session = manager.getSession(sessionId);
    if (session) {
      if (updates?.provider) session.provider = updates.provider;
      if (updates?.model) session.model = updates.model;
      if (updates?.systemPrompt !== undefined) session.systemPrompt = updates.systemPrompt;
      if (updates?.name) session.name = updates.name;
      manager.saveSession(session);
      return { success: true };
    }
    return { success: false, error: 'Session not found' };
  });

  ipcMain.handle('chat:sendMessage', async (event, { sessionId, content }) => {
    if (!sessionId || content === undefined || content === null) return { success: false, error: 'Missing session ID or content' };
    const manager = getChatManager();
    try { const result = await manager.sendMessage(sessionId, content); return { success: true, ...result }; }
    catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('chat:streamMessage', async (event, { sessionId, content, streamId }) => {
    if (!sessionId || !streamId || content === undefined || content === null) return { success: false, error: 'Missing required parameters' };
    const manager = getChatManager();
    activeStreams.set(streamId, { sessionId, aborted: false });

    (async () => {
      try {
        for await (const chunk of manager.streamMessage(sessionId, content)) {
          if (activeStreams.get(streamId)?.aborted) break;
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (chunk.type === 'chunk') mainWindow.webContents.send('chat:streamChunk', { streamId, content: chunk.content });
            else if (chunk.type === 'complete') mainWindow.webContents.send('chat:streamComplete', { streamId, message: chunk.message });
            else if (chunk.type === 'error') mainWindow.webContents.send('chat:streamError', { streamId, error: chunk.error });
            else if (chunk.type === 'user_message') mainWindow.webContents.send('chat:userMessage', { streamId, message: chunk.message });
          }
        }
      } catch (error) {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('chat:streamError', { streamId, error: error.message });
      } finally { activeStreams.delete(streamId); }
    })();

    return { success: true, streamId };
  });

  ipcMain.handle('chat:abortStream', (event, { streamId }) => {
    const stream = activeStreams.get(streamId);
    if (stream) { stream.aborted = true; return { success: true }; }
    return { success: false };
  });

  ipcMain.handle('chat:listProviders', () => { const manager = getChatManager(); return manager.listProviders(); });

  ipcMain.handle('chat:updateProviderConfig', (event, { provider, config }) => {
    const manager = getChatManager();
    manager.updateProviderConfig(provider, config);
    return { success: true };
  });

  ipcMain.handle('chat:getConfig', () => { const manager = getChatManager(); return manager.getConfig(); });

  ipcMain.handle('chat:setDefaultProvider', (event, { provider }) => {
    const manager = getChatManager();
    manager.setDefaultProvider(provider);
    return { success: true };
  });
}

module.exports = { registerChatHandlers };
