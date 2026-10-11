import { pathToFileURL } from 'url';
import command from '../lib/process_sonos_command.js';

const uri = process.argv[2];
const baselinePath = process.argv[3];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const median = values => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function main() {
  if (!uri || !uri.startsWith('spotify:')) {
    throw new Error('Usage: node scripts/benchmark-command.js spotify:album:ID [absolute-baseline-module-path]');
  }
  const variants = baselinePath
    ? [['baseline', (await import(pathToFileURL(baselinePath).href)).default], ['optimized', command]]
    : [['current', command]];
  const samples = {};
  const failures = {};
  for (const [name, fn] of variants) {
    console.log('WARMUP', name);
    try {
      await fn(uri);
    } catch (error) {
      console.error('WARMUP_FAILED', name, error.message);
    }
    samples[name] = [];
    failures[name] = 0;
    await delay(1000);
  }
  for (let trial = 0; trial < 5; trial++) {
    for (const [name, fn] of variants) {
      console.log('TRIAL', name, trial + 1);
      const started = process.hrtime.bigint();
      try {
        await fn(uri);
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        samples[name].push(ms);
        console.log('SAMPLE', JSON.stringify({ name, trial: trial + 1, command_complete_ms: ms }));
      } catch (error) {
        failures[name]++;
        process.exitCode = 1;
        console.error('SAMPLE_FAILED', name, trial + 1, error.message);
      }
      await delay(1000);
    }
  }
  for (const [name, values] of Object.entries(samples)) {
    console.log('SUMMARY', JSON.stringify({ name, failures: failures[name], samples: values, median_command_complete_ms: values.length ? median(values) : null }));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
