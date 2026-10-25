import { createMDX } from 'fumadocs-mdx/next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const withMDX = createMDX();

// GitHub Pages serves this repo under /<repo-name>, set by the deploy workflow
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

/** @type {(phase: string) => import('next').NextConfig} */
const config = (phase) => ({
  // Static export only for builds: in dev, `output: 'export'` turns every
  // unknown path (e.g. /favicon.ico) into a generateStaticParams error instead of a 404
  output: phase === PHASE_DEVELOPMENT_SERVER ? undefined : 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
});

export default (phase) => withMDX(config(phase));
