/** Web Worker entry: builds the PDF off the main thread so the page stays responsive. */
import { serveJobs } from '../../file-queue/job';
import { convertFiles, type ConvertRequest } from './convert';

serveJobs<ConvertRequest>((request, onProgress) => convertFiles(request, { onProgress }));
