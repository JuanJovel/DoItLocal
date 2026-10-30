/**
 * What the page shows about a picked video: its length and size in pixels, and one small frame.
 *
 * The video is never played on the page. A throwaway <video> reads the details, jumps to one
 * frame, which is drawn onto a canvas, and is released again. So a heavy file (4K, HEVC, a very
 * high bitrate) costs one frame of decoding, not a player that struggles to keep up. A browser
 * that cannot read the file just gets no preview; ReelBack itself reads it with ffmpeg.
 */

export interface VideoPreview {
  /** Seconds, or null when the browser could not tell. */
  duration: number | null;
  /** Picture size as shown, or null when the browser could not tell. */
  size: { width: number; height: number } | null;
  /** One frame, or null when the browser could not decode one. */
  thumbnail: HTMLCanvasElement | null;
}

/** Width of the thumbnail in pixels (it is shown smaller; this keeps it sharp on dense screens). */
const THUMBNAIL_WIDTH = 320;
/** Give up on a frame after this long, so a file the browser stalls on cannot hang the page. */
const TIMEOUT_MS = 6000;

/** Never rejects: `signal` aborting, a timeout or an unreadable file all resolve with less. */
export function previewVideo(file: File, signal?: AbortSignal): Promise<VideoPreview> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const preview: VideoPreview = { duration: null, size: null, thumbnail: null };
    let finished = false;

    function finish(): void {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      video.removeAttribute('src');
      video.load(); // lets the browser drop the decoder right away
      URL.revokeObjectURL(url);
      resolve(preview);
    }

    const timer = setTimeout(finish, TIMEOUT_MS);
    signal?.addEventListener('abort', finish);
    if (signal?.aborted) return finish();

    video.addEventListener('error', finish);
    video.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(video.duration) && video.duration > 0) preview.duration = video.duration;
      if (video.videoWidth > 0) {
        preview.size = { width: video.videoWidth, height: video.videoHeight };
        // A frame from a little way in is more telling than the often black first one. Never
        // seek to 0: a seek that goes nowhere may not fire "seeked".
        video.currentTime = preview.duration ? Math.min(1, preview.duration / 2) : 0.1;
      } else {
        finish(); // no picture (audio only, or a codec this browser cannot decode)
      }
    });
    video.addEventListener('seeked', () => {
      preview.thumbnail = drawFrame(video);
      finish();
    });

    video.src = url;
  });
}

function drawFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  const width = Math.min(THUMBNAIL_WIDTH, video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(1, Math.round((width * video.videoHeight) / video.videoWidth));
  const context = canvas.getContext('2d');
  if (!context) return null;
  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
  return canvas;
}
