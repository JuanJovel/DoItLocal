/**
 * Single source of truth for names, taglines and links.
 */
export const siteConfig = {
  /** Full brand name. */
  name: 'DoItLocal Toolkit',
  /** Short brand name used in the header, footer and page titles. */
  shortName: 'DoItLocal',
  tagline: 'Free tools. Private by design. Nothing leaves your device.',
  description:
    'DoItLocal is a growing suite of free, open-source tools that run entirely in your browser. No uploads, no accounts, no tracking.',
  /** Public GitHub repository. */
  githubUrl: 'https://github.com/JuanJovel/DoItLocal',
  /**
   * Public URL of the deployed site, including any sub-path and a trailing slash.
   * Used for canonical links, Open Graph tags and the sitemap.
   */
  siteUrl: 'https://juanjovel.github.io/DoItLocal/',
  license: 'MIT',
  keywords: [
    'free private PDF tools',
    'no upload',
    'offline PDF tools',
    'privacy-first',
    'open source',
  ],
  /** Page background (deep carbon black), used for the manifest and browser UI color. */
  themeColor: '#070c08',
  /** Shown in the FAQ ("How is this funded/maintained?"). */
  fundingNote:
    'DoItLocal is a volunteer-run open-source project. Because every tool runs in your browser, there are no servers to pay for beyond static file hosting, so there are no ads, no paywalls and no data to sell. If it saves you time, the best support is starring the repo, reporting bugs or contributing a tool.',
} as const;

export type SiteConfig = typeof siteConfig;
