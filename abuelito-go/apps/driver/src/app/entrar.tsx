import { useState } from "react";
import { KeyboardAvoidingView, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { supabase } from "../lib/supabase";
import { useSesion } from "../lib/sesion";
import { Boton, Campo, colores, estilos } from "../componentes/ui";

export default function Entrar() {
  const { sesion } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (sesion) return <Redirect href="/" />;

  async function entrar() {
    setEnviando(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message.includes("Invalid") ? "Correo o contraseña incorrectos" : "Sin conexión. Intenta de nuevo.");
    setEnviando(false);
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[estilos.pantalla, { justifyContent: "center" }]}>
      <View style={[estilos.contenido, { gap: 16 }]}>
        <Text style={[estilos.titulo, { fontSize: 32 }]}>Abuelito Go</Text>
        <Text style={estilos.suave}>Entra con la cuenta que te dio la oficina.</Text>
        <Campo etiqueta="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Campo etiqueta="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        {error ? <Text style={{ color: colores.error, fontSize: 16 }}>{error}</Text> : null}
        <Boton titulo="Entrar" onPress={entrar} cargando={enviando} deshabilitado={!email || !password} />
      </View>
    </KeyboardAvoidingView>
  );
}
