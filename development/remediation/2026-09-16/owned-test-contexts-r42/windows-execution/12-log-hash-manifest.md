# r42 log hash manifest (raw outside repository, normalized checked in)

01-baseline-unchanged-two-files.normalized.log
  raw: 01-baseline.raw.log (Git Bash /tmp = %LOCALAPPDATA%Temp42-raw-logs) sha256=2b074b9cf8b6604ee1e459c49f58b03dca6f15040d3360fe63d857f08f2e7086
  normalized sha256=39d5d9eb5c13830a087ae4b5dd85373084c2717d4d4dfca0725e4c81661b2ff1

02-first-failure-old-cleanup.normalized.log
  raw: first-failure.vitest.raw.log sha256=82fd65ecaaca4be278e78970f0c359e5bf3306478f867833cd8c9e712a344b15
  normalized sha256=f68bde463d6091ef6bc1fa3378c0ad5a684d7ecb4d5e52de10880f39a62afab2

03-candidate-full-pass.normalized.log
  raw: positive.vitest.raw.log sha256=067fd805903ca889a12ee5bcea9e41329a1616737beb0eb0c437ec22f0d78363
  normalized sha256=40a5d8c7805da2694ebc18ccb39a21cbf2fcbb65e39e65c5fe7f806e3afaf360

04-nc-no-dispose-negative-control.normalized.log
  raw: nc-no-dispose.vitest.raw.log sha256=6a93ea07fd9412edb63af223ae48541184f91043cbf4b4180c34a556db22275a
  normalized sha256=12e451a05147bc4766b61ba7f71a2aad3474f67bf04c7daf5e624f9a62925f4a

05-nc-no-await-negative-control.normalized.log
  raw: nc-no-await.vitest.raw.log sha256=0677b3ab0955d52b9d2b7409dd22fa845a1f063be74d5475fec8dda1a31475ea
  normalized sha256=9a6396d35c52f1b09e66dd99e64dec48c1023ca75508b16ad901db0972b2e8c9

06-post-nc-restore-positive.normalized.log
  raw: post-nc-restore-positive.vitest.raw.log sha256=067fd805903ca889a12ee5bcea9e41329a1616737beb0eb0c437ec22f0d78363
  normalized sha256=40a5d8c7805da2694ebc18ccb39a21cbf2fcbb65e39e65c5fe7f806e3afaf360

07-gate-typecheck.normalized.log
  raw: gate-typecheck.raw.log sha256=dd54e922a60e83072ccc3283a2c75fe5cfbb4adb462ec7d4be76003db9861c26
  normalized sha256=9a7f3da17c09451e8978453a85e9d914470484c797938140199d0489e09f7e4f

08-gate-lint.normalized.log
  raw: gate-lint2.raw.log sha256=2cbf4b52770023be87f33d1a9e40d429f07807c7f58768f103c3c407c36d2965
  normalized sha256=830eac73c365aec5679f1b2fd85e6e7170c4c924b6d1147ec2ff4fd1d3c62a9c

09-gate-duplication.normalized.log
  raw: gate-duplication.raw.log sha256=a9386be79ed794e8a3e4658a92c9858f8b9526c5e334f2a83b50bf4a2e0dbf0c
  normalized sha256=a9386be79ed794e8a3e4658a92c9858f8b9526c5e334f2a83b50bf4a2e0dbf0c

10-gate-i18n-pairing.normalized.log
  raw: gate-i18n-pairing.raw.log sha256=9d2ecd804df3dcd9b8c0f481cec3dc7b899d4f36e14ee3eac52a9698f8618609
  normalized sha256=9d2ecd804df3dcd9b8c0f481cec3dc7b899d4f36e14ee3eac52a9698f8618609

11-gate-docsync-attempt1.normalized.log
  raw: gate-docsync.raw.log sha256=2c123077c67e318a07d4681c95161460a440b2219c72765b996fd781f7fc735a
  normalized sha256=2c123077c67e318a07d4681c95161460a440b2219c72765b996fd781f7fc735a

## Post-review corrections and additions (2026-09-16, before commit; nothing deleted)

### Correction to the 03 entry raw hash (review item 1)

The 03 entry above recorded `positive.vitest.raw.log` sha256=`067fd805903ca889a12ee5bcea9e41329a1616737beb0eb0c437ec22f0d78363`, which was the file's true content when this manifest was written (the post-NC-restore positive run of the final sequence). That run's bytes survive intact and are also recorded as the 06 entry's raw (`post-nc-restore-positive.vitest.raw.log`, same hash). The shared driver log name `positive.vitest.raw.log` was subsequently overwritten by the 21:43 final-confirmation run, whose bytes are sha256=`ec83e5526bb26a278d70255464c1f0615dae3e9fbbb497de98375b7074bcb72e` (identical to `final-confirmation.vitest.raw.log`, recorded as the 15 entry raw below). The 03 checked-in normalized log derives from the `067fd805` bytes: re-deriving it from `post-nc-restore-positive.vitest.raw.log` reproduces the checked-in file byte-for-byte (verified this session, result below).

- positive.vitest.raw.log (driver-shared name), content as of 21:43 final confirmation: sha256=ec83e5526bb26a278d70255464c1f0615dae3e9fbbb497de98375b7074bcb72e
- post-nc-restore-positive.vitest.raw.log (067fd805 run, source of the 03/06 normalized pair): sha256=067fd805903ca889a12ee5bcea9e41329a1616737beb0eb0c437ec22f0d78363
- 03 re-derivation byte-compare: IDENTICAL

### Added entries 14 and 15 (review item 2)

Both raw files still exist outside the repository; each normalized file below was re-derived from its raw this session and byte-compared with the checked-in copy before recording.

14-gate-docsync-final.normalized.log
  raw: gate-docsync2.raw.log sha256=b129a4979c04fb2eeb375f2a6d76aa2d5c0613c39f3339144a4a5360d209b4e0
  normalized sha256=b129a4979c04fb2eeb375f2a6d76aa2d5c0613c39f3339144a4a5360d209b4e0
  re-derivation byte-compare: IDENTICAL

15-final-candidate-confirmation.normalized.log
  raw: final-confirmation.vitest.raw.log sha256=ec83e5526bb26a278d70255464c1f0615dae3e9fbbb497de98375b7074bcb72e
  normalized sha256=9da0474c27fef1e5cdb28820950fe3592240ea38198f64dc46b0339c29a36c68
  re-derivation byte-compare: IDENTICAL
