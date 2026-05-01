const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const CHANNEL_ID = '1492756482373058650';


const startDate = new Date('2026-03-21');

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);


  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const diffTime = now - startDate;

      const day = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const channel = await client.channels.fetch(CHANNEL_ID);
      if (channel) {
        await channel.setName(`Day: ${day}`);
        console.log(`Updated to Day: ${day}`);
      }
    } catch (err) {
      console.error(err);
    }
  });
});

client.login(process.env.TOKEN);
