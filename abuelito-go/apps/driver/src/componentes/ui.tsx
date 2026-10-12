// Piezas de interfaz con botones grandes, pensadas para usarse de pie y con prisa.
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

export const colores = {
  fondo: "#f2f4f7",
  tarjeta: "#ffffff",
  texto: "#101828",
  suave: "#667085",
  borde: "#d0d5dd",
  primario: "#0b63ce",
  exito: "#12805c",
  aviso: "#b54708",
  error: "#c01048",
};

export const colorEstado: Record<string, string> = {
  pendiente: colores.primario,
  entregada: colores.exito,
  parcial: colores.aviso,
  no_entregada: colores.error,
};

export function Boton({
  titulo,
  onPress,
  tipo = "primario",
  deshabilitado,
  cargando,
}: {
  titulo: string;
  onPress: () => void;
  tipo?: "primario" | "secundario" | "peligro" | "exito";
  deshabilitado?: boolean;
  cargando?: boolean;
}) {
  const fondo = { primario: colores.primario, secundario: colores.tarjeta, peligro: colores.error, exito: colores.exito }[tipo];
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado || cargando}
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: fondo, opacity: deshabilitado ? 0.45 : pressed ? 0.8 : 1 },
        tipo === "secundario" && { borderWidth: 1, borderColor: colores.borde },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={tipo === "secundario" ? colores.texto : "#fff"} />
      ) : (
        <Text style={[estilos.botonTexto, tipo === "secundario" && { color: colores.texto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Tarjeta({ children, borde }: { children: ReactNode; borde?: string }) {
  return <View style={[estilos.tarjeta, borde ? { borderLeftWidth: 5, borderLeftColor: borde } : null]}>{children}</View>;
}

export function Etiqueta({ texto, color }: { texto: string; color: string }) {
  return (
    <View style={[estilos.etiqueta, { backgroundColor: color + "22" }]}>
      <Text style={[estilos.etiquetaTexto, { color }]}>{texto}</Text>
    </View>
  );
}

export function Campo({ etiqueta, ...props }: TextInputProps & { etiqueta: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={estilos.etiquetaCampo}>{etiqueta}</Text>
      <TextInput placeholderTextColor={colores.suave} style={estilos.input} {...props} />
    </View>
  );
}

export function Opciones<T extends string>({
  valor,
  opciones,
  onCambio,
}: {
  valor: T | null;
  opciones: { valor: T; etiqueta: string; color?: string }[];
  onCambio: (v: T) => void;
}) {
  return (
    <View style={estilos.opciones}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        const color = o.color ?? colores.primario;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onCambio(o.valor)}
            style={[estilos.opcion, activo && { backgroundColor: color, borderColor: color }]}
          >
            <Text style={[estilos.opcionTexto, activo && { color: "#fff" }]}>{o.etiqueta}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, gap: 12, paddingBottom: 48 },
  boton: { minHeight: 56, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  botonTexto: { color: "#fff", fontSize: 18, fontWeight: "700" },
  tarjeta: { backgroundColor: colores.tarjeta, borderRadius: 12, padding: 16, gap: 6, borderWidth: 1, borderColor: "#eaecf0" },
  titulo: { fontSize: 22, fontWeight: "800", color: colores.texto },
  subtitulo: { fontSize: 17, fontWeight: "700", color: colores.texto },
  texto: { fontSize: 16, color: colores.texto },
  suave: { fontSize: 14, color: colores.suave },
  etiqueta: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  etiquetaTexto: { fontSize: 13, fontWeight: "700" },
  etiquetaCampo: { fontSize: 14, color: colores.suave, fontWeight: "600" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 52,
    fontSize: 18,
    color: colores.texto,
  },
  opciones: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opcion: { borderWidth: 1, borderColor: colores.borde, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: "#fff" },
  opcionTexto: { fontSize: 16, fontWeight: "600", color: colores.texto },
  fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  aviso: { backgroundColor: "#fffaeb", borderColor: "#fedf89", borderWidth: 1, borderRadius: 10, padding: 12 },
});
