# ARMv6 appliance repair — 2026-10-11

## Deployment boundaries

Runtime is Node 12.22.5 / npm 7.5.2. Do not deploy API master. API source
is carthurs/node-sonos-http-api branch nfc-node12-repair. The checked-in
commit-named vendor archive is deployment input; node_modules is not source.
Private usersettings.json remains local and must never be staged.

The API remains 1.6.9, with discovery 1.7.3 pinned to source commit
de6771b0ec8713ea8028560456cda593c8283372. A guarded postinstall applies exactly
the two SOAP Buffer changes, verifies the whole file, and is idempotent.
Discovery 1.8.0 was rejected because its HTTP agent breaks HTTPS on Node 12.
The Buffer replacements produce identical SOAP bytes on Node 12: they remove
deprecated APIs, but their causal connection to the original HTTP 500 is unproven.

## Install and recovery

Keep package-lock.json and the vendor archive together. On a *fresh replacement
checkout*, with Node 12 / npm 7 and ARMv6 compiler, Python, PC/SC headers and
native-build prerequisites available, use `HUSKY=0 npm ci`. This is slow and
removes node_modules; never run it as an exploratory repair on the live app.
An x86 clean-install test with scripts disabled validates resolution, not the
ARMv6 native build. If scripts are disabled, run the API patch verifier and
rebuild @pokusew/pcsclite on the Pi before claiming an install is usable.

Verify the resolved discovery from inside the API, not a top-level copy:

```
node -e 'const p=require("path");const root=p.resolve("node_modules/sonos-http-api");const f=require.resolve("sonos-discovery/package.json",{paths:[root]});console.log(f,require(f).version)'
node node_modules/sonos-http-api/scripts/patch-sonos-discovery.js
```

The previous working package, private configuration, source changes, original
PM2 dump, and interrupted-install debris were preserved in the mode-700
/home/chris/sonos-repair-20261011-G6PIJ7 directory. The separate
/home/chris/sonos-http-api-chrisold-backup was not touched. Extraneous installed
packages were moved to the backup, not erased. Do not casually delete backups.
The final API artifact is sonos-http-api-1.6.9-node12-b655cf0.tgz, SHA-256
9a1e3fceefff8732f586ebd53840707254b3f87ab2304ac30be6b4e4a576442c.
Fresh npm 7 resolution verified API 1.6.9, discovery 1.7.3, AWS 2.1046.0,
HTML entities 1.2.1 and Fuse 6.4.1, with no production Node 12 engine mismatch.

## Startup

PM2 5.1.2 runs two independent direct `/usr/bin/node` processes from
ecosystem.config.json. Its `interpreter: none` avoids PM2's incompatible ESM
loader on Node 12. NFC waits up to 180 seconds for the configured Sonos room's
state endpoint before loading the reader app. Both processes have a 5-second
restart delay and a 10-unstable-restart limit. Reader failure no longer kills
the API. `npm run start-all` remains a foreground diagnostic entrypoint with
direct Node children and the readiness gate.

After validated startup: `pm2 start ecosystem.config.json`, inspect the process
list, remove only obsolete stopped entries, and `pm2 save`. Do not save a
broken restart loop. Existing pm2-chris.service is the boot mechanism; verify
its saved dump and reboot behavior separately. PM2 timestamps plus the NFC
readiness log's uptime permit monotonic boot analysis.
The final foreground entrypoint was tested for 120 seconds with no tag present:
invoked 13:37:15 UTC, NFC gate started 13:38:01.741, API listener 13:38:24.910,
room ready 13:38:41.162, then the ACS reader attached. The planned timeout sent
SIGINT and both children exited; port 5005 was closed. Thus this diagnostic
npm/concurrently path took about 85 seconds to room readiness, of which about
46 seconds preceded the Node readiness gate. PM2 bypasses those wrappers.
With final PM2 startup, NFC gate started 13:41:24.515 UTC, the room was ready
45.789 seconds later, and the reader attached at 13:42:16. A targeted NFC
SIGTERM recovery test changed PID 3923 to 3992 while API PID 3922 stayed alive;
the readiness check took 1.164 seconds and the reader reattached. The original
TV configuration hash was restored exactly and no final TV playback was sent.
The saved PM2 dump contains only the API and NFC apps, both online; the existing
pm2-chris.service is enabled. A user-initiated reboot subsequently passed:
both direct Node processes were restored automatically, with zero restarts.
Boot timings (seconds since kernel boot): USB 6.590; PM2 unit starts 32.258;
Wi-Fi carrier 45.931; DHCP 55.377; PM2 daemon ready 71.339; two Node processes
restored 73.464 / 73.866; PM2 unit active 83.112; NFC gate begins 96.90;
API listener about 128.75; Sonos room ready 146.63; reader attached about 151.5.
Systemd reports 5.725 s kernel + 78.540 s userspace = 84.266 s. Blame durations
are PM2 50.854 s, dhcpcd 30.082 s, random seed 17.788 s, SD device 10.551 s;
these overlap. The gate waited 49.734 s. The TV state endpoint returned 200,
with the original configuration unchanged and no TV playback requested.
This is reboot-to-readiness, not a controlled cold power-on result. The reported
five-minute original appliance startup was not independently established.

