import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
} from 'react-native-svg';

interface Props {
  size?: number;
}

export default function DelphiAvatar({ size = 36 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Ellipse cx="50" cy="55" rx="34" ry="30" fill="#0F0F0F" />
      <Polygon points="20,38 26,16 38,32" fill="#0F0F0F" />
      <Polygon points="62,32 74,16 80,38" fill="#0F0F0F" />
      <Polygon points="25,32 28,21 33,31" fill="#FF8FA8" />
      <Polygon points="67,31 72,21 75,32" fill="#FF8FA8" />
      <Path
        d="M 30 58 Q 26 80 50 82 Q 74 80 70 58 Q 60 56 50 63 Q 40 56 30 58 Z"
        fill="#FFFFFF"
      />
      <Ellipse cx="40" cy="52" rx="4.6" ry="5.6" fill="#00E875" />
      <Ellipse cx="60" cy="52" rx="4.6" ry="5.6" fill="#00E875" />
      <Ellipse cx="40" cy="52" rx="1.2" ry="4.5" fill="#050505" />
      <Ellipse cx="60" cy="52" rx="1.2" ry="4.5" fill="#050505" />
      <Circle cx="41.6" cy="50.4" r="0.9" fill="#FFFFFF" />
      <Circle cx="61.6" cy="50.4" r="0.9" fill="#FFFFFF" />
      <Path d="M 47 64 L 53 64 L 50 68 Z" fill="#FF8FA8" />
      <Path
        d="M 50 68 Q 50 72 46 72"
        stroke="#0F0F0F"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M 50 68 Q 50 72 54 72"
        stroke="#0F0F0F"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
      />
      <G stroke="#0F0F0F" strokeWidth="0.55" strokeLinecap="round">
        <Line x1="34" y1="66" x2="20" y2="64" />
        <Line x1="34" y1="69" x2="20" y2="70" />
        <Line x1="66" y1="66" x2="80" y2="64" />
        <Line x1="66" y1="69" x2="80" y2="70" />
      </G>
    </Svg>
  );
}
