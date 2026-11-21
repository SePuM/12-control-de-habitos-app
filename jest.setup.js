global.__eventosGestos = { toque: [], pulsacionLarga: [] };

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");

  const crearGesto = (tipo) => {
    const gesto = {
      numberOfTaps: jest.fn(),
      minDuration: jest.fn(),
      onEnd: jest.fn(),
    };
    gesto.numberOfTaps.mockReturnValue(gesto);
    gesto.minDuration.mockReturnValue(gesto);
    gesto.onEnd.mockImplementation((callback) => {
      global.__eventosGestos[tipo].push(callback);
      return gesto;
    });
    return gesto;
  };

  return {
    GestureHandlerRootView: ({ children }) =>
      React.createElement(View, { testID: "gesture-root" }, children),
    GestureDetector: ({ children }) =>
      React.createElement(View, { testID: "gesture-detector" }, children),
    Gesture: {
      Exclusive: jest.fn((...gestos) => ({ gestos })),
      Tap: jest.fn(() => crearGesto("toque")),
      LongPress: jest.fn(() => crearGesto("pulsacionLarga")),
    },
  };
});

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");

  return {
    View,
    runOnJS: (funcion) => funcion,
    useAnimatedStyle: (fn) => fn(),
    useSharedValue: (valor) => ({ value: valor }),
    withTiming: (valor) => valor,
  };
});

beforeEach(() => {
  global.__eventosGestos.toque = [];
  global.__eventosGestos.pulsacionLarga = [];
});
