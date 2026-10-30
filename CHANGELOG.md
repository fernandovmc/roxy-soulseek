# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Search results are grouped into one row per song and ranked by relevance and popularity. Alternate versions (live, remix, acoustic, karaoke, covers, tributes) rank lower unless the query asks for them.
- The search detail line shows bit depth and sample rate (for example `FLAC 24/96`) and the number of peers sharing each song.
- Download race: a track is requested from up to three peers with the same format and resolution, and the first completed download is played.
- Prefetch of the next two queue entries while a track is playing.
- Saved tracks (heart button) in a new **Músicas** tab.
- Recently played tracks (last 50) in a new **Recentes** tab, with a button to clear the history.
- A 5 GB download cache that removes the least recently played files that are neither saved nor in a playlist.
- Import of public Spotify playlists and albums by link, without signing in (up to 100 tracks per link).

### Changed

- Within a song, playback prefers lossless files, then peers with a free upload slot, then higher resolution, then upload speed.
- Searches run one at a time, because slskd rejects concurrent searches with HTTP 429.
- The signed-in Spotify import button is now labeled **Minhas playlists do Spotify**.
- Download status messages name the peer serving the file and the position in its upload queue.

### Fixed

- Pressing play, the space bar, or a media key while a new track was downloading resumed the previous track.

## [0.4.0]

- Baseline release imported from the original repository.
