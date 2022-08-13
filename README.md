# 🥏 Disc Golf Analyzer

This is a very simple 🍦js app for connecting to the Strava api through oauth, getting disc golf activites, and trending data on games and "holes".

## Requirements

- had no desire to build a back-end for something so simple, so you need ask me for a secret key @danielmcleod42@gmail.com
- you need a strava account
- Activity Convention: Strava doesn't have a disc golf activity type, so the following requirements are needed to properly pull info
    - log disc golf activities as walks
    - if you want to track holes, add tuples of each hole in the description of your activity ex: (0, 1, -1, 0, 0)
