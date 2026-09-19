var e=`Analiza el código respecto a la aplicación de principios SOLID y prácticas de seguridad en el mismo.
Identifica únicamente problemas concretos, justificables y accionables.
Prioriza vulnerabilidades, errores de diseño, riesgos de mantenimiento y defectos funcionales.
No inventes contexto que no esté presente en el código o en la configuración.
Cada propuesta debe referirse a una línea concreta que contenga o provoque el problema.
No repitas la misma observación en varias líneas: si un problema afecta a muchas líneas, informa solo de la línea más representativa.
Si no existe un problema concreto, devuelve una lista suggestions vacía.
Vincula cada hallazgo al fichero y línea exactos.`,t=`CONTRATO OBLIGATORIO. Responde exclusivamente con un objeto JSON válido, sin markdown ni texto adicional:
{
  "suggestions": [
    {
      "id": "string",
      "filePath": "string",
      "line": 1,
      "severity": "baja | media | alta",
      "category": "solid | security | quality",
      "message": "string",
      "recommendation": "string"
    }
  ]
}
Reglas del contrato: suggestions debe ser siempre un array; line debe ser un número entero; filePath debe coincidir con el fichero analizado; no incluyas propiedades adicionales.`,n=`codereview-review-prompts`;function r(){let t=localStorage.getItem(n);if(!t)return{reviewInstructions:e};try{let n=JSON.parse(t);return{reviewInstructions:typeof n.reviewInstructions==`string`&&n.reviewInstructions.trim()?n.reviewInstructions:e}}catch{return{reviewInstructions:e}}}function i(e){if(!e.reviewInstructions.trim())throw Error(`Las instrucciones de revisión no pueden estar vacías.`);localStorage.setItem(n,JSON.stringify({reviewInstructions:e.reviewInstructions.trim()}))}export{t as n,i as r,r as t};