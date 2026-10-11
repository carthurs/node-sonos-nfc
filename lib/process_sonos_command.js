import fetch from 'node-fetch';
import fs from 'fs';

var { sonos_room, sonos_http_api } = JSON.parse(
  fs.readFileSync('usersettings.json', 'utf-8')
);

export const get_sonos_url = (sonos_instruction, service_type) => {
  if (service_type == 'completeurl') {
    return sonos_instruction;
  }

  return sonos_http_api + '/' + sonos_room + '/' + sonos_instruction;
};

export default async function process_sonos_command(received_text) {
  const started = process.hrtime.bigint();
  const elapsed = () => Number(process.hrtime.bigint() - started) / 1e6;
  const timedFetch = async (url, operation) => {
    const before = elapsed();
    const response = await fetch(url);
    console.log(`[timing] ${new Date().toISOString()} ${operation} http=${response.status} duration_ms=${(elapsed() - before).toFixed(1)} command_ms=${elapsed().toFixed(1)}`);
    return response;
  };
  let service_type, sonos_instruction;
  let received_text_lower = received_text.toLowerCase();

  if (received_text_lower.startsWith('apple:')) {
    service_type = 'applemusic';
    sonos_instruction = 'applemusic/now/' + received_text.slice(6);
  } else if (received_text_lower.startsWith('applemusic:')) {
    service_type = 'applemusic';
    sonos_instruction = 'applemusic/now/' + received_text.slice(11);
  } else if (received_text_lower.startsWith('http')) {
    service_type = 'completeurl';
    sonos_instruction = received_text;
  } else if (received_text_lower.startsWith('spotify:')) {
    service_type = 'spotify';
    sonos_instruction = 'spotify/now/' + received_text;
  } else if (received_text_lower.startsWith('tunein:')) {
    service_type = 'tunein';
    sonos_instruction = 'tunein/now/' + received_text;
  } else if (received_text_lower.startsWith('amazonmusic:')) {
    service_type = 'amazonmusic';
    sonos_instruction = 'amazonmusic/now/' + received_text.slice(12);
  } else if (received_text_lower.startsWith('playlist:')) {
    service_type = 'sonos_playlist';
    sonos_instruction = 'playlist/' + received_text.slice(9);
  } else if (received_text_lower.startsWith('command:')) {
    service_type = 'command';
    sonos_instruction = received_text.slice(8);
  } else if (received_text_lower.startsWith('room:')) {
    sonos_room = received_text.slice(5);
    console.log(`Sonos room changed to ${sonos_room}`);
    return;
  }

  if (!service_type) {
    console.log(
      'Service type not recognised. Text should begin ' +
        "'spotify', 'tunein', 'amazonmusic', 'apple'/'applemusic', 'command', 'http', 'playlist', or 'room'."
    );
    return;
  }

  console.log("Detected '%s' service request", service_type);

  if (service_type != 'command') {
    console.log(
      'Resetting Sonos queue (clear, turn off repeat, shuffle, crossfade)'
    );
    let res;
    res = await timedFetch(get_sonos_url('repeat/off'), 'repeat/off');
    if (!res.ok)
      throw new Error(
        `Unexpected response while turning repeat off: ${res.status}`
      );
    await new Promise((resolve) => setTimeout(resolve, 200));
    res = await timedFetch(get_sonos_url('shuffle/off'), 'shuffle/off');
    if (!res.ok)
      throw new Error(
        `Unexpected response while turning shuffle off: ${res.status}`
      );
    res = await timedFetch(get_sonos_url('crossfade/off'), 'crossfade/off');
    if (!res.ok)
      // for some reason, this sometimes returns a HTTP 500, but I
      // don't want a failure to turn off crossfade to be fatal.
      console.error(
        `Unexpected response while turning crossfade off: ${res.status}`
      );
      //throw new Error(
      //  `Unexpected response while turning crossfade off: ${res.status}`
      //);
    res = await timedFetch(get_sonos_url('clearqueue'), 'clearqueue');
    if (!res.ok)
      throw new Error(
        `Unexpected response while clearing queue: ${res.status}`
      );
  }

  const urltoget = get_sonos_url(sonos_instruction, service_type);

  // Perform the requested action on the sonos API
  console.log('Fetching URL via HTTP api: %s', urltoget);
  const res = await timedFetch(urltoget, 'playback-command');

  if (!res.ok) {
    throw new Error(
      `Unexpected response while sending instruction: ${res.status}`
    );
  }

  console.log('Sonos API reports: ', await res.json());
  console.log(`[timing] ${new Date().toISOString()} api_complete_ms=${elapsed().toFixed(1)}`);

  // Wait a bit before processing next record so the API has time to respond to first command
  // e.g. want to seek on a new queue -- need the new queue to exist. Is there a way to check/confirm
  // with Sonos that a prior command is complete? I'm not sure if this a sonos thing or the http API
  // sometimes throwing commands into the ether while Sonos is busy.
  await new Promise((resolve) => setTimeout(resolve, 200));
}
