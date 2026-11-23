// What is made of the file of a flag, as Wikimedia Commons keeps it, so that the game can show it.
//
// A drawing (SVG) stays a drawing wherever it can: it is cleaned of what the program it was made with left
// in it and its numbers are kept to the decimals its size calls for, and it is then drawn next to the
// original to see that nothing changed; when something did, it is cleaned with a lighter hand. What is not a
// drawing (a photograph, or a drawing that is the frame of one), what each device would draw its own way
// (words set in a typeface) and what is heavier than any image of a page should be goes as a picture
// (WebP), no wider than the game shows it.
//
// A drawing that stays one and is heavy is also given a picture, for where a flag is shown small: a list
// of fifty flags then asks for fifty light files, and the drawing is asked for when one of them is looked at.
//
// Used by scripts/data/flags.mjs, which says which files there are; nothing here knows where they come from.

import sharp from 'sharp';
import { optimize } from 'svgo';

/**
 * A drawing heavier than this once cleaned, in bytes, goes as a picture. It is what a large photograph
 * weighs: sent compressed, as a server sends it, such a drawing is about a third of this.
 */
export const SVG_MAX = 750_000;
/** A drawing heavier than this once cleaned, in bytes, is also given a picture for where it is shown small. */
export const LIGHT_FROM = 100_000;
/** How wide a picture is, in px: twice what the game shows a flag at, for the screens that draw two dots to one. */
export const PICTURE = 640;
/** How wide two drawings are compared, in px; and how wide once squinted at, to tell a change from a line that moved a hair. */
const LOOK = 480;
const SQUINT = 120;
/** How far two drawings may be from each other, of 255, and be the same: at any point once squinted at, and on the whole. */
export const SAME = { peak: 24, mean: 2 };

