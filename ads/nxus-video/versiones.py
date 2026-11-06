# Arma el plan de cada versión (A, B, C): duración del gancho, frases con su tiempo y duración total.
import json, sys
K = 1.07   # la voz va 7% más ágil, sin cambiar el tono
GANCHOS = {
  'A': ([(0, 2.18, 'Son las 11:48 de la noche.'), (2.77, 4.03, 'Tu negocio está cerrado…'), (4.62, 6.65, 'y tus clientes te siguen escribiendo.')], 6.78),
  'B': ([(0, 3.34, 'Este empleado atiende a tus clientes a las 3 de la mañana…'), (3.82, 5.44, 'y nunca pide horas extra.')], 5.57),
  'C': ([(0, 2.26, '¿Tienes un restaurante o una empresa?'), (2.89, 4.50, 'Esto te está costando dinero.')], 4.62),
}
CUERPO = [(0, 1.47, 'Mensajes sin contestar,'), (1.83, 5.17, 'reservas que se pierden y clientes que se van con la competencia.'),
  (5.64, 6.59, 'Con Nexus AI,'), (6.80, 9.85, 'una inteligencia artificial atiende a tus clientes al instante,'),
  (10.05, 11.32, 'las 24 horas,'), (11.57, 13.62, 'por WhatsApp, Instagram y teléfono.'),
  (13.96, 17.57, 'Agenda, da seguimiento y te deja las ventas listas para cerrar.'),
  (17.99, 20.89, 'Además, software a la medida y marketing que vende,'),
  (21.14, 23.87, 'para restaurantes y empresas que quieren crecer.'),
  (25.05, 27.75, 'Agenda tu diagnóstico gratis de 30 minutos.')]
CUERPO_FIN = 27.75
plan = {}
for g, (fr, fin) in GANCHOS.items():
    H = round(fin / K, 3)
    frases = [{'a': round(a / K, 3), 'b': round(b / K, 3), 'txt': t} for a, b, t in fr]
    frases += [{'a': round(H + a / K, 3), 'b': round(H + b / K, 3), 'txt': t} for a, b, t in CUERPO]
    plan[g] = {'gancho': g, 'H': H, 'T': round(H + CUERPO_FIN / K + 1.8, 2), 'frases': frases, 'ganchoFin': fin}
json.dump(plan, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print({g: (p['H'], p['T']) for g, p in plan.items()})
