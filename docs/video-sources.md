# Footage for Shorts and Reels

Where to download nature footage for the "Stories from creation" Shorts,
Reels and TikToks. Each clip must allow editing and posting on social
media. Shorts and Reels are vertical (9:16, 1080×1920), so filter for
**vertical / portrait** clips where the site allows it. A landscape clip can
be cropped to vertical, but you lose about two-thirds of the frame.

## Best first: free to edit, no credit required

| Site | Vertical filter | Licence in short | Good for |
|---|---|---|---|
| **Pexels Videos**: pexels.com/videos | Yes (Orientation → Portrait) | Free to use and edit, also commercially. Don't sell the clip unchanged or suggest the people shown endorse you. | Best overall: sunrises, seeds, birds, rivers, fields, hands, families. Start here. |
| **Pixabay Videos**: pixabay.com/videos | Yes (Orientation → Vertical) | Pixabay Content Licence: free to use and edit. Same "don't resell unchanged" rule. | Large library, many 4K timelapses (flowers opening, clouds, stars). |
| **Mixkit**: mixkit.co/free-stock-video | Yes (vertical category) | Mixkit Stock Video Free Licence | Fewer clips, very polished. |
| **Coverr**: coverr.co | Yes (vertical) | Coverr licence: free, no credit | Calm, cinematic nature and people. |
| **Videezy**: videezy.com | Some | Mixed: "Free licence" clips need credit, "Pro" clips need a subscription. Check each clip. | Extra nature options. |
| **Vecteezy video**: vecteezy.com/free-videos | Yes | Free licence needs credit ("Videos by Vecteezy"), Pro needs a subscription. | Extra nature options. |

## Public domain: no credit required, no logos

| Source | Good for | Note |
|---|---|---|
| **NASA**: images.nasa.gov (Video filter) | Earth from space, the sun, stars, galaxies: strong for "Is someone behind all of this?" | Don't use the NASA logo or suggest NASA endorses the video. |
| **US National Park Service**: nps.gov/media (B-roll) | Landscapes, wildlife, waterfalls, seasons | Public domain unless marked otherwise. |
| **US Fish & Wildlife Service**: on Flickr and Wikimedia Commons | Birds (eagles), animals | Public domain unless marked otherwise. |

## Wikimedia Commons (credit usually required)

commons.wikimedia.org, search with `filetype:video`. The three films in
`youtube-films/` came from here. Each file has its own licence:

- **CC0 / public domain**: use freely.
- **CC BY**: allowed; give the author, licence and link in the caption or description.
- **CC BY-SA**: avoid. The finished video must then carry the same licence.
- **NC / ND**: avoid. They forbid commercial use and edits.

Most Commons video is landscape, so expect to crop it.

## Music and sound

| Source | Licence | Note |
|---|---|---|
| **YouTube Audio Library** (YouTube Studio → Audio Library) | Free for YouTube; some tracks need credit (it says which) | Safest for YouTube Shorts. Can be added in YouTube Studio's editor after upload. |
| **Instagram / TikTok in-app music** | Licensed inside each app | Safest on those apps. Add the music in the app, not to the file. |
| **Pixabay Music**: pixabay.com/music | Pixabay Content Licence | Can trigger a false Content ID claim; Pixabay explains how to clear it. |

Never take music or footage from other people's YouTube, TikTok or
Instagram videos, even short clips.

## Before downloading

- Download the largest vertical version (1080×1920 or 4K).
- Note the clip's page link, author and licence while you download, for the credits.
- No faces in the clip unless the site allows it (Pexels and Pixabay do, but not in a way that suggests the person endorses the message).
- No visible brand logos.
- Prefer clips with slow, steady motion: captions are easier to read over them.

## Ideas that fit the series

The seed (John 12:24), the sun rising (Lamentations 3:22–23), the lost sheep
(Luke 15:4), the eagle and its young (Deuteronomy 32:11), the lilies of the
field (Matthew 6:28), the vine and the branches (John 15:5), the sparrow
(Matthew 10:29), the stars (Psalm 19:1), seedtime and harvest
(Genesis 8:22), the butterfly from the cocoon (2 Corinthians 5:17).

## How the website shows them

The home page's "Stories from creation" shows the channel's three
most-liked videos, in order of likes (ties: views, then newest). Shorts
appear upright, side by side, and as a swipeable row on phones. See
`src/lib/site/youtube.ts`:

- **Without an API key** the ranking uses YouTube's public channel feed, which only lists the 15 newest uploads.
- **With `YOUTUBE_API_KEY`** (a free YouTube Data API v3 key, set with `wrangler secret put YOUTUBE_API_KEY`) every upload on the channel is ranked.
- **`FEATURED_VIDEO_IDS`** picks videos by hand instead.

The page refreshes the list about once an hour.
