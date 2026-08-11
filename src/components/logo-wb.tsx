import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { ViewStyle } from 'react-native';

type LogoWbProps = {
  width?: number;
  height?: number;
  style?: ViewStyle;
};

export const LogoWb: React.FC<LogoWbProps> = ({ width = 44, height, style }) => {
  const resolvedHeight = height ?? width;

  return (
    <Svg width={width} height={resolvedHeight} viewBox="0 0 44 44" fill="none" style={style}>
      <Rect width="44" height="44" fill="#F2F1EC" />
      <Rect
        width="7"
        height="21.26"
        transform="matrix(1 0 -0.156434 0.987688 14.1629 11.5)"
        fill="#08090A"
      />
      <Rect
        width="7"
        height="21.26"
        transform="matrix(1 0 -0.156434 0.987688 26.1629 11.5)"
        fill="#08090A"
      />
    </Svg>
  );
};
