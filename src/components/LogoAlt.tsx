import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { ViewStyle } from 'react-native';

type LogoAltProps = {
  width?: number;
  height?: number;
  style?: ViewStyle;
};

export const LogoAlt: React.FC<LogoAltProps> = ({
  width = 44,
  height,
  style,
}) => {
  const resolvedHeight = height ?? width;

  return (
    <Svg
      width={width}
      height={resolvedHeight}
      viewBox="0 0 44 44"
      fill="none"
      style={style}
    >
      <Rect width="44" height="44" fill="#0F1211" />
      <Rect
        width="7"
        height="21.26"
        transform="matrix(1 0 -0.156434 0.987688 14.1629 11.5)"
        fill="#C8F24E"
      />
      <Rect
        width="7"
        height="21.26"
        transform="matrix(1 0 -0.156434 0.987688 26.1629 11.5)"
        fill="#C8F24E"
      />
    </Svg>
  );
};
