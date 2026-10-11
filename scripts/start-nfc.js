import fs from 'fs';
import fetch from 'node-fetch';

const settings = JSON.parse(fs.readFileSync('usersettings.json', 'utf8'));
const endpoint = settings.sonos_http_api.replace(/\/$/, '') + '/' + encodeURIComponent(settings.sonos_room) + '/state';
const started = Date.now();
console.log(`[startup] ${new Date().toISOString()} waiting_for_sonos uptime_s=${fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]}`);

async function start() {
  while (Date.now() - started < 180000) {
    let ready = false;
    try {
      const response = await fetch(endpoint, { timeout: 2000 });
      const state = await response.json();
      ready = response.ok && Boolean(state.playbackState);
    } catch (error) {
      // Discovery and the listener may still be starting. Retry with a bound.
    }
    if (ready) {
      console.log(`[startup] ${new Date().toISOString()} sonos_ready wait_ms=${Date.now() - started} uptime_s=${fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]}`);
      await import('../index.js');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Sonos room not ready after 180 seconds');
}

start().catch(error => {
  console.error('[startup]', error.message);
  process.exitCode = 1;
});
