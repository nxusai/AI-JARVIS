// Panel de firma: el cliente firma con el dedo y se guarda como SVG (ligero para subir sin buena señal).
import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colores } from "./ui";

export function Firma({ onCambio }: { onCambio: (svg: string | null) => void }) {
  const [trazos, setTrazos] = useState<string[]>([]);
  const trazosRef = useRef<string[]>([]);
  // El trazo en curso se acumula en la ref (el PanResponder no ve estado nuevo) y se copia al estado para dibujarlo.
  const acumulado = useRef("");
  const [actual, setActual] = useState("");
  const tamano = useRef({ ancho: 300, alto: 180 });
  // El PanResponder se crea una vez; con la referencia siempre llama al onCambio vigente.
  const avisar = useRef(onCambio);
  useEffect(() => {
    avisar.current = onCambio;
  }, [onCambio]);

  const exportar = (lista: string[]) => {
    if (lista.length === 0) return avisar.current(null);
    const { ancho, alto } = tamano.current;
    const paths = lista.map((d) => `<path d="${d}" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    avisar.current(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(ancho)} ${Math.round(alto)}">${paths}</svg>`);
  };

  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Evita que el ScrollView se lleve el gesto mientras firman.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        acumulado.current = `M${x.toFixed(1)} ${y.toFixed(1)}`;
        setActual(acumulado.current);
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        acumulado.current += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
        setActual(acumulado.current);
      },
      onPanResponderRelease: () => {
        const trazo = acumulado.current;
        acumulado.current = "";
        setActual("");
        const lista = [...trazosRef.current, trazo];
        trazosRef.current = lista;
        setTrazos(lista);
        exportar(lista);
      },
    }),
  );

  const medir = (e: LayoutChangeEvent) => {
    tamano.current = { ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height };
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={estilos.lienzo} onLayout={medir} {...responder.panHandlers}>
        <Svg width="100%" height="100%">
          {[...trazos, actual].filter(Boolean).map((d, i) => (
            <Path key={i} d={d} stroke="#000" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
        {trazos.length === 0 && !actual && <Text style={estilos.ayuda}>Firme aquí</Text>}
      </View>
      <Pressable
        onPress={() => {
          trazosRef.current = [];
          setTrazos([]);
          exportar([]);
        }}
      >
        <Text style={{ color: colores.primario, fontSize: 15 }}>Borrar firma</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  lienzo: { height: 180, backgroundColor: "#fff", borderWidth: 1, borderColor: colores.borde, borderRadius: 12, overflow: "hidden" },
  ayuda: { position: "absolute", alignSelf: "center", top: 78, color: colores.suave, fontSize: 16 },
});
