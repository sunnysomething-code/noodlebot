const {
  CHANNEL_ID,
  MESSAGE_CHANNEL_ID,
  DAY_START_DATE,
} = require('../config');

function getCurrentDay() {
  const brisbaneDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const today = new Date(`${brisbaneDate}T00:00:00+10:00`);
  const start = new Date(DAY_START_DATE);

  return Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
}

function createDayService(client) {
  async function updateChannel(sendMessage = true) {
    const day = getCurrentDay();

    const voiceChannel = await client.channels.fetch(CHANNEL_ID);
    if (voiceChannel) {
      await voiceChannel.setName(`╽ Day: ${day}`);
    }

    if (sendMessage) {
      const textChannel = await client.channels.fetch(MESSAGE_CHANNEL_ID);
      if (textChannel) {
        await textChannel.send(`📅 Today is **Day ${day}**`);
      }
    }

    console.log(`Updated to Day: ${day}`);
  }

  return {
    getCurrentDay,
    updateChannel,
  };
}

module.exports = {
  createDayService,
  getCurrentDay,
};
