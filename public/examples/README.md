# public/examples — static showcase assets (no API needed)

Drop one image + one ready narration audio per example here.
Filenames must match `lib/examples.ts`:

| id                    | image                              | audio                              |
|-----------------------|------------------------------------|------------------------------------|
| diponegoro-submission | diponegoro-submission.jpg          | diponegoro-submission.mp3          |
| self-portrait-affandi | self-portrait-affandi.jpg          | self-portrait-affandi.mp3          |
| bull-hunt             | bull-hunt.jpg                      | bull-hunt.mp3                      |
| perjuangan-kemerdekaan| perjuangan-kemerdekaan.jpg         | perjuangan-kemerdekaan.mp3         |

Source originals live outside the repo (`example_1/2/3/5.*`, git-ignored);
compressed copies are committed here so `/examples` works for every visitor.

Until the `.mp3` is present, the Examples page still plays instantly
using the visitor's on-device voice — still zero API requests.