Formatting no longer runs `git add -A`; private settings and vendor archives
are excluded from Prettier. Always stage explicit files and inspect the index.

## Playback and measurement

Spotify tags use the new API `spotify/replace` action. It activates the queue
before normalizing modes, clears it, enqueues, seeks, and plays. Normalizing
modes while TV input was active returned SOAP fault 712, Play mode not supported.
The API now logs fault XML instead of hiding the reason. Manual TV input
switches contaminated early TV measurements; controlled tests used Black Move.
Other service types retain queue clearing and the existing crossfade tolerance.
The final 200 ms inter-record delay is retained; multi-record tags are untested.

Five alternating Black Move benchmark pairs, zero failures in either variant:
baseline median command completion 1591.745 ms; repaired 1286.075 ms, a 305.670 ms
(19.2%) reduction. These include the final 200 ms delay and are not audible
tag-to-play measurements. `node scripts/benchmark-command.js URI BASELINE_PATH`
performs the paired test against an explicitly preserved baseline module.
NFC logs detection, command operation times, and tag-to-command completion.
Two user-confirmed audible Black Move scans logged tag-to-command completion
4936.0 ms and 4509.7 ms while the expensive npm tree audit was running. These
are real scan observations under maintenance load, not controlled idle latency
or exact audible-onset timestamps; do not compare them directly to paired API
benchmarks. The first TV scan before optimization logged 4053 ms, on a different
speaker and under different load. A controlled physical before/after remains open.

AWS SDK 2.1046.0 required 15.8 seconds and 9.3 MB RSS to load in isolation on
this Pi. The API now loads it only for an uncached Polly TTS request. A measured
direct warm API restart reached its listener in about 42.5 seconds; this is not
a cold boot result. Avoid launching repeated npm wrappers on 176 MiB RAM.
A quiet 20.036-second measurement after recovery showed API and NFC each using
zero measured CPU ticks, PM2 about 0.15% CPU. RSS: API 42.7 MiB, NFC 36.5 MiB,
PM2 18.0 MiB. Summed RSS counts shared pages more than once. System available
memory was 65 MiB; swap usage 28 MiB. No valid whole-appliance idle baseline
exists, so no idle before/after improvement is claimed.

Existing boot: kernel 7.161 s + userspace 70.840 s = 78.001 s. PM2 unit 42.656 s,
dhcpcd 30.915 s, random seed 18.928 s, SD device 11.874 s overlap, not additive.
Monotonic journal: USB reader 6.217 s; PM2 unit starts 34.712 s; Wi-Fi carrier
48.050 s; DHCP address 58.640 s; PM2 daemon ready 73.700 s; npm restored 75.660 s;
PM2 unit active 77.370 s; first PC/SC client service around 168 s. This does not
prove full appliance readiness or validate the reported five-minute cold boot.
Wall-clock time jumped during boot; use monotonic journal timestamps.

## Remaining risks

Two pcscd crashes and USB URB -121 errors were observed with ACS driver 1.1.8-1
and PC/SC 1.9.1-1. Voltage throttle flags were zero, but cable/power/USB/driver
stability is not established. No root driver or system service changes were
made. Restart isolation mitigates consequences, not the underlying fault.
No Node upgrade or new-hardware migration was attempted. An ARMv7/ARM64
quad-core Pi-class replacement with at least 1 GiB RAM would materially reduce
startup CPU and memory pressure, but cannot fix invalid Sonos mode requests,
manual input switches, or guarantee reader stability. Rebuild native modules
for the replacement architecture and validate runtime migration separately.
