# KapsStrike recorded sound sources

All included recordings are released under CC0 1.0 Universal. These are independently licensed recordings, not extracted Counter-Strike assets.

## Firearm recordings — The Free Firearm Sound Library

Ben Jaszczak, Brian Nelson, Kevin Heras and Matthew Nanney.
Original: https://opengameart.org/content/the-free-firearm-sound-library
Mirror and original CC0 text: https://github.com/buddingmonkey/FreeFirearmsSFXLibrary

`guns.mp3` contains cropped single attacks from the prepared recordings:

- rifle: AK-47 / C_28P.wav
- carbine: AR-15 / D_24P.wav
- pistol: 1911 / A_34P.wav
- smg: Carl Gustav M45 / G_20P.wav
- sniper: Tikka / W_24P.wav
- shotgun: Mossberg / N_26P.wav

LMG and the fictional railgun use pitch-adjusted rifle and sniper recordings. They do not represent recordings of those fictional weapons.

## Mechanical reload recordings — Brian MacIntosh (BMacZero)

https://opengameart.org/content/gun-reload-sound-effects — CC0.
`foley.mp3`: clipload1.wav, clipload2.wav, singlebullet1.wav, edited into magazine-out, magazine-in and action cues. These foley stages are scheduled against each in-game weapon's reload duration.

## Footsteps — Kenney, Impact Sounds 1.0

https://kenney.nl/assets/impact-sounds — CC0 (original notice in Kenney-license.txt).
Download mirror: https://github.com/GeorgeQLe/assets-sfx-combat/tree/main/assets/kenney/impact-sounds
`foley.mp3`: footstep_concrete_000..003.ogg, footstep_wood_000..003.ogg, footstep_grass_000..003.ogg. Four alternating variants for each set. Soft/fabric support uses the soft grass recordings.

## Edits and delivery

Each attack starts 8 ms before its first significant transient. Peaks normalized to 0.84; release fades added; mixed down to mono at 24 kHz, and encoded as two 96 kbps MP3 sprites for broad browser decoding. `samples.json` and `audioSamples.ts` hold offsets/durations in decoded seconds. Runtime small pitch variations avoid repeating exactly the same attack. Assets are served locally and loaded once per game audio context. Source recordings are not downloaded at runtime.
