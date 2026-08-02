const {
  MINECRAFT_SERVER_IP,
  MC_CHANNELS,
} = require('../config');

async function fetchMinecraftData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      `https://api.mcsrvstat.us/2/${MINECRAFT_SERVER_IP}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('API returned non-JSON response');
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function createMinecraftService(client) {
  async function updateMinecraftStats() {
    try {
      const data = await fetchMinecraftData();

      const statusChannel = await client.channels.fetch(MC_CHANNELS.STATUS);
      const playersChannel = await client.channels.fetch(MC_CHANNELS.PLAYERS);

      if (data.online) {
        if (statusChannel) {
          await statusChannel.setName('╿ Status: Online');
        }
        if (playersChannel) {
          await playersChannel.setName(
            `│ Players:  ${data.players.online} / ${data.players.max}`
          );
        }
      } else {
        if (statusChannel) {
          await statusChannel.setName('╿ Status: Offline');
        }
        if (playersChannel) {
          await playersChannel.setName('│ Players:  0 / 0');
        }
      }

      console.log('Minecraft status updated');
    } catch (error) {
      console.error('Failed to update Minecraft stats:', error);

      const statusChannel = await client.channels
        .fetch(MC_CHANNELS.STATUS)
        .catch(() => null);

      if (statusChannel) {
        await statusChannel
          .setName('╿ Status: Error/Offline')
          .catch(() => null);
      }
    }
  }

  return {
    fetchMinecraftData,
    updateMinecraftStats,
  };
}

module.exports = {
  createMinecraftService,
  fetchMinecraftData,
};
