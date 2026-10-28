import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * Calm Call logo pieces. Everything is drawn on a 1024 × 1024 canvas,
 * so the layers line up when they are stacked on top of each other.
 */
export const LOGO = {
  green1: '#4E9F70',
  green2: '#2A6B48',
  cream: '#FBF6EF',
  moon: '#F2B45A',
  handset:
    'M111 39Q114 39 120 39Q131 38 147 55Q176 83 199 131Q211 155 210.5 166.5Q210 178 196 197Q186 211 186 217Q188 233 215 267Q231 288 254.5 306Q278 324 295 330Q302 332 305.5 331Q309 330 320 322Q332 313 338 310Q344 307 352 307Q363 306 382 316Q416 333 443 353.5Q470 374 477 387Q481 395 479.5 402Q478 409 470 425Q444 476 405 485Q390 488 372 484Q337 477 282 444Q211 402 151 338Q109 295 83 253Q32 171 32 125Q32 107 39 94Q49 75 73 59Q96 44 111 39Z',
  handsetTransform: 'translate(210 250) scale(1.08) translate(-32 -39)',
  crescent: 'M709.9 142.4A120 120 0 1 0 838.3 282.4A98 98 0 0 1 709.9 142.4Z',
  wave1: 'M262 812C352 766 442 766 512 806S672 846 762 800',
  wave2: 'M352 892C412 860 472 860 522 888S632 916 692 884',
};

type Layer = 'tile' | 'handset' | 'moon' | 'waves';

/** One layer of the logo, so the intro can animate each part on its own. */
export function LogoLayer(props: { layer: Layer; size: number; rounded?: boolean }) {
  const { layer, size } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      {layer === 'tile' && (
        <>
          <Defs>
            <LinearGradient id="calmTile" x1="0" y1="0" x2="0.6" y2="1">
              <Stop offset="0" stopColor={LOGO.green1} />
              <Stop offset="1" stopColor={LOGO.green2} />
            </LinearGradient>
          </Defs>
          <Rect width="1024" height="1024" rx={props.rounded === false ? 0 : 230} fill="url(#calmTile)" />
        </>
      )}
      {layer === 'handset' && (
        <G transform={LOGO.handsetTransform}>
          <Path d={LOGO.handset} fill={LOGO.cream} />
        </G>
      )}
      {layer === 'moon' && <Path d={LOGO.crescent} fill={LOGO.moon} />}
      {layer === 'waves' && (
        <G fill="none" stroke={LOGO.cream} strokeLinecap="round" strokeWidth={32}>
          <Path d={LOGO.wave1} opacity={0.92} />
          <Path d={LOGO.wave2} opacity={0.45} />
        </G>
      )}
    </Svg>
  );
}

/** The whole logo as a rounded tile (used in the Home header). */
export function LogoMark(props: { size: number }) {
  const s = props.size;
  return (
    <Svg width={s} height={s} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="calmMark" x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={LOGO.green1} />
          <Stop offset="1" stopColor={LOGO.green2} />
        </LinearGradient>
      </Defs>
      <Rect width="1024" height="1024" rx="230" fill="url(#calmMark)" />
      <Path d={LOGO.crescent} fill={LOGO.moon} />
      <G transform={LOGO.handsetTransform}>
        <Path d={LOGO.handset} fill={LOGO.cream} />
      </G>
      <G fill="none" stroke={LOGO.cream} strokeLinecap="round" strokeWidth={32}>
        <Path d={LOGO.wave1} opacity={0.92} />
        <Path d={LOGO.wave2} opacity={0.45} />
      </G>
    </Svg>
  );
}
