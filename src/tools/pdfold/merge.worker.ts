/** Web Worker entry: merges off the main thread so the page stays responsive with big files. */
import { serveJobs } from '../../file-queue/job';
import { mergeFiles, type MergeFile } from './merge';

serveJobs<MergeFile[]>((files, onProgress) => mergeFiles(files, { onProgress }));
