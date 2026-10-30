import type { ToolDefinition } from '../types';

/**
 * ReelBack: play a video backwards, with ffmpeg running in the browser (ffmpeg.wasm).
 * The page module is imported lazily, and ffmpeg itself (about 30 MB) only once a video is picked.
 */
export const reelBack: ToolDefinition = {
  id: 'reelback',
  slug: 'reelback',
  name: 'ReelBack',
  seoTitle: 'Reverse a Video Online, Free and No Upload | ReelBack',
  tagline: 'Play any video backwards. Free. Private.',
  description:
    'Reverse a video online, free. ReelBack plays your clip backwards, sound included, and saves it as an MP4. It runs ffmpeg in your browser, so nothing is uploaded.',
  guide: {
    title: 'How to reverse a video',
    steps: [
      'Drop a video on the page, or click "Choose a video". It is read on your device; nothing is uploaded.',
      'Pick the size of the reversed video, and whether the sound should play backwards too or be removed.',
      'Click "Reverse video". When it is done, watch the result on the page and download it as an MP4.',
    ],
  },
  faq: [
    {
      question: 'Which videos can I reverse?',
      answer:
        'Most videos from phones, cameras and screen recorders: MP4, MOV, WebM, MKV, AVI and more, up to 20 minutes long. The reversed video is saved as an MP4 that plays everywhere.',
    },
    {
      question: 'How long does it take?',
      answer:
        'Your own device does the work, so it depends on its speed and the size of the video. A short phone clip usually takes under a minute. Choosing a smaller size is much faster.',
    },
    {
      question: 'Why is the first video slower to start?',
      answer:
        'The first time, your browser downloads ffmpeg, the video engine ReelBack uses (about 30 MB). It is kept for next time, and works offline from then on.',
    },
  ],
  icon: 'rewind',
  status: 'live',
  load: () => import('./page'),
};
