import { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Güçlü ease-out: basma anında tepki hemen görünür. */
const PRESS_TRANSITION = {
  transitionProperty: 'transform',
  transitionDuration: 120,
  transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
} as const;

export interface ScalePressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle> | ((pressed: boolean) => StyleProp<ViewStyle>);
  /** Basılıyken ölçek. Buton ve çipler için 0.97, büyük kartlar için 0.98. */
  pressedScale?: number;
}

/**
 * Parmak değdiği anda hafifçe küçülen dokunulabilir alan. Geri bildirim bırakınca değil basınca
 * başlar (gecikmiş hissettirmez), animasyon UI thread'inde çalışır. Sistemde "hareketi azalt"
 * açıksa ölçek uygulanmaz; renk/opaklık değişimi yine görünür.
 */
export function ScalePressable({ style, pressedScale = 0.97, onPressIn, onPressOut, pressRetentionOffset = 16, ...rest }: ScalePressableProps) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const resolved = typeof style === 'function' ? style(pressed) : style;
  return (
    <AnimatedPressable
      {...rest}
      pressRetentionOffset={pressRetentionOffset}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[resolved, PRESS_TRANSITION, { transform: [{ scale: pressed && !reduced ? pressedScale : 1 }] }]}
    />
  );
}