/** The size the root of a drawing gives, in its own units: that of its viewBox or, without one, its width and height. */
export function boxOf(svg) {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? '';
  const box = /\bviewBox\s*=\s*["']\s*[-\d.eE+]+[\s,]+[-\d.eE+]+[\s,]+([\d.eE+]+)[\s,]+([\d.eE+]+)/.exec(root);
  if (box) return [Number(box[1]), Number(box[2])];
  const side = (name) => Number(new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.eE+]+)`).exec(root)?.[1]) || 0;
  return [side('width'), side('height')];
}

/** How many decimals keep a coordinate to one part in three thousand of the longer side: finer than a screen shows a flag. */
export const precisionFor = (side) => Math.max(0, Math.min(4, Math.ceil(Math.log10(3000 / (side > 0 ? side : 1000)))));

/** What a drawing has that makes it something else than a drawing, or one that not every device draws alike. */
export function traits(svg) {
  return {
    /** A photograph inside it: the drawing is its frame. */
    photo: /<image\b/i.test(svg),
    /** Words set in a typeface, which each device would choose for itself. */
    words: /<(text|tspan|textPath|tref)\b/i.test(svg),
  };
}

/** What may not be left in a drawing that the site serves: anything that runs, or that reaches outside. */
const UNSAFE = [
  /<script\b/i,
  /\son[a-z]+\s*=/i,
  /javascript:/i,
  /<foreignObject\b/i,
  /<(iframe|embed|object|audio|video|animate\w*|set|handler|listener)\b/i,
  /(?:href|src)\s*=\s*["']\s*(?!#|data:image\/)/i,
  /url\(\s*["']?\s*(?!#|["']?\s*#)/i,
  /@import/i,
  /<!ENTITY/i,
  /<!DOCTYPE/i,
];
export const unsafe = (svg) => UNSAFE.some((mark) => mark.test(svg));

/** A link to another page: the shapes inside stay, the link goes. */
const unlink = {
  name: 'unlink',
  fn: () => ({
    element: {
      enter: (node) => {
        if (node.name !== 'a') return;
        node.name = 'g';
        for (const name of Object.keys(node.attributes)) if (/^(xlink:.*|href|target|rel|download|ping|type|hreflang|referrerpolicy)$/.test(name)) delete node.attributes[name];
      },
    },
  }),
};

/**
 * What only the program that made the drawing reads: the copy of its own file that Illustrator leaves inside
 * a `foreignObject`, which no browser draws, and anything else that is not of SVG there.
 */
const unforeign = {
  name: 'unforeign',
  fn: () => ({
    element: {
      enter: (node, parent) => {
        if (node.name === 'foreignObject') parent.children = parent.children.filter((child) => child !== node);
      },
    },
  }),
};

/**
 * A drawing cleaned of what the program it was made with left in it, with its numbers kept to `precision`
 * decimals. `gentle` leaves every shape as it is written: only what is not drawn goes. Its size, as its
 * root gives it, is never touched: a drawing whose frame is not that of its viewBox would be drawn otherwise.
 */
export function clean(svg, precision, gentle = false) {
  const always = ['removeScripts', unlink, unforeign];
  const plugins = gentle
    ? ['removeDoctype', 'removeXMLProcInst', 'removeComments', 'removeMetadata', 'removeEditorsNSData', 'cleanupAttrs', 'removeTitle', 'removeDesc', ...always, 'removeUnusedNS']
    : [{ name: 'preset-default' }, 'removeTitle', ...always];
  const out = optimize(svg, { multipass: !gentle, ...(gentle ? {} : { floatPrecision: precision }), plugins }).data;
  // A typeface that the drawing still names, when nothing in it is set in words: it is of no use, and it is a thing to fetch.
  return /<(text|tspan|textPath|tref)\b/i.test(out) ? out : out.replace(/@font-face\s*\{[^}]*\}/gi, '');
}

/** A drawing as so many dots on white: `width` wide and, unless it is said, as high as its own shape makes it. */
export async function drawn(svg, width, height) {
  const buf = Buffer.isBuffer(svg) ? svg : Buffer.from(svg);
  const own = await sharp(buf, { limitInputPixels: false }).metadata();
  if (!own.width || !own.height) throw new Error('A drawing with no size');
  // Drawn at the size asked for, and not at its own and then stretched: a flag three units wide is as sharp as any.
  const density = Math.min(100_000, Math.max(1, (72 * width) / own.width));
  const high = height ?? Math.max(1, Math.round((width * own.height) / own.width));
  const { data } = await sharp(buf, { density, limitInputPixels: false }).resize(width, high, { fit: 'fill' }).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width, height: high };
}

/** How far apart two pictures of the same size are: on the whole, and the most at any point once both are squinted at. */
export async function apart(a, b) {
  let sum = 0;
  for (let i = 0; i < a.data.length; i++) sum += Math.abs(a.data[i] - b.data[i]);
  const small = (img) =>
    sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } })
      .resize(SQUINT, Math.max(1, Math.round((SQUINT * img.height) / img.width)), { fit: 'fill', kernel: 'cubic' })
      .raw()
      .toBuffer();
  const [x, y] = await Promise.all([small(a), small(b)]);
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i] - y[i]));
  return { mean: sum / a.data.length, peak };
}

/**
 * The drawing of a flag made as light as it can be without changing what is seen: cleaned at the precision
 * that its size calls for; when that changes how it is drawn (shapes written small and then enlarged lose
 * more than they should), at a finer one, and at last with every shape left as it is written. Gives the
 * text, how it was got (`how`: `p1` for one decimal, `gentle`, or `as it is` when nothing else drew the
 * same) and whether it was compared with the original (`checked`: not when the original cannot be drawn
 * here, in which case the first cleaning is taken on trust).
 */
export async function lighten(svg) {
  const first = precisionFor(Math.max(...boxOf(svg)));
  let before = null;
  try {
    before = await drawn(svg, LOOK);
  } catch {
    // Nothing to compare with.
  }
  const ways = [...new Set([first, Math.min(first + 2, 5), 6])].map((precision) => ({ how: `p${precision}`, make: () => clean(svg, precision) }));
  ways.push({ how: 'gentle', make: () => clean(svg, 0, true) });
  for (const { how, make } of ways) {
    let text;
    try {
      text = make();
    } catch {
      continue;
    }
    if (!before) return { text, how, checked: false };
    try {
      const far = await apart(before, await drawn(text, LOOK, before.height));
      if (far.peak <= SAME.peak && far.mean <= SAME.mean) return { text, how, checked: true };
    } catch {
      // What cannot be drawn is not what was there.
    }
  }
  return { text: svg, how: 'as it is', checked: false };
}

/**
 * A picture of a flag, no wider than the game needs, in the lighter of the two ways WebP has of keeping
 * one: an exact copy when that is not much heavier, so that flat colours stay flat, and a close one
 * otherwise. A drawing is drawn at that width; a photograph is made smaller, never larger.
 */
export async function picture(source, { svg = false, width = PICTURE } = {}) {
  let from = sharp(source, { limitInputPixels: false });
  if (svg) {
    const own = await from.metadata();
    if (!own.width) throw new Error('A drawing with no size');
    from = sharp(source, { density: Math.min(100_000, Math.max(1, (72 * width) / own.width)), limitInputPixels: false });
  }
  const sized = await from.resize({ width, withoutEnlargement: !svg }).png().toBuffer();
  const [exact, close] = await Promise.all([
    sharp(sized).webp({ lossless: true, effort: 6 }).toBuffer({ resolveWithObject: true }),
    sharp(sized).webp({ quality: 84, alphaQuality: 90, effort: 6, smartSubsample: true }).toBuffer({ resolveWithObject: true }),
  ]);
  const best = exact.data.length <= close.data.length * 1.5 ? exact : close;
  return { body: best.data, w: best.info.width, h: best.info.height, exact: best === exact };
}

/** Whether two files show the same flag: both drawn small, and compared with more leave than two drawings of one file. */
export async function alike(a, b, { svgA = false, svgB = false } = {}) {
  const small = async (source, svg) => {
    let from = sharp(source, { limitInputPixels: false });
    if (svg) {
      const own = await from.metadata();
      from = sharp(source, { density: Math.min(100_000, Math.max(1, (72 * 96) / own.width)), limitInputPixels: false });
    }
    return from.resize(48, 32, { fit: 'fill' }).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer();
  };
  const [x, y] = await Promise.all([small(a, svgA), small(b, svgB)]);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i]);
  return sum / x.length;
}
