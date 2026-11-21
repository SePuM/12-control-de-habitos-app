import React, { type ReactNode } from "react";
import { TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

type GestoAccesibleProps = {
  etiqueta: string;
  children: ReactNode;
  testID?: string;
  onAlternativa?: () => void;
  onDobleToque?: () => void;
  onPulsacionLarga?: () => void;
};

const sinOperacion = (): void => undefined;

export default function GestoAccesible({
  etiqueta,
  children,
  testID,
  onAlternativa,
  onDobleToque,
  onPulsacionLarga,
}: GestoAccesibleProps) {
  const dobleToque = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(onDobleToque ?? sinOperacion)();
    });

  const pulsacionLarga = Gesture.LongPress()
    .minDuration(500)
    .onEnd(() => {
      runOnJS(onPulsacionLarga ?? sinOperacion)();
    });

  return (
    <GestureDetector gesture={Gesture.Exclusive(dobleToque, pulsacionLarga)}>
      <View>
        <TouchableOpacity
          accessibilityLabel={etiqueta}
          testID={testID}
          onPress={onAlternativa ?? sinOperacion}
          activeOpacity={0.85}
        >
          {children}
        </TouchableOpacity>
      </View>
    </GestureDetector>
  );
}
